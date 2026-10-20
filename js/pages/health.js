// Business health — a report card from the property's own data (037_business_health.sql).
// Owner: all areas. Manager: operations view (occupancy, dues, booking mix, guests).
import { page, rpc, content, setSubtitle, headerActions, esc, fmtDate, $ } from '../core.js';

const WORD = { green: 'Good', amber: 'Watch', red: 'Act now', unknown: 'No data yet' };
const TONE = { green: '#3CC48F', amber: '#F2B33D', red: '#F0806A', unknown: '#8A93AD' };
const I = (d, w = 22) => `<svg aria-hidden="true" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const AREA_PATHS = {
  occupancy: '<path d="M3 18V8"/><path d="M3 14h18v4"/><path d="M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
  pricing: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  profit: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><circle cx="16" cy="14.5" r="1.5"/>',
  cash: '<path d="M6 2h12M6 22h12M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10"/>',
  mix: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  guests: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.4 6.5-6.4s6.5 2.8 6.5 6.4"/><circle cx="18" cy="9" r="2.3"/><path d="M15.8 13.8c2.3.5 4.2 2.5 4.2 5.4"/>',
  compliance: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  payback: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
};
const AREA_LINK = {   // where to fix it
  occupancy: ['calendar.html', 'Open calendar'], pricing: ['settings.html?tab=rooms', 'Set prices'], profit: ['expenses.html', 'Expenses & profit'],
  cash: ['payments.html', 'See payments'], mix: ['ota.html', 'OTA sync'], guests: ['guest-profile.html', 'See guests'],
  compliance: ['investment.html#documents', 'Documents'], payback: ['investment.html#payback', 'My business'],
};
const STATUS_IC = {
  green: '<path d="M20 6L9 17l-5-5"/>', amber: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  red: '<path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/>', unknown: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
};
const areaIcon = (k, w) => I(AREA_PATHS[k] || STATUS_IC.unknown, w);

page('health', async (ctx) => {
  if (!['owner', 'manager'].includes(ctx.role)) { content('<div class="ns-card ns-empty">Business health is for the owner and managers.</div>'); return; }
  const h = await rpc('business_health', { p_property: ctx.property_id });
  const owner = h.view === 'owner';
  setSubtitle(`${ctx.property_name} · ${owner ? 'last 30 days, compared with your own past' : 'operations view (no money details)'}`);
  headerActions().innerHTML = owner ? '<button type="button" class="ns-btn-ghost" id="bh-print">Download summary (PDF)</button>' : '';
  $('#bh-print')?.addEventListener('click', () => window.print());

  const s = h.score; const tone = s == null ? 'unknown' : s >= 75 ? 'green' : s >= 55 ? 'amber' : 'red';
  const count = (st) => h.areas.filter((a) => a.status === st).length;
  const t = h.trend || []; const prev = t.length >= 2 ? t[t.length - 2].score : null;
  const delta = s != null && prev != null ? s - prev : null;
  const deltaHtml = delta == null ? '' : `<span class="bhx-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} vs last week</span>`;

  // gauge: a 270° arc with the score
  const C = 2 * Math.PI * 80; const arc = C * 0.75; const val = s == null ? 0 : arc * s / 100;
  const gauge = `<svg class="bhx-gauge" viewBox="0 0 200 190" role="img" aria-label="Health score ${s == null ? 'not available' : s + ' out of 100'}">
    <circle cx="100" cy="100" r="80" fill="none" stroke="#24305A" stroke-width="16" stroke-linecap="round" stroke-dasharray="${arc.toFixed(1)} ${C.toFixed(1)}" transform="rotate(135 100 100)"/>
    <circle cx="100" cy="100" r="80" fill="none" stroke="${TONE[tone]}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${val.toFixed(1)} ${C.toFixed(1)}" transform="rotate(135 100 100)"/>
    <text x="100" y="106" text-anchor="middle" class="bhx-score">${s == null ? '—' : s}</text>
    <text x="100" y="132" text-anchor="middle" class="bhx-of">out of 100</text>
    <text x="44" y="182" text-anchor="middle" class="bhx-end">0</text><text x="156" y="182" text-anchor="middle" class="bhx-end">100</text></svg>`;
  const spark = (() => {
    if (t.length < 2) return '';
    const W = 160; const H = 40; const lo = Math.min(...t.map((p) => p.score)) - 5; const hi = Math.max(...t.map((p) => p.score)) + 5;
    const x = (i) => 5 + i * ((W - 10) / (t.length - 1)); const y = (v) => 5 + (hi - v) * (H - 10) / ((hi - lo) || 1);
    const pts = t.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
    return `<svg class="bhx-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#3CC48F" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(t.length - 1)}" cy="${y(t[t.length - 1].score)}" r="4" fill="#3CC48F"/></svg>`;
  })();

  const actions = (h.actions || []).map((a, i) => {
    const ar = h.areas.find((x) => x.key === a.area); const link = AREA_LINK[a.area];
    return `<li class="bhx-act bhx-${a.status}"><span class="bhx-act-n">${i + 1}</span>
      <div><span class="bhx-act-area">${areaIcon(a.area, 15)} ${esc(ar?.title || '')}</span><p>${esc(a.text)}</p>
        ${link ? `<a href="${link[0]}" class="bhx-act-go">${esc(link[1])} →</a>` : ''}</div></li>`;
  }).join('') || `<li class="bhx-act bhx-green"><span class="bhx-act-n">${I(STATUS_IC.green, 14)}</span><div><p>Nothing urgent — keep doing what you’re doing.</p></div></li>`;

  const order = { red: 0, amber: 1, green: 2, unknown: 3 };
  const card = (a) => {
    const link = AREA_LINK[a.key];
    return `<article class="bhx-area bhx-${a.status}">
      <header><span class="bhx-ic">${areaIcon(a.key)}</span><b>${esc(a.title)}</b><span class="bhx-pill">${I(STATUS_IC[a.status], 13)}${WORD[a.status]}</span></header>
      <div class="bhx-value">${esc(a.value)}</div>
      <div class="bhx-detail">${esc(a.detail || '')}</div>
      ${a.tip ? `<div class="bhx-tip">${esc(a.tip)}</div>` : ''}
      <footer>${a.how ? `<details><summary>How it’s worked out</summary><p>${esc(a.how)}</p></details>` : '<span></span>'}
        ${link && a.status !== 'green' ? `<a href="${link[0]}" class="bhx-go">${esc(link[1])} →</a>` : ''}</footer></article>`;
  };
  const attention = h.areas.filter((a) => a.status === 'red' || a.status === 'amber').sort((x, y) => order[x.status] - order[y.status] || (y.weight || 0) - (x.weight || 0));
  const good = h.areas.filter((a) => a.status === 'green'); const none = h.areas.filter((a) => a.status === 'unknown');
  const section = (list, colour, title) => (list.length ? `<h2 class="bhx-sec"><span class="bhx-sec-dot" style="background:${colour}"></span>${title} <small>${list.length}</small></h2><div class="bhx-grid">${list.map(card).join('')}</div>` : '');

  const trend = (() => {
    if (!owner) return '';
    if (t.length < 2) return `<section class="ns-card bhx-trend"><h2 class="ns-h3" style="margin:0">Score every week</h2><p class="ns-muted" style="margin:6px 0 0">Your trend starts this week — the score is saved every week, so in a few weeks you’ll see if things are getting better.</p></section>`;
    const phone = window.innerWidth < 640; const W = phone ? 380 : 900; const H = phone ? 220 : 200; const n = t.length; const x = (i) => 30 + i * ((W - 60) / (n - 1));
    const lo = Math.max(0, Math.min(70, ...t.map((p) => p.score)) - 8); const y = (v) => 24 + (100 - v) * (H - 56) / (100 - lo);
    const pts = t.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`);
    const fill = `M${pts[0]} L${pts.slice(1).join(' L')} L${x(n - 1).toFixed(1)},${H - 30} L${x(0).toFixed(1)},${H - 30} Z`;
    return `<section class="ns-card bhx-trend"><div class="bhx-trend-h"><h2 class="ns-h3" style="margin:0">Score every week</h2>${deltaHtml}</div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Weekly health score, ${t[0].score} to ${t[n - 1].score}" style="margin-top:6px">
        <rect x="30" y="${y(100)}" width="${W - 60}" height="${(y(75) - y(100)).toFixed(1)}" rx="6" fill="#E9F5EE"></rect>
        <text x="${W - 40}" y="${y(100) + 17}" font-size="12" fill="#0E6E4B" text-anchor="end" font-weight="700">healthy zone · 75+</text>
        <path d="${fill}" fill="#101A3D" opacity=".06"></path>
        <polyline points="${pts.join(' ')}" fill="none" stroke="#101A3D" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>
        ${t.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.score)}" r="${i === n - 1 ? 7 : 5}" fill="${i === n - 1 ? '#1C9A6C' : '#101A3D'}" stroke="#fff" stroke-width="2"><title>Week of ${fmtDate(p.week_start)}: ${p.score}</title></circle>
          <text x="${x(i)}" y="${y(p.score) - 14}" font-size="13" font-weight="800" fill="#101A3D" text-anchor="middle">${p.score}</text>`).join('')}
        <text x="30" y="${H - 8}" font-size="12.5" fill="#5B6478">${esc(fmtDate(t[0].week_start))}</text>
        <text x="${W - 30}" y="${H - 8}" font-size="12.5" fill="#5B6478" text-anchor="end">This week</text></svg></section>`;
  })();

  content(`<section class="bhx-hero" aria-label="Health score">
      <div class="bhx-score-box">
        ${gauge}
        <div class="bhx-verdict"><span class="bhx-kicker">${I('<path d="M3 12h4l2-5 4 10 2-5h6"/>', 15)} ${owner ? 'Business health' : 'Operations score'}</span>
          <b class="bhx-label bhx-l-${tone}">${esc(h.label)}</b>
          <span class="bhx-period">${esc(fmtDate(h.from))} – ${esc(fmtDate(h.today))}</span>
          <div class="bhx-trendline">${deltaHtml}${spark}</div>
          <div class="bhx-counts">
            <span><i style="background:${TONE.green}"></i>${count('green')} good</span>
            <span><i style="background:${TONE.amber}"></i>${count('amber')} watch</span>
            <span><i style="background:${TONE.red}"></i>${count('red')} act now</span></div>
        </div>
      </div>
      <div class="bhx-todo"><h2>${I('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', 18)} Top things to do</h2><ol>${actions}</ol></div>
    </section>
    ${section(attention, TONE.amber, 'Needs attention')}
    ${section(good, TONE.green, 'Doing well')}
    ${section(none, TONE.unknown, 'Not enough data yet')}
    ${trend}
    <p class="ns-muted bh-foot">The score compares your property with its own past — not with other businesses. Areas without enough data are left out. It’s a guide, not financial advice.</p>`);
});
