const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/js/subscriber-delete.js', 'utf8').replace('export async function', 'async function');
const { deleteSubscriber } = vm.runInNewContext(`${source}\n({ deleteSubscriber })`);

test('validates then removes each batch of property files before deleting the property', async () => {
  const files = Array.from({ length: 205 }, (_, i) => ({ bucket: i % 2 ? 'guest-ids' : 'staff-docs', path: `property/${i}` }));
  const operations = [];
  const rpc = async (name, args) => {
    operations.push(name);
    assert.equal(args.p_property, 'property');
    if (name === 'admin_subscriber_files') return files.slice(0, 200);
  };
  const storage = { from: (bucket) => ({ remove: async (paths) => {
    operations.push(`remove:${bucket}`);
    for (const path of paths) files.splice(files.findIndex((f) => f.bucket === bucket && f.path === path), 1);
    return { error: null };
  } }) };
  await deleteSubscriber(rpc, storage, 'property');
  assert.equal(files.length, 0);
  assert.equal(operations[0], 'admin_validate_subscriber_delete');
  assert.equal(operations.at(-1), 'admin_delete_subscriber');
  assert.equal(operations.filter((x) => x === 'admin_subscriber_files').length, 3);
});

test('validation failure does not delete files or the property', async () => {
  const calls = [];
  await assert.rejects(deleteSubscriber(async (name) => {
    calls.push(name);
    throw new Error('Cannot delete dependent records');
  }, { from() { throw new Error('unexpected storage operation'); } }, 'property'), /dependent records/);
  assert.deepEqual(calls, ['admin_validate_subscriber_delete']);
});

test('storage failures and unchanged files prevent database deletion', async () => {
  for (const storageError of [true, false]) {
    const calls = [];
    const rpc = async (name) => {
      calls.push(name);
      return name === 'admin_subscriber_files' ? [{ bucket: 'guest-ids', path: 'property/id' }] : null;
    };
    const storage = { from: () => ({ remove: async () => ({ error: storageError ? { message: 'denied' } : null }) }) };
    await assert.rejects(deleteSubscriber(rpc, storage, 'property'), storageError ? /denied/ : /could not be deleted/);
    assert.ok(!calls.includes('admin_delete_subscriber'));
  }
});
