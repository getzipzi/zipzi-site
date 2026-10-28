import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('qa/build-manifest.json', root), 'utf8'));
for (const file of manifest.files) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(file.path) || file.path.split('/').includes('..')) throw Error('Invalid package path');
  const data = await readFile(new URL(`dist/${file.path}`, root));
  if (createHash('sha256').update(data).digest('hex') !== file.sha256) throw Error(`Build changed: ${file.path}`);
}
await rm(new URL('artifact/', root), { recursive: true, force: true });
await mkdir(new URL('artifact/', root), { recursive: true });
await cp(new URL('dist/', root), new URL('artifact/site/', root), { recursive: true });
await writeFile(new URL('artifact/manifest.json', root), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(
  new URL('artifact/SHA256SUMS', root),
  manifest.files.map((f) => `${f.sha256}  site/${f.path}`).join('\n') + '\n'
);
await writeFile(
  new URL('artifact/source.json', root),
  JSON.stringify(
    {
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    },
    null,
    2
  ) + '\n'
);
await writeFile(
  new URL('artifact/DEPLOYMENT.txt', root),
  'Static website files only. Preserve existing jobs/API routes and legacy assets. Install the reviewed Nginx routing change and a protected legacy jobs entry before replacing the homepage. Never delete the shared document root. See docs/deployment.md.\n'
);
console.log(
  `Packaged ${manifest.files.length} checksum-verified site files; no credentials or deployment configuration.`
);
