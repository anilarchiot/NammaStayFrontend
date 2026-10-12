const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');

if (!fs.existsSync(output) || !fs.statSync(output).isDirectory()) {
  throw new Error('Production output is missing. Run npm run build first.');
}

const sourcePages = fs.readdirSync(root)
  .filter((name) => name.endsWith('.html'))
  .sort();
const builtPages = fs.readdirSync(output)
  .filter((name) => name.endsWith('.html'))
  .sort();

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
collectFiles(output);

const sourceMaps = files.filter((file) => file.endsWith('.map'));
if (sourceMaps.length) {
  throw new Error(`Production output contains source maps: ${sourceMaps.map((file) => path.relative(output, file)).join(', ')}`);
}

const missingReferences = [];
const localReference = /(?:href|src)=["']([^"'#]+)["']/gi;
for (const page of builtPages) {
  const pagePath = path.join(output, page);
  const html = fs.readFileSync(pagePath, 'utf8');
  for (const match of html.matchAll(localReference)) {
    const reference = match[1];
    if (/^(?:[a-z]+:|\/\/|data:|mailto:|tel:)/i.test(reference)) continue;
    const pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    if (!pathname || pathname === '/') continue;
    const target = path.resolve(path.dirname(pagePath), pathname);
    if (!target.startsWith(output + path.sep) || !fs.existsSync(target)) {
      missingReferences.push(`${page} -> ${reference}`);
    }
  }
}

if (missingReferences.length) {
  throw new Error(`Production pages contain missing local references:\n${missingReferences.join('\n')}`);
}

if (!fs.existsSync(path.join(output, '.nojekyll'))) {
  throw new Error('Production output is missing .nojekyll.');
}

console.log(`Production validation passed (${builtPages.length} pages, ${files.length} files, no source maps or missing local assets).`);
