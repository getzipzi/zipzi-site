import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { parse } from 'parse5';
const html = await readFile('dist/index.html', 'utf8');
const links = [];
const text = (node) => (node.childNodes ?? []).map((n) => n.value ?? text(n)).join('');
function walk(n) {
  if (n.tagName === 'a') links.push({ ...Object.fromEntries(n.attrs.map((a) => [a.name, a.value])), text: text(n) });
  for (const child of n.childNodes ?? []) walk(child);
}
walk(parse(html));
const repository = 'https://github.com/getzipzi/zipzi-2d';
const releases = `${repository}/releases`;
// Check visible text, accessible descriptions, metadata and JSON-LD. SVG path
// coordinates can look like version numbers, so do not treat drawing data as copy.
function publicCopy(node) {
  const attrs = Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value]));
  if (['svg', 'style'].includes(node.tagName) || (node.tagName === 'script' && attrs.type !== 'application/ld+json'))
    return '';
  return [
    node.value ?? '',
    ...['content', 'alt', 'aria-label', 'title'].map((key) => attrs[key] ?? ''),
    ...(node.childNodes ?? []).map(publicCopy),
  ].join(' ');
}
test('Public pages retain maturity context without release versions, dates, packages or structured release metadata', async () => {
  assert.ok(html.includes('尚无稳定版'));
  assert.ok(html.includes('Windows 为开发原型'));
  assert.ok(html.includes('桌面验证仍在进行'));
  assert.ok(html.includes('CPython 3.14'));
  assert.ok(html.includes('AI Agent'));
  for (const page of ['dist/index.html', 'dist/404.html']) {
    const output = await readFile(page, 'utf8');
    const copy = publicCopy(parse(output));
    assert.ok(!/\bv?\d+\.\d+\.\d+(?:[-+][\w.-]+)?\b/.test(copy), 'No pinned release version');
    assert.ok(!/\b\d{4}-\d{2}-\d{2}\b/.test(copy), 'No release date');
    assert.doesNotMatch(output, /softwareVersion|datePublished|dateModified|downloadUrl/);
    assert.doesNotMatch(output, /\/releases\/(?:tag|download|latest)(?:\/|["'])/);
    assert.doesNotMatch(output, /\.(?:dmg|zip|whl|tar\.gz)(?:["'\s<]|$)|SHA256SUMS/);
  }
  await assert.rejects(access('src/data/release.json'), { code: 'ENOENT' });
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.scripts['release:check'], undefined, 'No release synchronization dependency');
  for (const obsolete of ['私有 GitHub 仓库', '普通访客目前暂无公共下载', '发布于', 'ad hoc', '尚未通过 Apple 公证'])
    assert.ok(!html.includes(obsolete), `Obsolete claim: ${obsolete}`);
});
test('All download actions use the stable Releases page and the named GitHub icon opens the product', () => {
  const downloads = links.filter((link) => link.text.includes('下载'));
  assert.equal(downloads.length, 3);
  for (const link of downloads) assert.equal(link.href, releases);
  const icon = links.find((link) => link['aria-label'] === 'Zipzi 2D GitHub 项目');
  assert.equal(icon?.href, repository);
  const allowed = new Set([repository, releases, 'https://beian.miit.gov.cn/']);
  for (const link of links.filter((link) => /^https?:/.test(link.href))) assert.ok(allowed.has(link.href), link.href);
});
