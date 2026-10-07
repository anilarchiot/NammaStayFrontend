// Form C — foreign guests must be reported to FRRO within 24 hours of arrival (and on departure).
// NammaStay prepares the details in the portal's order, tracks the deadline and records the FRRO number.
import { page, rpc, content, setSubtitle, headerActions, esc, modal, field, options, toast, guestFace, viewIdDocs, fmtDayTime, $, $$ } from '../core.js';

const FRRO_URL = 'https://indianfrro.gov.in/frro/FormC';
const FIELDS = [   // details the FRRO form asks for (beyond name, nationality, date of birth)
  ['gender', 'Gender'], ['passport_no', 'Passport number'], ['passport_place', 'Passport place of issue'], ['passport_issued', 'Passport date of issue'],
  ['passport_expiry', 'Passport valid till'], ['visa_no', 'Visa number'], ['visa_type', 'Visa type'], ['visa_place', 'Visa place of issue'],
  ['visa_issued', 'Visa date of issue'], ['visa_expiry', 'Visa valid till'], ['arrived_india_on', 'Date of arrival in India'], ['arrived_from', 'Arrived in India at (port / city)'],
  ['next_destination', 'Next destination'], ['purpose', 'Purpose of visit'], ['home_address', 'Address in home country']];
const dmy = (v) => { if (!v) return ''; const d = new Date(String(v).length === 10 ? v + 'T12:00:00+05:30' : v);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d); };
const hm = (v) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(v));
const left = (deadline) => {
  const ms = new Date(deadline) - Date.now(); const h = Math.floor(Math.abs(ms) / 36e5); const m = Math.floor((Math.abs(ms) % 36e5) / 6e4);
  return ms < 0 ? [`Overdue by ${h}h ${m}m`, 'red'] : [`${h}h ${m}m left`, h < 6 ? 'amber' : 'green'];
};
const missing = (r) => {
  const f = r.foreign || {}; const out = FIELDS.filter(([k]) => !f[k] && !(k === 'passport_no' && r.guest.id_type === 'passport' && r.guest.id_number)).map(([, l]) => l);
  if (!r.guest.dob) out.unshift('Date of birth');
  return out;
};

