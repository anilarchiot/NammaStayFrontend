// NammaStay → Channex (NammaStay Connect, migration 058): connect a property, match rooms with Channex room types and
// rate plans, and set rates, restrictions and availability. Everything is saved through the normal NammaStay RPCs;
// the database then pings the connect function, which sends only what changed to Channex (queued, rate-limited, retried).
import { page, rpc, sb, content, setSubtitle, headerActions, esc, toast, confirmDialog, showFatal, fmtDayTime, ymd, addDays, $, $$ } from '../core.js';

const TRI = [['', 'No change'], ['yes', 'Yes'], ['no', 'No']];
const tri = (v) => (v === 'yes' ? true : v === 'no' ? false : undefined);
const money = (paise) => (paise == null ? '—' : (paise / 100).toFixed(2));
const yn = (v) => (v === true ? 'Yes' : v === false ? 'No' : '—');
const opts = (list, sel = '') => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join('');
const range = (a, b) => (a === b ? a : `${a} → ${b}`);

async function fn(body) {
  const { data, error } = await sb.functions.invoke('connect', { body });
  if (error || data?.error) {
    let m = data?.error || error?.message;
    try { const j = await error?.context?.json?.(); if (j?.error) m = j.error; } catch { /* ignore */ }
    throw new Error(m || 'Couldn’t reach the channel manager.');
  }
  return data;
}

