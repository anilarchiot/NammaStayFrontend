// NammaStay admin → OTA sync: manage Beds24 setup and monitor each property’s connections,
// watch every property's connection, read the message log, retry, and run the Test OTA simulator
// (fake guest bookings + what the "OTA" currently shows) for testing.
// OTA sync setup queue: confirm payments, link each property's Beds24 sub-account, tick channels, go live.
import { adminPage, rpc, sb, content, setSubtitle, headerActions, esc, fmtDayTime, fmtDate, rupees, toast, modal, confirmDialog, showFatal, field, FUNCTIONS_URL } from '../core.js';

const STATUS = { setup: ['amber', 'Setting up'], waiting: ['blue', 'Waiting for approval'], live: ['green', 'Live'], paused: ['grey', 'Paused'] };
const OTAS3 = [['booking', 'Booking.com'], ['agoda', 'Agoda'], ['goibibo', 'Goibibo / MakeMyTrip'], ['other', 'Other Beds24 channels']]; // OTA sync (046)
const today = () => new Date().toISOString().slice(0, 10);
const day = (x) => (x ? fmtDate(String(x).slice(0, 10) + 'T12:00:00+05:30') : '');
const STATE = { requested: ['amber', 'Requested'], paid: ['green', 'Ready to set up'], linked: ['amber', 'Setting up'], live: ['green', 'Live'] };
const ago = (iso) => { if (!iso) return '—'; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const call = async (body) => {
  const { data, error } = await sb.functions.invoke('connect', { body });
  if (error || data?.error) { let m = data?.error || error?.message; try { const j = await error?.context?.json?.(); if (j?.error) m = j.error; } catch { /* ignore */ } throw new Error(m || 'The connect function didn’t answer.'); }
  return data;
};

adminPage(async (ctx) => {
  if (!ctx.isAdmin) { showFatal('This screen is only for NammaStay admins.'); return; }
  headerActions().innerHTML = '<a class="ns-btn-ghost" href="admin.html">← Admin</a><button type="button" class="ns-btn-ghost" id="cn-reload">⟳ Refresh</button>';
  document.getElementById('cn-reload').onclick = () => draw();
  const style = document.createElement('style');
  style.textContent = `.cn-tbl{width:100%;border-collapse:collapse;font-size:13.5px}.cn-tbl th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;padding:8px;border-bottom:1px solid #E7DFC7}
    .cn-tbl td{padding:9px 8px;border-bottom:1px solid #F1EAD6;vertical-align:top}.cn-wrap{overflow-x:auto}.cn-acts{display:flex;gap:6px;flex-wrap:wrap}.cn-acts .ns-btn-ghost{height:30px;font-size:12px;padding:0 10px}
    .cn-log{display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow:auto}.cn-log-row{border:1px solid #F1EAD6;border-radius:10px;padding:8px 10px;font-size:13px}
    .cn-log-row.bad{border-color:#F3C4C4;background:#FFF6F6}.cn-log-row pre{white-space:pre-wrap;word-break:break-all;font-size:11.5px;background:#FBF7EC;padding:8px;border-radius:8px;margin:6px 0 0;max-height:220px;overflow:auto}
    .cn-grid{border-collapse:collapse;font-size:12px}.cn-grid td,.cn-grid th{border:1px solid #F1EAD6;padding:4px 6px;text-align:center;white-space:nowrap}.cn-grid .z{background:#FDECEC;color:#B23A3A;font-weight:700}
    .sq-step{display:flex;gap:12px;align-items:flex-start;border:1px solid #E7DFC7;border-radius:14px;padding:14px;margin-bottom:10px}.sq-step.done{border-color:#CDE9DA;background:#F3FAF6}.sq-step.now{border:2px solid #1C9A6C;padding:13px}
    .sq-n{flex:none;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #C9C0A6;color:#5B6270;box-sizing:border-box}
    .sq-step.done .sq-n{background:#1C9A6C;border-color:#1C9A6C;color:#fff}.sq-step.now .sq-n{background:#0E1B3D;border-color:#0E1B3D;color:#fff}
    .sq-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}.sq-body > b{font-size:14.5px}.sq-row{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}.sq-row .ns-field{flex:1 1 220px}
    .sq-ok{background:#F3FAF6;border:1px solid #CDE9DA;border-radius:10px;padding:8px 10px;font-size:13px}.sq-pay{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;border-top:1px solid #F1EAD6;padding-top:6px}
    .sq-chk{display:flex;align-items:center;gap:10px;min-height:40px;font-size:13.5px}.sq-chk input{width:18px;height:18px;accent-color:#1C9A6C}.sq-hook{font-family:ui-monospace,monospace;font-size:12px}
    @media (max-width:640px){.sq-tbl{min-width:0!important}.sq-tbl thead{display:none}.sq-tbl tr{display:block;padding:12px 0;border-bottom:1px solid #F1EAD6}
      .sq-tbl td{display:flex;gap:10px;align-items:flex-start;border:0;padding:4px 0}.sq-tbl td:first-child{display:block;padding-bottom:6px}
      .sq-tbl td[data-l]::before{content:attr(data-l);flex:0 0 112px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;padding-top:2px}
      .sq-tbl td:last-child{text-align:left!important;padding-top:10px}.sq-tbl td:last-child .ns-btn,.sq-tbl td:last-child .ns-btn-ghost{width:100%}}`;
  document.head.appendChild(style);
  await draw();

  async function draw() {
    let d; let sq = null;
    try { d = await rpc('cn_admin_overview'); }
    catch { content(`<div class="ns-card" style="max-width:760px"><div class="ns-h3">Database update needed</div>
        <div class="ns-muted" style="margin-top:6px">Run <b>049_connect.sql</b> and <b>050_connect_beds24.sql</b> in Supabase → SQL Editor, then reload this page.</div></div>`); return; }
    const live = d.connections.filter((c) => c.status === 'live').length; const bad = d.connections.filter((c) => c.last_error).length;
    let setupError = '';
    try { sq = await rpc('cn_b24_queue'); } catch (error) { setupError = error.message; }
    const waitingSetup = (sq || []).filter((x) => x.state !== 'live').length;
    setSubtitle(`${d.connections.length} connection${d.connections.length === 1 ? '' : 's'} · ${live} live${bad ? ` · ${bad} need attention` : ''}${waitingSetup ? ` · ${waitingSetup} OTA sync to set up` : ''}`);
    content(`
      ${sq ? queueHtml(sq) : `<div class="ns-card"><div class="ns-h3">Couldn’t load Beds24 setup queue</div><div class="ns-muted" style="margin-top:6px">${esc(setupError)}. Run <b>050_connect_beds24.sql</b> after <b>049_connect.sql</b> and verify platform-admin access.</div></div>`}
      <div class="ns-card"><div class="ns-h3">OTAs</div>
        <div class="ns-muted" style="font-size:12.5px;margin:4px 0 10px">Switch an OTA on <b>only after</b> it has approved NammaStay as a connectivity partner and its credentials are saved as Supabase secrets for the <b>connect</b> function. Waiting connections then go live by themselves.</div>
        <div class="cn-wrap"><table class="cn-tbl"><thead><tr><th>OTA</th><th>Connections</th><th>Waiting</th><th>Status</th><th></th></tr></thead><tbody>
          ${d.otas.filter((o) => !['booking', 'airbnb'].includes(o.ota)).map((o) => `<tr><td><b>${esc(o.name)}</b></td><td>${o.connections}</td><td>${o.waiting}</td>
            <td><span class="ns-pill ${o.enabled ? 'green' : 'grey'}">${o.enabled ? 'Switched on' : 'Off — awaiting approval'}</span></td>
            <td style="text-align:right"><button type="button" class="ns-btn-ghost" data-ota="${esc(o.ota)}" data-on="${o.enabled ? 0 : 1}" style="height:32px">${o.enabled ? 'Switch off' : 'Switch on'}</button></td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="ns-card"><div class="ns-h3">Connections</div>
        ${d.connections.length ? `<div class="cn-wrap"><table class="cn-tbl"><thead><tr><th>Property</th><th>OTA · ID</th><th>Status</th><th>Sent</th><th>Checked</th><th>Rooms</th><th>Reservations</th><th></th></tr></thead><tbody>
          ${d.connections.map((c) => { const [tone, label] = STATUS[c.status] || ['grey', c.status]; return `<tr>
            <td><b>${esc(c.property)}</b></td><td>${esc(c.ota_name)}<div class="ns-muted" style="font-size:12px">${esc(c.ota_hotel_id)}</div></td>
            <td><span class="ns-pill ${c.last_error ? 'red' : tone}">${c.last_error ? 'Error' : label}</span>${c.last_error ? `<div style="color:#B23A3A;font-size:12px;margin-top:4px;max-width:260px">${esc(c.last_error)}${c.fails ? ` · ${c.fails} fail${c.fails === 1 ? '' : 's'}` : ''}</div>` : ''}</td>
            <td>${ago(c.last_push_at)}</td><td>${ago(c.last_pull_at)}</td><td>${c.mapped}/${c.groups}</td>
            <td>${c.reservations}${c.problems ? ` <span class="ns-pill red" title="Needing attention in the last 30 days">${c.problems} ⚠</span>` : ''}</td>
            <td><div class="cn-acts"><button type="button" class="ns-btn-ghost" data-log="${c.id}">Log</button>
              ${c.status === 'live' ? `<button type="button" class="ns-btn-ghost" data-retry="${c.id}">Retry now</button>` : ''}
              ${c.ota === 'test' ? `<button type="button" class="ns-btn-ghost" data-sim="${c.id}">Simulate booking</button><button type="button" class="ns-btn-ghost" data-view="${c.id}">OTA view</button>` : ''}</div></td></tr>`; }).join('')}
        </tbody></table></div>` : '<div class="ns-muted" style="font-size:13px;margin-top:6px">No connections yet. Owners connect OTAs from <b>OTA sync → NammaStay Connect</b>. To test, open your own property’s OTA sync page and connect the <b>Test OTA</b>.</div>'}</div>
      <div class="ns-card" id="cn-allres"><div class="ns-h3">OTA reservations</div><div class="ns-muted" style="font-size:12.5px;margin-top:6px">Loading…</div></div>
      <div class="ns-card"><div class="ns-h3">Before applying to an OTA — what the Test OTA proves</div>
        <ol style="margin:8px 0 0 18px;font-size:13.5px;line-height:1.7">
          <li>Full refresh: 365 nights of availability, price and minimum stay arrive (<b>OTA view</b>).</li>
          <li>A booking, block or price change in NammaStay sends only the changed nights within a minute (<b>Log</b>).</li>
          <li>A new OTA reservation becomes a NammaStay booking and is confirmed back (<b>Simulate booking</b>).</li>
          <li>Modification and cancellation update the NammaStay booking and reopen the nights.</li>
          <li>Overbooking and unmatched rooms raise an owner alert instead of failing silently.</li>
          <li>Failures retry with back-off (2 → 64 min) and show here.</li></ol></div>`);

    loadReservations();
    document.querySelectorAll('[data-ota]').forEach((b) => b.addEventListener('click', async () => {
      const o = d.otas.find((x) => x.ota === b.dataset.ota); const on = b.dataset.on === '1';
      if (!(await confirmDialog(on ? `Switch ${o.name} on?` : `Switch ${o.name} off?`,
        on ? `Only if ${o.name} has approved NammaStay and its credentials are saved as secrets. ${o.waiting} waiting connection${o.waiting === 1 ? '' : 's'} will go live and start sending.`
           : `All ${o.name} connections stop sending and receiving until it’s switched on again.`, { confirmLabel: on ? 'Switch on' : 'Switch off', danger: !on }))) return;
      try { const n = await rpc('cn_admin_set_ota', { p_ota: o.ota, p_enabled: on }); toast(`${o.name} ${on ? 'on' : 'off'} — ${n} connection${n === 1 ? '' : 's'} updated.`); draw(); }
      catch (e) { toast(e.message, { error: true }); }
    }));
    document.querySelectorAll('[data-log]').forEach((b) => b.addEventListener('click', () => showLog(d.connections.find((c) => c.id === b.dataset.log))));
    document.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = 'Syncing…';
      try { await rpc('cn_admin_retry', { p_connection: b.dataset.retry }); const r = await call({ action: 'sync', connection_id: b.dataset.retry });
        toast(r.skipped ? r.reason : `Done — ${r.imported} reservation update${r.imported === 1 ? '' : 's'}, ${r.nights_sent} night${r.nights_sent === 1 ? '' : 's'} sent.`); }
      catch (e) { toast(e.message, { error: true }); }
      draw();
    }));
    document.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', () => simulate(d.connections.find((c) => c.id === b.dataset.sim))));
    document.querySelectorAll('[data-setup]').forEach((b) => b.addEventListener('click', () => setup(b.dataset.setup)));
    document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => otaView(d.connections.find((c) => c.id === b.dataset.view))));
  }

  // ------------------------------------------------------------ OTA sync setup queue (046)
  function payPill(x) {
    const pend = (x.payments || []).filter((p) => p.status === 'pending').length;
    if (x.paid_until && x.paid_until >= today()) return `<span class="ns-pill green">Paid until ${day(x.paid_until)}</span>${pend ? ` <span class="ns-pill amber">${pend} to confirm</span>` : ''}`;
    if (pend) return `<span class="ns-pill amber">${pend} payment${pend === 1 ? '' : 's'} to confirm</span>`;
    return !x.managed ? '<span class="ns-pill grey">Own Beds24 (no fee)</span>' : x.paid_until ? `<span class="ns-pill red">Overdue since ${day(x.paid_until)}</span>` : '<span class="ns-pill grey">Waiting for payment</span>';
  }
  function queueHtml(sq) {
    return `<div class="ns-card"><div class="ns-h3">OTA sync setup</div>
      <div class="ns-muted" style="font-size:12.5px;margin:4px 0 10px">Owners who turned on OTA sync (Beds24, “Do it for me”). Confirm the payment, link the property’s Beds24 sub-account, tick the OTAs linked inside Beds24, then go live.</div>
      ${sq.length ? `<div class="cn-wrap"><table class="cn-tbl sq-tbl" style="min-width:860px"><thead><tr><th>Property</th><th>Size</th><th>Payment</th><th>Owner accepted</th><th>Status</th><th></th></tr></thead><tbody>
        ${sq.map((x) => { const [tone, label] = x.connection?.status === 'paused' ? ['grey', 'Paused'] : STATE[x.state] || ['grey', x.state]; return `<tr>
          <td><b>${esc(x.property)}</b><div class="ns-muted" style="font-size:12px">${esc([x.city, x.owner, x.phone].filter(Boolean).join(' · '))}</div></td>
          <td data-l="Size"><div>${x.units} · ${esc(x.kind || '')}</div></td><td data-l="Payment"><div>${payPill(x)}</div></td>
          <td data-l="Owner setup"><div style="font-size:12.5px;line-height:1.6">${OTAS3.map(([k, n]) => x.owner_steps?.[k] ? `${n} ✓` : `<span class="ns-muted">${n} —</span>`).join('<br>')}</div></td>
          <td data-l="Status"><div><span class="ns-pill ${tone}">${label}</span>${x.connection?.last_error ? `<div style="color:#B23A3A;font-size:12px;margin-top:4px;max-width:220px">${esc(x.connection.last_error)}</div>` : ''}</div></td>
          <td style="text-align:right"><button type="button" class="${x.state === 'live' ? 'ns-btn-ghost' : 'ns-btn'}" data-setup="${esc(x.property_id)}" style="height:36px">${x.state === 'live' ? 'Open' : x.state === 'linked' ? 'Continue' : 'Set up'}</button></td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="ns-muted" style="font-size:13px">No requests yet. Owners turn it on from <b>OTA sync → NammaStay Connect</b>.</div>'}</div>`;
  }

  async function setup(propertyId) {
    const all = await rpc('cn_b24_queue'); const x = all.find((i) => i.property_id === propertyId);
    if (!x) { toast('This request is no longer open.', { error: true }); draw(); return; }
    const c = x.connection; const paid = !x.managed || (x.paid_until && x.paid_until >= today());
    const linked = !!c; const groups = (c?.maps || []).filter((m) => m.units > 0); const mapped = groups.filter((m) => m.ota_room_id).length;
    const ticked = OTAS3.filter(([k]) => x.otas_linked?.[k]).length; const live = x.state === 'live' && c?.status === 'live';
    const hook = c ? `${FUNCTIONS_URL}/connect?hook=beds24&c=${c.id}&k=${x.hook_key}` : '';
    const st = (done, now) => (done ? 'done' : now ? 'now' : '');
    const n = (done, i) => (done ? '✓' : i);
    const dlg = modal({ title: `OTA sync · ${x.property}`, width: 820,
      body: `<div>
        <div class="ns-muted" style="font-size:12.5px;margin-bottom:10px">${esc([x.city, x.owner, x.phone, `${x.units} ${x.kind === 'hostel' ? 'beds' : 'units'}`].filter(Boolean).join(' · '))}</div>
        <div class="sq-step ${st(paid, !paid)}"><span class="sq-n">${n(paid, 1)}</span><div class="sq-body"><b>Payment</b>
          ${!x.managed ? '<div class="ns-muted" style="font-size:13px">The owner linked their own Beds24 account — no fee to NammaStay.</div>' : ''}
          ${x.paid_until ? `<div style="font-size:13px">Paid until <b>${day(x.paid_until)}</b></div>` : ''}
          ${(x.payments || []).slice().reverse().map((p) => `<div class="sq-pay"><span>UTR <b>${esc(p.utr)}</b> · ${rupees(p.amount_paise)} · ${fmtDayTime(p.submitted_at)}</span>
            <span class="ns-pill ${p.status === 'approved' ? 'green' : p.status === 'rejected' ? 'red' : 'amber'}">${p.status === 'approved' ? 'Confirmed' : p.status === 'rejected' ? 'Not confirmed' : 'To confirm'}</span>
            ${p.status === 'pending' ? `<span style="margin-left:auto;display:flex;gap:6px"><button type="button" class="ns-btn" data-pay="${esc(p.utr)}" data-ok="1" style="height:32px">Confirm</button><button type="button" class="ns-btn-ghost" data-pay="${esc(p.utr)}" data-ok="0" style="height:32px">Not received</button></span>` : ''}</div>`).join('')}
        </div></div>
        <div class="sq-step ${st(linked, paid && !linked)}"><span class="sq-n">${n(linked, 2)}</span><div class="sq-body"><b>Link the Beds24 sub-account</b>
          ${linked ? `<div class="sq-ok">Linked — Beds24 property <b>${esc(c.ota_hotel_id)}</b> · ${(c.ota_rooms || []).length} Beds24 room${(c.ota_rooms || []).length === 1 ? '' : 's'} · ${mapped} of ${groups.length} room types matched</div>` : ''}
          <div class="ns-muted" style="font-size:12.5px">${linked ? 'To re-link (new key), paste a new invite code.' : 'In NammaStay’s Beds24 account, create a sub-account for this property. In the sub-account: <b>Settings → Marketplace → API → Generate invite code</b>, tick properties, inventory, bookings and bookings-personal (guest data). NammaStay creates the property and one room per room type if the sub-account is empty.'}</div>
          <div class="sq-row">${field('Invite code', '<input class="ns-input" id="sq-code" autocomplete="off" spellcheck="false" maxlength="600">')}
            ${field('Beds24 property ID', `<input class="ns-input" id="sq-pid" inputmode="numeric" maxlength="12" value="${esc(x.b24_property_id || c?.ota_hotel_id || '')}" placeholder="Only if the account has more than one">`)}
            <button type="button" class="ns-btn" id="sq-link" style="height:44px">${linked ? 'Re-link' : 'Link'}</button></div>
          ${linked ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="ns-btn-ghost" id="sq-map" style="height:34px">Match rooms</button><button type="button" class="ns-btn-ghost" id="sq-rooms" style="height:34px">⟳ Get rooms from Beds24</button></div>` : ''}
        </div></div>
        <div class="sq-step ${st(ticked > 0, linked && !ticked)}"><span class="sq-n">${n(ticked > 0, 3)}</span><div class="sq-body"><b>OTAs linked and rooms matched, inside the Beds24 sub-account</b>
          <div class="ns-muted" style="font-size:12.5px">Tick each one when its rooms are matched in Beds24. You can go live with one and add the rest later.</div>
          ${OTAS3.map(([k, nm]) => `<label class="sq-chk"><input type="checkbox" data-sq-ota="${k}" ${x.otas_linked?.[k] ? 'checked' : ''}><b style="flex:1">${nm}</b>
            <span style="font-size:12.5px;font-weight:700;color:${x.owner_steps?.[k] ? '#157A56' : '#7A4A0E'}">${x.owner_steps?.[k] ? 'Owner accepted' : 'Owner hasn’t accepted yet'}</span></label>`).join('')}
          <div><button type="button" class="ns-btn-ghost" id="sq-otas" style="height:34px">Save ticks</button></div>
        </div></div>
        <div class="sq-step ${st(!!x.last_hook_at, false)}"><span class="sq-n">${n(!!x.last_hook_at, 4)}</span><div class="sq-body"><b>Booking webhook</b>
          ${hook ? `<div class="ns-muted" style="font-size:12.5px">In the sub-account: <b>Settings → Properties → Access → Booking webhooks</b> — paste this link. Bookings then arrive in seconds (the every-minute check is the backup).</div>
            <div class="sq-row"><input class="ns-input sq-hook" readonly value="${esc(hook)}" aria-label="Webhook link" style="flex:1 1 320px"><button type="button" class="ns-btn-ghost" id="sq-copy" style="height:44px">Copy link</button></div>
            <div style="font-size:13px">${x.last_hook_at ? `Last ping: <b>${fmtDayTime(x.last_hook_at)}</b>` : 'No ping yet — make a test booking in Beds24, or reopen this after a minute.'}</div>` : '<div class="ns-muted" style="font-size:12.5px">Link the sub-account first.</div>'}
        </div></div>
        <div class="ns-muted" style="font-size:12.5px;line-height:1.5">On going live, NammaStay sends the next 365 days and reads every booking not yet departed from Beds24. If the owner typed some OTA bookings in by hand, cancel those copies afterwards.</div>
      </div>`,
      actions: [{ label: 'Close' }, ...(live ? [] : [{ label: 'Go live', kind: 'primary', onClick: async () => {
        await rpc('cn_b24_admin_go_live', { p_property: x.property_id });
        toast(`${x.property} is live — sending 365 days now.`);
        call({ action: 'sync', connection_id: c.id, full: true }).catch(() => {});
        draw();
      } }])] });
    const el = dlg.el; const again = () => { dlg.close(); draw(); setup(propertyId); };
    const busy = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (e) { toast(e.message, { error: true }); btn.disabled = false; } };
    el.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.ok === '1') return busy(b, async () => {
        await rpc('cn_b24_admin_pay', { p_property: x.property_id, p_utr: b.dataset.pay, p_approve: true });
        toast('Payment confirmed — one month added.'); again();
      });
      dlg.close();
      modal({ title: `Payment not received · UTR ${b.dataset.pay}`, width: 520,
        body: field('Note for the owner', '<textarea class="ns-input" id="sq-note" maxlength="200">We couldn’t find this UPI transaction. Please check the UTR and submit it again.</textarea>'),
        actions: [{ label: 'Back', onClick: () => { setup(propertyId); } }, { label: 'Mark not received', kind: 'danger', onClick: async (ov) => {
          await rpc('cn_b24_admin_pay', { p_property: x.property_id, p_utr: b.dataset.pay, p_approve: false, p_note: ov.querySelector('#sq-note').value });
          toast('Marked as not received. The owner is told.'); draw(); setup(propertyId);
        } }] });
    }));
    el.querySelector('#sq-link').addEventListener('click', (e) => busy(e.target, async () => {
      e.target.textContent = 'Linking…';
      const r = await call({ action: 'link', property_id: x.property_id, code: el.querySelector('#sq-code').value, b24_property_id: el.querySelector('#sq-pid').value });
      toast(`Linked Beds24 ${r.b24_property_id}: ${r.rooms} room${r.rooms === 1 ? '' : 's'}${r.created ? ` (${r.created} created)` : ''}, ${r.mapped} of ${r.groups} matched.`); again();
    }));
    el.querySelector('#sq-map')?.addEventListener('click', () => { dlg.close(); adminMap(x, () => setup(propertyId)); });
    el.querySelector('#sq-rooms')?.addEventListener('click', (e) => busy(e.target, async () => { const r = await call({ action: 'rooms', connection_id: c.id }); toast(`${r.rooms.length} Beds24 room${r.rooms.length === 1 ? '' : 's'} loaded.`); again(); }));
    el.querySelector('#sq-otas').addEventListener('click', (e) => busy(e.target, async () => {
      const otas = Object.fromEntries([...el.querySelectorAll('[data-sq-ota]')].map((i) => [i.dataset.sqOta, i.checked]));
      await rpc('cn_b24_admin_set', { p_property: x.property_id, p: { otas_linked: otas } }); toast('Saved.'); again();
    }));
    el.querySelector('#sq-copy')?.addEventListener('click', async () => { const v = el.querySelector('.sq-hook').value;
      try { await navigator.clipboard.writeText(v); toast('Webhook link copied.'); } catch { el.querySelector('.sq-hook').select(); toast('Selected — press Ctrl+C / ⌘C.'); } });
  }

  function adminMap(x, back) {
    const c = x.connection; const groups = (c.maps || []).filter((m) => m.units > 0); const rooms = c.ota_rooms || [];
    modal({ title: `Match rooms · ${x.property} · Beds24`, width: 720,
      body: `<div class="ns-muted" style="font-size:12.5px;margin-bottom:8px">Each NammaStay room type to one Beds24 room. Room types left out aren’t sold on the OTAs.</div>
        ${groups.map((m) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #F1EAD6" data-g="${esc(m.group_key)}">
          <div><b>${esc(m.title)}</b><div class="ns-muted" style="font-size:12px">${m.units} unit${m.units === 1 ? '' : 's'} · ${rupees(m.rate_paise)}</div></div>
          <select class="ns-input" aria-label="Beds24 room for ${esc(m.title)}"><option value="">— not sold on OTAs —</option>
            ${rooms.map((r) => `<option value="${esc(r.ota_room_id)}" ${r.ota_room_id === m.ota_room_id ? 'selected' : ''}>${esc(r.room_name)}</option>`).join('')}</select></div>`).join('')}`,
      actions: [{ label: 'Back', onClick: () => { back(); } }, { label: 'Save matching', kind: 'primary', onClick: async (ov) => {
        const maps = [...ov.querySelectorAll('[data-g]')].map((r) => ({ group_key: r.dataset.g, ota_room_id: r.querySelector('select').value }));
        await rpc('cn_b24_admin_map', { p_connection: c.id, p_maps: maps }); toast('Saved.'); draw(); back();
      } }] });
  }

  // Every reservation fetched from every OTA, across all properties.
  async function loadReservations() {
    const host = document.getElementById('cn-allres'); if (!host) return;
    let rows;
    try { rows = await rpc('cn_admin_reservations', { p_limit: 200 }); }
    catch (e) { host.innerHTML = `<div class="ns-h3">OTA reservations</div><div class="ns-muted" style="margin-top:6px">${esc(e.message)}</div>`; return; }
    host.innerHTML = `<div class="ns-h3">OTA reservations <span class="ns-muted" style="font-weight:600">(${rows.length})</span></div>
      ${rows.length ? `<div class="cn-wrap"><table class="cn-tbl"><thead><tr><th>Property</th><th>OTA</th><th>Guest</th><th>Stay</th><th>Code</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td><b>${esc(r.property)}</b></td><td>${esc(r.ota_name)}</td><td>${esc(r.guest || '')}</td>
          <td>${day(r.arrival)} → ${day(r.departure)}</td><td>${esc(r.code)}</td>
          <td>${r.amount ? (!r.currency || r.currency === 'INR' ? rupees(Math.round(Number(r.amount) * 100)) : esc(r.currency) + ' ' + esc(r.amount)) : ''}</td>
          <td><span class="ns-pill ${r.problem ? 'red' : r.status === 'cancelled' ? 'grey' : 'green'}">${r.problem ? 'Problem' : r.status === 'cancelled' ? 'Cancelled' : r.status === 'modified' ? 'Changed' : 'New'}</span></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="ns-muted" style="font-size:13px;margin-top:6px">No OTA reservations yet.</div>'}`;
  }

  async function showLog(c) {
    const rows = await rpc('cn_admin_log', { p_connection: c.id, p_limit: 100 });
    modal({ title: `Message log · ${c.property} · ${c.ota_name}`, width: 860,
      body: `<div class="cn-log">${rows.length ? rows.map((l) => `<div class="cn-log-row${l.ok ? '' : ' bad'}">
          <div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><span class="ns-muted" style="font-size:12px">${fmtDayTime(l.at)}</span>
            <b>${l.dir === 'out' ? '→ OTA' : l.dir === 'in' ? '← OTA' : '•'}</b><span class="ns-pill ${l.ok ? 'grey' : 'red'}" style="font-size:10.5px">${esc(l.kind)}</span><span>${esc(l.summary || '')}</span></div>
          ${l.detail ? `<details><summary class="ns-muted" style="font-size:12px;cursor:pointer">Message</summary><pre>${esc(l.detail)}</pre></details>` : ''}</div>`).join('')
        : '<div class="ns-muted">Nothing logged yet.</div>'}</div>`,
      actions: [{ label: 'Close' }] });
  }

  async function simulate(c) {
    const st = await rpc('cn_admin_sim_view', { p_connection: c.id, p_days: 1 });
    const rooms = [...new Set(st.map((r) => r.ota_room_id))];
    const day = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    const recent = await rpc('cn_admin_log', { p_connection: c.id, p_limit: 100 });
    const resCodes = [...new Set(recent.filter((l) => l.kind === 'reservation' && /^New /.test(l.summary || '')).map((l) => (l.summary.match(/^New (\S+)/) || [])[1]).filter(Boolean))].slice(0, 8);
    modal({ title: `Test OTA · simulate a guest`, width: 560,
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="ns-muted" style="font-size:12.5px">Creates a reservation on the Test OTA. The next sync (every minute, or <b>Retry now</b>) brings it into ${esc(c.property)}.</div>
        ${field('OTA room', `<select class="ns-input" id="sim-room">${rooms.length ? rooms.map((r) => `<option>${esc(r)}</option>`).join('') : '<option value="">— send availability first —</option>'}</select>`)}
        ${field('Check-in', `<input class="ns-input" type="date" id="sim-in" value="${day}">`)}
        ${field('Nights', '<input class="ns-input" type="number" id="sim-n" value="2" min="1" max="30">')}
        ${field('Guest first name', '<input class="ns-input" id="sim-g" value="Test" maxlength="40">')}
        ${resCodes.length ? field('…or cancel an earlier test reservation', `<select class="ns-input" id="sim-cancel"><option value="">—</option>${resCodes.map((r) => `<option>${esc(r)}</option>`).join('')}</select>`) : ''}
      </div>`,
      actions: [{ label: 'Close' }, { label: 'Create on Test OTA', kind: 'primary', onClick: async (ov) => {
        const cancel = ov.querySelector('#sim-cancel')?.value;
        const res = await rpc('cn_admin_sim_booking', { p_connection: c.id, p: cancel ? { cancel } : { ota_room_id: ov.querySelector('#sim-room').value,
          checkin: ov.querySelector('#sim-in').value, nights: Number(ov.querySelector('#sim-n').value), guest: ov.querySelector('#sim-g').value } });
        toast(cancel ? `Cancellation of ${res} queued on the Test OTA.` : `Reservation ${res} created on the Test OTA — tap Retry now to pull it in.`);
      } }] });
  }

  async function otaView(c) {
    const rows = await rpc('cn_admin_sim_view', { p_connection: c.id, p_days: 14 });
    const days = [...new Set(rows.map((r) => r.day))]; const rooms = [...new Set(rows.map((r) => r.ota_room_id))];
    const at = (room, day) => rows.find((r) => r.ota_room_id === room && r.day === day);
    modal({ title: `What the Test OTA shows · next 14 nights`, width: 980,
      body: rows.length ? `<div class="cn-wrap"><table class="cn-grid"><thead><tr><th>Room</th>${days.map((dd) => `<th>${dd.slice(5)}</th>`).join('')}</tr></thead><tbody>
          ${rooms.map((r) => `<tr><th>${esc(r)}</th>${days.map((dd) => { const x = at(r, dd); return x ? `<td class="${x.avail ? '' : 'z'}">${x.avail} free<br>₹${Math.round(x.rate_paise / 100).toLocaleString('en-IN')}${x.min_stay > 1 ? `<br>min ${x.min_stay}` : ''}</td>` : '<td>—</td>'; }).join('')}</tr>`).join('')}
        </tbody></table></div>` : '<div class="ns-muted">Nothing received yet — go live and sync first.</div>',
      actions: [{ label: 'Close' }] });
  }
});
