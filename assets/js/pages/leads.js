// Leads from the homepage "Get early access" form. Visible only to NammaStay platform admins.
import { page, rpc, content, setSubtitle, headerActions, headerSearch, esc, fmtDayTime, modal, toast, field, options,
  downloadCsv, showFatal, $, $$ } from '../core.js';

const STATUS = [['new', 'New', 'amber'], ['contacted', 'Contacted', 'blue'], ['demo_booked', 'Demo booked', 'purple'], ['won', 'Won', 'green'], ['lost', 'Lost', 'grey']];
const LABEL = Object.fromEntries(STATUS.map(([v, l]) => [v, l]));
const COLOR = Object.fromEntries(STATUS.map(([v, , c]) => [v, c]));
const TYPE = { hostel: 'Hostel', homestay: 'Homestay', hotel: 'Hotel / guest house', other: 'Other' };

page(null, async (ctx) => {
  if (!ctx.isAdmin) { showFatal('Leads are only visible to NammaStay admins.'); return; }
  const state = { status: '', q: '', cursor: null, rows: [] };
  const head = headerActions();
  head.innerHTML = '<div class="ns-search"><span>Search</span></div><button type="button" class="ns-btn-ghost" id="csv">Export CSV</button>';
  headerSearch('Search name, phone, city…', (v) => { state.q = v; load(true); });

  content(`
    <div id="chips" style="display:flex;gap:8px;flex-wrap:wrap"></div>
    <div class="ns-card" style="padding:0;overflow:hidden"><div style="overflow-x:auto">
      <table class="ns-table" style="min-width:900px"><thead><tr><th>Received</th><th>Name</th><th>Contact</th><th>Property</th><th>Message</th><th>Status</th><th></th></tr></thead>
      <tbody id="rows"></tbody></table></div>
      <div id="more-wrap" style="padding:14px;text-align:center;border-top:1px solid #F3EFE1" hidden><button type="button" class="ns-btn-ghost" id="more">Load more</button></div>
    </div>`);

  async function chips() {
    const c = await rpc('lead_counts');
    setSubtitle(`${c.all || 0} total · ${c.last_7_days || 0} in the last 7 days · from thenammastay.in`);
    $('#chips').innerHTML = [['', 'All', c.all], ...STATUS.map(([v, l]) => [v, l, c[v]])].map(([v, l, n]) =>
      `<button type="button" class="ns-chip${v === state.status ? ' is-on' : ''}" data-s="${v}">${l} (${n || 0})</button>`).join('');
    $$('#chips [data-s]').forEach((b) => b.onclick = () => { state.status = b.dataset.s; chips(); load(true); });
  }

  const row = (l) => {
    const wa = l.phone ? `https://wa.me/${l.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${l.name.split(' ')[0]}, thanks for your interest in NammaStay!`)}` : '';
    return `<tr data-id="${esc(l.id)}">
      <td class="ns-muted">${fmtDayTime(l.created_at)}</td>
      <td style="font-weight:700">${esc(l.name)}${l.notes ? '<div class="ns-muted" style="font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis">📝 ' + esc(l.notes) + '</div>' : ''}</td>
      <td>${l.phone ? `<a href="${esc(wa)}" target="_blank" rel="noopener" style="color:#157A56;font-weight:700">${esc(l.phone)}</a>` : ''}
          ${l.email ? `<div><a href="mailto:${esc(l.email)}" style="color:#2D5FA6">${esc(l.email)}</a></div>` : ''}</td>
      <td>${esc(l.property_name || '—')}<div class="ns-muted">${esc([TYPE[l.property_type], l.beds ? l.beds + ' beds/rooms' : '', l.city].filter(Boolean).join(' · '))}</div></td>
      <td class="ns-muted" style="max-width:220px;overflow:hidden;text-overflow:ellipsis" title="${esc(l.message || '')}">${esc(l.message || '—')}</td>
      <td><span class="ns-pill ${COLOR[l.status]}">${LABEL[l.status]}</span></td>
      <td><button type="button" class="ns-btn-ghost" style="height:32px;font-size:12px" data-edit="${esc(l.id)}">Update</button></td></tr>`;
  };

  async function load(first) {
    if (first) { state.cursor = null; state.rows = []; $('#rows').innerHTML = ''; }
    const rows = await rpc('list_leads', { p_status: state.status || null, p_q: state.q || null,
      p_cursor_at: state.cursor?.at || null, p_cursor_id: state.cursor?.id || null, p_limit: 50 });
    state.rows.push(...rows);
    if (first && !rows.length) $('#rows').innerHTML = `<tr><td colspan="7" class="ns-empty">${state.q ? 'No leads match your search.' : 'No leads yet. They appear here when someone fills the form on your homepage.'}</td></tr>`;
    $('#rows').insertAdjacentHTML('beforeend', rows.map(row).join(''));
    const last = rows[rows.length - 1];
    state.cursor = last ? { at: last.created_at, id: last.id } : null;
    $('#more-wrap').hidden = rows.length < 50;
  }

  $('#rows').addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit]'); if (!b) return;
    const l = state.rows.find((x) => x.id === b.dataset.edit);
    modal({
      title: `Update · ${l.name}`,
      body: `${field('Status', `<select class="ns-input" name="status">${options(STATUS.map(([v, lbl]) => [v, lbl]), l.status)}</select>`)}
        ${field('Notes (only you see these)', `<textarea class="ns-input" name="notes" maxlength="2000" placeholder="Called on Monday, wants a demo next week…">${esc(l.notes || '')}</textarea>`)}
        ${l.message ? `<div class="ns-help" style="font-size:12.5px"><b>Their message:</b> ${esc(l.message)}</div>` : ''}
        ${l.source ? `<div class="ns-help">Came from: ${esc(l.source)}</div>` : ''}`,
      actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
        await rpc('update_lead', { p_id: l.id, p_status: el.querySelector('[name=status]').value, p_notes: el.querySelector('[name=notes]').value });
        toast('Lead updated.'); chips(); load(true);
      } }],
    });
  });
  $('#more').onclick = () => load(false);

  $('#csv').onclick = async (e) => {
    e.target.disabled = true;
    try {
      const out = [['Received', 'Name', 'Phone', 'Email', 'Property', 'Type', 'Beds/rooms', 'City', 'Message', 'Status', 'Notes', 'Source']];
      let cursor = null;
      for (let i = 0; i < 500; i++) {
        const rows = await rpc('list_leads', { p_status: state.status || null, p_q: state.q || null, p_cursor_at: cursor?.at || null, p_cursor_id: cursor?.id || null, p_limit: 200 });
        rows.forEach((l) => out.push([fmtDayTime(l.created_at), l.name, l.phone, l.email, l.property_name, TYPE[l.property_type] || '', l.beds, l.city, l.message, LABEL[l.status], l.notes, l.source]));
        if (rows.length < 200) break;
        cursor = { at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id };
      }
      downloadCsv('nammastay_leads.csv', out);
    } catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
  };

  await Promise.all([chips(), load(true)]);
});
