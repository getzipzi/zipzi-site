// Report paths/categories only. Never print matched credential material.
import { execFileSync } from 'node:child_process';
import { readFile, readdir, lstat } from 'node:fs/promises';
const files = new Set(
  execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
);
async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await walk(file);
    else files.add(file);
  }
}
await walk('dist');
await walk('artifact');
const patterns = [
  ['private-key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/],
  ['github-token', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ['cloud-access-key', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ['credential-url', /https?:\/\/[^\s/<>:"']+:[^\s/@<>"']+@/],
];
const issues = [];
let count = 0;
for (const file of files) {
  let info;
  try {
    info = await lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  if (info.isSymbolicLink()) {
    issues.push({ file, category: 'symlink' });
    continue;
  }
  if (!info.isFile()) continue;
  if (
    file
      .split('/')
      .some(
        (part) =>
          /^\.env(?:\.|$)/.test(part) ||
          [
            '.ssh',
            'authorized_keys',
            'known_hosts',
            'id_rsa',
            'id_ed25519',
            'nginx.htpasswd',
            'qa',
            'backup',
            'backups',
            'scripts',
          ].includes(part)
      ) ||
    /\.(?:pem|key|p12|pfx)$/.test(file)
  )
    issues.push({ file, category: 'private-or-operational-path' });
  const data = (await readFile(file)).toString();
  count++;
  for (const [category, pattern] of patterns) if (pattern.test(data)) issues.push({ file, category });
}
if (issues.length) {
  console.error(JSON.stringify(issues, null, 2));
  process.exitCode = 1;
} else
  console.log(
    `Publication audit passed for ${count} source/build/artifact files; no credential patterns or private operational paths.`
  );
