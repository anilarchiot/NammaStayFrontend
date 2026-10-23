const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 4174;

module.exports = Object.freeze({
  ROOT: path.resolve(__dirname, '..'),
  HOST,
  PORT,
  ORIGIN: `http://${HOST}:${PORT}`,
  PRELOAD_PATH: path.join(__dirname, 'preload.cjs'),
  VALID_KEY: /^[\w.-]{1,100}$/,
});
