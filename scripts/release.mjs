import {readFile} from 'node:fs/promises';

export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function validateRelease(release) {
  if (!/^getzipzi\/[a-zA-Z0-9_.-]+$/.test(release.repository)) throw Error('Release must belong to getzipzi');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(release.tag)) throw Error('Invalid release tag');
  if (typeof release.private !== 'boolean' || typeof release.prerelease !== 'boolean') throw Error('Missing release visibility or maturity');
  if (!Number.isFinite(Date.parse(release.publishedAt))) throw Error('Invalid publication date');
  const base = `https://github.com/${release.repository}`;
  if (release.url !== `${base}/releases/tag/${release.tag}`) throw Error('Unexpected release URL');
  if (!Array.isArray(release.assets) || !release.assets.length) throw Error('Missing release assets');
  const names = new Set();
  for (const asset of release.assets) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(asset.name) || names.has(asset.name)) throw Error('Invalid or duplicate asset name');
    names.add(asset.name);
    if (asset.url !== `${base}/releases/download/${release.tag}/${asset.name}`) throw Error('Unexpected asset URL');
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || !/^sha256:[a-f0-9]{64}$/.test(asset.digest)) throw Error('Missing asset integrity metadata');
  }
  return release;
}

export async function readRelease() {
  return validateRelease(JSON.parse(await readFile(new URL('../src/release.json', import.meta.url), 'utf8')));
}

export function renderRelease(release) {
  validateRelease(release);
  if (release.review?.platform !== 'macos-arm64' || release.review?.signing !== 'ad-hoc' || release.review?.notarized !== false) {
    throw Error('Review the release platform/signing and update its presentation before publishing');
  }
  const e = escapeHTML;
  const labels = name => name.endsWith('.dmg') ? 'macOS Apple Silicon · DMG' : name.endsWith('-macos-arm64.zip') ? 'macOS Apple Silicon · ZIP' : name.endsWith('-source.tar.gz') ? '源码归档' : name === 'SHA256SUMS' ? 'SHA256 校验文件' : name;
  const assets = release.assets.map(asset => `<li><a href="${e(asset.url)}" rel="noopener noreferrer" target="_blank"><span>${e(labels(asset.name))}</span><span aria-hidden="true">↗</span></a></li>`).join('\n');
  const access = release.private
    ? '发布资源位于私有 GitHub 仓库，仅向已有仓库权限的账号开放。普通访客目前暂无公共下载；下方链接可能显示 404。'
    : '发布资源托管于 GitHub。下载前请阅读发布说明，并核对 SHA256 校验值。';
  return `<div class="release-panel" aria-label="发布资源">
    <p class="release-version">${e(release.tag)} <span>· ${e(release.publishedAt.slice(0,10))} · ${release.prerelease ? '预发布版本' : '已发布版本'}</span></p>
    <p class="release-access">${access}</p>
    <ul class="release-assets">${assets}</ul>
    <a class="text-link" href="${e(release.url)}" target="_blank" rel="noopener noreferrer">阅读此版本发布说明 ↗</a>
    <a class="text-link release-history" href="https://github.com/${e(release.repository)}/releases" target="_blank" rel="noopener noreferrer">查看全部发布 ↗</a>
  </div>`;
}
