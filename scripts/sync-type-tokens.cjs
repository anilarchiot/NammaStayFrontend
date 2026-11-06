const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'marketplace', 'travel.css'), 'utf8');
const match = source.match(/TYPE SYSTEM[\s\S]*?\*\/\s*(:root\s*\{[^}]+\})/);
if (!match) throw new Error('Could not find the marketplace type system.');

const output = path.join(root, 'assets', 'css', 'type-tokens.css');
const css = `/* Generated from marketplace/travel.css. Run npm run sync:type-tokens after changing its type system. */\n${match[1]}\n`;

function checkTypeTokens() {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== css) {
    throw new Error('Type tokens are out of date. Run npm run sync:type-tokens.');
  }
}

if (require.main === module) {
  fs.writeFileSync(output, css);
  console.log('Updated assets/css/type-tokens.css from marketplace/travel.css.');
}

module.exports = { checkTypeTokens };
