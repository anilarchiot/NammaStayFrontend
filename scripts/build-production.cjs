const fs = require('node:fs');
const path = require('node:path');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const rootFiles = fs.readdirSync(root, { withFileTypes: true });

if (fs.existsSync(output) && !fs.statSync(output).isDirectory()) {
  throw new Error('Build output path exists and is not a directory: dist');
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

function copyStaticFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

async function copyAssets(sourceDir, destinationDir) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const destination = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await copyAssets(source, destination);
      continue;
    }

    if (!entry.isFile() || /\.map$/i.test(entry.name)) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (extension === '.js' || extension === '.mjs') {
      const result = await minifyJs(fs.readFileSync(source, 'utf8'), {
        ecma: 2022,
        module: true,
        compress: { passes: 2 },
        format: { comments: false },
        sourceMap: false,
      });
      if (result.error) throw result.error;
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, result.code);
    } else if (extension === '.css') {
      const result = new CleanCSS({ level: 2 }).minify(fs.readFileSync(source, 'utf8'));
      if (result.errors.length) throw new Error(`${source}: ${result.errors.join('; ')}`);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, result.styles);
    } else {
      copyStaticFile(source, destination);
    }
  }
}

async function build() {
  for (const entry of rootFiles) {
    if (!entry.isFile()) continue;
    const source = path.join(root, entry.name);
    const destination = path.join(output, entry.name);
    const extension = path.extname(entry.name).toLowerCase();

    if (extension === '.html') {
      const html = await minifyHtml(fs.readFileSync(source, 'utf8'), {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
      });
      fs.writeFileSync(destination, html);
    } else if (entry.name === 'CNAME' || entry.name === 'robots.txt' || /\.(?:png|jpe?g|webp|svg|ico|avif)$/i.test(entry.name)) {
      copyStaticFile(source, destination);
    }
  }

  const assets = path.join(root, 'assets');
  if (fs.existsSync(assets)) await copyAssets(assets, path.join(output, 'assets'));

  const sourceMaps = [];
  function findSourceMaps(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) findSourceMaps(file);
      else if (/\.map$/i.test(entry.name)) sourceMaps.push(path.relative(output, file));
    }
  }
  findSourceMaps(output);
  if (sourceMaps.length) throw new Error(`Production output must not contain source maps: ${sourceMaps.join(', ')}`);
}

build().then(() => {
  const fileCount = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (count, entry) => count + (entry.isDirectory() ? fileCount(path.join(dir, entry.name)) : 1), 0,
  );
  console.log(`Production site built in dist/ (${fileCount(output)} files; source maps excluded).`);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
