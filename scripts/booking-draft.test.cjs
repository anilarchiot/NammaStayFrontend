const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('assets/js/pages/booking-draft.js', 'utf8');
const modulePromise = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('draft writes are serialized and the newest value is saved last', async () => {
  const { createBookingDraftSync } = await modulePromise;
  const calls = [];
  let finish;
  const sync = createBookingDraftSync({
    propertyId: 'property', delay: 10000, status() {},
    rpc: (_name, args) => {
      calls.push(args);
      return calls.length === 1 ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve();
    },
  });
  sync.schedule({ full_name: 'First' });
  const first = sync.flush();
  sync.schedule({ full_name: 'Latest' });
  const second = sync.flush();
  await tick();
  assert.equal(calls.length, 1);
  finish();
  await Promise.all([first, second]);
  assert.deepEqual(calls.map((c) => c.p_draft.full_name), ['First', 'Latest']);
  await sync.clear();
  assert.equal(calls.at(-1).p_draft, null);
});

test('failed save is reported and can be retried', async () => {
  const { createBookingDraftSync } = await modulePromise;
  let fail = true;
  const messages = [];
  const sync = createBookingDraftSync({
    propertyId: 'property', delay: 10000,
    status: (text, error) => messages.push({ text, error }),
    rpc: async () => { if (fail) throw new Error('offline'); },
  });
  sync.schedule({ full_name: 'Guest' });
  await sync.flush();
  assert.match(messages.at(-1).text, /offline/);
  assert.equal(messages.at(-1).error, true);
  fail = false;
  await sync.flush();
  assert.match(messages.at(-1).text, /saved/);
  await sync.clear();
});

test('clear waits for an in-flight save before deleting the draft', async () => {
  const { createBookingDraftSync } = await modulePromise;
  const calls = [];
  let finish;
  const sync = createBookingDraftSync({
    propertyId: 'property', delay: 10000, status() {},
    rpc: (_name, args) => {
      calls.push(args.p_draft);
      return args.p_draft ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve();
    },
  });
  sync.schedule({ full_name: 'Guest' });
  const write = sync.flush();
  const clear = sync.clear();
  await tick();
  assert.equal(calls.length, 1);
  finish();
  await Promise.all([write, clear]);
  assert.equal(calls.at(-1), null);
});
