// Read metadata using the maintainer's existing gh session. Never download binaries.
import {execFileSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {readRelease, validateRelease} from './release.mjs';

const current = await readRelease();
const args = process.argv.slice(2);
if (args.length > 1 || (args[0] && !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(args[0]))) throw Error('Usage: npm run release:check -- [tag]');
const api = endpoint => JSON.parse(execFileSync('gh', ['api', endpoint], {encoding:'utf8', maxBuffer:4*1024*1024}));
const repository = api(`repos/${current.repository}`);
if (repository.full_name !== current.repository) throw Error('Repository changed; review its identity explicitly');
const release = args[0]
  ? api(`repos/${current.repository}/releases/tags/${args[0]}`)
  : api(`repos/${current.repository}/releases?per_page=100`).filter(r => !r.draft && r.published_at).sort((a,b) => Date.parse(b.published_at)-Date.parse(a.published_at))[0];
if (!release || release.draft || !release.published_at) throw Error('No published release found');
const candidate = validateRelease({repository:repository.full_name, private:repository.private, tag:release.tag_name, url:release.html_url, prerelease:release.prerelease, publishedAt:release.published_at, assets:release.assets.map(a => ({name:a.name,url:a.browser_download_url,bytes:a.size,digest:a.digest})), review:null});
await mkdir(new URL('../qa/',import.meta.url),{recursive:true});
await writeFile(new URL('../qa/release-candidate.json',import.meta.url),JSON.stringify(candidate,null,2)+'\n');
console.log(`Prepared ${candidate.repository} ${candidate.tag}; private=${candidate.private}; ${candidate.assets.length} assets.\nReview qa/release-candidate.json against the release notes, set platform/signing review, then explicitly copy it to src/release.json. Production and product releases are unchanged.`);
