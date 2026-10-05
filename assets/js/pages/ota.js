// OTA calendar sync (iCal) — export each bed/room's NammaStay calendar to OTAs, import OTA calendars back.
import { page, rpc, sb, content, setSubtitle, headerActions, esc, toast, confirmDialog, field, options, showFatal, W,
  FUNCTIONS_URL, OTA, DEMO, $, $$ } from '../core.js';

const ago = (iso) => {
  if (!iso) return 'not synced yet';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const HOWTO = [
  ['airbnb', 'Airbnb', 'Listing → <b>Availability</b> → <b>Connect calendars</b> (Sync calendars). <b>Export</b>: copy Airbnb’s link and add it here. <b>Import</b>: “Connect another calendar” → paste the NammaStay link.'],
  ['booking', 'Booking.com', 'Extranet → <b>Rates & availability</b> → <b>Sync calendars</b> (if your listing offers it — mostly homes & apartments). Export Booking.com’s link → add it here; import the NammaStay link there.'],
  ['agoda', 'Agoda', 'YCS → <b>Calendar</b> → <b>Calendar sync / iCal</b> (homes listings). Same two steps.'],
  ['vrbo', 'Vrbo', 'Calendar → <b>Import & export</b>. Same two steps.'],
  ['google', 'Google Calendar', 'Settings → your calendar → <b>Secret address in iCal format</b> → add it here (e.g. owner’s personal blocks).'],
];

page('ota', async (ctx) => {
  if (!ctx.can('owner', 'manager')) { showFatal('Only the owner or manager can set up OTA sync.'); return; }
  const canEdit = ctx.allow('manage_rooms');
  headerActions().innerHTML = '<button type="button" class="ns-btn" id="sync-now">⟳ Sync now</button>';

  async function draw() {
    const beds = await rpc('ota_overview', { p_property: ctx.property_id });
    const feeds = beds.flatMap((b) => b.feeds);
    const errs = feeds.filter((f) => f.last_status === 'error').length;
    const lastSync = feeds.map((f) => f.last_synced_at).filter(Boolean).sort().pop();
    setSubtitle(`${feeds.length} OTA calendar${feeds.length === 1 ? '' : 's'} connected · last sync ${ago(lastSync)}${errs ? ` · ${errs} need attention` : ''}`);
    let room = null;
    content(`
      <div class="ns-card ota-intro">
        <div class="ns-h3">Keep Airbnb, Booking.com and NammaStay in step</div>
        <div class="ota-steps">
          <div><span>1</span><b>Export to the OTA</b><br>Copy a ${W.unit}’s NammaStay link and paste it in the OTA’s “import calendar”. Nights booked here close there.</div>
          <div><span>2</span><b>Import from the OTA</b><br>Copy the OTA’s calendar (export / iCal) link and add it below. Their bookings appear on your calendar as 🔗 blocks.</div>
          <div><span>3</span><b>Automatic</b><br>NammaStay checks every 30 minutes, or tap <b>Sync now</b>. A clash with an existing booking sends you an alert.</div>
        </div>
        <details class="ota-howto"><summary>Where to find the calendar links on each OTA</summary>
          ${HOWTO.map(([k, n, t]) => `<div class="ota-how"><span class="ota-dot" style="background:${OTA[k].color}"></span><div><b>${n}</b> — ${t}</div></div>`).join('')}
          <div class="ns-help" style="margin-top:8px">iCal shares <b>dates only</b> — not prices or guest details. OTAs refresh imported calendars on their own schedule (often every few hours), so a booking made on two sites within minutes can still clash. Hostelworld, MakeMyTrip and Booking.com hotel/hostel listings usually need a channel manager instead of iCal.</div>
        </details>
      </div>
      ${beds.map((b) => {
        let head = '';
        if (b.room !== room) { room = b.room; head = `<div class="ota-room">${esc(room)}</div>`; }
        return `${head}<div class="ns-card ota-bed${b.is_active ? '' : ' is-off'}" data-bed="${esc(b.bed_id)}">
          <div class="ota-bed-head"><b>${esc(b.label)}</b>${b.is_active ? '' : ' <span class="ns-pill grey">Not in use</span>'}</div>
          <div class="ota-cols">
            <div class="ota-col">
              <div class="ota-lbl">⬆ NammaStay link — paste into the OTA</div>
              <div class="ota-export">
                <select class="ns-input" data-exp-ch aria-label="For which OTA">${options(Object.entries(OTA).filter(([k]) => k !== 'other').map(([k, v]) => [k, `For ${v.name}`]).concat([['', 'Any OTA']]), 'airbnb')}</select>
                <input class="ns-input" readonly data-exp-url value="${esc(`${FUNCTIONS_URL}/ical?t=${b.token}&c=airbnb`)}" aria-label="Calendar link">
                <button type="button" class="ns-btn-ghost" data-copy>Copy</button>
              </div>
              <button type="button" class="ota-link-btn" data-newtok>Make a new link (if this one was shared by mistake)</button>
            </div>
            <div class="ota-col">
              <div class="ota-lbl">⬇ OTA calendars — imported here</div>
              ${b.feeds.length ? b.feeds.map((f) => `<div class="ota-feed${f.last_status === 'error' ? ' is-err' : ''}">
                  <span class="ota-badge" style="background:${(OTA[f.channel] || OTA.other).color}">${esc((OTA[f.channel] || OTA.other).name)}</span>
                  <span class="ota-feed-main"><span class="ota-url">${esc(f.import_url)}</span>
                    <span class="ota-status">${f.last_status === 'error' ? `⚠ ${esc(f.last_error || 'Sync failed')}` : `✓ ${ago(f.last_synced_at)} · ${f.events_count} upcoming booking${f.events_count === 1 ? '' : 's'}`}</span></span>
                  ${canEdit ? `<button type="button" class="ns-icon-del" data-del-feed="${esc(f.id)}" aria-label="Remove ${esc((OTA[f.channel] || OTA.other).name)} calendar" title="Remove">✕</button>` : ''}</div>`).join('')
                : '<div class="ns-muted" style="font-size:12.5px">No OTA calendar yet.</div>'}
              ${canEdit ? `<div class="ota-add">
                <select class="ns-input" data-add-ch aria-label="OTA">${options(Object.entries(OTA).map(([k, v]) => [k, v.name]), 'airbnb')}</select>
                <input class="ns-input" data-add-url placeholder="Paste the OTA’s calendar link (https://…ics)" aria-label="OTA calendar link">
                <button type="button" class="ns-btn" data-add>Add</button></div>` : ''}
            </div>
          </div></div>`;
      }).join('') || '<div class="ns-card ns-empty">Add your rooms and beds first (Rooms).</div>'}`);

    $$('.ota-bed').forEach((card) => {
      const bed = beds.find((x) => x.bed_id === card.dataset.bed);
      const urlEl = card.querySelector('[data-exp-url]'); const chEl = card.querySelector('[data-exp-ch]');
      const setUrl = () => { urlEl.value = `${FUNCTIONS_URL}/ical?t=${bed.token}${chEl.value ? '&c=' + chEl.value : ''}`; };
      chEl.addEventListener('change', setUrl);
      card.querySelector('[data-copy]').onclick = async () => {
        try { await navigator.clipboard.writeText(urlEl.value); toast(`Link copied — paste it in ${chEl.value ? OTA[chEl.value].name : 'the OTA'}’s “import calendar”.`); }
        catch { urlEl.select(); toast('Select the link and copy it.'); }
      };
      card.querySelector('[data-newtok]').onclick = async () => {
        if (!await confirmDialog('Make a new link', `The old link for ${bed.label} stops working. You’ll need to paste the new one into every OTA that uses it.`, { confirmLabel: 'Make new link' })) return;
        await rpc('ota_new_token', { p_bed: bed.bed_id }); toast('New link made — update it on your OTAs.'); draw();
      };
      card.querySelector('[data-add]')?.addEventListener('click', async (e) => {
        const url = card.querySelector('[data-add-url]').value.trim();
        if (!/^https:\/\//.test(url)) return toast('Paste the full calendar link from the OTA — it starts with https://', { error: true });
        e.target.disabled = true;
        try {
          await rpc('ota_feed_save', { p_property: ctx.property_id, p: { bed_id: bed.bed_id, channel: card.querySelector('[data-add-ch]').value, import_url: url } });
          toast('Calendar added — syncing…'); await syncNow(true);
        } catch (err) { toast(err.message, { error: true }); e.target.disabled = false; }
      });
      card.querySelectorAll('[data-del-feed]').forEach((b) => b.addEventListener('click', async () => {
        if (!await confirmDialog('Remove OTA calendar', 'Its imported bookings disappear from your calendar. Bookings on the OTA itself are not affected.', { confirmLabel: 'Remove', danger: true })) return;
        await rpc('ota_feed_delete', { p_feed: b.dataset.delFeed }); toast('Removed.'); draw();
      }));
    });
  }

  async function syncNow(quiet = false) {
    const btn = $('#sync-now'); btn.disabled = true; btn.textContent = '⟳ Syncing…';
    try {
      const { data, error } = await sb.functions.invoke('ota-sync', { body: { property_id: ctx.property_id } });
      if (error) throw new Error(error.message || 'Sync failed.');
      const r = data?.results || [];
      const add = r.reduce((t, x) => t + (x.added || 0), 0); const clash = r.reduce((t, x) => t + (x.clashes || 0), 0); const bad = r.filter((x) => x.error).length;
      if (!quiet || bad || clash) toast(`Synced ${r.length} calendar${r.length === 1 ? '' : 's'} · ${add} new booking${add === 1 ? '' : 's'}${clash ? ` · ⚠ ${clash} clash${clash > 1 ? 'es' : ''} — see notifications` : ''}${bad ? ` · ${bad} failed` : ''}`, { error: !!(bad || clash) });
    } catch (e) {
      toast(DEMO ? e.message : `${e.message} — check the ota-sync function is deployed (docs/GO-LIVE.md §35).`, { error: true });
    } finally { btn.disabled = false; btn.textContent = '⟳ Sync now'; draw(); }
  }
  $('#sync-now').onclick = () => syncNow();
  await draw();
});
