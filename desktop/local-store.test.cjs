const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createLocalStore } = require('./local-store.cjs');

function makeSafeStorage() {
  const wrappingKey = crypto.createHash('sha256').update('test-only-key').digest();
  return {
    isEncryptionAvailable: () => true,
    encryptString(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, iv);
      const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
    },
    decryptString(value) {
      const iv = value.subarray(0, 12);
      const authTag = value.subarray(12, 28);
      const decipher = crypto.createDecipheriv('aes-256-gcm', wrappingKey, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}

test('local records are encrypted, persistent, and scoped by namespace/key', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nammastay-local-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const safeStorage = makeSafeStorage();

  const store = await createLocalStore({ directory, safeStorage });
  const record = { guest: 'Example Guest', notes: 'private local note' };
  store.set('guests', 'guest-1', record);
  assert.deepEqual(store.get('guests', 'guest-1'), record);
  assert.equal(store.get('bookings', 'guest-1'), null);
  assert.deepEqual(store.list('guests'), [{ key: 'guest-1', value: record }]);
  store.close();

  const encryptedFile = fs.readFileSync(path.join(directory, 'nammastay-local.db.enc'));
  assert.equal(encryptedFile.includes(Buffer.from('private local note')), false);
  assert.equal(encryptedFile.includes(Buffer.from('guests')), false);

  const reopened = await createLocalStore({ directory, safeStorage });
  assert.deepEqual(reopened.get('guests', 'guest-1'), record);
  assert.equal(reopened.delete('guests', 'guest-1'), true);
  assert.equal(reopened.delete('guests', 'guest-1'), false);
  reopened.close();
});

test('local store rejects unavailable OS encryption and invalid records', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nammastay-local-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  await assert.rejects(createLocalStore({
    directory,
    safeStorage: { isEncryptionAvailable: () => false },
  }), /Operating-system encryption is unavailable/);

  const store = await createLocalStore({ directory, safeStorage: makeSafeStorage() });
  t.after(() => store.close());
  assert.throws(() => store.set('../unsafe', 'key', 'value'), /Invalid local data namespace/);
  assert.throws(() => store.set('prefs', 'key', undefined), /JSON-serializable/);
  assert.throws(() => store.set('prefs', 'key', 'x'.repeat(1024 * 1024 + 1)), /exceeds 1 MB/);
});

test('local store detects encrypted record tampering', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nammastay-local-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = await createLocalStore({ directory, safeStorage: makeSafeStorage() });
  store.set('prefs', 'theme', 'dark');
  const databasePath = path.join(directory, 'nammastay-local.db.enc');
  const database = fs.readFileSync(databasePath);
  database[database.length - 1] ^= 1;
  fs.writeFileSync(databasePath, database);
  await assert.rejects(createLocalStore({ directory, safeStorage: makeSafeStorage() }));
  store.close();
});
