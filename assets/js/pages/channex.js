// NammaStay → Channex: send rates, restrictions and availability, and see the bookings that came back.
// Each save goes to the `channex` function as ONE Channex call holding only the values that were changed
// (payloads are built and validated in backend/supabase/functions/channex/ari.ts). Connecting the property
// and creating rooms is done on the OTA sync page.
import { page, rpc, sb, content, setSubtitle, headerActions, esc, toast, confirmDialog, showFatal, fmtDayTime, $, $$ } from '../core.js';

const TRI = [['', 'No change'], ['yes', 'Yes'], ['no', 'No']];
const tri = (v) => (v === 'yes' ? true : v === 'no' ? false : undefined);
const money = (minor) => (minor == null ? '—' : (minor / 100).toFixed(2));
const yn = (v) => (v === true ? 'Yes' : v === false ? 'No' : '—');
const opts = (list, sel = '') => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join('');
const range = (a, b) => (!b || a === b ? a : `${a} → ${b}`);

async function fn(body) {
  const { data, error } = await sb.functions.invoke('channex', { body });
  if (error || data?.error) {
    let m = data?.error || error?.message;
    try { const j = await error?.context?.json?.(); if (j?.error) m = j.error; } catch { /* ignore */ }
    throw new Error(m || 'Couldn’t reach Channex.');
  }
  return data;
}

