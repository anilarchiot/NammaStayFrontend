const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/subscription-notice.js', 'utf8').replace('export function', 'function');
const { subscriptionNotice } = vm.runInNewContext(`${source}\n({ subscriptionNotice })`);
const fmt = (date) => new Date(date).toISOString().slice(0, 10);
const active = { state: 'active', paid_until: '2026-11-16T00:00:00Z' };

test('soft renewal notice starts at seven days with an owner billing link', () => {
  assert.equal(subscriptionNotice({ ...active, days_left: 8 }, true, fmt), null);
  const notice = subscriptionNotice({ ...active, days_left: 7 }, true, fmt);
  assert.match(notice.text, /ends.*2026-11-16/);
  assert.match(notice.text, /settings.html\?tab=billing/);
  assert.doesNotMatch(notice.text, /renews in/);
  assert.equal(notice.dismissible, true);
});

test('staff are directed to the owner, and pending payments replace renewal prompts', () => {
  const staff = subscriptionNotice({ ...active, days_left: 1 }, false, fmt);
  assert.match(staff.text, /ask the owner/);
  assert.doesNotMatch(staff.text, /settings.html/);
  const pending = subscriptionNotice({ ...active, days_left: 1, pending_payment: true }, true, fmt);
  assert.match(pending.text, /waiting for confirmation/);
  assert.ok(!pending.dismissible);
});

test('grace deadline and expired behavior are accurate', () => {
  const notice = subscriptionNotice({ state: 'grace', ends_at: '2026-11-09T00:00:00Z', grace_days: 4 }, true, fmt);
  assert.match(notice.text, /2026-11-13/);
  assert.match(subscriptionNotice({ state: 'expired' }, true, fmt).text, /new bookings are paused/);
  assert.equal(subscriptionNotice({ state: 'complimentary' }, true, fmt), null);
  assert.equal(subscriptionNotice({ state: 'suspended' }, true, fmt), null);
});
