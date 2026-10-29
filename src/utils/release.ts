import snapshot from '~/data/release.json';
export const release = snapshot;
export const repositoryUrl = `https://github.com/${release.repository}`;
export const releasesUrl = `${repositoryUrl}/releases`;
if (release.repository !== 'getzipzi/zipzi-2d' || !/^[\w.-]+$/.test(release.tag))
  throw new Error('Unreviewed release identity');
if (
  release.url !== `${releasesUrl}/tag/${release.tag}` ||
  !/^[a-f0-9]{40}$/.test(release.review.readmeCommit) ||
  release.private ||
  !release.review.anonymousAccess ||
  !release.review.platforms.includes('macos-arm64') ||
  !release.review.platforms.includes('windows-x86_64') ||
  release.review.windowsStatus !== 'development-prototype'
)
  throw new Error('Release needs review');
for (const asset of release.assets) {
  if (
    !/^[\w.-]+$/.test(asset.name) ||
    asset.url !== `${releasesUrl}/download/${release.tag}/${asset.name}` ||
    !/^sha256:[a-f0-9]{64}$/.test(asset.digest)
  )
    throw new Error('Unreviewed release asset');
}
