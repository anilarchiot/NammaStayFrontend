// NammaStay admin → Channel manager: paste the Channex API key here (044). No Supabase secrets needed.
// The key is stored in the database where only the server function can read it — this page only ever sees the last 4 characters.
import { adminPage, rpc, sb, DEMO, content, setSubtitle, headerActions, esc, fmtDayTime, toast, confirmDialog, showFatal, $ } from '../core.js';

// Demo mode: keep a pretend key in this browser so the screen can be tried out
const DEMO_K = 'ns.demo.cxkey';
const demoGet = () => { try { return JSON.parse(localStorage.getItem(DEMO_K) || 'null'); } catch { return null; } };
const demoStatus = () => { const d = demoGet(); return { set: !!d?.key, last4: d?.key ? d.key.slice(-4) : null, base_url: d?.live ? 'https://app.channex.io' : 'https://staging.channex.io', live: !!d?.live, updated_at: d?.at || null }; };
const api = {
  status: () => DEMO ? demoStatus() : rpc('cx_key_status'),
  save: (key, live) => {
    if (!DEMO) return rpc('cx_key_save', { p_key: key || null, p_live: live });
    const d = demoGet() || {}; if (key) { if (key.length < 20 || /\s/.test(key)) throw new Error('That doesn’t look like a Channex API key. Copy it again from Channex → API keys.'); d.key = key; }
    d.live = live; d.at = new Date().toISOString(); localStorage.setItem(DEMO_K, JSON.stringify(d)); return demoStatus();
  },
  clear: () => { if (DEMO) { localStorage.removeItem(DEMO_K); return demoStatus(); } return rpc('cx_key_clear'); },
  test: async () => {
    if (DEMO) { await new Promise((r) => setTimeout(r, 500)); if (!demoGet()?.key) throw new Error('Save a key first.'); return { ok: true, properties: [{ id: 'demo-0000', title: 'Social Backpacker Hostel' }] }; }
    const { data, error } = await sb.functions.invoke('channex', { body: { action: 'key_test' } });
    if (error || data?.error) { let m = data?.error || error?.message; try { const j = await error?.context?.json?.(); if (j?.error) m = j.error; } catch { /* ignore */ } throw new Error(m || 'Couldn’t reach the channel manager.'); }
    return data;
  },
};

