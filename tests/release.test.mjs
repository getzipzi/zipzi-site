import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
const release = JSON.parse(await readFile('src/data/release.json', 'utf8'));
const html = await readFile('dist/index.html', 'utf8');
const links = [];
const text = (node) => (node.childNodes ?? []).map((n) => n.value ?? text(n)).join('');
function walk(n) {
  if (n.tagName === 'a') links.push({ ...Object.fromEntries(n.attrs.map((a) => [a.name, a.value])), text: text(n) });
  for (const child of n.childNodes ?? []) walk(child);
}
walk(parse(html));
const repository = `https://github.com/${release.repository}`;
const releases = `${repository}/releases`;
test('Generated release copy matches reviewed public Alpha platforms and limitations', () => {
  assert.equal(release.private, false);
  assert.equal(release.review.anonymousAccess, true);
  assert.match(release.review.readmeCommit, /^[a-f0-9]{40}$/);
  assert.equal(release.prerelease, true);
  assert.ok(html.includes(release.tag));
  assert.ok(html.includes('尚无稳定版'));
  assert.ok(html.includes('Windows 为开发原型'));
  assert.ok(html.includes('桌面验证仍在进行'));
  assert.ok(html.includes('CPython 3.14'));
  assert.ok(html.includes('AI Agent'));
  assert.ok(release.assets.some((asset) => asset.name.endsWith('-windows-x86_64.zip')));
  assert.ok(release.assets.some((asset) => asset.name.endsWith('-macos-arm64.dmg')));
  for (const obsolete of [
    '私有 GitHub 仓库',
    '普通访客目前暂无公共下载',
    '没有 Intel Mac 或 Windows',
    'v0.1.0-alpha.1',
    'ad hoc',
    '尚未通过 Apple 公证',
  ])
    assert.ok(!html.includes(obsolete), `Obsolete claim: ${obsolete}`);
});
test('All download actions use the Releases page and the named GitHub icon opens the product', () => {
  const downloads = links.filter((link) => link.text.includes('下载'));
  assert.equal(downloads.length, 3);
  for (const link of downloads) assert.equal(link.href, releases);
  const icon = links.find((link) => link['aria-label'] === 'Zipzi 2D GitHub 项目');
  assert.equal(icon?.href, repository);
  const allowed = new Set([repository, releases, 'https://beian.miit.gov.cn/']);
  for (const link of links.filter((link) => /^https?:/.test(link.href))) assert.ok(allowed.has(link.href), link.href);
  assert.ok(!links.some((link) => /\/releases\/(?:download|tag|latest)\//.test(link.href)));
});
