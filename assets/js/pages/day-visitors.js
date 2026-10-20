// Day visitors — resorts (034_resort.sql): day-out packages without a room (pool + lunch…),
// headcount, arrival, payments with receipts (RP-…), activities, and the list of day packages.
import { page, rpc, content, setSubtitle, headerActions, esc, rupees, toPaise, fmtDay, fmtTime, ymd, addDays, toast, modal, field, options, METHOD_OPTIONS, waNumber, $ } from '../core.js';

const ST = { booked: ['Expected', 'blue'], arrived: ['Here now', 'green'], left: ['Left', 'grey'], cancelled: ['Cancelled', 'grey'], no_show: ['No-show', 'red'] };

page('dayvisits', async (ctx) => {
  const staff = ctx.can('owner', 'manager', 'front_desk');
  const boss = ctx.can('owner', 'manager');
  const canPay = ctx.allow('record_payments');
  const today = ymd(); let d = today;
  const head = headerActions();
  head.innerHTML = `<button type="button" class="ns-btn-ghost" id="v-prev" aria-label="Previous day">‹</button>
    <input class="ns-input" type="date" id="v-day" value="${d}" style="height:40px;width:auto">
    <button type="button" class="ns-btn-ghost" id="v-next" aria-label="Next day">›</button>
    ${staff ? '<button type="button" class="ns-btn" id="v-new">+ Day visitor</button>' : ''}`;
  const setDay = (x) => { d = x; $('#v-day').value = d; load(); };
  $('#v-prev').onclick = () => setDay(addDays(d, -1));
  $('#v-next').onclick = () => setDay(addDays(d, 1));
  $('#v-day').onchange = (e) => e.target.value && setDay(e.target.value);
  $('#v-new')?.addEventListener('click', () => newVisit());

  let data = null; let pk = [];
  async function load() {
    [data, pk] = await Promise.all([rpc('day_visits_list', { p_property: ctx.property_id, p_day: d }), rpc('dayout_packages_list', { p_property: ctx.property_id })]);
    draw();
  }
  function draw() {
    const t = data.totals;
    setSubtitle(`${fmtDay(d + 'T12:00:00+05:30')}${d === today ? ' · today' : ''} · ${t.people} ${t.people === 1 ? 'visitor' : 'visitors'}`);
    content(`
      <div class="rs-kpis">
        <div class="ns-card pf-kpi"><div class="pf-lbl">Visitors</div><div class="pf-num">${t.people}</div><div class="pf-sub">${t.arrived} arrived · ${t.visits} booking${t.visits === 1 ? '' : 's'}</div></div>
        <div class="ns-card pf-kpi"><div class="pf-lbl">Lunches</div><div class="pf-num">${t.lunches}</div><div class="pf-sub">for the kitchen</div></div>
        <div class="ns-card pf-kpi"><div class="pf-lbl">Billed</div><div class="pf-num">${rupees(t.billed_paise)}</div><div class="pf-sub">packages + activities</div></div>
        <div class="ns-card pf-kpi"><div class="pf-lbl">Collected</div><div class="pf-num">${rupees(t.collected_paise)}</div><div class="pf-sub">${t.billed_paise - t.collected_paise > 0 ? `${rupees(t.billed_paise - t.collected_paise)} still due` : 'all paid'}</div></div>
      </div>
      <div class="ns-card" style="padding:0;overflow:hidden">
        ${data.visits.length ? data.visits.map((v) => { const [sl, sc] = ST[v.status]; return `<div class="rs-visit${['cancelled', 'no_show'].includes(v.status) ? ' is-off' : ''}" data-v="${esc(v.id)}">
            <div style="min-width:0;flex:1"><div style="font-weight:800">${esc(v.guest)} <span class="ns-muted" style="font-weight:600">· ${esc(v.code)}</span></div>
              <div class="ns-muted" style="font-size:12px">${esc(v.package)} · ${v.adults} adult${v.adults > 1 ? 's' : ''}${v.children ? ` + ${v.children} child${v.children > 1 ? 'ren' : ''}` : ''}${v.lunch ? ' · lunch' : ''}${v.phone ? ` · ${esc(v.phone)}` : ''}</div>
              ${v.activities.length ? `<div class="ns-muted" style="font-size:12px">🌿 ${v.activities.map((a) => `${esc(a.name)} ${esc(a.slot)}${a.status === 'cancelled' ? ' (cancelled)' : ''}`).join(' · ')}</div>` : ''}</div>
            <div style="text-align:right;flex-shrink:0"><div style="font-weight:800">${rupees(v.total_paise)}</div>
              <div style="font-size:12px;${v.balance_paise > 0 ? 'color:#B23A3A;font-weight:700' : 'color:#157A56'}">${v.balance_paise > 0 ? `${rupees(v.balance_paise)} due` : 'Paid'}</div></div>
            <div class="rs-visit-act"><span class="ns-pill ${sc}">${sl}</span>
              ${staff && v.status === 'booked' ? '<button type="button" class="ns-btn" data-a="arrived" style="height:30px;font-size:12px">Arrived</button>' : ''}
              ${staff && v.status === 'arrived' ? '<button type="button" class="ns-btn-ghost" data-a="left" style="height:30px;font-size:12px">Left</button>' : ''}
              ${canPay && v.balance_paise > 0 && !['cancelled', 'no_show'].includes(v.status) ? '<button type="button" class="ns-btn-ghost" data-a="pay" style="height:30px;font-size:12px">Collect</button>' : ''}
              ${staff && ['booked', 'arrived'].includes(v.status) ? `<a class="ns-btn-ghost" href="activities.html?day=${esc(d)}" style="height:30px;font-size:12px;display:inline-flex;align-items:center">+ Activity</a>` : ''}
              <button type="button" class="ns-btn-ghost" data-a="more" style="height:30px;font-size:12px" aria-label="More">⋯</button></div></div>`; }).join('')
        : `<div class="ns-empty" style="padding:28px">No day visitors on this day.${staff ? ' Tap “+ Day visitor” to add one.' : ''}</div>`}
      </div>
      <div class="ns-card" style="padding:0;overflow:hidden">
        <div style="padding:18px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div><div class="ns-h3">Day packages</div><div class="ns-muted">What day visitors pay for, per adult and per child, and how many you can take in a day.</div></div>
          ${boss ? `<span style="display:flex;gap:8px">${pk.length ? '' : '<button type="button" class="ns-btn-ghost" id="p-suggest">Add examples</button>'}<button type="button" class="ns-btn" id="p-add">+ Add day package</button></span>` : ''}</div>
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:600px"><thead><tr><th>Package</th><th>Includes</th><th style="text-align:right">Adult</th><th style="text-align:right">Child</th><th>A day</th><th>Offered</th><th class="ns-sticky-end"><span class="sr-only">Actions</span></th></tr></thead><tbody>
        ${pk.map((p) => `<tr data-p="${esc(p.id)}"><td><b>${esc(p.name)}</b>${p.lunch ? ' <span class="ns-pill amber">Lunch</span>' : ''}</td><td style="white-space:normal">${esc(p.includes || '—')}</td>
            <td style="text-align:right">${rupees(p.adult_paise)}</td><td style="text-align:right">${rupees(p.child_paise)}</td><td>${p.capacity || 'No limit'}</td>
            <td>${p.is_active ? '<span class="ns-pill green">Yes</span>' : '<span class="ns-pill grey">Hidden</span>'}</td>
            <td class="ns-sticky-end" style="text-align:right;white-space:nowrap">${boss ? '<button type="button" class="ns-btn-ghost" data-pe style="height:30px;font-size:12px">Edit</button> <button type="button" class="ns-btn-ghost" data-pd style="height:30px;font-size:12px;color:#B23A3A">Remove</button>' : ''}</td></tr>`).join('')
          || '<tr><td colspan="7" class="ns-empty">No day packages yet.</td></tr>'}</tbody></table></div></div>`);
  }

  const payFields = (due) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${field('Amount (₹)', `<input class="ns-input" name="amt" inputmode="decimal" value="${due ? due / 100 : ''}">`)}
      ${field('Method', `<select class="ns-input" name="method">${options(METHOD_OPTIONS, 'upi')}</select>`)}
      <div style="grid-column:1/-1">${field('UPI transaction ID (UTR) / reference', '<input class="ns-input" name="ref" autocomplete="off" placeholder="12-digit UTR for UPI">')}</div></div>`;
  const readPay = (el) => { const v = (n) => el.querySelector(`[name=${n}]`).value.trim(); const a = v('amt') ? toPaise(v('amt')) : 0;
    if (Number.isNaN(a) || a < 0) throw new Error('Enter the amount in rupees.'); return { amount_paise: a, method: v('method'), reference: v('ref') }; };

  function newVisit() {
    const offered = pk.filter((p) => p.is_active);
    if (!offered.length) { toast('Add a day package first (Day packages, below).', { error: true }); return; }
    const m = modal({
      title: `New day visitor · ${fmtDay(d + 'T12:00:00+05:30')}`, width: 560,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="grid-column:1/-1">${field('Day package', `<select class="ns-input" name="pk">${options(offered.map((p) => [p.id, `${p.name} — ${rupees(p.adult_paise)}/adult${p.child_paise ? ` · ${rupees(p.child_paise)}/child` : ''}`]), offered[0].id)}</select>`)}</div>
        ${field('Name *', '<input class="ns-input" name="name" maxlength="120" placeholder="Lead guest or group name">')}
        ${field('Phone', '<input class="ns-input" name="phone" type="tel" placeholder="+91 98400 12233">')}
        ${field('Adults', '<input class="ns-input" name="ad" type="number" min="1" max="500" value="2">')}
        ${field('Children', '<input class="ns-input" name="ch" type="number" min="0" max="500" value="0">')}
        <div style="grid-column:1/-1" class="ns-muted" id="v-total"></div>
        ${canPay ? `<div style="grid-column:1/-1"><div class="ns-h3" style="font-size:14px;margin:4px 0">Paid now (optional)</div>${payFields(0)}</div>` : ''}
        <label style="grid-column:1/-1;display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" name="here" ${d === today ? 'checked' : ''} ${d === today ? '' : 'disabled'}> They are here now (mark arrived)</label></div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`);
        const pay = canPay ? readPay(el) : null;
        const r = await rpc('day_visit_save', { p_property: ctx.property_id, p: { package_id: v('pk').value, guest: v('name').value.trim(), phone: v('phone').value.trim(),
          adults: Number(v('ad').value) || 1, children: Number(v('ch').value) || 0, visit_date: d, arrived: v('here').checked, payment: pay && pay.amount_paise > 0 ? pay : null } });
        toast(`${r.code} saved${r.paid_paise ? ` · ${rupees(r.paid_paise)} received` : ''}.`); await load();
      } }],
    });
    const el = m.el; const v = (n) => el.querySelector(`[name=${n}]`);
    const sync = () => { const p = offered.find((x) => x.id === v('pk').value); const t = p.adult_paise * (Number(v('ad').value) || 0) + p.child_paise * (Number(v('ch').value) || 0);
      el.querySelector('#v-total').innerHTML = `Total <b>${rupees(t)}</b>${p.includes ? ` · ${esc(p.includes)}` : ''}`; if (canPay && !v('amt').dataset.typed) v('amt').value = t ? t / 100 : ''; };
    ['pk', 'ad', 'ch'].forEach((n) => v(n).addEventListener('input', sync)); v('pk').addEventListener('change', sync);
    if (canPay) v('amt').addEventListener('input', () => { v('amt').dataset.typed = '1'; });
    sync();
  }

  function payDialog(vs, refund = false) {
    modal({ title: `${refund ? 'Refund' : 'Collect'} · ${vs.guest} (${vs.code})`, width: 480,
      body: `<div class="ns-muted" style="margin-bottom:10px">${refund ? `Paid ${rupees(vs.paid_paise)}` : `Due ${rupees(vs.balance_paise)} of ${rupees(vs.total_paise)}`}</div>${payFields(refund ? vs.paid_paise : vs.balance_paise)}`,
      actions: [{ label: 'Cancel' }, { label: refund ? 'Refund' : 'Record payment', kind: refund ? 'danger' : 'primary', onClick: async (el) => {
        const r = await rpc('day_visit_pay', { p_id: vs.id, p: { ...readPay(el), kind: refund ? 'refund' : 'payment' } });
        toast(`${r.code} · ${rupees(r.amount_paise)} ${refund ? 'refunded' : 'received'}.`); await load();
      } }] });
  }

  function more(vs) {
    const n = waNumber(vs.phone);
    const text = `Hi ${String(vs.guest).split(/\s+/)[0]}, thank you for visiting ${ctx.property_name}! Receipt ${vs.code}: ${vs.package} for ${vs.adults + vs.children} — ${rupees(vs.total_paise)}${vs.balance_paise > 0 ? `, ${rupees(vs.balance_paise)} still due` : ', fully paid'}.`;
    modal({ title: `${vs.guest} · ${vs.code}`, width: 520,
      body: `<div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">
        <div>${esc(vs.package)} · ${vs.adults} adult${vs.adults > 1 ? 's' : ''}${vs.children ? ` + ${vs.children} child${vs.children > 1 ? 'ren' : ''}` : ''} · ${rupees(vs.package_paise)}</div>
        ${vs.activities.map((a) => `<div>🌿 ${esc(a.name)} ${esc(a.slot)} · ${a.persons} · ${a.status === 'cancelled' ? 'cancelled' : rupees(a.amount_paise)}</div>`).join('')}
        <div style="border-top:1px solid #F0EBDB;padding-top:8px">${vs.payments.length ? vs.payments.map((p) => `<div>${esc(p.code)} · ${p.kind === 'refund' ? 'Refund ' : ''}${rupees(p.amount_paise)} · ${esc(p.method.toUpperCase())}${p.reference ? ` · ${esc(p.reference)}` : ''} · ${fmtTime(p.received_at)}</div>`).join('') : '<span class="ns-muted">No payments yet.</span>'}</div>
        ${vs.arrived_at ? `<div class="ns-muted">Arrived ${fmtTime(vs.arrived_at)}${vs.left_at ? ` · left ${fmtTime(vs.left_at)}` : ''}</div>` : ''}</div>`,
      actions: [
        ...(n ? [{ label: 'WhatsApp receipt', onClick: () => { window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); return false; } }] : []),
        ...(boss && vs.paid_paise > 0 ? [{ label: 'Refund', onClick: () => { setTimeout(() => payDialog(vs, true), 30); } }] : []),
        ...(staff && ['booked', 'arrived'].includes(vs.status) ? [{ label: vs.status === 'booked' ? 'No-show' : 'Cancel visit', kind: 'danger', onClick: async () => {
          await rpc('day_visit_status', { p_id: vs.id, p_status: vs.status === 'booked' && d < today ? 'no_show' : 'cancelled' }); toast('Visit cancelled.'); await load(); } }] : []),
        { label: 'Close', kind: 'primary' }] });
  }

  const editPk = (p) => modal({
    title: p ? 'Edit day package' : 'New day package', width: 520,
    body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">${field('Name', `<input class="ns-input" name="name" maxlength="60" value="${esc(p?.name || '')}" placeholder="e.g. Pool + lunch">`)}</div>
      <div style="grid-column:1/-1">${field('Includes', `<input class="ns-input" name="inc" maxlength="300" value="${esc(p?.includes || '')}" placeholder="e.g. Pool, buffet lunch, indoor games">`)}</div>
      ${field('Per adult (₹)', `<input class="ns-input" name="ad" inputmode="decimal" value="${p ? p.adult_paise / 100 : ''}">`)}
      ${field('Per child (₹)', `<input class="ns-input" name="ch" inputmode="decimal" value="${p ? p.child_paise / 100 : 0}">`)}
      ${field('Most visitors a day', `<input class="ns-input" name="cap" type="number" min="0" max="2000" value="${p?.capacity ?? 40}">`, '0 = no limit')}
      <label style="display:flex;gap:6px;align-items:center;font-size:13px;align-self:end"><input type="checkbox" name="lunch" ${p?.lunch ? 'checked' : ''}> Includes lunch (kitchen count)</label>
      <label style="grid-column:1/-1;display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" name="active" ${!p || p.is_active ? 'checked' : ''}> Offered</label></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
      const v = (n) => el.querySelector(`[name=${n}]`); const money = (n) => (v(n).value.trim() ? toPaise(v(n).value) : 0);
      if (Number.isNaN(money('ad')) || Number.isNaN(money('ch'))) throw new Error('Enter prices in rupees, e.g. 1200.');
      await rpc('dayout_package_save', { p_property: ctx.property_id, p: { id: p?.id || null, name: v('name').value.trim(), includes: v('inc').value.trim(), adult_paise: money('ad'),
        child_paise: money('ch'), capacity: Number(v('cap').value) || 0, lunch: v('lunch').checked, is_active: v('active').checked } });
      toast('Day package saved.'); await load();
    } }],
  });

  document.querySelector('.ns-content').addEventListener('click', async (e) => {
    const row = e.target.closest('[data-v]');
    const a = e.target.closest('[data-a]');
    if (row && a) {
      const vs = data.visits.find((x) => x.id === row.dataset.v);
      if (a.dataset.a === 'pay') return payDialog(vs);
      if (a.dataset.a === 'more') return more(vs);
      a.disabled = true;
      try { await rpc('day_visit_status', { p_id: vs.id, p_status: a.dataset.a }); toast(a.dataset.a === 'arrived' ? `${vs.guest} arrived.` : `${vs.guest} left.`); await load(); }
      catch (err) { toast(err.message, { error: true }); a.disabled = false; }
      return;
    }
    if (e.target.closest('#p-add')) return editPk(null);
    if (e.target.closest('#p-suggest')) {
      try { for (const p of [{ name: 'Pool + lunch', includes: 'Pool, buffet lunch, indoor games', lunch: true, adult_paise: 120000, child_paise: 60000, capacity: 40 },
        { name: 'Full day out', includes: 'Pool, lunch, plantation walk, evening tea', lunch: true, adult_paise: 180000, child_paise: 90000, capacity: 25 }]) await rpc('dayout_package_save', { p_property: ctx.property_id, p });
      toast('2 example day packages added — change them to yours.'); await load(); } catch (err) { toast(err.message, { error: true }); }
      return;
    }
    const pr = e.target.closest('[data-p]'); if (!pr) return; const p = pk.find((x) => x.id === pr.dataset.p);
    if (e.target.closest('[data-pe]')) editPk(p);
    if (e.target.closest('[data-pd]')) modal({ title: 'Remove day package', width: 420, body: `<p style="margin:0;font-size:14px">Remove <b>${esc(p.name)}</b>? Visits that used it keep it.</p>`,
      actions: [{ label: 'Cancel' }, { label: 'Remove', kind: 'danger', onClick: async () => { await rpc('dayout_package_delete', { p_id: p.id }); toast('Day package removed.'); await load(); } }] });
  });

  await load();
});
