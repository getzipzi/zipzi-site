import {readFile, writeFile, mkdir, rm, cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root = new URL('../',import.meta.url);
const manifest = JSON.parse(await readFile(new URL('qa/build-manifest.json',root),'utf8'));
for (const file of manifest.files) {
  if (!/^(index\.html|assets\/[a-zA-Z0-9_.-]+)$/.test(file.path)) throw Error('Unexpected package path');
  const data = await readFile(new URL(`dist/${file.path}`,root));
  if (createHash('sha256').update(data).digest('hex') !== file.sha256) throw Error(`Build changed: ${file.path}`);
}
await rm(new URL('artifact/',root),{recursive:true,force:true});
await mkdir(new URL('artifact/',root),{recursive:true});
await cp(new URL('dist/',root),new URL('artifact/site/',root),{recursive:true});
await writeFile(new URL('artifact/manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
await writeFile(new URL('artifact/SHA256SUMS',root),manifest.files.map(f => `${f.sha256}  site/${f.path}`).join('\n')+'\n');
await writeFile(new URL('artifact/DEPLOYMENT.txt',root),'Validated standalone static site. This is NOT a complete replacement for a shared document root. Preserve existing application routes and assets using the environment-specific deployment adapter. See docs/deployment.md in the source commit.\n');
console.log(`Packaged ${manifest.files.length} verified files in artifact/.`);
