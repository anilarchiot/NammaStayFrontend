const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

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
    const target = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const relative = path.relative(absoluteRoot, target);
    if (relative !== 'index.html' && !relative.endsWith('.html') && !relative.startsWith(`assets${path.sep}`)
        && !['CNAME', 'robots.txt', '_headers', '.nojekyll'].includes(relative)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(target).pipe(response);
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