page('formc', async (ctx) => {
  let tab = 'due'; let rows = [];
  headerActions().innerHTML = `<a class="ns-btn-ghost" href="${FRRO_URL}" target="_blank" rel="noopener">Open FRRO Form C ↗</a>`;

  async function draw() {
    rows = await rpc('formc_list', { p_property: ctx.property_id, p_days: 60 });
    const groups = {
      due: rows.filter((r) => r.status === 'checked_in' && !r.arrival_at),
      departure: rows.filter((r) => r.status === 'checked_out' && r.arrival_at && !r.departure_at),
      upcoming: rows.filter((r) => ['pending', 'confirmed'].includes(r.status) && !r.arrival_at),
      done: rows.filter((r) => r.arrival_at && (r.departure_at || r.status !== 'checked_out')).concat(rows.filter((r) => r.status === 'checked_out' && !r.arrival_at)),
    };
    const overdue = groups.due.filter((r) => new Date(r.deadline) < Date.now()).length;
    setSubtitle(`${groups.due.length} arrival report${groups.due.length === 1 ? '' : 's'} due${overdue ? ` · ${overdue} overdue` : ''} · ${groups.departure.length} departure report${groups.departure.length === 1 ? '' : 's'}`);
    const TABS = [['due', 'Arrival due'], ['departure', 'Departure due'], ['upcoming', 'Arriving soon'], ['done', 'Done / older']];
    const list = groups[tab];
    content(`
      <div class="fc-intro ns-card">
        <div><b>Form C</b> — report every foreign guest to FRRO <b>within 24 hours of arrival</b>, and again after they check out.
          Fill the details here once, then use <b>Copy for FRRO</b> on the portal and save the FRRO number.</div></div>
      <div class="ns-chips" id="fc-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" class="ns-chip${tab === k ? ' is-on' : ''}" data-tab="${k}" role="tab" aria-selected="${tab === k}">${l} (${groups[k].length})</button>`).join('')}</div>
      ${list.length ? list.map((r) => {
        const miss = missing(r); const dl = left(r.deadline);
        return `<div class="ns-card fc-row">
          <div class="fc-who">${guestFace(r.guest.full_name, 40)}<div><b>${esc(r.guest.full_name)}</b><div class="ns-muted" style="font-size:12.5px">${esc(r.guest.nationality || '')} · ${esc(r.room)} · ${esc(r.bed)} · ${esc(r.code)}</div>
            <div class="ns-muted" style="font-size:12.5px">${r.status === 'checked_out' ? `Left ${fmtDayTime(r.departed_at || r.check_out_at)}` : `Arrived ${fmtDayTime(r.arrived_at)}`}</div></div></div>
          <div class="fc-state">
            ${r.status === 'checked_in' && !r.arrival_at ? `<span class="ns-pill ${dl[1]}">${dl[0]}</span>` : ''}
            ${r.arrival_at ? `<span class="ns-pill green">Arrival ✓ ${esc(r.arrival_ref || '')}</span>` : ''}
            ${r.departure_at ? `<span class="ns-pill green">Departure ✓ ${esc(r.departure_ref || '')}</span>` : ''}
            ${miss.length && !r.arrival_at ? `<span class="ns-pill amber" title="${esc(miss.join(', '))}">${miss.length} detail${miss.length > 1 ? 's' : ''} missing</span>` : ''}
          </div>
          <div class="fc-acts">
            <button type="button" class="ns-btn-ghost" data-det="${esc(r.booking_id)}">Passport &amp; visa</button>
            <button type="button" class="ns-btn-ghost" data-copy="${esc(r.booking_id)}">Copy for FRRO</button>
            ${!r.arrival_at && r.status !== 'pending' && r.status !== 'confirmed' ? `<button type="button" class="ns-btn" data-mark="${esc(r.booking_id)}" data-kind="arrival">Arrival submitted</button>` : ''}
            ${r.arrival_at && r.status === 'checked_out' && !r.departure_at ? `<button type="button" class="ns-btn" data-mark="${esc(r.booking_id)}" data-kind="departure">Departure submitted</button>` : ''}
          </div></div>`; }).join('')
        : `<div class="ns-card ns-empty">${{ due: 'No arrival reports due. 🎉', departure: 'No departure reports due.', upcoming: 'No foreign guests arriving in the next 2 days.', done: 'Nothing here yet.' }[tab]}</div>`}`,
    'padding:24px 32px;display:flex;flex-direction:column;gap:14px;');
    $('#fc-tabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; draw(); } };
    $$('[data-det]').forEach((b) => b.onclick = () => details(rows.find((x) => x.booking_id === b.dataset.det)));
    $$('[data-copy]').forEach((b) => b.onclick = () => copySheet(rows.find((x) => x.booking_id === b.dataset.copy)));
    $$('[data-mark]').forEach((b) => b.onclick = () => mark(rows.find((x) => x.booking_id === b.dataset.mark), b.dataset.kind));
  }

  function details(r) {
    const f = r.foreign || {}; const pass = f.passport_no || (r.guest.id_type === 'passport' ? r.guest.id_number : '');
    const inp = (k, ph = '', type = 'text') => `<input class="ns-input" name="${k}" type="${type}" value="${esc(k === 'passport_no' ? pass || '' : f[k] || '')}" placeholder="${esc(ph)}">`;
    modal({
      title: `Passport & visa · ${r.guest.full_name}`, width: 640,
      body: `<div class="fc-form">
        <div class="fc-h">Passport</div>
        ${field('Gender', `<select class="ns-input" name="gender">${options([['', 'Choose…'], ['male', 'Male'], ['female', 'Female'], ['other', 'Other']], f.gender || '')}</select>`)}
        ${field('Passport number', inp('passport_no', 'e.g. C01X00T47'))}
        ${field('Place of issue', inp('passport_place', 'e.g. Berlin'))}
        ${field('Date of issue', inp('passport_issued', '', 'date'))}
        ${field('Valid till', inp('passport_expiry', '', 'date'))}
        <div class="fc-h">Visa</div>
        ${field('Visa number', inp('visa_no', 'e-Visa: the ETA number'))}
        ${field('Visa type', inp('visa_type', 'e.g. e-Tourist Visa'))}
        ${field('Visa subtype', inp('visa_subtype', 'optional'))}
        ${field('Place of issue', inp('visa_place', 'e.g. Delhi / Online'))}
        ${field('Date of issue', inp('visa_issued', '', 'date'))}
        ${field('Valid till', inp('visa_expiry', '', 'date'))}
        <div class="fc-h">Travel</div>
        ${field('Arrived in India on', inp('arrived_india_on', '', 'date'))}
        ${field('Arrived at (port / city)', inp('arrived_from', 'e.g. Chennai airport'))}
        ${field('Next destination', inp('next_destination', 'e.g. Pondicherry'))}
        ${field('Purpose of visit', `<select class="ns-input" name="purpose">${options([['', 'Choose…'], ['Tourism', 'Tourism'], ['Business', 'Business'], ['Visiting friends/relatives', 'Visiting friends/relatives'], ['Conference', 'Conference'], ['Medical', 'Medical'], ['Study', 'Study'], ['Other', 'Other']], f.purpose || '')}</select>`)}
        <div style="grid-column:1/-1">${field('Address in home country', inp('home_address', 'Street, city, country'))}</div>
        ${field('Contact in India (optional)', inp('contact_india', 'phone'))}
        ${!r.guest.dob ? '<div class="ns-help" style="grid-column:1/-1">Date of birth is missing — add it in the guest profile (Edit profile).</div>' : ''}
      </div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save details', kind: 'primary', onClick: async (el) => {
        const p = {}; el.querySelectorAll('[name]').forEach((i) => { p[i.name] = i.value.trim(); });
        await rpc('formc_save_details', { p_guest: r.guest.id, p }); toast('Passport & visa details saved.'); draw();
      } }],
    });
  }

  function copySheet(r) {
    const f = r.foreign || {}; const g = r.guest;
    const parts = String(g.full_name).trim().split(/\s+/); const surname = parts.length > 1 ? parts.pop() : parts[0]; const given = parts.length ? parts.join(' ') : '';
    const nights = Math.max(1, Math.round((new Date(r.check_out_at) - new Date(r.check_in_at)) / 864e5));
    const items = [
      ['Surname', surname], ['Given name', given], ['Gender', f.gender ? f.gender[0].toUpperCase() + f.gender.slice(1) : ''], ['Date of birth', dmy(g.dob)],
      ['Nationality', g.nationality], ['Address in country of residence', f.home_address],
      ['Passport number', f.passport_no || (g.id_type === 'passport' ? g.id_number : '')], ['Passport place of issue', f.passport_place],
      ['Passport date of issue', dmy(f.passport_issued)], ['Passport valid till', dmy(f.passport_expiry)],
      ['Visa number', f.visa_no], ['Visa type', f.visa_type], ['Visa subtype', f.visa_subtype], ['Visa place of issue', f.visa_place],
      ['Visa date of issue', dmy(f.visa_issued)], ['Visa valid till', dmy(f.visa_expiry)],
      ['Date of arrival in India', dmy(f.arrived_india_on)], ['Arrived in India at', f.arrived_from],
      ['Date of arrival at hotel', dmy(r.arrived_at)], ['Time of arrival at hotel', hm(r.arrived_at)], ['Intended duration of stay (days)', String(nights)],
      ['Next destination', f.next_destination], ['Purpose of visit', f.purpose], ['Contact in India', f.contact_india], ['Mobile', g.phone], ['Email', g.email]];
    const m = modal({
      title: `Copy for FRRO · ${g.full_name}`, width: 620,
      body: `<div class="ns-muted" style="font-size:12.5px">Open <a href="${FRRO_URL}" target="_blank" rel="noopener">FRRO Form C</a> (signed in with your accommodation's login), choose <b>${r.arrival_at ? 'departure' : 'arrival'}</b>, and copy each value in. Upload the guest's photo and passport/visa pages, solve the captcha and submit.</div>
        <div class="fc-copy">${items.map(([l, v], i) => `<div class="fc-copy-row${v ? '' : ' is-missing'}"><span>${esc(l)}</span><b>${v ? esc(v) : 'missing'}</b>${v ? `<button type="button" class="ns-btn-ghost" data-cp="${i}" aria-label="Copy ${esc(l)}">Copy</button>` : '<span></span>'}</div>`).join('')}</div>
        ${g.id_doc_path || g.id_doc_back_path ? '<button type="button" class="ns-btn-ghost" id="fc-ids" style="align-self:flex-start">View passport / visa photos</button>' : '<div class="ns-help">No passport photo on file — take one at check-in or in the guest profile.</div>'}`,
      actions: [{ label: 'Close' }, { label: r.arrival_at ? 'Departure submitted' : 'Arrival submitted', kind: 'primary', onClick: () => { setTimeout(() => mark(r, r.arrival_at ? 'departure' : 'arrival'), 50); } }],
    });
    m.el.querySelectorAll('[data-cp]').forEach((b) => b.onclick = async () => {
      const v = items[+b.dataset.cp][1];
      try { await navigator.clipboard.writeText(v); b.textContent = 'Copied ✓'; setTimeout(() => { b.textContent = 'Copy'; }, 1200); } catch { prompt('Copy:', v); }
    });
    m.el.querySelector('#fc-ids')?.addEventListener('click', () => viewIdDocs({ front: g.id_doc_path, back: g.id_doc_back_path, name: g.full_name }).catch((e) => toast(e.message, { error: true })));
  }

  function mark(r, kind) {
    modal({
      title: `${kind === 'arrival' ? 'Arrival' : 'Departure'} report submitted`, width: 440,
      body: field('FRRO application / reference number', '<input class="ns-input" name="ref" maxlength="60" placeholder="From the FRRO confirmation">', 'Saved on the booking so you can show it if asked.'),
      actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
        const ref = el.querySelector('[name=ref]').value.trim(); if (!ref) throw new Error('Enter the FRRO number.');
        await rpc('formc_mark', { p_booking: r.booking_id, p_kind: kind, p_ref: ref }); toast(`${kind === 'arrival' ? 'Arrival' : 'Departure'} report saved ✓`); draw();
      } }],
    });
  }

  await draw();
  setInterval(() => { if (!document.querySelector('.ns-overlay')) draw(); }, 60000);   // keep countdowns fresh
});
