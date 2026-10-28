import snapshot from '~/data/release.json';
export const release = snapshot;
const base = `https://github.com/${release.repository}`;
if (!/^getzipzi\/[a-zA-Z0-9_.-]+$/.test(release.repository) || !/^[\w.-]+$/.test(release.tag))
  throw new Error('Unreviewed release identity');
if (
  release.url !== `${base}/releases/tag/${release.tag}` ||
  !release.review ||
  release.review.platform !== 'macos-arm64'
)
  throw new Error('Release needs review');
for (const asset of release.assets) {
  if (
    !/^[\w.-]+$/.test(asset.name) ||
    asset.url !== `${base}/releases/download/${release.tag}/${asset.name}` ||
    !/^sha256:[a-f0-9]{64}$/.test(asset.digest)
  )
    throw new Error('Unreviewed release asset');
}
export const releaseAssets = [...release.assets].sort((a, b) => {
  const rank = (name: string) =>
    name.endsWith('.dmg') ? 0 : name.endsWith('-macos-arm64.zip') ? 1 : name.endsWith('.tar.gz') ? 2 : 3;
  return rank(a.name) - rank(b.name);
});
export const assetLabel = (name: string) =>
  name.endsWith('.dmg')
    ? 'macOS Apple Silicon · DMG'
    : name.endsWith('-macos-arm64.zip')
      ? 'macOS Apple Silicon · ZIP'
      : name.endsWith('.tar.gz')
        ? '源码归档'
        : 'SHA256 校验文件';
