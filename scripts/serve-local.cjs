const path = require('node:path');
const { createLocalServer } = require('./local-server.cjs');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);

createLocalServer(root, { port, host: '127.0.0.1' })
  .then(() => console.log(`NammaStay site: http://localhost:${port}/`))
  .catch((error) => { console.error(error); process.exitCode = 1; });
