import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import yaml from 'js-yaml';
import sharp from 'sharp';
const config = yaml.load(await readFile('src/config.yaml', 'utf8'));
const origin = config.site.site;
const html = await readFile('dist/index.html', 'utf8');
const document = parse(html);
const nodes = [];
function walk(node) {
  if (node.tagName) nodes.push(node);
  for (const child of node.childNodes ?? []) walk(child);
}
walk(document);
const attrs = (node) => Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value]));
const find = (tag, name, value) => nodes.find((n) => n.tagName === tag && attrs(n)[name] === value);
const meta = (name) => attrs(find('meta', 'name', name) ?? find('meta', 'property', name) ?? {}).content;
const text = (node) => (node?.childNodes ?? []).map((n) => n.value ?? text(n)).join('');
const manifest = JSON.parse(await readFile('qa/build-manifest.json', 'utf8'));

test('Generated homepage has complete, consistent, indexable metadata', () => {
  assert.equal(attrs(nodes.find((n) => n.tagName === 'html')).lang, 'zh-CN');
  assert.ok(meta('viewport').includes('width=device-width'));
  assert.equal(text(nodes.find((n) => n.tagName === 'title')), config.metadata.title.default);
  assert.equal(meta('description'), config.metadata.description);
  assert.equal(attrs(find('link', 'rel', 'canonical')).href, origin + '/');
  assert.ok(!(meta('robots') ?? '').includes('noindex'));
  assert.equal(meta('og:url'), origin + '/');
  assert.equal(meta('og:title'), config.metadata.title.default);
  assert.equal(meta('og:description'), config.metadata.description);
  assert.equal(meta('og:image'), origin + '/media/editor-screenshot.jpg');
  assert.equal(meta('twitter:image'), meta('og:image'));
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.ok(meta('twitter:image:alt'));
  assert.equal(nodes.filter((n) => n.tagName === 'h1').length, 1);
});

