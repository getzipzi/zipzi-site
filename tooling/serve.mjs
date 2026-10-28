// Isolated production-artifact test server. No SPA fallback or user browser state.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(new URL('../dist/', import.meta.url).pathname);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(405);
      response.end();
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    if (pathname.split('/').some((part) => part.startsWith('.')) || pathname.includes('\\')) {
      response.writeHead(404);
      response.end();
      return;
    }
    let target = path.resolve(root, '.' + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) throw Error('Invalid path');
    let status = pathname === '/404.html' ? 404 : 200;
    try {
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      if (!(await stat(target)).isFile()) throw Error('Not a file');
    } catch {
      target = path.join(root, '404.html');
      status = 404;
    }
    const bytes = await readFile(target);
    response.writeHead(status, {
      'Content-Type': types[path.extname(target)] ?? 'application/octet-stream',
      'Content-Length': bytes.length,
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(400);
    response.end();
  }
});
server.listen(4173, '127.0.0.1', () => console.log('Static artifact server: http://127.0.0.1:4173'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
