const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'www');
const allowedRootFile = /\.(?:html|js|css|png|jpe?g|webp|svg|ico|json|txt|woff2?)$/i;

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && allowedRootFile.test(entry.name)
      && !['package.json', 'package-lock.json'].includes(entry.name)) {
    fs.copyFileSync(path.join(root, entry.name), path.join(output, entry.name));
  }
}

copyDirectory(path.join(root, 'assets'), path.join(output, 'assets'));

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, destinationPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, destinationPath);
  }
}

const pages = fs.readdirSync(output).filter((name) => name.endsWith('.html'));
if (!pages.includes('index.html') || !pages.includes('login.html')) {
  throw new Error('Mobile web output is missing the homepage or sign-in page.');
}
console.log(`Prepared mobile web app (${pages.length} pages, assets copied).`);