test('Real robots and well-formed sitemap files contain only canonical public pages', async () => {
  const robots = await readFile('dist/robots.txt', 'utf8');
  assert.match(robots, /^User-agent: \*/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  assert.match(robots, /Disallow: \/jobs/);
  assert.match(robots, /Disallow: \/api\//);
  for (const name of ['sitemap.xml', 'sitemap-0.xml', 'sitemap-index.xml']) {
    const xml = await readFile(`dist/${name}`, 'utf8');
    assert.equal(XMLValidator.validate(xml), true);
    assert.ok(!xml.includes('<html'));
  }
  const parsed = new XMLParser().parse(await readFile('dist/sitemap.xml', 'utf8'));
  const urls = [parsed.urlset.url].flat().map((item) => item.loc);
  assert.deepEqual(urls, [origin + '/']);
  const index = new XMLParser().parse(await readFile('dist/sitemap-index.xml', 'utf8'));
  assert.equal(index.sitemapindex.sitemap.loc, origin + '/sitemap-0.xml');
});

test('Every generated local link, fragment, script, stylesheet, and responsive image resolves', async () => {
  const brandSource = await readFile('src/assets/images/app-icon.svg', 'utf8');
  const ids = nodes.map((n) => attrs(n).id).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
  for (const node of nodes) {
    const a = attrs(node);
    const refs = [a.href, a.src, ...(a.srcset?.split(',').map((v) => v.trim().split(/\s+/)[0]) ?? [])].filter(Boolean);
    for (const ref of refs) {
      if (ref.startsWith('data:image/png;base64,')) {
        assert.equal(node.tagName, 'image', 'Only the reviewed SVG may embed its PNG');
        let ancestor = node.parentNode;
        while (ancestor && attrs(ancestor).id !== 'zipzi-brand-artwork') ancestor = ancestor.parentNode;
        assert.ok(ancestor, 'Embedded image belongs to the brand symbol');
        assert.ok(brandSource.includes(`xlink:href="${ref}"`), 'Embedded bytes match the reviewed SVG');
        continue;
      }
      const url = new URL(ref, origin + '/');
      if (url.origin !== origin) {
        assert.equal(node.tagName, 'a', 'No external runtime resources');
        continue;
      }
      if (url.hash && url.pathname === '/')
        assert.ok(ids.includes(decodeURIComponent(url.hash.slice(1))), `Missing fragment ${ref}`);
      const file = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      assert.ok((await stat('dist' + file)).isFile(), `Missing local asset ${ref}`);
    }
    if (node.tagName === 'img') {
      assert.ok(a.alt !== undefined);
      assert.ok(a.width && a.height);
    }
  }
});

test('Only verified software facts are in structured data; no inherited template marketing', () => {
  const schema = JSON.parse(text(find('script', 'type', 'application/ld+json')));
  assert.equal(schema['@context'], 'https://schema.org');
  const app = schema['@graph'].find((item) => item['@type'] === 'SoftwareApplication');
  assert.equal(app.name, 'Zipzi 2D');
  assert.deepEqual(app.operatingSystem, ['macOS', 'Windows (development prototype)']);
  assert.equal(app.url, origin + '/');
  for (const key of [
    'offers',
    'aggregateRating',
    'review',
    'downloadUrl',
    'softwareVersion',
    'datePublished',
    'dateModified',
  ])
    assert.equal(app[key], undefined);
  for (const marker of [
    'AstroWind',
    'Unsplash',
    'Decap',
    'google-site-verification',
    'G-XXXXXXXXXX',
    '@arthelokyo',
    'localhost',
    'zipzi2d.com',
  ])
    assert.ok(!html.includes(marker), `Template/unready-domain marker ${marker}`);
});

test('Custom 404 is a separate noindex artifact with a working home link', async () => {
  const notFound = await readFile('dist/404.html', 'utf8');
  assert.ok(notFound.includes('noindex'));
  assert.ok(notFound.includes('PAGE NOT FOUND'));
  assert.ok(notFound.includes('href="/"'));
  assert.notEqual(notFound, html);
});

test('All manifest bytes match, source files stay private, and output meets size budgets', async () => {
  for (const file of manifest.files) {
    assert.ok(!/(?:^|\/)(?:qa|scripts|tooling|tests|vendor|node_modules|\.git|\.env)(?:\/|$)/.test(file.path));
    assert.ok(!/\.(?:map|md|ts|zip|gz|key|pem)$/.test(file.path));
    const data = await readFile('dist/' + file.path);
    assert.equal(data.length, file.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256);
  }
  assert.ok(manifest.totalBytes < 1_500_000, 'Entire static build under 1.5 MB');
  assert.ok(
    manifest.files.filter((f) => f.path.endsWith('.js')).reduce((n, f) => n + f.bytes, 0) +
      nodes
        .filter((n) => n.tagName === 'script' && attrs(n).type !== 'application/ld+json')
        .reduce((n, node) => n + Buffer.byteLength(text(node)), 0) <
      15_000,
    'Site JavaScript under 15 KB'
  );
  assert.ok(
    manifest.files.filter((f) => f.path.endsWith('.css')).reduce((n, f) => n + f.bytes, 0) < 50_000,
    'CSS under 50 KB'
  );
});

test('Current product artwork is traceable and all browser/share images use the refreshed assets', async () => {
  for (const [path, hash, width, height] of [
    [
      'src/assets/images/editor-screenshot.png',
      'c053ba12bbb4af898836a318d3f8fddd85d07862637289ccb6b470db677cbee8',
      2204,
      1486,
    ],
  ]) {
    const bytes = await readFile(path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, 'Preserve the reviewed product original');
    const image = await sharp(bytes).metadata();
    assert.equal(image.width, width);
    assert.equal(image.height, height);
  }
  const svg = await readFile('src/assets/images/app-icon.svg', 'utf8');
  assert.equal(
    createHash('sha256').update(svg).digest('hex'),
    '2079d9e1927ea63d6d5a026e6bb6a264b4252cd24b7ec4b09e78be0603fa02dd'
  );
  assert.doesNotMatch(svg, /<\?(?:xml)|<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|\son[a-z]+\s*=/i);
  const svgNodes = [];
  function visitSvg(node) {
    if (node.tagName) svgNodes.push(node);
    for (const child of node.childNodes ?? []) visitSvg(child);
  }
  visitSvg(parse(svg));
  const svgIds = new Set(svgNodes.map((node) => attrs(node).id).filter(Boolean));
  for (const node of svgNodes) {
    assert.ok(!['script', 'foreignObject', 'style', 'animate', 'set'].includes(node.tagName));
    for (const attribute of node.attrs ?? []) {
      assert.ok(!/^on/i.test(attribute.name));
      if (attribute.name === 'href' || attribute.name === 'src') {
        const value = attribute.value;
        if (value.startsWith('#')) assert.ok(svgIds.has(value.slice(1)));
        else {
          assert.equal(node.tagName, 'image');
          assert.match(value, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
          assert.equal(Buffer.from(value.split(',')[1], 'base64').subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        }
      }
      for (const match of attribute.value.matchAll(/url\(([^)]+)\)/g)) {
        assert.ok(match[1].startsWith('#') && svgIds.has(match[1].slice(1)), 'SVG paint references are local');
      }
    }
  }
  const symbol = find('symbol', 'id', 'zipzi-brand-artwork');
  assert.equal(attrs(symbol).viewBox, '0 0 1024 1024');
  // Compare parsed drawing nodes, including the exact embedded PNG, to the
  // reviewed source. Attribute order and irrelevant formatting may differ.
  const drawing = (list) =>
    list.filter((n) => ['path', 'image', 'stop'].includes(n.tagName)).map((n) => ({ tag: n.tagName, attrs: attrs(n) }));
  const symbolNodes = [];
  const collect = (node) => {
    symbolNodes.push(node);
    for (const child of node.childNodes ?? []) collect(child);
  };
  collect(symbol);
  assert.deepEqual(drawing(symbolNodes), drawing(svgNodes));
  assert.equal(nodes.filter((n) => n.tagName === 'use' && attrs(n).href === '#zipzi-brand-artwork').length, 2);
  assert.ok(nodes.some((n) => n.tagName === 'svg' && attrs(n).class === 'brand-icon'));
  await assert.rejects(access('src/assets/images/app-icon.png'), { code: 'ENOENT' });
  assert.ok(manifest.files.every((file) => !file.path.includes('app-icon')));
  assert.doesNotMatch(html, /app-icon\.png|app-icon\.[\w-]+\.webp|zipzi-editor-icon-v3/);
  assert.equal(attrs(find('link', 'rel', 'icon')).href, '/favicon.png');
  assert.equal(attrs(find('link', 'rel', 'apple-touch-icon')).href, '/apple-touch-icon.png');
  for (const [path, width, height] of [
    ['dist/favicon.png', 96, 96],
    ['dist/apple-touch-icon.png', 180, 180],
    ['dist/media/editor-screenshot.jpg', 2204, 1486],
  ]) {
    const image = await sharp(path).metadata();
    assert.equal(image.width, width);
    assert.equal(image.height, height);
  }
  for (const [size, path] of [
    [96, 'dist/favicon.png'],
    [180, 'dist/apple-touch-icon.png'],
  ]) {
    const expected = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    assert.deepEqual(await readFile(path), expected, 'Raster browser icons derive from the correct SVG');
  }
  assert.equal(meta('og:image:width'), '2204');
  assert.equal(meta('og:image:height'), '1486');
  const screenshot = nodes.find((node) => node.tagName === 'img' && attrs(node).alt?.includes('猫模型'));
  assert.ok(screenshot);
  assert.equal(attrs(screenshot).width, '2204');
  assert.equal(attrs(screenshot).height, '1486');
  assert.equal(attrs(screenshot).srcset.split(',').length, 4);
  for (const obsolete of ['editor-modeling', 'favicon.svg', '内置测试场景', '双菱形', '.kasane'])
    assert.ok(!html.includes(obsolete), `Old artwork metadata: ${obsolete}`);
});
