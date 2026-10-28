import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import yaml from 'js-yaml';
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
  assert.equal(meta('og:image'), origin + '/media/editor-modeling.png');
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
  const ids = nodes.map((n) => attrs(n).id).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
  for (const node of nodes) {
    const a = attrs(node);
    const refs = [a.href, a.src, ...(a.srcset?.split(',').map((v) => v.trim().split(/\s+/)[0]) ?? [])].filter(Boolean);
    for (const ref of refs) {
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
  assert.equal(app.operatingSystem, 'macOS (Apple Silicon)');
  assert.equal(app.url, origin + '/');
  for (const key of ['offers', 'aggregateRating', 'review', 'downloadUrl']) assert.equal(app[key], undefined);
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
