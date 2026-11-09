const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/js/pages/bookings.js', 'utf8')
  .replace(/^import[\s\S]*?from '\.\.\/core\.js';/, '');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const booking = (id, at, status = 'confirmed') => ({
  id, code: id, guest_name: id, status, check_in_at: at, check_out_at: at,
});

function element(dataset = {}) {
  return {
    dataset, hidden: false, disabled: false, innerHTML: '', textContent: '', attributes: {},
    classList: { toggle() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, fn) { this[name] = fn; },
    insertAdjacentHTML(_where, html) { this.innerHTML += html; },
    click() { return this.clickHandler?.({ currentTarget: this }); },
  };
}

function setup(listBookings) {
  const elements = Object.fromEntries(['rows', 'nearest', 'sort-label', 'more-wrap', 'more'].map((id) => [id, element()]));
  const statuses = [element({ status: '' }), element({ status: 'pending' })];
  let init;
  let search;
  let markup;
  const context = {
    page: (_name, fn) => { init = fn; },
    rpc: async (name, args) => name === 'list_bookings' ? listBookings(args)
      : name === 'occupancy_series' ? [] : { all: 0 },
    content: (html) => { markup = html; },
    document: { querySelectorAll: () => statuses },
    $: (selector) => elements[selector.slice(1)],
    W: { Unit: 'Bed', units: 'beds' }, roomsMode: () => false,
    setSubtitle() {}, headerSearch: (_placeholder, fn) => { search = fn; }, param: () => '',
    ymd: (value) => value === undefined ? '2026-11-09'
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)),
    addDays: () => '2026-11-15', fmtWeekday: (date) => date,
    esc: (value) => String(value ?? ''), unitName: () => '', avatar: () => '',
    statusPill: () => '', payPill: () => '', fmtDayTime: (value) => value,
    rupees: () => '', location: {}, Date, Intl,
  };
  vm.runInNewContext(source, context);
  return { elements, statuses, search: (value) => search(value), start: () => init({ property_id: 'p', property_name: 'Property' }), markup: () => markup };
}

function click(el) { el.click({ currentTarget: el }); }

test('nearest button finds upcoming bookings across pages, orders and paginates them', async () => {
  const rows = Array.from({ length: 130 }, (_, i) => booking(`future-${String(i).padStart(3, '0')}`, '2026-12-01T10:00:00Z'))
    .concat([booking('tomorrow', '2026-11-09T20:00:00Z'), booking('today', '2026-11-09T10:00:00Z'), booking('past', '2026-11-08T10:00:00Z')]);
  const calls = [];
  const app = setup(async (args) => {
    calls.push(args);
    const start = args.p_cursor_id ? rows.findIndex((b) => b.id === args.p_cursor_id) + 1 : 0;
    return rows.slice(start, start + args.p_limit);
  });
  await app.start();
  assert.match(app.markup(), /id="nearest" aria-pressed="false"/);
  click(app.elements.nearest);
  await tick();
  let html = app.elements.rows.innerHTML;
  assert.equal(app.elements.nearest.attributes['aria-pressed'], 'true');
  assert.ok(html.indexOf('today') < html.indexOf('tomorrow'));
  assert.ok(html.indexOf('tomorrow') < html.indexOf('future-000'));
  assert.doesNotMatch(html, />past</);
  assert.equal(calls.filter((call) => call.p_limit === 100).length, 2);
  assert.equal((html.match(/data-href=/g) || []).length, 30);
  assert.equal(app.elements['more-wrap'].hidden, false);
  click(app.elements.more);
  await tick();
  html = app.elements.rows.innerHTML;
  assert.equal((html.match(/data-href=/g) || []).length, 60);
  click(app.elements.nearest);
  await tick();
  assert.equal(app.elements.nearest.attributes['aria-pressed'], 'false');
  assert.equal(app.elements['sort-label'].textContent, 'Newest check-in first');
  assert.match(app.elements.rows.innerHTML, /future-000/);
});

test('filters and search refresh the nearest list and ignore stale responses', async () => {
  const pending = [];
  const calls = [];
  const app = setup((args) => {
    calls.push(args);
    if (args.p_status === 'pending') return Promise.resolve([booking('matching', '2026-11-10T10:00:00Z', 'pending')]);
    return new Promise((resolve) => { pending.push(resolve); });
  });
  const initial = app.start();
  await tick();
  click(app.elements.nearest);
  click(app.statuses[1]);
  app.search('matching');
  await tick();
  pending.forEach((resolve) => resolve([booking('stale', '2026-11-10T10:00:00Z')]));
  await initial;
  await tick();
  assert.match(app.elements.rows.innerHTML, /matching/);
  assert.doesNotMatch(app.elements.rows.innerHTML, /stale/);
  assert.equal(calls.at(-1).p_status, 'pending');
  assert.equal(calls.at(-1).p_q, 'matching');
});

test('nearest mode reports an empty result or a loading error', async () => {
  let fail = false;
  const app = setup(async () => {
    if (fail) throw new Error('Booking service unavailable');
    return [booking('past', '2026-11-08T10:00:00Z')];
  });
  await app.start();
  click(app.elements.nearest);
  await tick();
  assert.match(app.elements.rows.innerHTML, /No upcoming check-ins/);
  fail = true;
  app.search('guest');
  await tick();
  assert.match(app.elements.rows.innerHTML, /Booking service unavailable/);
});
