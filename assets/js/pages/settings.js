import { page, DEMO, rpc, q, sb, content, esc, rupees, toPaise, field, options, modal, confirmDialog, toast, ROLE_LABEL, fmtDayTime, avatar, pill, $, $$ } from '../core.js';

const ROLE_PILL = { owner: 'navy', manager: 'green', front_desk: 'blue', accountant: 'amber' };
const TABS = ['property', 'team', 'rooms', 'notifications'];

page('settings', async (ctx) => {
  const owner = ctx.can('owner');
  const tabsRow = $$('.ns-main > div').find((d) => /Users & roles/.test(d.textContent) && d.children.length === 4);
  const tabEls = tabsRow ? [...tabsRow.children] : [];
  const styles = tabEls.map((t) => t.getAttribute('style') || '');
  const onStyle = styles.find((s) => /#1C9A6C|border-bottom:2px solid #1/i.test(s)) || styles[1] || '';
  const offStyle = styles.find((s) => s !== onStyle) || '';
  if (tabsRow) tabsRow.setAttribute('role', 'tablist');
  tabEls.forEach((t, i) => {
    t.setAttribute('role', 'tab'); t.tabIndex = 0; t.style.cursor = 'pointer'; t.dataset.tab = TABS[i];
    t.addEventListener('click', () => show(TABS[i]));
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(TABS[i]); } });
  });

  async function show(tab) {
    if (!TABS.includes(tab)) tab = 'property';
    tabEls.forEach((t) => {
      const on = t.dataset.tab === tab;
      t.setAttribute('style', (on ? onStyle : offStyle) + ';cursor:pointer');
      t.setAttribute('aria-selected', on);
    });
    history.replaceState(null, '', '?tab=' + tab);
    content('<div class="ns-card ns-empty">Loading…</div>', 'padding:24px 32px;display:flex;flex-direction:column;gap:20px;');
    try { await VIEWS[tab](); } catch (e) { content(`<div class="ns-card ns-empty">${esc(e.message)}</div>`); }
  }

  const VIEWS = {
    // ------------------------------------------------------------ Property details
    async property() {
      const p = await q(sb.from('properties').select('*').eq('id', ctx.property_id).single());
      content(`
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:20px">
          <div class="ns-card" style="display:flex;flex-direction:column;gap:14px" id="prop">
            <div class="ns-h3">Property details</div>
            ${field('Property name', `<input class="ns-input" name="name" value="${esc(p.name)}">`)}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              ${field('Type', `<select class="ns-input" name="kind">${options([['hostel', 'Hostel'], ['hotel', 'Hotel'], ['homestay', 'Homestay']], p.kind)}</select>`)}
              ${field('Timezone', '<input class="ns-input" value="Asia/Kolkata (GMT+5:30)" disabled>')}
              ${field('Area / address', `<input class="ns-input" name="address" value="${esc(p.address || '')}">`)}
              ${field('City', `<input class="ns-input" name="city" value="${esc(p.city || '')}">`)}
              ${field('Phone', `<input class="ns-input" name="phone" value="${esc(p.phone || '')}">`)}
              ${field('Email', `<input class="ns-input" type="email" name="email" value="${esc(p.email || '')}">`)}
              ${field('Default check-in', `<input class="ns-input" type="time" name="checkin_time" value="${esc(p.checkin_time.slice(0, 5))}">`)}
              ${field('Default check-out', `<input class="ns-input" type="time" name="checkout_time" value="${esc(p.checkout_time.slice(0, 5))}">`)}
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="ns-btn" id="save">Save changes</button>
              ${DEMO ? '<button type="button" class="ns-btn-danger" id="reset-demo">Reset demo data</button>' : ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:20px" id="prop2">
            <div class="ns-card" style="display:flex;flex-direction:column;gap:12px">
              <div class="ns-h3">Payments</div>
              ${field('Your UPI ID', `<input class="ns-input" name="upi_id" value="${esc(p.upi_id || '')}" placeholder="yourname@okaxis">`,
                'Guests scan a QR on the booking and pay straight to this UPI ID. No gateway fees.')}
            </div>
            <div class="ns-card" style="display:flex;flex-direction:column;gap:12px">
              <div class="ns-h3">Privacy</div>
              ${field('Delete ID photos after (days)', `<input class="ns-input" type="number" min="1" max="3650" name="id_doc_retention_days" value="${p.id_doc_retention_days}">`,
                'Counted from the guest’s last check-out.')}
            </div>
          </div>
        </div>`);
      $('#save').onclick = async (e) => {
        const v = Object.fromEntries($$('#prop [name], #prop2 [name]').map((i) => [i.name, i.value.trim() || null]));
        v.id_doc_retention_days = parseInt(v.id_doc_retention_days, 10) || 180;
        if (!v.name) return toast('Property name can’t be empty.', { error: true });
        e.target.disabled = true;
        try { await q(sb.from('properties').update(v).eq('id', ctx.property_id)); toast('Saved.'); }
        catch (err) { toast(/upi_id/.test(err.message) ? 'That UPI ID doesn’t look right (e.g. name@okaxis).' : err.message, { error: true }); }
        finally { e.target.disabled = false; }
      };
      $('#reset-demo')?.addEventListener('click', async () => {
        if (await confirmDialog('Reset demo data', 'Start again with fresh sample bookings? Changes you made in the demo will be cleared.', { confirmLabel: 'Reset' })) { sb.reset(); location.reload(); }
      });
    },

    // ------------------------------------------------------------ Users & roles
    async team() {
      const members = await rpc('list_members', { p_property: ctx.property_id });
      content(`
        <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:20px">
          <div class="ns-card" style="padding:0;overflow:hidden">
            <div style="padding:18px 20px;display:flex;justify-content:space-between;align-items:center;gap:10px">
              <div><div class="ns-h3">Team members</div><div class="ns-muted">${members.length} people have access to ${esc(ctx.property_name)}</div></div>
              ${owner ? '<button type="button" class="ns-btn" id="invite">+ Invite member</button>' : ''}</div>
            <div style="overflow-x:auto"><table class="ns-table" style="min-width:520px"><thead><tr><th>Name</th><th>Role</th><th>Last active</th><th></th></tr></thead><tbody>
              ${members.map((m) => `<tr><td><div style="display:flex;gap:10px;align-items:center">${avatar(m.display_name || m.email)}<div>
                  <div style="font-weight:700">${esc(m.display_name || m.email)}${m.user_id === ctx.user.id ? ' (you)' : ''}</div><div class="ns-muted" style="font-size:11px">${esc(m.email || '')}</div></div></div></td>
                <td>${pill(ROLE_LABEL[m.role], ROLE_PILL[m.role])}</td>
                <td class="ns-muted">${m.last_seen_at ? fmtDayTime(m.last_seen_at) : 'Invited · never signed in'}</td>
                <td style="white-space:nowrap">${owner && m.user_id !== ctx.user.id ? `
                  <button type="button" class="ns-btn-ghost" style="height:30px;font-size:12px" data-role="${esc(m.user_id)}">Edit</button>
                  <button type="button" class="ns-btn-danger" style="height:30px;font-size:12px" data-remove="${esc(m.user_id)}">Remove</button>` : ''}</td></tr>`).join('')}
            </tbody></table></div>
          </div>
          <div class="ns-card-dark" style="display:flex;flex-direction:column;gap:10px;align-self:start">
            <div class="ns-h3" style="color:#FBF3DE">Role permissions</div>
            ${[['Owner', 'everything, incl. team and settings'], ['Manager', 'bookings, rooms & rates, payments, reports'],
              ['Front desk', 'check-in/out, bookings, guest profiles, payments'], ['Accountant', 'payments & reports, read-only elsewhere; no guest ID data']]
              .map(([r, d]) => `<div style="font-size:12.5px;color:#AEB6C9;line-height:1.5"><b style="color:#FBF3DE">${r}</b> — ${d}</div>`).join('')}
          </div>
        </div>`);
      const byId = Object.fromEntries(members.map((m) => [m.user_id, m]));
      const memberDialog = (m) => modal({
        title: m ? `Edit ${m.display_name || m.email}` : 'Invite team member',
        body: `${!m && DEMO ? '<div class="ns-demo-hint">Demo mode: the member is added to the sample team only — no email is sent.</div>' : ''}
          ${!m && !DEMO ? '<div class="ns-help" style="font-size:12.5px;line-height:1.6">Step 1: invite them in Supabase → Authentication → Users → <b>Invite user</b> (they get an email to set a password).<br>Step 2: add them here with their role.</div>' : ''}
          ${field('Name', `<input class="ns-input" name="name" value="${esc(m?.display_name || '')}">`)}
          ${field('Email', `<input class="ns-input" type="email" name="email" value="${esc(m?.email || '')}" ${m ? 'disabled' : ''}>`)}
          ${field('Role', `<select class="ns-input" name="role">${options(Object.entries(ROLE_LABEL), m?.role || 'front_desk')}</select>`)}`,
        actions: [{ label: 'Cancel' }, { label: m ? 'Save' : 'Add member', kind: 'primary', onClick: async (el) => {
          const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
          await rpc('add_member', { p_property: ctx.property_id, p_email: v('email'), p_role: v('role'), p_name: v('name') });
          toast(m ? 'Saved.' : 'Member added.'); show('team');
        } }],
      });
      $('#invite')?.addEventListener('click', () => memberDialog(null));
      $$('[data-role]').forEach((b) => b.onclick = () => memberDialog(byId[b.dataset.role]));
      $$('[data-remove]').forEach((b) => b.onclick = async () => {
        const m = byId[b.dataset.remove];
        if (!await confirmDialog('Remove access', `Remove ${m.display_name || m.email}? They won’t be able to sign in to this property.`, { confirmLabel: 'Remove', danger: true })) return;
        try { await rpc('remove_member', { p_property: ctx.property_id, p_user: m.user_id }); toast('Removed.'); show('team'); }
        catch (err) { toast(err.message, { error: true }); }
      });
    },

    // ------------------------------------------------------------ Room types & pricing
    async rooms() {
      const rooms = await rpc('bed_board', { p_property: ctx.property_id });
      content(`
        <div class="ns-card" style="padding:0;overflow:hidden">
          <div style="padding:18px 20px;display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div><div class="ns-h3">Room types & pricing</div><div class="ns-muted">Nightly rate per bed. Changes apply to new bookings.</div></div>
            <a class="ns-btn-ghost" href="rooms.html">Manage rooms & beds →</a></div>
          <div style="overflow-x:auto"><table class="ns-table" style="min-width:560px"><thead><tr><th>Room type</th><th>Bed</th><th>Type</th><th>Rate / night (₹)</th><th>In use</th></tr></thead><tbody>
            ${rooms.flatMap((r) => r.beds.map((b, i) => `<tr data-bed="${esc(b.id)}">
              <td style="font-weight:700">${i === 0 ? esc(r.name) + `<div class="ns-muted" style="font-weight:500">${esc(r.description || '')}</div>` : ''}</td>
              <td>${esc(b.label)}</td><td class="ns-muted">${esc(b.position[0].toUpperCase() + b.position.slice(1))}</td>
              <td><input class="ns-input" name="rate" inputmode="decimal" value="${b.rate_paise / 100}" style="height:36px;width:110px" aria-label="Rate for ${esc(b.label)}" data-was="${b.rate_paise}"></td>
              <td><input type="checkbox" name="active" ${b.is_active ? 'checked' : ''} style="width:16px;height:16px;accent-color:#1C9A6C" aria-label="${esc(b.label)} in use" data-was="${b.is_active}"></td></tr>`)).join('')}
          </tbody></table></div>
          <div style="padding:16px 20px;border-top:1px solid #F3EFE1;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <div class="ns-muted" id="avg"></div><button type="button" class="ns-btn" id="save-rates">Save pricing</button></div>
        </div>`);
      const avg = () => {
        const rates = $$('[name=rate]').map((i) => toPaise(i.value)).filter((x) => x >= 0);
        $('#avg').textContent = rates.length ? `Average ${rupees(rates.reduce((a, b) => a + b, 0) / rates.length)} per bed · full house ${rupees(rates.reduce((a, b) => a + b, 0))} per night` : '';
      };
      $$('[name=rate]').forEach((i) => i.addEventListener('input', avg)); avg();
      $('#save-rates').onclick = async (e) => {
        e.target.disabled = true;
        try {
          let n = 0;
          for (const tr of $$('tr[data-bed]')) {
            const rate = toPaise(tr.querySelector('[name=rate]').value);
            const active = tr.querySelector('[name=active]').checked;
            if (!(rate >= 0)) throw new Error('Check the rates — numbers only.');
            if (String(rate) !== tr.querySelector('[name=rate]').dataset.was || String(active) !== tr.querySelector('[name=active]').dataset.was) {
              await q(sb.from('beds').update({ rate_paise: rate, is_active: active }).eq('id', tr.dataset.bed)); n++;
            }
          }
          toast(n ? `Saved ${n} change${n > 1 ? 's' : ''}.` : 'Nothing changed.'); if (n) show('rooms');
        } catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
      };
    },

    // ------------------------------------------------------------ Notifications
    async notifications() {
      const [p, recent] = await Promise.all([
        q(sb.from('properties').select('*').eq('id', ctx.property_id).single()),
        q(sb.from('notifications').select('title, body, booking_id, created_at, read_at').eq('property_id', ctx.property_id).order('created_at', { ascending: false }).limit(15)),
      ]);
      content(`
        <div style="display:grid;grid-template-columns:1fr 1.2fr;gap:20px">
          <div style="display:flex;flex-direction:column;gap:20px">
            <div class="ns-card" style="display:flex;flex-direction:column;gap:12px">
              <div class="ns-h3">Email alerts</div>
              ${field('Send new-booking alerts to', `<input class="ns-input" type="email" id="alert-email" value="${esc(p.email || '')}" placeholder="you@example.com">`,
                DEMO ? 'Demo mode: no emails are sent.' : 'Sent by the notify-booking function (see docs/GO-LIVE.md step 7).')}
              <button type="button" class="ns-btn" id="save-email" style="align-self:flex-start">Save</button>
            </div>
            <div class="ns-card" style="display:flex;flex-direction:column;gap:8px">
              <div class="ns-h3">In-app</div>
              <div class="ns-muted" style="font-size:13px;line-height:1.6">The bell in the menu lights up instantly for every new booking and every guest online check-in, for all staff at this property.</div>
              <div class="ns-muted" style="font-size:13px;line-height:1.6">Guests get a confirmation email with their online check-in link when “Email the booking confirmation” is ticked on a new booking.</div>
            </div>
          </div>
          <div class="ns-card" style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;align-items:center"><div class="ns-h3">Recent notifications</div>
              <button type="button" class="ns-btn-ghost" id="mark-read" style="height:32px">Mark all read</button></div>
            ${recent.map((n) => `<a class="ns-list-row" style="color:inherit" ${n.booking_id ? `href="booking-detail.html?id=${esc(n.booking_id)}"` : ''}>
                <div><div style="font-size:13px;font-weight:${n.read_at ? 600 : 800}">${esc(n.title)}</div><div class="ns-muted">${esc(n.body || '')}</div></div>
                <div class="ns-muted" style="white-space:nowrap">${fmtDayTime(n.created_at)}</div></a>`).join('') || '<div class="ns-empty">No notifications yet.</div>'}
          </div>
        </div>`);
      $('#save-email').onclick = async () => {
        try { await q(sb.from('properties').update({ email: $('#alert-email').value.trim() || null }).eq('id', ctx.property_id)); toast('Saved.'); }
        catch (err) { toast(err.message, { error: true }); }
      };
      $('#mark-read').onclick = async () => { await rpc('mark_notifications_read', { p_property: ctx.property_id }); toast('All marked as read.'); show('notifications'); };
    },
  };

  await show(new URLSearchParams(location.search).get('tab') || 'property');
});