page('channex', async (ctx) => {
  if (!ctx.isAdmin && !ctx.can('owner', 'manager')) { showFatal('Only the owner or manager can use Channex.'); return; }
  const isOwner = ctx.isAdmin || ctx.role === 'owner';
  const head = headerActions();
  const staged = { rates: [], avail: [] };
  let conn = null; let view = { plans: [], days: [], caps: [] };

  async function load() {
    const st = await rpc('cn_status', { p_property: ctx.property_id });
    const known = (st.otas || []).some((o) => o.ota === 'channex');
    conn = (st.connections || []).find((c) => c.ota === 'channex') || null;
    if (conn) {
      const from = ymd(); view = await rpc('cn_cx_view', { p_connection: conn.id, p_from: from, p_to: addDays(from, 800) });
    }
    return { known, enabled: (st.otas || []).find((o) => o.ota === 'channex')?.enabled };
  }

  async function syncNow(full = false) {
    if (!conn || conn.status !== 'live') return null;
    return fn({ action: 'sync', connection_id: conn.id, full });
  }
  const summary = (r) => (r?.reason ? r.reason : r ? `${r.imported || 0} booking change(s) saved, ${r.nights_sent || 0} night(s) sent` : 'Saved');

  async function draw() {
    let meta;
    try { meta = await load(); }
    catch (e) { content(`<div class="ns-card"><div class="ns-h3">Database update needed</div><div class="ns-muted" style="margin-top:6px">Run migration <b>058_connect_channex.sql</b>. (${esc(e.message)})</div></div>`); return; }
    setSubtitle(`${ctx.property_name} · Channex`);
    head.innerHTML = conn ? '<button type="button" class="ns-btn-ghost" id="cx-refresh">Refresh</button>' : '';
    $('#cx-refresh')?.addEventListener('click', draw);

    if (!meta.known) {
      content('<div class="ns-card"><div class="ns-h3">Channex isn’t available yet</div><div class="ns-muted" style="margin-top:6px">Run migration <b>058_connect_channex.sql</b> on the database.</div></div>');
      return;
    }
    if (!conn) {
      content(`<div class="ns-card" style="max-width:640px">
        <div class="ns-h3">Connect this property to Channex</div>
        <div class="ns-muted" style="margin:6px 0 14px">Paste the property ID from Channex (Properties → your property → ID). ${meta.enabled ? '' : '<b>Channex is not switched on by TheNammaStay yet.</b>'}</div>
        <div class="ns-field"><label for="cx-id">Channex property ID</label><input class="ns-input" id="cx-id" placeholder="e.g. 716305c4-561a-4561-a187-7f5b8aeb5920" autocomplete="off" ${isOwner ? '' : 'disabled'}></div>
        <div style="margin-top:14px"><button type="button" class="ns-btn" id="cx-connect" ${isOwner ? '' : 'disabled'}>Connect</button>${isOwner ? '' : ' <span class="ns-muted">Only the owner can connect.</span>'}</div></div>`);
      $('#cx-connect')?.addEventListener('click', async () => {
        const id = $('#cx-id').value.trim();
        if (!id) { toast('Enter the Channex property ID.', { error: true }); return; }
        try { await rpc('cn_save_connection', { p_property: ctx.property_id, p_ota: 'channex', p_hotel_id: id }); toast('Connected ✓'); await draw(); }
        catch (e) { toast(e.message, { error: true }); }
      });
      return;
    }

    const planByRate = Object.fromEntries(view.plans.map((p) => [p.ota_rate_id, p]));
    const groups = conn.maps || [];
    const roomsMapped = groups.filter((g) => g.ota_room_id);
    const roomOptions = [...new Map(roomsMapped.map((g) => [g.ota_room_id, g.title])).entries()];
    const planOptions = view.plans.map((p) => [p.ota_rate_id, p.title]);
    const badge = conn.status === 'live' ? ['#E9F5EE', '#157A56', 'Live'] : conn.status === 'waiting' ? ['#FCF0DC', '#966016', 'Waiting for TheNammaStay to switch Channex on'] : conn.status === 'paused' ? ['#F3EFE1', '#7A7154', 'Paused'] : ['#F3EFE1', '#7A7154', 'Set up'];

    content(`
      <div class="ns-card">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <div><div class="ns-h3">Channex property <span class="cx-num">${esc(conn.ota_hotel_id)}</span></div>
            <div class="ns-muted" style="margin-top:4px">Last sent: ${conn.last_push_at ? esc(fmtDayTime(conn.last_push_at)) : 'never'} · Last bookings check: ${conn.last_pull_at ? esc(fmtDayTime(conn.last_pull_at)) : 'never'}</div></div>
          <span class="cx-pill" style="background:${badge[0]};color:${badge[1]}">${esc(badge[2])}</span></div>
        ${conn.last_error ? `<div class="ns-error" style="margin-top:10px">${esc(conn.last_error)}${conn.retry_at ? ` — retrying ${esc(fmtDayTime(conn.retry_at))}` : ''}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button type="button" class="ns-btn-ghost" id="cx-load">1 · Load rooms from Channex</button>
          ${isOwner ? '<button type="button" class="ns-btn-ghost" id="cx-live">2 · Go live</button>' : ''}
          <button type="button" class="ns-btn-ghost" id="cx-hook">3 · Register booking webhook</button>
          <button type="button" class="ns-btn" id="cx-sync">Sync now</button>
          <button type="button" class="ns-btn-ghost" id="cx-full">Full sync</button>
        </div></div>

      <div class="ns-card">
        <div class="ns-h3">Rooms &amp; rate plans</div>
        <div class="ns-muted" style="margin:4px 0 12px">Match each Channex rate plan with a room in TheNammaStay. All rate plans of one Channex room type must use the same TheNammaStay room. Leave the room empty to skip a rate plan. The price is optional: empty = TheNammaStay’s own price for the room.</div>
        ${(conn.ota_rooms || []).length ? `<div style="overflow:auto"><table class="cx-table"><thead><tr><th>Channex room</th><th>Rate plan</th><th>TheNammaStay room</th><th>Price</th></tr></thead><tbody>
          ${conn.ota_rooms.filter((r) => r.ota_rate_id).map((r) => { const p = planByRate[r.ota_rate_id]; return `<tr data-rate="${esc(r.ota_rate_id)}" data-room="${esc(r.ota_room_id)}" data-title="${esc(r.rate_name || r.ota_rate_id)}">
            <td>${esc(r.room_name)}</td><td>${esc(r.rate_name || r.ota_rate_id)}</td>
            <td><select class="ns-input" data-g>${opts([['', '— skip —'], ...groups.map((g) => [g.group_key, g.title])], p?.group_key || '')}</select></td>
            <td><input class="ns-input" data-price type="number" min="0" step="0.01" style="width:110px" value="${p?.base_rate_paise != null ? (p.base_rate_paise / 100).toFixed(2) : ''}" placeholder="auto"></td></tr>`; }).join('')}
          </tbody></table></div>
          <div style="margin-top:12px"><button type="button" class="ns-btn" id="cx-plans">Save matching</button></div>`
          : '<div class="ns-muted">No rooms loaded yet — press “Load rooms from Channex”.</div>'}
      </div>

      ${view.plans.length ? `
      <div class="ns-card">
        <div class="ns-h3">Rates &amp; restrictions</div>
        <div class="ns-muted" style="margin:4px 0 12px">Add one or more changes, then save them together. Channex receives them as one update. Fields set to “No change” are left alone.</div>
        <div class="cx-grid">
          <div class="ns-field"><label>Rate plan</label><select class="ns-input" id="r-plan">${opts(planOptions)}</select></div>
          <div class="ns-field"><label>From</label><input class="ns-input" type="date" id="r-from"></div>
          <div class="ns-field"><label>To (optional)</label><input class="ns-input" type="date" id="r-to"></div>
          <div class="ns-field"><label>Rate</label><input class="ns-input" type="number" min="0" step="0.01" id="r-rate" placeholder="no change"></div>
          <div class="ns-field"><label>Min stay</label><input class="ns-input" type="number" min="1" max="365" id="r-min" placeholder="no change"></div>
          <div class="ns-field"><label>Max stay</label><input class="ns-input" type="number" min="0" max="365" id="r-max" placeholder="no change"></div>
          <div class="ns-field"><label>Stop sell</label><select class="ns-input" id="r-stop">${opts(TRI)}</select></div>
          <div class="ns-field"><label>Closed to arrival</label><select class="ns-input" id="r-cta">${opts(TRI)}</select></div>
          <div class="ns-field"><label>Closed to departure</label><select class="ns-input" id="r-ctd">${opts(TRI)}</select></div>
          <div><button type="button" class="ns-btn-ghost" id="r-add">Add to list</button></div>
        </div>
        <div id="r-list" style="margin-top:14px"></div>
      </div>` : ''}

      ${roomOptions.length ? `
      <div class="ns-card">
        <div class="ns-h3">Availability</div>
        <div class="ns-muted" style="margin:4px 0 12px">The number of rooms offered on Channex per night. It is never more than what is really free in TheNammaStay, and it drops by itself when a booking is made. Leave the number empty to offer everything that is free.</div>
        <div class="cx-grid">
          <div class="ns-field"><label>Room</label><select class="ns-input" id="a-room">${opts(roomOptions)}</select></div>
          <div class="ns-field"><label>From</label><input class="ns-input" type="date" id="a-from"></div>
          <div class="ns-field"><label>To (optional)</label><input class="ns-input" type="date" id="a-to"></div>
          <div class="ns-field"><label>Rooms available</label><input class="ns-input" type="number" min="0" max="999" id="a-n"></div>
          <div><button type="button" class="ns-btn-ghost" id="a-add">Add to list</button></div>
        </div>
        <div id="a-list" style="margin-top:14px"></div>
      </div>` : ''}

      <div class="ns-card">
        <div class="ns-h3">Bookings from Channex</div>
        ${(conn.reservations || []).length ? `<div style="overflow:auto"><table class="cx-table"><thead><tr><th>Received</th><th>Reference</th><th>Status</th><th>Guest</th><th>Stay</th><th>Amount</th></tr></thead><tbody>
          ${conn.reservations.map((r) => `<tr><td>${esc(fmtDayTime(r.received_at))}</td><td>${esc(r.code || r.ota_res_id)}</td><td>${esc(r.status || '')}</td><td>${esc(r.guest || '')}</td><td>${esc(range(r.arrival || '', r.departure || ''))}</td><td>${esc(r.currency || '')} ${esc(r.amount ?? '')}${r.problem ? `<div class="ns-error">${esc(r.problem)}</div>` : ''}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="ns-muted" style="margin-top:6px">No bookings yet.</div>'}
      </div>`);

    wire();
    drawLists();
  }

  function drawLists() {
    const planTitle = (id) => planByTitle(id);
    const rl = $('#r-list');
    if (rl) {
      rl.innerHTML = staged.rates.length ? `<div style="overflow:auto"><table class="cx-table"><thead><tr><th>Rate plan</th><th>Dates</th><th>Rate</th><th>Min</th><th>Max</th><th>Stop sell</th><th>CTA</th><th>CTD</th><th></th></tr></thead><tbody>
        ${staged.rates.map((r, i) => `<tr><td>${esc(planTitle(r.ota_rate_id))}</td><td>${esc(range(r.date_from, r.date_to || r.date_from))}</td><td>${'rate_paise' in r ? money(r.rate_paise) : '—'}</td><td>${r.min_stay ?? '—'}</td><td>${r.max_stay ?? '—'}</td><td>${yn(r.stop_sell)}</td><td>${yn(r.cta)}</td><td>${yn(r.ctd)}</td><td><button type="button" class="ns-btn-ghost" data-rm-r="${i}">Remove</button></td></tr>`).join('')}
        </tbody></table></div><div style="margin-top:12px"><button type="button" class="ns-btn" id="r-save">Save ${staged.rates.length} change${staged.rates.length === 1 ? '' : 's'} &amp; send to Channex</button></div>`
        : '<div class="ns-muted">Nothing added yet.</div>';
      $$('[data-rm-r]', rl).forEach((b) => b.addEventListener('click', () => { staged.rates.splice(Number(b.dataset.rmR), 1); drawLists(); }));
      $('#r-save')?.addEventListener('click', saveRates);
    }
    const al = $('#a-list');
    if (al) {
      const roomTitle = (id) => (conn.maps.find((g) => g.ota_room_id === id)?.title) || id;
      al.innerHTML = staged.avail.length ? `<div style="overflow:auto"><table class="cx-table"><thead><tr><th>Room</th><th>Dates</th><th>Available</th><th></th></tr></thead><tbody>
        ${staged.avail.map((r, i) => `<tr><td>${esc(roomTitle(r.ota_room_id))}</td><td>${esc(range(r.date_from, r.date_to || r.date_from))}</td><td>${r.avail ?? 'all free'}</td><td><button type="button" class="ns-btn-ghost" data-rm-a="${i}">Remove</button></td></tr>`).join('')}
        </tbody></table></div><div style="margin-top:12px"><button type="button" class="ns-btn" id="a-save">Save ${staged.avail.length} change${staged.avail.length === 1 ? '' : 's'} &amp; send to Channex</button></div>`
        : '<div class="ns-muted">Nothing added yet.</div>';
      $$('[data-rm-a]', al).forEach((b) => b.addEventListener('click', () => { staged.avail.splice(Number(b.dataset.rmA), 1); drawLists(); }));
      $('#a-save')?.addEventListener('click', saveAvail);
    }
  }
  const planByTitle = (id) => view.plans.find((p) => p.ota_rate_id === id)?.title || id;

  async function saveRates() {
    const b = $('#r-save'); b.disabled = true;
    try {
      await rpc('cn_cx_save_restrictions', { p_connection: conn.id, p_rows: staged.rates });
      staged.rates = [];
      const r = await syncNow();
      toast(summary(r)); await draw();
    } catch (e) { toast(e.message, { error: true }); b.disabled = false; }
  }
  async function saveAvail() {
    const b = $('#a-save'); b.disabled = true;
    try {
      await rpc('cn_cx_save_avail', { p_connection: conn.id, p_rows: staged.avail });
      staged.avail = [];
      const r = await syncNow();
      toast(summary(r)); await draw();
    } catch (e) { toast(e.message, { error: true }); b.disabled = false; }
  }

  function wire() {
    const busy = async (btn, work, okMsg) => {
      btn.disabled = true;
      try { const r = await work(); toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); await draw(); }
      catch (e) { toast(e.message, { error: true }); btn.disabled = false; }
    };
    $('#cx-load')?.addEventListener('click', (e) => busy(e.currentTarget, () => fn({ action: 'rooms', connection_id: conn.id }), (r) => `Found ${(r.rooms || []).length} room / rate plan(s) in Channex`));
    $('#cx-live')?.addEventListener('click', (e) => busy(e.currentTarget, () => rpc('cn_go_live', { p_connection: conn.id }), (s) => (s === 'live' ? 'Live — sending to Channex' : 'Saved — waiting for TheNammaStay to switch Channex on')));
    $('#cx-hook')?.addEventListener('click', (e) => busy(e.currentTarget, () => fn({ action: 'cx_webhook', connection_id: conn.id }), 'Booking webhook registered ✓'));
    $('#cx-sync')?.addEventListener('click', (e) => busy(e.currentTarget, () => fn({ action: 'sync', connection_id: conn.id }), summary));
    $('#cx-full')?.addEventListener('click', async (e) => {
      if (!await confirmDialog('Full sync', 'Send the next 500 days of availability, rates and restrictions to Channex now? This uses 2 Channex calls.', { confirmLabel: 'Send everything' })) return;
      busy(e.currentTarget, () => fn({ action: 'sync', connection_id: conn.id, full: true }), summary);
    });
    $('#cx-plans')?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
      const rows = $$('tr[data-rate]').filter((tr) => $('[data-g]', tr).value).map((tr) => {
        const price = $('[data-price]', tr).value.trim();
        return { group_key: $('[data-g]', tr).value, ota_room_id: tr.dataset.room, ota_rate_id: tr.dataset.rate, title: tr.dataset.title, base_rate_paise: price === '' ? null : Math.round(parseFloat(price) * 100) };
      });
      if (!rows.length) throw new Error('Choose a room in TheNammaStay for at least one rate plan.');
      return rpc('cn_cx_plans_save', { p_connection: conn.id, p_plans: rows });
    }, 'Matching saved ✓'));

    $('#r-add')?.addEventListener('click', () => {
      const row = { ota_rate_id: $('#r-plan').value, date_from: $('#r-from').value };
      const to = $('#r-to').value; if (to) row.date_to = to;
      if (!row.ota_rate_id || !row.date_from) { toast('Choose a rate plan and a start date.', { error: true }); return; }
      if (to && to < row.date_from) { toast('The end date is before the start date.', { error: true }); return; }
      const num = (id, k, f = (x) => x) => { const v = $(id).value.trim(); if (v !== '') row[k] = f(parseFloat(v)); };
      num('#r-rate', 'rate_paise', (x) => Math.round(x * 100)); num('#r-min', 'min_stay'); num('#r-max', 'max_stay');
      [['#r-stop', 'stop_sell'], ['#r-cta', 'cta'], ['#r-ctd', 'ctd']].forEach(([id, k]) => { const v = tri($(id).value); if (v !== undefined) row[k] = v; });
      if (Object.keys(row).length <= (to ? 3 : 2)) { toast('Set at least one value to change.', { error: true }); return; }
      staged.rates.push(row); drawLists();
    });
    $('#a-add')?.addEventListener('click', () => {
      const row = { ota_room_id: $('#a-room').value, date_from: $('#a-from').value };
      const to = $('#a-to').value; if (to) row.date_to = to;
      if (!row.ota_room_id || !row.date_from) { toast('Choose a room and a start date.', { error: true }); return; }
      if (to && to < row.date_from) { toast('The end date is before the start date.', { error: true }); return; }
      const n = $('#a-n').value.trim(); row.avail = n === '' ? null : parseInt(n, 10);
      staged.avail.push(row); drawLists();
    });
  }

  await draw();
});
