const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const MAX_RECORD_BYTES = 1024 * 1024;
const VALID_KEY = /^[\w.-]{1,100}$/;
const FILE_HEADER = Buffer.from('NSDB1');

async function createLocalStore({ directory, safeStorage }) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Operating-system encryption is unavailable; local data storage cannot be opened safely.');
  }

  fs.mkdirSync(directory, { recursive: true });
  const keyPath = path.join(directory, 'local-data-key');
  let key;
  if (fs.existsSync(keyPath)) {
    key = Buffer.from(safeStorage.decryptString(fs.readFileSync(keyPath)), 'base64');
  } else {
    key = crypto.randomBytes(32);
    const encryptedKey = safeStorage.encryptString(key.toString('base64'));
    const temporaryPath = `${keyPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, encryptedKey, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryPath, keyPath);
  }
  if (key.length !== 32) throw new Error('The local data encryption key is invalid.');

  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });
  const databasePath = path.join(directory, 'nammastay-local.db.enc');
  const db = new SQL.Database(fs.existsSync(databasePath) ? decryptDatabase(key, fs.readFileSync(databasePath)) : undefined);
  db.run(`CREATE TABLE IF NOT EXISTS local_records (
    namespace TEXT NOT NULL,
    record_key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (namespace, record_key)
  )`);

  function validate(namespace, recordKey) {
    if (typeof namespace !== 'string' || !VALID_KEY.test(namespace)) throw new TypeError('Invalid local data namespace.');
    if (typeof recordKey !== 'string' || !VALID_KEY.test(recordKey)) throw new TypeError('Invalid local data key.');
  }

  function persist() {
    const encrypted = encryptDatabase(key, Buffer.from(db.export()));
    const temporaryPath = `${databasePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(temporaryPath, encrypted, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryPath, databasePath);
  }

  function read(namespace, recordKey) {
    const statement = db.prepare('SELECT value_json FROM local_records WHERE namespace = $namespace AND record_key = $key');
    try {
      statement.bind({ $namespace: namespace, $key: recordKey });
      return statement.step() ? JSON.parse(statement.getAsObject().value_json) : null;
    } finally {
      statement.free();
    }
  }

  return {
    get(namespace, recordKey) {
      validate(namespace, recordKey);
      return read(namespace, recordKey);
    },
    set(namespace, recordKey, value) {
      validate(namespace, recordKey);
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new TypeError('Local data must be JSON-serializable.');
      if (Buffer.byteLength(serialized, 'utf8') > MAX_RECORD_BYTES) throw new RangeError('Local data record exceeds 1 MB.');
      db.run(`INSERT INTO local_records (namespace, record_key, value_json, updated_at)
        VALUES ($namespace, $key, $value, $updated)
        ON CONFLICT (namespace, record_key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`, {
        $namespace: namespace,
        $key: recordKey,
        $value: serialized,
        $updated: new Date().toISOString(),
      });
      persist();
    },
    delete(namespace, recordKey) {
      validate(namespace, recordKey);
      db.run('DELETE FROM local_records WHERE namespace = $namespace AND record_key = $key', {
        $namespace: namespace,
        $key: recordKey,
      });
      const deleted = db.getRowsModified() > 0;
      persist();
      return deleted;
    },
    list(namespace) {
      validate(namespace, 'list');
      const statement = db.prepare('SELECT record_key, value_json FROM local_records WHERE namespace = $namespace ORDER BY record_key');
      try {
        statement.bind({ $namespace: namespace });
        const records = [];
        while (statement.step()) {
          const row = statement.getAsObject();
          records.push({ key: row.record_key, value: JSON.parse(row.value_json) });
        }
        return records;
      } finally {
        statement.free();
      }
    },
    close() {
      db.close();
      key.fill(0);
    },
  };
}

function encryptDatabase(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(FILE_HEADER);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([FILE_HEADER, iv, cipher.getAuthTag(), ciphertext]);
}

function decryptDatabase(key, file) {
  if (file.length < FILE_HEADER.length + 12 + 16 || !file.subarray(0, FILE_HEADER.length).equals(FILE_HEADER)) {
    throw new Error('The local database file is invalid or unsupported.');
  }
  const offset = FILE_HEADER.length;
  const iv = file.subarray(offset, offset + 12);
  const authTag = file.subarray(offset + 12, offset + 28);
  const ciphertext = file.subarray(offset + 28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(FILE_HEADER);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = { createLocalStore };
