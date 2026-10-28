import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = new URL('../', import.meta.url);
const files = [];
async function walk(directory, prefix = '') {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name, 'en')
  )) {
    const relative = path.posix.join(prefix, entry.name);
    if (!/^[a-zA-Z0-9_./-]+$/.test(relative) || entry.isSymbolicLink()) throw Error('Unexpected build path');
    if (entry.isDirectory()) await walk(new URL(`${entry.name}/`, directory), relative);
    else {
      const data = await readFile(new URL(entry.name, directory));
      files.push({ path: relative, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
  }
}
await walk(new URL('dist/', root));
await mkdir(new URL('qa/', root), { recursive: true });
await writeFile(
  new URL('qa/build-manifest.json', root),
  JSON.stringify({ files, totalBytes: files.reduce((n, f) => n + f.bytes, 0) }, null, 2) + '\n'
);
console.log(`Verified manifest: ${files.length} files, ${files.reduce((n, f) => n + f.bytes, 0)} bytes.`);
