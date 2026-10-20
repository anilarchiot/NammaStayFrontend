// Housekeeping board — every bed/room: Dirty → Cleaning → Ready (Clean). Check-out marks it Dirty automatically.
import { page, rpc, content, setSubtitle, headerActions, esc, modal, field, toast, fmtTime, W, $, $$ } from '../core.js';

const ST = {
  dirty: { label: 'Dirty', next: 'cleaning', action: 'Start cleaning', icon: '🧺' },
  cleaning: { label: 'Cleaning', next: 'clean', action: 'Mark ready', icon: '🧹' },
  inspect: { label: 'Check', next: 'clean', action: 'Mark ready', icon: '🔍' },
  clean: { label: 'Ready', next: 'dirty', action: 'Mark dirty', icon: '✨' },
};
const ago = (iso) => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

page('housekeeping', async (ctx) => {
  let filter = 'todo';
  headerActions().innerHTML = '<button type="button" class="ns-btn-ghost" id="hk-refresh">⟳ Refresh</button>';

  async function draw() {
    const beds = await rpc('hk_board', { p_property: ctx.property_id });
    const todo = beds.filter((b) => b.status !== 'clean');
    const priority = (b) => (b.status !== 'clean' && b.arriving ? 0 : b.status === 'cleaning' ? 1 : b.status === 'dirty' ? 2 : b.status === 'inspect' ? 3 : 4);
    const list = (filter === 'todo' ? todo : beds).slice().sort((a, b) => priority(a) - priority(b));
    const urgent = todo.filter((b) => b.arriving).length;
    setSubtitle(`${todo.length} ${W.unit}${todo.length === 1 ? '' : 's'} to clean${urgent ? ` · ${urgent} with a guest arriving today` : ''} · ${beds.length - todo.length} ready`);
    content(`
      <div class="ns-chips" id="hk-filter">${[['todo', `To clean (${todo.length})`], ['all', `All ${W.units} (${beds.length})`]].map(([k, l]) => `<button type="button" class="ns-chip${filter === k ? ' is-on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      ${list.length ? `<div class="hk-grid">${list.map((b) => { const s = ST[b.status];
        return `<div class="hk-tile hk-${b.status}${b.status !== 'clean' && b.arriving ? ' hk-urgent' : ''}">
          <div class="hk-top"><span class="hk-name"><b>${esc(b.label)}</b><span>${esc(b.room)}</span></span><span class="hk-badge">${s.icon} ${s.label}</span></div>
          ${b.status !== 'clean' && b.arriving ? `<div class="hk-flag">⏰ ${esc(b.arriving.guest)} arrives ${fmtTime(b.arriving.at)} — clean first</div>` : ''}
          ${b.in_house ? `<div class="hk-info">🛏 ${esc(b.in_house.guest)}${b.in_house.leaving_today ? ` · leaves today ${fmtTime(b.in_house.out)}` : ' · staying'}</div>` : ''}
          ${b.status === 'clean' && b.arriving ? `<div class="hk-info">Arriving: ${esc(b.arriving.guest)} · ${fmtTime(b.arriving.at)}</div>` : ''}
          ${b.blocked ? '<div class="hk-info">🔧 Under maintenance</div>' : ''}
          ${b.note ? `<div class="hk-note">“${esc(b.note)}”</div>` : ''}
          <div class="hk-meta">${b.updated_at ? `${ago(b.updated_at)}${b.updated_by ? ' · ' + esc(b.updated_by) : ''}` : ''}</div>
          <div class="hk-acts">
            <button type="button" class="${b.status === 'clean' ? 'ns-btn-ghost' : 'ns-btn'} hk-go" data-bed="${esc(b.id)}" data-to="${s.next}">${s.action}</button>
            <button type="button" class="ns-btn-ghost hk-more" data-more="${esc(b.id)}" aria-label="More for ${esc(b.label)}">⋯</button>
          </div></div>`; }).join('')}</div>`
        : `<div class="ns-card ns-empty">All ${W.units} are ready. ✨</div>`}`, 'padding:20px 24px;display:flex;flex-direction:column;gap:14px;');
    $('#hk-filter').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; draw(); } };
    $$('[data-to]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      try { await rpc('hk_set', { p_bed: b.dataset.bed, p_status: b.dataset.to, p_note: null }); toast(b.dataset.to === 'clean' ? 'Ready ✨' : b.dataset.to === 'cleaning' ? 'Cleaning started 🧹' : 'Marked dirty'); draw(); }
      catch (e) { toast(e.message, { error: true }); b.disabled = false; }
    });
    $$('[data-more]').forEach((b) => b.onclick = () => more(beds.find((x) => x.id === b.dataset.more)));
  }

  function more(b) {
    modal({
      title: `${b.room} · ${b.label}`, width: 420,
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="hk-pick">${Object.entries(ST).map(([k, s]) => `<label class="hk-opt"><input type="radio" name="st" value="${k}" ${b.status === k ? 'checked' : ''}> ${s.icon} ${s.label}</label>`).join('')}</div>
        ${field('Note for the team (optional)', `<input class="ns-input" name="note" maxlength="200" value="${esc(b.note || '')}" placeholder="e.g. Change bedsheet, AC remote missing">`)}</div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
        await rpc('hk_set', { p_bed: b.id, p_status: el.querySelector('[name=st]:checked').value, p_note: el.querySelector('[name=note]').value }); toast('Saved.'); draw();
      } }],
    });
  }

  $('#hk-refresh').onclick = draw;
  await draw();
  setInterval(() => { if (!document.querySelector('.ns-overlay')) draw(); }, 60000);
});
