import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
const release = JSON.parse(await readFile('src/data/release.json', 'utf8'));
const html = await readFile('dist/index.html', 'utf8');
const links = [];
function walk(n) {
  if (n.tagName === 'a') links.push(Object.fromEntries(n.attrs.map((a) => [a.name, a.value])).href);
  for (const child of n.childNodes ?? []) walk(child);
}
walk(parse(html));
test('Built release section uses reviewed assets and discloses actual private access', () => {
  assert.ok(html.includes(release.tag));
  if (release.private) assert.ok(html.includes('普通访客目前暂无公共下载'));
  assert.ok(html.includes('ad hoc'));
  assert.ok(html.includes('尚未通过 Apple 公证'));
  assert.ok(links.includes(release.url));
  for (const asset of release.assets) assert.ok(links.includes(asset.url));
  assert.ok(!links.some((link) => link.includes('/latest/download/')));
});
test('External navigation is limited to the reviewed release repository and ICP authority', () => {
  const allowed = new Set([
    release.url,
    `https://github.com/${release.repository}/releases`,
    'https://beian.miit.gov.cn/',
    ...release.assets.map((a) => a.url),
  ]);
  for (const link of links.filter((link) => /^https?:/.test(link))) assert.ok(allowed.has(link), link);
});
