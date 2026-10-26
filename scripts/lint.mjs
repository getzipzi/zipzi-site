import {readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
for (const file of (await readdir(new URL('./',import.meta.url))).filter(file => file.endsWith('.mjs') && ['build.mjs','check.mjs','site.test.mjs','release.mjs','release.test.mjs','sync-release.mjs','lint.mjs','package.mjs'].includes(file))) {
  execFileSync(process.execPath,['--check',new URL(file,import.meta.url).pathname],{stdio:'inherit'});
}
execFileSync(process.execPath,['--check',new URL('../src/assets/site.js',import.meta.url).pathname],{stdio:'inherit'});
await import('./check.mjs');
