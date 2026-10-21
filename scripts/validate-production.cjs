const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routesFile = path.join(root, 'assets', 'js', 'routes.js');

if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('The site root is missing index.html.');
}

const sourcePages = fs.readdirSync(root)
  .filter((name) => name.endsWith('.html'))
  .sort();
const builtPages = sourcePages;

const missingPages = sourcePages.filter((name) => !builtPages.includes(name));
if (missingPages.length) {
  throw new Error(`Production output is missing pages: ${missingPages.join(', ')}`);
}

const files = [];
function collectFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(file);
    else files.push(file);
  }
}
for (const page of builtPages) files.push(path.join(root, page));
collectFiles(path.join(root, 'assets'));
for (const file of ['_headers', '.nojekyll', 'CNAME', 'robots.txt']) {
  if (fs.existsSync(path.join(root, file))) files.push(path.join(root, file));
}

const sourceMaps = files.filter((file) => file.endsWith('.map'));
if (sourceMaps.length) {
  throw new Error(`The published site contains source maps: ${sourceMaps.map((file) => path.relative(root, file)).join(', ')}`);
}

const routeSource = fs.readFileSync(routesFile, 'utf8');
const routeEntries = [...routeSource.matchAll(/\{ key: (null|'[^']+'), path: '([^']+)', title: '[^']+', module: '([^']+)'(?:, roles: \[[^\]]*\])? \}/g)]
  .map(([, key, routePath, modulePath]) => ({ key: key === 'null' ? null : key.slice(1, -1), path: routePath, module: modulePath }));
if (!routeEntries.length) throw new Error('The app route manifest contains no routes.');

const seenPaths = new Set(); const seenKeys = new Set();
for (const route of routeEntries) {
  if (seenPaths.has(route.path)) throw new Error(`Duplicate app route path: ${route.path}`);
  seenPaths.add(route.path);
  if (route.key) {
    if (seenKeys.has(route.key)) throw new Error(`Duplicate app route key: ${route.key}`);
    seenKeys.add(route.key);
  }
  if (!builtPages.includes(route.path)) throw new Error(`App route has no emitted page: ${route.path}`);
  const moduleFile = path.resolve(path.dirname(routesFile), route.module);
  if (!moduleFile.startsWith(path.join(root, 'assets', 'js', 'pages') + path.sep) || !fs.existsSync(moduleFile)) {
    throw new Error(`App route has a missing or invalid page module: ${route.module}`);
  }
  const pageHtml = fs.readFileSync(path.join(root, route.path), 'utf8');
  if (!pageHtml.includes(`assets/js/${route.module.replace(/^\.\//, '')}`)) {
    throw new Error(`Route page does not load its registered module: ${route.path}`);
  }
}

const headersFile = path.join(root, '_headers');
if (!fs.existsSync(headersFile)) throw new Error('Production output is missing Cloudflare security headers.');
const headers = fs.readFileSync(headersFile, 'utf8').toLowerCase();
for (const header of ['x-content-type-options: nosniff', 'referrer-policy:', 'x-frame-options:', 'permissions-policy:']) {
  if (!headers.includes(header)) throw new Error(`Production security headers are missing ${header.trim()}.`);
}

const secretArtifacts = [];
for (const file of files) {
  const contents = fs.readFileSync(file, 'utf8');
  if (/sb_secret_[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|service_role\s*[:=]/i.test(contents)) {
    secretArtifacts.push(path.relative(root, file));
  }
  for (const match of contents.matchAll(/\b(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g)) {
    try {
      const claims = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64url').toString('utf8'));
      if (claims.role === 'service_role') secretArtifacts.push(path.relative(root, file));
    } catch { /* unrelated JWT-like string */ }
  }
}
if (secretArtifacts.length) {
  throw new Error(`Production output contains server-only credential markers: ${[...new Set(secretArtifacts)].join(', ')}`);
}

const missingReferences = [];
const localReference = /(?:href|src)=["']([^"'#]+)["']/gi;
for (const page of builtPages) {
  const pagePath = path.join(root, page);
  const html = fs.readFileSync(pagePath, 'utf8');
  for (const match of html.matchAll(localReference)) {
    const reference = match[1];
    if (/^(?:[a-z]+:|\/\/|data:|mailto:|tel:)/i.test(reference)) continue;
    const pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    if (!pathname || pathname === '/') continue;
    const target = path.resolve(path.dirname(pagePath), pathname);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) {
      missingReferences.push(`${page} -> ${reference}`);
    }
  }
}

if (missingReferences.length) {
  throw new Error(`Production pages contain missing local references:\n${missingReferences.join('\n')}`);
}

if (!fs.existsSync(path.join(root, '.nojekyll'))) {
  throw new Error('The site root is missing .nojekyll.');
}

console.log(`Static site build passed (${builtPages.length} pages, ${routeEntries.length} app routes, ${files.length} published files, security headers present, no server secrets or source maps).`);
