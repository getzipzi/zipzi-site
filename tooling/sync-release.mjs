// Maintainer-only metadata read. Never download or redistribute product binaries.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const current = JSON.parse(await readFile(new URL('../src/data/release.json', import.meta.url), 'utf8'));
const [tag, ...extra] = process.argv.slice(2);
if (extra.length || (tag && !/^[\w.-]+$/.test(tag))) throw Error('Usage: npm run release:check -- [tag]');
const api = (endpoint) => JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8' }));
const repo = api(`repos/${current.repository}`);
if (repo.full_name !== current.repository) throw Error('Repository identity changed');
const release = tag
  ? api(`repos/${repo.full_name}/releases/tags/${tag}`)
  : api(`repos/${repo.full_name}/releases?per_page=100`)
      .filter((r) => !r.draft && r.published_at)
      .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
if (!release || release.draft) throw Error('No published release');
const candidate = {
  repository: repo.full_name,
  private: repo.private,
  tag: release.tag_name,
  url: release.html_url,
  prerelease: release.prerelease,
  publishedAt: release.published_at,
  assets: release.assets.map((a) => ({ name: a.name, url: a.browser_download_url, bytes: a.size, digest: a.digest })),
  review: null,
};
await mkdir(new URL('../qa/', import.meta.url), { recursive: true });
await writeFile(new URL('../qa/release-candidate.json', import.meta.url), JSON.stringify(candidate, null, 2) + '\n');
console.log(
  'Wrote qa/release-candidate.json. Review platform, signing, visibility, links and page copy before explicitly updating src/data/release.json. No automatic release or production update occurred.'
);