page('channex', async (ctx) => {
  if (!ctx.isAdmin && !ctx.can('owner', 'manager')) { showFatal('Only the owner or manager can use Channex.'); return; }
  const head = headerActions();
  const staged = { rates: [], avail: [] };
  const call = (body) => fn({ property_id: ctx.property_id, ...body });
  let status = null; let cx = { rooms: [], plans: [] };

  async function load() {
    status = await rpc('cx_status', { p_property: ctx.property_id });
    cx = status?.link?.cx_property_id ? await call({ action: 'plans' }) : { rooms: [], plans: [] };
  }

  async function draw() {
    try { await load(); }
    catch (e) { content(`<div class="ns-card"><div class="ns-h3">Couldn’t load Channex</div><div class="ns-muted" style="margin-top:6px">${esc(e.message)}</div></div>`); return; }
    setSubtitle(`${ctx.property_name} · Channex`);
    const link = status?.link;
    head.innerHTML = link?.cx_property_id ? '<button type="button" class="ns-btn-ghost" id="cx-refresh">Refresh</button>' : '';
    $('#cx-refresh')?.addEventListener('click', draw);

    if (!link?.cx_property_id) {
      content('<div class="ns-card" style="max-width:640px"><div class="ns-h3">Connect this property to Channex first</div><div class="ns-muted" style="margin:6px 0 14px">Set up the channel manager (or link an existing Channex property ID) on the OTA sync page, then come back here.</div><a class="ns-btn" href="ota.html">Open OTA sync</a></div>');
      return;
    }

    const planOptions = cx.plans.map((p) => [p.id, `${p.room ? p.room + ' — ' : ''}${p.title}`]);
    const roomOptions = cx.rooms.map((r) => [r.id, r.title]);
    const bookings = status.bookings || [];

    content(`
      <div class="ns-card">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <div><div class="ns-h3">Channex property <span class="cx-num">${esc(link.cx_property_id)}</span></div>
            <div class="ns-muted" style="margin-top:4px">Last sent: ${link.last_push_at ? esc(fmtDayTime(link.last_push_at)) : 'never'} · Last bookings check: ${link.last_pull_at ? esc(fmtDayTime(link.last_pull_at)) : 'never'}</div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="ns-btn-ghost" id="cx-bookings">Check bookings</button>
            <button type="button" class="ns-btn-ghost" id="cx-full">Full sync</button></div></div>
        ${link.last_error ? `<div class="ns-error" style="margin-top:10px">${esc(link.last_error)}</div>` : ''}
      </div>

      ${planOptions.length ? `
      <div class="ns-card">
        <div class="ns-h3">Rates &amp; restrictions</div>
        <div class="ns-muted" style="margin:4px 0 12px">Add one or more changes, then save them together: Channex receives them as one update with only the fields you set. Fields left as “No change” are not sent.</div>
        <div class="cx-grid">
          <div class="ns-field"><label>Rate plan</label><select class="ns-input" id="r-plan">${opts(planOptions)}</select></div>
          <div class="ns-field"><label>From</label><input class="ns-input" type="date" id="r-from"></div>
          <div class="ns-field"><label>To (optional)</label><input class="ns-input" type="date" id="r-to"></div>
          <div class="ns-field"><label>Rate</label><input class="ns-input" type="number" min="0" step="0.01" id="r-rate" placeholder="no change"></div>
          <div class="ns-field"><label>Min stay</label><input class="ns-input" type="number" min="1" max="365" step="1" id="r-min" placeholder="no change"></div>
          <div class="ns-field"><label>Max stay</label><input class="ns-input" type="number" min="0" max="365" step="1" id="r-max" placeholder="no change"></div>
          <div class="ns-field"><label>Stop sell</label><select class="ns-input" id="r-stop">${opts(TRI)}</select></div>
          <div class="ns-field"><label>Closed to arrival</label><select class="ns-input" id="r-cta">${opts(TRI)}</select></div>
          <div class="ns-field"><label>Closed to departure</label><select class="ns-input" id="r-ctd">${opts(TRI)}</select></div>
          <div><button type="button" class="ns-btn-ghost" id="r-add">Add to list</button></div>
        </div>
        <div id="r-list" style="margin-top:14px"></div>
      </div>` : '<div class="ns-card"><div class="ns-muted">No rate plans found in Channex for this property yet.</div></div>'}

      ${roomOptions.length ? `
      <div class="ns-card">
        <div class="ns-h3">Availability</div>
        <div class="ns-muted" style="margin:4px 0 12px">The number of rooms offered on Channex for each night. Enter 0 to close a room.</div>
        <div class="cx-grid">
          <div class="ns-field"><label>Room</label><select class="ns-input" id="a-room">${opts(roomOptions)}</select></div>
          <div class="ns-field"><label>From</label><input class="ns-input" type="date" id="a-from"></div>
          <div class="ns-field"><label>To (optional)</label><input class="ns-input" type="date" id="a-to"></div>
          <div class="ns-field"><label>Rooms available</label><input class="ns-input" type="number" min="0" max="999" step="1" id="a-n"></div>
          <div><button type="button" class="ns-btn-ghost" id="a-add">Add to list</button></div>
        </div>
        <div id="a-list" style="margin-top:14px"></div>
      </div>` : ''}

      <div class="ns-card">
        <div class="ns-h3">Bookings from Channex</div>
        ${bookings.length ? `<div style="overflow:auto"><table class="cx-table"><thead><tr><th>Received</th><th>Channex booking ID</th><th>Reference</th><th>Status</th><th>Guest</th><th>Stay</th><th>Amount</th></tr></thead><tbody>
          ${bookings.map((b) => `<tr><td>${esc(fmtDayTime(b.received_at))}</td><td><code>${esc(b.cx_booking_id)}</code></td><td>${esc(b.code || '')}</td><td>${esc(b.status || '')}</td><td>${esc(b.guest || '')}</td><td>${esc(range(b.arrival || '', b.departure || ''))}</td><td>${esc(b.currency || '')} ${esc(b.amount ?? '')}${b.problem ? `<div class="ns-error">${esc(b.problem)}</div>` : ''}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="ns-muted" style="margin-top:6px">No bookings yet.</div>'}
      </div>`);

    wire();
    drawLists();
  }

  const planTitle = (id) => cx.plans.find((p) => p.id === id)?.title || id;
  const roomTitle = (id) => cx.rooms.find((r) => r.id === id)?.title || id;

  function drawLists() {
    const rl = $('#r-list');
    if (rl) {
      rl.innerHTML = staged.rates.length ? `<div style="overflow:auto"><table class="cx-table"><thead><tr><th>Rate plan</th><th>Dates</th><th>Rate</th><th>Min</th><th>Max</th><th>Stop sell</th><th>CTA</th><th>CTD</th><th></th></tr></thead><tbody>
        ${staged.rates.map((r, i) => `<tr><td>${esc(planTitle(r.rate_plan_id))}</td><td>${esc(range(r.date_from, r.date_to))}</td><td>${money(r.rate_minor)}</td><td>${r.min_stay ?? '—'}</td><td>${r.max_stay ?? '—'}</td><td>${yn(r.stop_sell)}</td><td>${yn(r.cta)}</td><td>${yn(r.ctd)}</td><td><button type="button" class="ns-btn-ghost" data-rm-r="${i}">Remove</button></td></tr>`).join('')}
        </tbody></table></div><div style="margin-top:12px"><button type="button" class="ns-btn" id="r-save">Save ${staged.rates.length} change${staged.rates.length === 1 ? '' : 's'} &amp; send to Channex</button></div>`
        : '<div class="ns-muted">Nothing added yet.</div>';
      $$('[data-rm-r]', rl).forEach((b) => b.addEventListener('click', () => { staged.rates.splice(Number(b.dataset.rmR), 1); drawLists(); }));
      $('#r-save')?.addEventListener('click', () => send('restrictions', staged.rates, () => { staged.rates = []; }, $('#r-save')));
    }
    const al = $('#a-list');
    if (al) {
      al.innerHTML = staged.avail.length ? `<div style="overflow:auto"><table class="cx-table"><thead><tr><th>Room</th><th>Dates</th><th>Available</th><th></th></tr></thead><tbody>
        ${staged.avail.map((r, i) => `<tr><td>${esc(roomTitle(r.room_type_id))}</td><td>${esc(range(r.date_from, r.date_to))}</td><td>${r.availability}</td><td><button type="button" class="ns-btn-ghost" data-rm-a="${i}">Remove</button></td></tr>`).join('')}
        </tbody></table></div><div style="margin-top:12px"><button type="button" class="ns-btn" id="a-save">Save ${staged.avail.length} change${staged.avail.length === 1 ? '' : 's'} &amp; send to Channex</button></div>`
        : '<div class="ns-muted">Nothing added yet.</div>';
      $$('[data-rm-a]', al).forEach((b) => b.addEventListener('click', () => { staged.avail.splice(Number(b.dataset.rmA), 1); drawLists(); }));
      $('#a-save')?.addEventListener('click', () => send('availability', staged.avail, () => { staged.avail = []; }, $('#a-save')));
    }
  }

  async function send(action, rows, clear, btn) {
    btn.disabled = true;
    try {
      await call({ action, rows });
      clear();
      toast('Sent to Channex ✓'); await draw();
    } catch (e) { toast(e.message, { error: true }); btn.disabled = false; }
  }

  function wire() {
    const busy = async (btn, work, okMsg) => {
      btn.disabled = true;
      try { const r = await work(); toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); await draw(); }
      catch (e) { toast(e.message, { error: true }); btn.disabled = false; }
    };
    $('#cx-bookings')?.addEventListener('click', (e) => busy(e.currentTarget, () => call({ action: 'pull' }), (r) => `${r.saved || 0} booking change(s) saved`));
    $('#cx-full')?.addEventListener('click', async (e) => {
      if (!await confirmDialog('Full sync', 'Send the next 500 days of availability, rates, minimum stay and stop sell to Channex now? This also checks for new bookings.', { confirmLabel: 'Send everything' })) return;
      busy(e.currentTarget, () => call({ action: 'sync' }), 'Everything sent to Channex ✓');
    });

    $('#r-add')?.addEventListener('click', () => {
      const row = { rate_plan_id: $('#r-plan').value, date_from: $('#r-from').value };
      const to = $('#r-to').value; if (to) row.date_to = to;
      if (!row.rate_plan_id || !row.date_from) { toast('Choose a rate plan and a start date.', { error: true }); return; }
      if (to && to < row.date_from) { toast('The end date is before the start date.', { error: true }); return; }
      const num = (id, k, f = (x) => x) => { const v = $(id).value.trim(); if (v !== '') row[k] = f(Number(v)); };
      num('#r-rate', 'rate_minor', (x) => Math.round(x * 100)); num('#r-min', 'min_stay'); num('#r-max', 'max_stay');
      [['#r-stop', 'stop_sell'], ['#r-cta', 'cta'], ['#r-ctd', 'ctd']].forEach(([id, k]) => { const v = tri($(id).value); if (v !== undefined) row[k] = v; });
      if (!['rate_minor', 'min_stay', 'max_stay', 'stop_sell', 'cta', 'ctd'].some((k) => k in row)) { toast('Set at least one value to change.', { error: true }); return; }
      staged.rates.push(row); drawLists();
    });
    $('#a-add')?.addEventListener('click', () => {
      const row = { room_type_id: $('#a-room').value, date_from: $('#a-from').value };
      const to = $('#a-to').value; if (to) row.date_to = to;
      if (!row.room_type_id || !row.date_from) { toast('Choose a room and a start date.', { error: true }); return; }
      if (to && to < row.date_from) { toast('The end date is before the start date.', { error: true }); return; }
      const n = $('#a-n').value.trim();
      if (n === '' || !Number.isInteger(Number(n)) || Number(n) < 0) { toast('Enter how many rooms are available (0 or more).', { error: true }); return; }
      row.availability = Number(n);
      staged.avail.push(row); drawLists();
    });
  }

  await draw();
});