adminPage(async (ctx) => {
  if (!ctx.isAdmin) { showFatal('This screen is only for NammaStay admins.'); return; }
  headerActions().innerHTML = '<a class="ns-btn-ghost" href="admin.html">← Admin</a>';
  let st;
  try { st = await api.status(); }
  catch { content(`<div class="ns-card" style="max-width:760px"><div class="ns-h3">Database update needed</div>
      <div class="ns-muted" style="margin-top:6px">Run <b>044_channex_key.sql</b> once in Supabase → SQL Editor, then reload this page.</div></div>`); return; }
  let tested = null;
  draw();

  function draw() {
    setSubtitle(st.set ? `Connected to Channex ${st.live ? 'Live' : 'Test'} · key ••••${esc(st.last4 || '')}` : 'Not connected yet');
    content(`
      <div class="ns-card" style="max-width:760px;display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div><div class="ns-h3">Channex API key</div>
            <div class="ns-muted" style="font-size:13px;margin-top:4px">One key for all NammaStay properties. Owners then tap <b>OTA sync → Set up channel manager</b>.</div></div>
          ${st.set ? `<span class="ns-pill ${st.live ? 'green' : 'amber'}">${st.live ? 'Live' : 'Test mode'}</span>` : '<span class="ns-pill grey">Not set</span>'}
        </div>
        ${st.set ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#F6F2E6;border-radius:10px;padding:12px 14px;font-size:13.5px">
            <span>🔑 Saved key <b style="font-family:ui-monospace,monospace">••••••••${esc(st.last4 || '')}</b></span>
            <span class="ns-muted">· ${esc(st.base_url)}${st.updated_at ? ` · saved ${esc(fmtDayTime(st.updated_at))}` : ''}</span></div>` : ''}
        <div class="ns-field"><label for="cx-key">${st.set ? 'Replace with a new key (optional)' : 'Paste your Channex API key'}</label>
          <input class="ns-input" id="cx-key" type="password" autocomplete="off" spellcheck="false" placeholder="${st.set ? 'Leave empty to keep the saved key' : 'From Channex → your profile → API keys'}"></div>
        <div class="ns-field"><label>Channex account</label>
          <style>.cm-seg{display:flex;gap:8px;flex-wrap:wrap}.cm-seg button{flex:1;min-width:200px;padding:10px 12px;border-radius:8px;border:1px solid #E7DFC7;background:#fff;color:#101A3D;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer}.cm-seg button.is-on{background:#1C9A6C;border-color:#1C9A6C;color:#fff}</style>
          <div class="cm-seg" id="cx-env"><button type="button" data-live="0" class="${st.live ? '' : 'is-on'}">Test (staging.channex.io)</button><button type="button" data-live="1" class="${st.live ? 'is-on' : ''}">Live (app.channex.io)</button></div>
          <div class="ns-help">The key must come from the same account: a staging key only works with Test, a live key only with Live.</div></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="ns-btn" id="cx-save">Save</button>
          <button type="button" class="ns-btn-ghost" id="cx-test"${st.set ? '' : ' disabled'}>Test connection</button>
          ${st.set ? '<button type="button" class="ns-btn-ghost" id="cx-clear" style="margin-left:auto;color:#B23A3A">Remove key</button>' : ''}
        </div>
        <div id="cx-result">${tested ? result(tested) : ''}</div>
      </div>
      <div class="ns-card" style="max-width:760px;font-size:13.5px;line-height:1.7">
        <div class="ns-h3" style="margin-bottom:6px">After saving</div>
        1. Tap <b>Test connection</b> — you should see your Channex properties.<br>
        2. In the hostel app → <b>OTA sync</b> → <b>Set up channel manager</b> (or <b>Already have a Channex property? → Link it</b> with an ID from the list below).<br>
        3. <b>Connect your OTAs</b> → <b>Sync now</b>.<br>
        <span class="ns-muted">Safety: the key is stored where only NammaStay’s server can read it. This page — and anyone using the website — can only see the last 4 characters.</span>
      </div>`);
    let live = !!st.live;
    $('#cx-env').onclick = (e) => { const b = e.target.closest('[data-live]'); if (!b) return; live = b.dataset.live === '1';
      $('#cx-env').querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b)); };
    $('#cx-save').onclick = async (e) => {
      const key = $('#cx-key').value.trim();
      if (!key && !st.set) return toast('Paste the API key first.', { error: true });
      if (live && !st.live && !(await confirmDialog('Switch to Live?', 'Real OTA bookings and prices will flow through this key. Make sure it is your live Channex key (app.channex.io).', { confirmLabel: 'Use Live' }))) return;
      e.target.disabled = true;
      try { st = await api.save(key, live); tested = null; toast('Saved. Now tap Test connection.'); draw(); }
      catch (err) { toast(err.message, { error: true }); e.target.disabled = false; }
    };
    $('#cx-test')?.addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = 'Testing…';
      try { tested = await api.test(); } catch (err) { tested = { error: err.message }; }
      draw();
    });
    $('#cx-clear')?.addEventListener('click', async () => {
      if (!(await confirmDialog('Remove the Channex key?', 'Syncing with OTAs stops for every property until a key is saved again.', { confirmLabel: 'Remove', danger: true }))) return;
      try { st = await api.clear(); tested = null; toast('Key removed.'); draw(); } catch (err) { toast(err.message, { error: true }); }
    });
  }

  function result(t) {
    if (t.error) return `<div class="cx-err" style="background:#FDECEC;border:1px solid #F3C2C2;color:#8A2222;border-radius:10px;padding:12px 14px;font-size:13.5px">⚠ ${esc(t.error)}<br><span style="font-size:12.5px">Check the key was copied fully and that Test/Live matches the account it came from.</span></div>`;
    const ps = t.properties || [];
    return `<div style="background:#E6F5EE;border:1px solid #BFE5D2;color:#0A5C40;border-radius:10px;padding:12px 14px;font-size:13.5px">
      ✅ Connected — ${ps.length} Channex ${ps.length === 1 ? 'property' : 'properties'} on this account.
      ${ps.length ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">${ps.map((p) => `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>${esc(p.title || 'Untitled')}</b>
        <code style="font-size:12px;background:#fff;border-radius:6px;padding:2px 6px">${esc(p.id)}</code>
        <button type="button" class="ns-btn-ghost" data-copy="${esc(p.id)}" style="height:28px;font-size:12px">Copy ID</button></div>`).join('')}</div>` : ''}</div>`;
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Property ID copied — paste it in OTA sync → Link it.'); } catch { toast(b.dataset.copy); }
  });
});
