const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const zlib = require('node:zlib');
const { promisify } = require('node:util');
const gzip = promisify(zlib.gzip);

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function createLocalServer(root, { port = 0, host = '127.0.0.1' } = {}) {
  const absoluteRoot = path.resolve(root);
  const fileCache = new Map();
  const MAX_CACHE_BYTES = 32 * 1024 * 1024;
  let cacheBytes = 0;

  async function readCached(file, stat) {
    const key = `${file}:${stat.size}:${stat.mtimeMs}`;
    let cached = fileCache.get(key);
    if (cached) return cached;

    const body = await fs.promises.readFile(file);
    cached = { body, etag: `"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"` };
    if (cacheBytes + body.length <= MAX_CACHE_BYTES) {
      fileCache.set(key, cached);
      cacheBytes += body.length;
    }
    return cached;
  }

  const server = http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }

    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400).end('Bad request'); return; }
    if (pathname.includes('\0')) { response.writeHead(400).end('Bad request'); return; }
    const file = path.resolve(absoluteRoot, `.${pathname}`);
    if (!file.startsWith(absoluteRoot + path.sep) && file !== absoluteRoot) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    void (async () => {
      let target = file;
      let stat;
      try {
        stat = await fs.promises.stat(file);
        if (stat.isDirectory()) {
          target = path.join(file, 'index.html');
          stat = await fs.promises.stat(target);
        }
      } catch {
        response.writeHead(404).end('Not found');
        return;
      }
      if (!stat.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      const relative = path.relative(absoluteRoot, target);
      if (relative !== 'index.html' && !relative.endsWith('.html') && !relative.startsWith(`assets${path.sep}`)
          && !['CNAME', 'robots.txt', '_headers', '.nojekyll'].includes(relative)) {
        response.writeHead(404).end('Not found');
        return;
      }

      const cached = await readCached(target, stat);
      if (request.headers['if-none-match'] === cached.etag) {
        response.writeHead(304, { ETag: cached.etag }).end();
        return;
      }

      const isAsset = relative.startsWith(`assets${path.sep}`);
      const ext = path.extname(target).toLowerCase();
      const compressible = ['.css', '.html', '.js', '.json', '.svg', '.txt'].includes(ext);
      const headers = {
        'Content-Type': types[ext] || 'application/octet-stream',
        'Cache-Control': isAsset ? 'public, max-age=86400, stale-while-revalidate=604800' : 'no-cache',
        'ETag': cached.etag,
        'X-Content-Type-Options': 'nosniff',
      };

      let body = cached.body;
      if (request.method !== 'HEAD' && compressible && /\bgzip\b/i.test(request.headers['accept-encoding'] || '')) {
        const gzipKey = `${cached.etag}:gzip`;
        let gzipBody = fileCache.get(gzipKey)?.body;
        if (!gzipBody) {
          gzipBody = await gzip(body, { level: 6 });
          if (cacheBytes + gzipBody.length <= MAX_CACHE_BYTES) {
            fileCache.set(gzipKey, { body: gzipBody });
            cacheBytes += gzipBody.length;
          }
        }
        body = gzipBody;
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
      }
      headers['Content-Length'] = body.length;
      response.writeHead(200, headers);
      if (request.method === 'HEAD') response.end();
      else response.end(body);
    })().catch(() => {
      if (!response.headersSent) response.writeHead(500).end('Internal server error');
      else response.destroy();
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

module.exports = { createLocalServer };
