// NammaStay Connect (045) — the owner's card on OTA sync: connect an OTA with its hotel ID, match rooms,
// go live, see reservations and sync status. Talks to the `connect` edge function for "fetch rooms" and "sync now".
// + OTA sync through Beds24 (050): managed setup or an owner-linked Beds24 account.
import { rpc, sb, esc, toast, modal, confirmDialog, fmtDate, rupees, field, W, FUNCTIONS_URL, upiLink, qrDataUrl } from '../core.js';

const COL = { booking: '#003580', mmt: '#E8352E', agoda: '#5C2D91', expedia: '#1B2B5A', hostelworld: '#F25621', test: '#6B7280', beds24: '#0E1B3D' };
const STATUS = { setup: ['amber', 'Setting up'], waiting: ['blue', 'Waiting for OTA approval'], live: ['green', 'Live'], paused: ['grey', 'Paused'] };
const BEDS24_ONLY = new Set(['booking', 'airbnb']);   // Booking.com & Airbnb go through Beds24; NammaStay Connect handles every other OTA
const B24_OTAS = [['booking', 'Booking.com'], ['agoda', 'Agoda'], ['goibibo', 'Goibibo / MakeMyTrip'], ['other', 'Other Beds24 channels']];
const ago = (iso) => { if (!iso) return 'never'; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const day = (d) => (d ? fmtDate(String(d).slice(0, 10) + 'T12:00:00+05:30') : '');
const call = async (body) => {
  const { data, error } = await sb.functions.invoke('connect', { body });
  if (error || data?.error) { let m = data?.error || error?.message; try { const j = await error?.context?.json?.(); if (j?.error) m = j.error; } catch { /* ignore */ } throw new Error(m || 'NammaStay Connect is unavailable.'); }
  return data;
};
const copy = async (text, what) => {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied.`); }
  catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast(`${what} copied.`); } catch { toast('Couldn’t copy — select it and copy by hand.', { error: true }); } t.remove(); }
};
const ICON = {
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"></path>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"></path>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
};
const svg = (k, size = 20, color = '#1C9A6C', w = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

function css() {
  if (document.getElementById('cn-css')) return;
  const s = document.createElement('style'); s.id = 'cn-css';
  s.textContent = `.cn-otas{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-top:12px}
  .cn-ota{border:1px solid #E7DFC7;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;background:#FFFDF6}
  .cn-ota b{font-size:14px}.cn-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
  .cn-conn{border:1px solid #E7DFC7;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;margin-top:12px;background:#FFFDF6}
  .cn-conn-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.cn-conn-head .ns-pill{margin-left:auto}
  .cn-map-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1.6fr);gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #F1EAD6}
  .cn-map-row .ns-input{height:38px}.cn-codes{display:flex;gap:6px}.cn-note{font-size:12.5px;color:#5B6270}
  .cn-sync{border:1px solid #E7DFC7;border-radius:16px;padding:18px;margin-top:12px;background:#FFFFFF;display:flex;flex-direction:column;gap:14px}
  .cn-sync-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cn-sync-top .grow{margin-left:auto}
  .cn-sync-h{margin:0;font-family:'Sora',sans-serif;font-size:21px;font-weight:800;line-height:1.25;max-width:720px}
  .cn-sync-p{margin:0;font-size:14px;line-height:1.6;color:#3C4560;max-width:720px}
  .cn-feats{display:flex;flex-wrap:wrap;gap:10px}.cn-feat{flex:1 1 200px;background:#FFFDF6;border:1px solid #E7DFC7;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:4px}
  .cn-feat b{font-size:14px}.cn-feat span{font-size:13px;line-height:1.5;color:#5B6270}
  .cn-chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cn-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid #E2DAC4;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700}
  .cn-chip i{width:8px;height:8px;border-radius:50%;background:#0E1B3D}
  .cn-price{background:#FBF3DE;border-radius:12px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
  .cn-price-n{font-family:'Sora',sans-serif;font-size:28px;font-weight:800}
  .cn-steps{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px}
  .cn-step{flex:1 1 200px;display:flex;gap:10px;align-items:flex-start;border:1px solid #E7DFC7;border-radius:12px;padding:12px}
  .cn-step.done{border-color:#CDE9DA;background:#F3FAF6}.cn-step.now{border:2px solid #1C9A6C;padding:11px}
  .cn-step .n{flex:none;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid #C9C0A6;color:#5B6270;box-sizing:border-box}
  .cn-step.done .n{background:#1C9A6C;border-color:#1C9A6C;color:#fff}.cn-step.now .n{background:#0E1B3D;border-color:#0E1B3D;color:#fff}
  .cn-step b{display:block;font-size:14px}.cn-step span{font-size:12.5px;color:#5B6270}
  .cn-acc{border:1px solid #E7DFC7;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px}.cn-acc.done{border-color:#CDE9DA;background:#F3FAF6}
  .cn-acc-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cn-acc-h b{font-size:15px}.cn-acc-h .grow{margin-left:auto}
  .cn-acc ol{margin:0;padding-left:20px;font-size:13.5px;line-height:1.6;color:#3C4560}
  .cn-msg{background:#FFFDF6;border:1px dashed #D9CFB2;border-radius:10px;padding:10px 12px;font-size:13.5px;line-height:1.55}
  .cn-list{display:flex;flex-direction:column;border:1px solid #E7DFC7;border-radius:12px;overflow:hidden}
  .cn-list > div{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:11px 14px;border-top:1px solid #EFE8D4}.cn-list > div:first-child{border-top:0}
  .cn-link{font:inherit;font-size:13px;font-weight:700;color:#157A56;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline}
  .cn-hook{display:flex;gap:8px;flex-wrap:wrap}.cn-hook input{flex:1 1 280px;font-family:ui-monospace,monospace;font-size:12px}
  .cn-qr{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center}
  .cx-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .cx-acts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .cx-stats{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#5B6270}
  .cx-stats b{color:#101A3D}
  .cx-err{border:1px solid #F3C4C4;border-radius:10px;background:#FFF6F6;color:#9B2C2C;padding:10px 12px;font-size:13px}
  .cx-bk{display:flex;flex-direction:column;gap:8px}
  .cx-bk-row{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #F1EAD6;padding-top:8px;font-size:12.5px}
  .cx-bk-main{min-width:0;overflow-wrap:anywhere}
  .ota-badge{display:inline-flex;align-items:center;border-radius:999px;padding:4px 9px;color:#fff;font-size:11.5px;font-weight:700}
  @media (max-width:640px){.cn-map-row{grid-template-columns:1fr}.cn-qr{grid-template-columns:1fr}.cn-sync{padding:14px}.cx-bk-row{align-items:flex-start;flex-direction:column}}`;
  document.head.appendChild(s);
}

export async function cnCard(ctx) {
  const host = document.getElementById('cn-card'); if (!host) return;
  let st;
  try { st = await rpc('cn_status', { p_property: ctx.property_id }); }
  catch (error) {
    host.innerHTML = `<div class="ns-card"><div class="ns-h3">Couldn’t load OTA sync</div><div class="ns-muted" style="margin-top:6px">${esc(error.message)}. Check that migrations 049 and 050 are installed and your account has owner/manager access.</div></div>`;
    return;
  }
  let b24; let b24Error;
  try { b24 = await rpc('cn_b24_status', { p_property: ctx.property_id }); }
  catch (error) { b24Error = error.message; }
  css();
  const owner = ctx.can('owner');
  const b24c = st.connections.find((c) => c.ota === 'beds24');
  const others = st.connections.filter((c) => c.ota !== 'beds24' && !BEDS24_ONLY.has(c.ota));
  const used = new Set(st.connections.map((c) => c.ota));
  const free = st.otas.filter((o) => !used.has(o.ota) && o.ota !== 'beds24' && !BEDS24_ONLY.has(o.ota));
  host.innerHTML = `<div class="ns-card">
    <div class="cx-head"><div><div class="ns-h3">🔗 Beds24 OTA sync</div>
      <div class="ns-muted" style="font-size:12.5px">NammaStay sends availability and rates to Beds24; Beds24 distributes them to channels enabled and mapped in your Beds24 account. Reservations return to your calendar.</div></div>
      ${st.is_admin ? '<a class="ns-btn-ghost" href="connections.html">Admin console</a>' : ''}</div>
    ${b24 ? syncHtml(b24, b24c) : `<div class="cn-sync"><b>Couldn’t load Beds24 setup</b><span class="cn-note">${esc(b24Error || 'Apply backend migration 050_connect_beds24.sql to enable Beds24 account linking.')}</span></div>`}
    ${others.map((c) => connRow(c)).join('')}
    ${free.length ? `<div class="cn-otas">${free.map((o) => `<div class="cn-ota"><b><span class="cn-dot" style="background:${COL[o.ota] || '#6B7280'}"></span>${esc(o.name)}</b>
        <span class="cn-note">${o.enabled ? 'Ready to connect' : 'NammaStay’s partner approval in progress — set up now, it goes live automatically once approved.'}</span>
        ${owner ? `<button type="button" class="ns-btn-ghost" data-add="${esc(o.ota)}" style="height:34px">Connect</button>` : ''}</div>`).join('')}</div>` : ''}
  </div>`;

  host.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addConn(ctx, st.otas.find((o) => o.ota === b.dataset.add))));
  host.querySelectorAll('[data-map]').forEach((b) => b.addEventListener('click', () => mapRooms(ctx, st.connections.find((c) => c.id === b.dataset.map))));
  host.querySelectorAll('[data-live]').forEach((b) => b.addEventListener('click', async () => {
    try { const s = await rpc('cn_go_live', { p_connection: b.dataset.live });
      toast(s === 'live' ? 'Live — sending your rooms and prices now.' : 'Saved. It goes live automatically as soon as this OTA approves NammaStay.');
      if (s === 'live') await call({ action: 'sync', connection_id: b.dataset.live, full: true }).catch((e) => toast(e.message, { error: true }));
      cnCard(ctx);
    } catch (e) { toast(e.message, { error: true }); }
  }));
  host.querySelectorAll('[data-sync]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'Syncing…';
    try { const r = await call({ action: 'sync', connection_id: b.dataset.sync });
      toast(r.skipped ? r.reason : `Synced — ${r.imported} reservation update${r.imported === 1 ? '' : 's'}, ${r.nights_sent} night${r.nights_sent === 1 ? '' : 's'} sent.${r.problems?.length ? ' ⚠ ' + r.problems.length + ' need attention' : ''}`, { error: !!r.problems?.length });
    } catch (e) { toast(e.message, { error: true }); }
    cnCard(ctx);
  }));
  host.querySelectorAll('[data-pause]').forEach((b) => b.addEventListener('click', async () => {
    const c = st.connections.find((x) => x.id === b.dataset.pause);
    try { await rpc('cn_pause', { p_connection: c.id, p_paused: c.status !== 'paused' }); toast(c.status === 'paused' ? 'Resumed.' : 'Paused — nothing is sent or received.'); cnCard(ctx); }
    catch (e) { toast(e.message, { error: true }); }
  }));
  host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const c = st.connections.find((x) => x.id === b.dataset.del);
    if (!(await confirmDialog(`Remove ${c.ota_name}?`, `NammaStay stops sending to and reading from ${c.ota_name}. Bookings already made stay. Also switch NammaStay off as connectivity provider in the ${c.ota_name} extranet.`, { confirmLabel: 'Remove', danger: true }))) return;
    try { await rpc('cn_delete', { p_connection: c.id }); toast('Removed.'); cnCard(ctx); } catch (e) { toast(e.message, { error: true }); }
  }));
  // ---- OTA sync (046)
  host.querySelectorAll('[data-b24-pay]').forEach((b) => b.addEventListener('click', () => payModal(ctx, b24)));
  host.querySelector('[data-b24-how]')?.addEventListener('click', () => howModal());
  host.querySelector('[data-b24-own]')?.addEventListener('click', () => linkOwn(ctx));
  host.querySelectorAll('[data-b24-step]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await rpc('cn_b24_owner_step', { p_property: ctx.property_id, p_ota: b.dataset.b24Step, p_done: b.dataset.done === '1' }); cnCard(ctx); }
    catch (e) { toast(e.message, { error: true }); b.disabled = false; }
  }));
  host.querySelector('[data-b24-copymsg]')?.addEventListener('click', (e) => copy(e.target.closest('.cn-acc').querySelector('.cn-msg').textContent.trim(), 'Message'));
  host.querySelector('[data-b24-copyhook]')?.addEventListener('click', (e) => copy(e.target.closest('.cn-hook').querySelector('input').value, 'Webhook link'));
  host.querySelectorAll('[data-b24-off]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmDialog('Turn OTA sync off?', 'Your beds and prices stop updating on your OTAs. Bookings already made stay. You can turn it on again any time.', { confirmLabel: 'Turn off', danger: true }))) return;
    try { await rpc('cn_b24_cancel', { p_property: ctx.property_id }); toast('OTA sync is off.'); cnCard(ctx); } catch (e) { toast(e.message, { error: true }); }
  }));

  // ------------------------------------------------------------ OTA sync section (Beds24)
  function syncHtml(b, c) {
    const s = b.setup; const managed = s?.managed !== false;
    if (!s || s.state === 'cancelled') return offerHtml(b);
    if (!managed) return ownHtml(s, c);
    if (s.state === 'live') return liveHtml(b, s, c);
    return stepsHtml(b, s);
  }
  function offerHtml(b) {
    return `<div class="cn-sync">
      <div class="cn-sync-top">${svg('bolt', 20)}<b style="font-family:'Sora',sans-serif;font-size:15px">OTA sync</b><span class="ns-pill green">New</span></div>
      <h3 class="cn-sync-h">Keep your Beds24-connected booking channels in step.</h3>
      <p class="cn-sync-p">NammaStay sends availability and rates to Beds24 and imports channel reservations from Beds24. Coverage depends on the channels enabled and mapped in your Beds24 account, property configuration, and channel approval.</p>
      <div class="cn-feats">
        <div class="cn-feat">${svg('tool', 22)}<b>We set it up</b><span>Our team links Beds24 and matches your NammaStay room types; you connect each booking channel in Beds24.</span></div>
        <div class="cn-feat">${svg('bolt', 22)}<b>Updates in seconds</b><span>Every booking, blocked ${W.unit} or price change goes out to all your OTAs straight away.</span></div>
        <div class="cn-feat">${svg('cal', 22)}<b>Bookings come in</b><span>New, changed and cancelled OTA bookings appear on your calendar with the guest’s details.</span></div>
      </div>
      <div class="cn-chips"><span class="cn-note" style="font-weight:700">Channel coverage</span><span class="cn-chip"><i></i>Channels enabled in your Beds24 account</span></div>
      <div class="cn-price"><div><div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="cn-price-n">${rupees(b.price_paise)}</span><span class="cn-note" style="font-size:13.5px;font-weight:600">a month per property · GST included</span></div>
          <div class="cn-note">Paid by UPI, like your NammaStay plan.</div></div>
        <div class="cx-acts">${owner ? '<button type="button" class="ns-btn" data-b24-pay>Turn on OTA sync</button>' : ''}<button type="button" class="ns-btn-ghost" data-b24-how>How it works</button></div></div>
      <div class="cn-note">Your Beds24 account must be connected to the booking channels you want to use; each may require its own approval and room mapping.
        ${owner ? ' · <button type="button" class="cn-link" data-b24-own>Already use Beds24? Link your own account</button>' : ''}</div>
    </div>`;
  }
  function stepsHtml(b, s) {
    const paid = !!s.paid_until && s.paid_until >= new Date().toISOString().slice(0, 10);
    const pending = (s.payments || []).filter((p) => p.status === 'pending');
    const rejected = (s.payments || []).filter((p) => p.status === 'rejected').pop();
    const accepted = B24_OTAS.filter(([k]) => s.owner_steps?.[k]).length;
    const steps = {
      booking: `<ol><li>Open the Booking.com extranet and go to <b>Account → Connectivity provider</b>.</li><li>If another provider is connected, click <b>End connection</b> first.</li><li>Search for <b>Beds24</b>, click <b>Connect</b> and accept.</li></ol>`,
      agoda: `<ol><li>In <b>Agoda YCS</b>, open the channel manager setting.</li><li>Choose <b>Beds24</b> and save.</li></ol>`,
      goibibo: `<div class="cn-note" style="font-size:13.5px;color:#3C4560">Goibibo connects channel managers through your market manager. Send them this message:</div>
        <div class="cn-msg">Hi, please connect my property ${esc(ctx.property_name)} (Goibibo ID: your ID) to the channel manager Beds24. Thank you.</div>`,
      other: `<ol><li>In Beds24, connect each additional booking site enabled for your account.</li><li>Map its room types to the Beds24 rooms linked to NammaStay and confirm the channel is active.</li></ol>`,
    };
    return `<div class="cn-sync">
      <div class="cn-sync-top">${svg('bolt', 20)}<b style="font-family:'Sora',sans-serif;font-size:15px">OTA sync</b><span class="ns-pill amber">Setting up</span>
        <span class="cn-note grow">${paid ? `Paid until ${day(s.paid_until)}` : pending.length ? 'Payment submitted · waiting for NammaStay to confirm' : 'Payment not received yet'}</span></div>
      ${rejected && !paid && !pending.length ? `<div class="cx-err">We couldn’t confirm your payment (UTR ${esc(rejected.utr)})${rejected.note ? ': ' + esc(rejected.note) : ''}. ${owner ? '<button type="button" class="cn-link" data-b24-pay>Submit again</button>' : ''}</div>` : ''}
      <ol class="cn-steps">
        <li class="cn-step ${paid ? 'done' : 'now'}"><span class="n">${paid ? svg('check', 14, '#fff', 3) : '1'}</span><span><b>Paid</b><span>${paid ? 'Confirmed' : pending.length ? 'Waiting for confirmation' : 'To do'}</span></span></li>
        <li class="cn-step ${accepted === B24_OTAS.length ? 'done' : paid || pending.length ? 'now' : ''}"><span class="n">${accepted === B24_OTAS.length ? svg('check', 14, '#fff', 3) : '2'}</span><span><b>Connect your channels in Beds24</b><span>You · ${accepted} of ${B24_OTAS.length} steps done</span></span></li>
        <li class="cn-step"><span class="n">3</span><span><b>We connect and go live</b><span>NammaStay team</span></span></li>
      </ol>
      <div><div class="ns-h3" style="font-size:16px">Connect the booking channels in Beds24</div>
        <div class="cn-sync-p" style="font-size:13.5px;margin-top:4px">Enable every channel supported by your Beds24 account, accept Beds24 as the channel manager where required, and map each channel’s rooms to the Beds24 room types linked to NammaStay. The examples below are not an exhaustive channel list.</div></div>
      ${B24_OTAS.map(([k, n]) => { const done = !!s.owner_steps?.[k]; return `<div class="cn-acc${done ? ' done' : ''}">
        <div class="cn-acc-h"><b>${n}</b><span class="ns-pill ${done ? 'green' : 'amber'}">${done ? `Done ${day(s.owner_steps[k])}` : 'To do'}</span>
          ${owner && done ? `<span class="grow"></span><button type="button" class="cn-link" data-b24-step="${k}" data-done="0">Undo</button>` : ''}</div>
        ${done ? '' : steps[k]}
        ${owner && !done ? `<div class="cx-acts">${k === 'goibibo' ? '<button type="button" class="ns-btn-ghost" data-b24-copymsg>Copy message</button>' : ''}<button type="button" class="ns-btn" data-b24-step="${k}" data-done="1">I’ve done this</button></div>` : ''}
      </div>`; }).join('')}
      <div class="cn-note">When you’re done, our team links everything and lets you know. You can keep taking bookings in each extranet meanwhile.
        ${owner ? ' · <button type="button" class="cn-link" data-b24-off>Turn OTA sync off</button>' : ''}</div>
    </div>`;
  }
  function liveHtml(b, s, c) {
    const bad = c?.last_error && c.status === 'live'; const paused = c?.status === 'paused';
    const today = new Date().toISOString().slice(0, 10);
    const due = !!s.paid_until && s.paid_until < today; const soon = !!s.paid_until && !due && (new Date(s.paid_until) - new Date(today)) / 864e5 <= 7;
    const pending = (s.payments || []).some((p) => p.status === 'pending');
    const full = c ? st.connections.find((x) => x.id === c.id) : null;
    const mm = full?.maps || []; const mapped = mm.filter((m) => m.ota_room_id && m.units > 0).length; const groups = mm.filter((m) => m.units > 0).length;
    return `<div class="cn-sync">
      <div class="cn-sync-top">${svg('bolt', 20)}<b style="font-family:'Sora',sans-serif;font-size:15px">OTA sync</b>
        <span class="ns-pill ${bad ? 'red' : paused ? 'grey' : 'green'}">${bad ? 'Needs attention' : paused ? 'Paused' : 'Live'}</span>
        <span class="grow"></span>
        ${c && c.status === 'live' ? `<button type="button" class="ns-btn-ghost" data-sync="${c.id}">⟳ Sync now</button>` : ''}
        ${owner && c && (c.status === 'live' || (paused && !due)) ? `<button type="button" class="ns-btn-ghost" data-pause="${c.id}">${paused ? 'Resume' : 'Pause'}</button>` : ''}</div>
      ${c?.status === 'live' ? `<div class="cx-stats"><span>${W.Units} and prices sent <b>${ago(c.last_push_at)}</b></span><span>Bookings checked <b>${ago(c.last_pull_at)}</b></span>${groups ? `<span>${mapped} of ${groups} room types matched</span>` : ''}</div>` : ''}
      ${bad ? `<div class="cx-err">⚠ ${esc(c.last_error)}${c.retry_at ? ' · trying again shortly' : ''}</div>` : ''}
      ${paused && due ? '<div class="cx-err">OTA sync is paused because the payment is overdue. Pay to switch it back on.</div>' : ''}
      <div class="cn-list">${B24_OTAS.map(([k, n]) => `<div><b>${n}</b>${s.otas_linked?.[k] ? '<span class="ns-pill green">Live</span>'
          : s.owner_steps?.[k] ? `<span class="ns-pill amber">Waiting for ${n}</span>` : '<span class="ns-pill grey">Not connected</span>'}</div>`).join('')}</div>
      ${full?.reservations?.length ? resList(full) : ''}
      <div class="cn-price" style="padding:12px 16px"><span style="font-size:13.5px"><b>OTA sync</b> · ${rupees(b.price_paise)} a month · ${s.paid_until ? `${due ? 'was due' : 'paid until'} ${day(s.paid_until)}` : 'not paid yet'}${pending ? ' · payment waiting for confirmation' : ''}</span>
        ${owner && (due || soon) && !pending ? '<button type="button" class="ns-btn" data-b24-pay>Pay for next month</button>' : owner && !pending ? '<button type="button" class="ns-btn-ghost" data-b24-pay>Pay ahead</button>' : ''}</div>
      ${owner ? '<div class="cn-note"><button type="button" class="cn-link" data-b24-off>Turn OTA sync off</button></div>' : ''}
    </div>`;
  }
  function ownHtml(s, c) {
    const hook = s.hook_key && c ? `${FUNCTIONS_URL}/connect?hook=beds24&c=${c.id}&k=${s.hook_key}` : '';
    const row = c ? st.connections.find((x) => x.id === c.id) : null;
    return `${row ? connRow(row) : ''}
      ${hook ? `<div class="cn-sync" style="gap:8px"><b style="font-size:14px">Instant bookings from your Beds24</b>
        <div class="cn-note">Paste this link in Beds24 → Settings → Properties → Access → <b>Booking webhooks</b>. Bookings then arrive in seconds (without it, NammaStay checks every minute).</div>
        <div class="cn-hook"><input class="ns-input" readonly value="${esc(hook)}" aria-label="Beds24 webhook link"><button type="button" class="ns-btn-ghost" data-b24-copyhook>Copy link</button></div>
        <div class="cn-note">${s.last_hook_at ? `Last ping from Beds24: ${ago(s.last_hook_at)}` : 'No ping from Beds24 yet.'}</div></div>` : ''}`;
  }

  function connRow(c) {
    const [tone, label] = STATUS[c.status] || ['grey', c.status];
    const mapped = c.maps.filter((m) => m.ota_room_id && m.units > 0).length; const groups = c.maps.filter((m) => m.units > 0).length;
    return `<div class="cn-conn">
      <div class="cn-conn-head"><span class="ota-badge" style="background:${COL[c.ota] || '#6B7280'}">${esc(c.ota_name)}</span>
        <span class="ns-muted" style="font-size:12.5px">ID ${esc(c.ota_hotel_id)}</span><span class="ns-pill ${c.last_error && c.status === 'live' ? 'red' : tone}">${c.last_error && c.status === 'live' ? 'Needs attention' : label}</span></div>
      ${c.status === 'live' ? `<div class="cx-stats"><span>Availability &amp; prices sent <b>${ago(c.last_push_at)}</b></span><span>Reservations checked <b>${ago(c.last_pull_at)}</b></span><span>${mapped} of ${groups} room types matched</span></div>` : ''}
      ${c.status === 'waiting' ? `<div class="cn-note">Everything is set up. This connection switches on automatically when ${esc(c.ota_name)} is enabled for NammaStay.</div>` : ''}
      ${c.status === 'setup' ? `<div class="cn-note">${mapped ? `${mapped} of ${groups} room types matched.` : 'Next: match your rooms to the OTA’s rooms.'} Then tap <b>Go live</b>.</div>` : ''}
      ${c.last_error && c.status === 'live' ? `<div class="cx-err">⚠ ${esc(c.last_error)}${c.retry_at ? ` · trying again ${new Date(c.retry_at) > new Date() ? 'shortly' : 'now'}` : ''}</div>` : ''}
      ${mapped < groups && c.status !== 'setup' ? `<div class="cx-err" style="background:#FFF7E8;border-color:#F3D9A6;color:#7A4F0F">${groups - mapped} room type${groups - mapped === 1 ? ' isn’t' : 's aren’t'} matched yet — those ${W.units} aren’t sent to ${esc(c.ota_name)}.</div>` : ''}
      <div class="cx-acts">
        <button type="button" class="ns-btn${c.status === 'setup' ? '-ghost' : '-ghost'}" data-map="${c.id}">Match rooms</button>
        ${c.status === 'setup' && owner ? `<button type="button" class="ns-btn" data-live="${c.id}">Go live</button>` : ''}
        ${c.status === 'live' ? `<button type="button" class="ns-btn-ghost" data-sync="${c.id}">⟳ Sync now</button>` : ''}
        ${owner && c.status !== 'setup' ? `<button type="button" class="ns-btn-ghost" data-pause="${c.id}">${c.status === 'paused' ? 'Resume' : 'Pause'}</button>` : ''}
        ${owner ? `<button type="button" class="ns-btn-ghost" data-del="${c.id}" style="margin-left:auto">Remove</button>` : ''}</div>
      ${c.reservations.length ? resList(c) : ''}
    </div>`;
  }
  function resList(c) {
    const name = c.ota === 'beds24' ? 'OTA' : c.ota_name;
    return `<div class="cx-bk"><div class="ns-muted" style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em">Latest ${esc(name)} reservations</div>
        ${c.reservations.slice(0, 6).map((b) => `<div class="cx-bk-row${b.problem ? ' is-bad' : ''}">
          <span class="cx-bk-main"><b>${esc(b.guest || '')}</b> · ${b.arrival ? fmtDate(b.arrival + 'T12:00:00+05:30') : ''} → ${b.departure ? fmtDate(b.departure + 'T12:00:00+05:30') : ''} · ${esc(b.code || '')}${b.amount ? ` · ${!b.currency || b.currency === 'INR' ? '₹' + Number(b.amount).toLocaleString('en-IN') : esc(b.currency) + ' ' + b.amount}` : ''}
            ${b.problem ? `<br><span style="color:#B23A3A">⚠ ${esc(b.problem)}</span>` : ''}</span>
          <span class="ns-pill ${b.status === 'cancelled' ? 'grey' : b.problem ? 'red' : 'green'}">${b.status === 'cancelled' ? 'Cancelled' : b.status === 'modified' ? 'Changed' : 'New'}</span>
          ${b.booking_ids?.[0] ? `<a class="ns-btn-ghost" style="height:30px;font-size:12px" href="booking-detail.html?id=${esc(b.booking_ids[0])}">Open</a>` : ''}</div>`).join('')}</div>`;
  }
}

// ------------------------------------------------------------ OTA sync: pay (UPI + UTR), how it works, link own Beds24
function payModal(ctx, b) {
  const upi = b.pay_to?.upi_id;
  const first = !b.setup || b.setup.state === 'cancelled';
  const dlg = modal({ title: first ? 'Turn on OTA sync' : 'Pay for OTA sync', width: 560,
    body: upi ? `<div style="display:flex;flex-direction:column;gap:14px">
        <div class="cn-note" style="font-size:13.5px">${first ? 'After payment, connect the channels you use in Beds24 and our team completes the NammaStay setup.' : 'One more month of OTA sync.'}</div>
        <div class="cn-qr"><div style="width:170px;height:170px;border:1px solid #F0EBDB;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#fff" id="cn-qr-box"><img id="cn-qr" alt="UPI QR code" width="160" height="160"></div>
          <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
            <div style="font-size:13.5px;line-height:1.6"><b>1.</b> Pay <b>${rupees(b.price_paise)}</b> to <b>${esc(upi)}</b> (${esc(b.pay_to.payee_name || '')}) — scan the QR or <a id="cn-upi" style="font-weight:700">open your UPI app</a>.</div>
            <div style="font-size:13.5px"><b>2.</b> Enter the 12-digit UPI transaction ID (UTR).</div>
            <input class="ns-input" id="cn-utr" placeholder="e.g. 412345678901" autocomplete="off" inputmode="numeric" maxlength="35" aria-label="UPI transaction ID (UTR)">
          </div></div>
      </div>` : '<div class="ns-demo-hint">Online payment isn’t set up yet. Please contact NammaStay support to turn on OTA sync.</div>',
    actions: upi ? [{ label: 'Cancel' }, { label: 'I’ve paid — submit', kind: 'primary', onClick: async (ov) => {
      await rpc('cn_b24_pay', { p_property: ctx.property_id, p_utr: ov.querySelector('#cn-utr').value });
      toast('Thank you! We’ll confirm your payment shortly.'); cnCard(ctx);
    } }] : [{ label: 'Close' }] });
  if (upi) {
    const link = upiLink({ upiId: upi, payee: b.pay_to.payee_name, amountPaise: b.price_paise, note: `OTA sync ${ctx.property_name}`.slice(0, 40) });
    dlg.el.querySelector('#cn-upi').href = link;
    qrDataUrl(link).then((u) => { if (u) dlg.el.querySelector('#cn-qr').src = u; else dlg.el.querySelector('#cn-qr-box').hidden = true; });
  }
}
function howModal() {
  modal({ title: 'How OTA sync works', width: 560,
    body: `<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.6">
      <li><b>Turn it on</b> and pay by UPI.</li>
      <li><b>Connect your channels in Beds24.</b> Enable the booking sites available for your Beds24 account and map their room types; each site may require separate approval.</li>
      <li><b>We set it up:</b> our team links your Beds24 account, matches your NammaStay rooms, and tells you when it’s live.</li>
      <li><b>That’s it.</b> From then on, every booking, blocked ${W.unit} or price change in NammaStay updates your OTAs within seconds, and OTA bookings appear on your calendar by themselves.</li></ol>`,
    actions: [{ label: 'Close' }] });
}
function linkOwn(ctx) {
  modal({ title: 'Link your own Beds24 account', width: 560,
    body: `<div style="display:flex;flex-direction:column;gap:12px">
      <div class="cn-note" style="font-size:13.5px">If you already use Beds24, NammaStay can work with your account — no OTA sync fee to NammaStay (you keep paying Beds24).</div>
      <ol style="margin:0;padding-left:20px;font-size:13.5px;line-height:1.6"><li>In Beds24: <b>Settings → Marketplace → API → Generate invite code</b>.</li>
        <li>Tick <b>properties</b>, <b>inventory</b>, <b>bookings</b> and <b>bookings-personal</b> (guest details; read and write).</li><li>Paste the code here (it works for 24 hours).</li></ol>
      ${field('Invite code', '<input class="ns-input" id="b24-code" autocomplete="off" spellcheck="false" maxlength="600">')}
      ${field('Beds24 property ID', '<input class="ns-input" id="b24-pid" inputmode="numeric" maxlength="12" placeholder="Only if your Beds24 account has more than one property">')}
    </div>`,
    actions: [{ label: 'Cancel' }, { label: 'Link Beds24', kind: 'primary', onClick: async (ov) => {
      const r = await call({ action: 'link', property_id: ctx.property_id, code: ov.querySelector('#b24-code').value, b24_property_id: ov.querySelector('#b24-pid').value, own: true });
      toast(`Beds24 linked — ${r.mapped} of ${r.groups} room types matched.${r.mapped < r.groups ? ' Match the rest, then tap Go live.' : ' Tap Go live when ready.'}`);
      cnCard(ctx);
    } }] });
}

// ------------------------------------------------------------ connect an OTA (hotel ID)
function addConn(ctx, o) {
  const steps = {
    booking: 'In the Booking.com extranet: <b>Account → Connectivity provider</b> → search <b>NammaStay</b> → accept. Your property ID is the number next to your property name at the top.',
    mmt: 'In the MakeMyTrip (InGo-MMT) extranet, ask support to connect your property to <b>NammaStay</b>. Your Hotel ID is on the extranet home page.',
    agoda: 'In Agoda YCS: <b>Settings → Property settings → Optional settings</b> → channel manager mode → <b>NammaStay</b>.',
    expedia: 'In Expedia Partner Central: <b>Rooms and rates → Connectivity</b> → choose <b>NammaStay</b>.',
    hostelworld: 'In Hostelworld Inbox: <b>Settings → Channel manager</b> → choose <b>NammaStay</b>.',
    test: 'The Test OTA is NammaStay’s built-in simulator, for trying the whole flow. Any code works.',
  };
  modal({ title: `Connect ${o.name}`, width: 560,
    body: `<div style="display:flex;flex-direction:column;gap:12px">
      ${!o.enabled ? `<div class="cn-note" style="background:#EEF4FF;border:1px solid #CFE0FF;color:#1E3A8A;border-radius:10px;padding:10px">NammaStay is completing its partner approval with ${esc(o.name)}. You can set everything up now — the connection switches on by itself once ${esc(o.name)} approves NammaStay.</div>` : ''}
      <div class="cn-note">${steps[o.ota] || ''}</div>
      ${field(`${esc(o.name)} ID`, `<input class="ns-input" id="cn-hid" autocomplete="off" placeholder="${esc(o.hint || '')}" maxlength="40">`)}
    </div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save & match rooms', kind: 'primary', onClick: async (ov) => {
      const id = await rpc('cn_save_connection', { p_property: ctx.property_id, p_ota: o.ota, p_hotel_id: ov.querySelector('#cn-hid').value });
      const st = await rpc('cn_status', { p_property: ctx.property_id });
      setTimeout(() => mapRooms(ctx, st.connections.find((c) => c.id === id)), 30);
      cnCard(ctx);
    } }] });
}

// ------------------------------------------------------------ match NammaStay rooms ↔ OTA rooms
function mapRooms(ctx, c) {
  if (!c) return;
  const groups = c.maps.filter((m) => m.units > 0);
  const listed = c.ota_rooms || [];
  const key = (r) => `${r.ota_room_id}|${r.ota_rate_id || ''}`;
  const rowHtml = (m) => `<div class="cn-map-row" data-g="${esc(m.group_key)}">
      <div><b>${esc(m.title)}</b><div class="cn-note">${m.units} ${m.units === 1 ? W.unit : W.units} · ${rupees(m.rate_paise)} base</div></div>
      <div>${listed.length ? `<select class="ns-input" data-sel aria-label="OTA room for ${esc(m.title)}"><option value="">— not on this OTA —</option>
          ${listed.map((r) => `<option value="${esc(key(r))}" ${key(r) === `${m.ota_room_id}|${m.ota_rate_id || ''}` ? 'selected' : ''}>${esc(r.room_name)}${r.rate_name ? ' · ' + esc(r.rate_name) : ''}</option>`).join('')}</select>`
        : `<div class="cn-codes"><input class="ns-input" data-room placeholder="OTA room code" value="${esc(m.ota_room_id || '')}" aria-label="OTA room code for ${esc(m.title)}">
           <input class="ns-input" data-rate placeholder="Rate code" value="${esc(m.ota_rate_id || '')}" aria-label="OTA rate code for ${esc(m.title)}" style="max-width:130px"></div>`}</div></div>`;
  const dlg = modal({ title: `Match rooms · ${c.ota_name}`, width: 720,
    body: `<div class="cn-note" style="margin-bottom:6px">For each NammaStay room type, pick the matching ${esc(c.ota_name)} room. ${W.Units} you leave out are not sold on ${esc(c.ota_name)}.</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0 8px"><button type="button" class="ns-btn-ghost" id="cn-fetch" style="height:34px">⟳ Get rooms from ${esc(c.ota_name)}</button>
        <span class="cn-note" id="cn-fetch-msg">${listed.length ? `${listed.length} room/rate options loaded.` : 'Or type the OTA’s room and rate codes.'}</span></div>
      <div id="cn-rows">${groups.map(rowHtml).join('')}</div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save matching', kind: 'primary', onClick: async (ov) => {
      const maps = [...ov.querySelectorAll('.cn-map-row')].map((r) => {
        const sel = r.querySelector('[data-sel]');
        if (sel) { const [room, rate] = sel.value ? sel.value.split('|') : ['', '']; return { group_key: r.dataset.g, ota_room_id: room, ota_rate_id: rate }; }
        return { group_key: r.dataset.g, ota_room_id: r.querySelector('[data-room]').value.trim(), ota_rate_id: r.querySelector('[data-rate]').value.trim() };
      });
      await rpc('cn_save_map', { p_connection: c.id, p_maps: maps });
      toast(c.status === 'setup' ? 'Saved. Now tap Go live.' : 'Saved — the changes go out with the next sync.');
      cnCard(ctx);
    } }] });
  dlg.el.querySelector('#cn-fetch').addEventListener('click', async (e) => {
    const msg = dlg.el.querySelector('#cn-fetch-msg'); e.target.disabled = true; msg.textContent = 'Asking the OTA…';
    try {
      const r = await call({ action: 'rooms', connection_id: c.id });
      const st = await rpc('cn_status', { p_property: ctx.property_id });
      const fresh = st.connections.find((x) => x.id === c.id);
      dlg.close(); mapRooms(ctx, fresh); toast(`${r.rooms.length} room/rate options loaded from ${c.ota_name}.`);
    } catch (err) { msg.textContent = err.message; msg.style.color = '#B23A3A'; e.target.disabled = false; }
  });
}
