// Builds the protected "live" output (into ./live/site and ./live/stays):
//  - config.js points the app at our own /api proxy (no Supabase URL or key in the shipped code)
//  - all JavaScript (files and inline) is obfuscated, HTML is minified, comments removed
// Run: npm run build:live
const fs = require('node:fs');
const path = require('node:path');
const Obfuscator = require('javascript-obfuscator');
const { minify } = require('html-minifier-terser');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'live');
const PLACEHOLDER = 'theNammaStay';

const OBF = {
  compact: true, stringArray: true, stringArrayEncoding: ['base64'], stringArrayThreshold: 0.75,
  identifierNamesGenerator: 'hexadecimal', splitStrings: false, controlFlowFlattening: false,
  deadCodeInjection: false, selfDefending: false, disableConsoleOutput: true, sourceType: 'module',
};
const obf = (code, module = true) => Obfuscator.obfuscate(code, { ...OBF, sourceType: module ? 'module' : 'script' }).getObfuscatedCode();

function copy(src, dst, skip = () => false) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (skip(s, e)) continue;
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d, skip); } else fs.copyFileSync(s, d);
  }
}

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, fn); else fn(f);
  }
}

function protectConfig(file) {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/supabaseUrl:\s*'[^']*'/, "supabaseUrl: location.origin + '/api'")
       .replace(/supabaseAnonKey:\s*'[^']*'/, `supabaseAnonKey: '${PLACEHOLDER}'`);
  if (/supabase\.co/.test(s)) throw new Error('config.js still contains a Supabase URL: ' + file);
  fs.writeFileSync(file, s);
}

async function protectHtml(file) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/https:\/\/\*\.supabase\.co/g, '').replace(/wss:\/\/\*\.supabase\.co/g, '');
  html = html.replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, code) => {
    if (/type=["'](?!module|text\/javascript)/i.test(attrs) || !code.trim()) return m;
    return `<script${attrs}>${obf(code, /type=["']module/i.test(attrs))}</script>`;
  });
  html = await minify(html, { collapseWhitespace: true, removeComments: true, minifyCSS: true, conservativeCollapse: false, keepClosingSlash: true });
  fs.writeFileSync(file, html);
}

async function protect(dir) {
  const files = []; walk(dir, (f) => files.push(f));
  for (const f of files) {
    if (f.endsWith('.js') && !f.endsWith('config.js')) {
      const code = fs.readFileSync(f, 'utf8');
      try { fs.writeFileSync(f, obf(code)); } catch (e) { throw new Error(`Obfuscation failed for ${path.relative(root, f)}: ${e.message}`); }
    } else if (f.endsWith('config.js')) protectConfig(f);
    else if (f.endsWith('.html')) await protectHtml(f);
    else if (f.endsWith('.css')) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*/g, ''));
  }
  return files.length;
}

(async () => {
  fs.rmSync(out, { recursive: true, force: true });

  const site = path.join(out, 'site');
  fs.mkdirSync(site, { recursive: true });
  const siteDirs = new Set(['assets']);
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.isDirectory() && siteDirs.has(e.name)) { fs.mkdirSync(path.join(site, e.name)); copy(path.join(root, e.name), path.join(site, e.name)); }
    else if (e.isFile() && /\.(html|png|txt|webmanifest)$|^(CNAME|_headers)$/.test(e.name)) fs.copyFileSync(path.join(root, e.name), path.join(site, e.name));
  }
  const n1 = await protect(site);

  const stays = path.join(out, 'stays');
  fs.mkdirSync(stays, { recursive: true });
  copy(path.join(root, 'marketplace'), stays, (s) => /\.(md|jsonc)$/.test(s));
  const n2 = await protect(stays);

  for (const dir of [site, stays]) {
    walk(dir, (f) => {
      if (/\.(js|html)$/.test(f) && /supabase\.co/.test(fs.readFileSync(f, 'utf8').replace(/https:\/\/\*\.supabase\.co|wss:\/\/\*\.supabase\.co/g, ''))) {
        throw new Error('Supabase project URL leaked into ' + path.relative(root, f));
      }
    });
  }
  console.log(`Protected build ready: live/site (${n1} files), live/stays (${n2} files).`);
})().catch((e) => { console.error(e); process.exit(1); });
