import { W, GST_STATES, openPlatformInvoice, SITE_URL, FUNCTIONS_URL, PERMS, PERM_LOCKED, permDefault, page, DEMO, rpc, q, sb, content, esc, rupees, toPaise, field, options, modal, confirmDialog, toast, ROLE_LABEL, fmtDayTime, fmtDate, avatar, pill, upiLink, qrDataUrl, $, $$ } from '../core.js';

const ROLE_PILL = { owner: 'navy', manager: 'green', front_desk: 'blue', accountant: 'amber' };
const TABS = ['property', 'team', 'rooms', 'notifications', 'billing', 'account'];
const STATE = { trial: ['Free trial', 'blue'], active: ['Active', 'green'], grace: ['Payment due', 'amber'], expired: ['Ended', 'red'], complimentary: ['Free — complimentary', 'green'], suspended: ['Suspended', 'red'] };

page('settings', async (ctx) => {
  const owner = ctx.can('owner');
  const tabsRow = $$('.ns-main > div').find((d) => /Users & roles/.test(d.textContent) && d.children.length === 4);
  const tabEls = tabsRow ? [...tabsRow.children] : [];
  if (tabsRow && tabEls.length === 4) {                 // add Billing and My account next to the design's four
    for (const label of ['Billing', 'My account']) { const t = tabEls[0].cloneNode(false); t.textContent = label; tabsRow.appendChild(t); tabEls.push(t); }
  }
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
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="ns-btn" id="save-upi">Save UPI ID</button>
                <span class="ns-muted" id="upi-state" style="font-size:12.5px">${p.upi_id ? '✓ Saved' : 'Not set yet'}</span></div>
            </div>
            <div class="ns-card" style="display:flex;flex-direction:column;gap:12px">
              <div class="ns-h3">Privacy</div>
              ${field('Delete ID photos after (days)', `<input class="ns-input" type="number" min="1" max="3650" name="id_doc_retention_days" value="${p.id_doc_retention_days}">`,
                'Counted from the guest’s last check-out.')}
              <button type="button" class="ns-btn-ghost" id="save-privacy" style="align-self:flex-start">Save</button>
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
      // each card can be saved on its own
      const upiIn = $('#prop2 [name=upi_id]');
      upiIn.addEventListener('input', () => { $('#upi-state').textContent = upiIn.value.trim() === (p.upi_id || '') ? (p.upi_id ? '✓ Saved' : 'Not set yet') : 'Not saved yet'; });
      $('#save-upi').onclick = async (e) => {
        const upi = upiIn.value.trim().replace(/\s+/g, '');
        if (upi && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(upi)) return toast('That UPI ID doesn’t look right — it looks like name@okaxis or 9840012345@ybl.', { error: true });
        e.target.disabled = true;
        try { await q(sb.from('properties').update({ upi_id: upi || null }).eq('id', ctx.property_id)); p.upi_id = upi || null; upiIn.value = upi;
          $('#upi-state').textContent = upi ? '✓ Saved' : 'Not set yet'; toast(upi ? `UPI ID saved — guests will pay to ${upi}.` : 'UPI ID removed.'); }
        catch (err) { toast(/upi_id/.test(err.message) ? 'That UPI ID doesn’t look right (e.g. name@okaxis).' : err.message, { error: true }); }
        finally { e.target.disabled = false; }
      };
      $('#save-privacy').onclick = async (e) => {
        const days = parseInt($('#prop2 [name=id_doc_retention_days]').value, 10);
        if (!(days >= 1 && days <= 3650)) return toast('Enter 1 to 3650 days.', { error: true });
        e.target.disabled = true;
        try { await q(sb.from('properties').update({ id_doc_retention_days: days }).eq('id', ctx.property_id)); toast(`Saved — ID photos are deleted ${days} days after check-out.`); }
        catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
      };
      moreCards(ctx, p);
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
              <div style="display:flex;gap:8px;flex-wrap:wrap">${!DEMO ? '<button type="button" class="ns-btn-ghost" id="signout-all">Sign out on all devices</button>' : ''}
          ${owner ? '<button type="button" class="ns-btn" id="invite">+ Invite member</button>' : ''}</div></div>
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
      permsCard(ctx);
      $('#signout-all')?.addEventListener('click', async () => {
        if (!await confirmDialog('Sign out on all devices', 'You’ll be signed out everywhere — this computer, your phone and any other device. Staff accounts are not affected.', { confirmLabel: 'Sign out everywhere' })) return;
        await sb.auth.signOut({ scope: 'global' }).catch(() => sb.auth.signOut());
        location.replace('login.html');
      });
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
            <div><div class="ns-h3">Room types & pricing</div><div class="ns-muted">Nightly rate per ${W.unit}. Changes apply to new bookings.</div></div>
            <a class="ns-btn-ghost" href="rooms.html">Manage ${W.setup.toLowerCase()} →</a></div>
          <div style="overflow-x:auto"><table class="ns-table" style="min-width:560px"><thead><tr><th>Room type</th><th>${W.Unit}</th><th>Type</th><th>Rate / night (₹)</th><th>In use</th></tr></thead><tbody>
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
        $('#avg').textContent = rates.length ? `Average ${rupees(rates.reduce((a, b) => a + b, 0) / rates.length)} per ${W.unit} · full house ${rupees(rates.reduce((a, b) => a + b, 0))} per night` : '';
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
      await extrasCard(ctx);
      if (!ctx.allow('manage_rooms')) {
        $$('#save-rates, #x-save, #x-add, #x-suggest, [data-x-del]').forEach((b) => b.remove());
        $$('.ns-content input, .ns-content select').forEach((i) => { i.disabled = true; });
        document.querySelector('.ns-content').insertAdjacentHTML('afterbegin', '<div class="ns-demo-hint">View only — your role can’t change rooms, beds or prices.</div>');
      }
    },

    // ------------------------------------------------------------ Billing (subscription)
    async billing() {
      const b = await rpc('billing_info', { p_property: ctx.property_id });
      const a = b.access; const [label, color] = STATE[a.state] || [a.state, 'grey'];
      const plans = b.plans; const payable = plans.filter((x) => !x.is_quote);
      let chosen = payable.find((x) => x.id === a.plan_id) || payable[payable.length - 1] || null;
      const KIND = { hostel: 'hostels & PGs', hotel: 'hotels', homestay: 'homestays' };
      const tierNote = `Prices for ${KIND[b.kind] || 'your property'} · you have ${b.units} ${b.units === 1 ? W.unit : W.units}`;
      const contact = b.pay_to?.support_whatsapp ? `https://wa.me/${String(b.pay_to.support_whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I’d like a quote for NammaStay for ' + ctx.property_name)}`
        : b.pay_to?.support_email ? `mailto:${b.pay_to.support_email}?subject=${encodeURIComponent('NammaStay quote — ' + ctx.property_name)}` : null;
      const owner = ctx.can('owner'); const upi = b.pay_to?.upi_id;
      const until = a.state === 'trial' ? `Trial ends ${fmtDate(a.trial_ends_at)}` : a.state === 'active' ? `Paid until ${fmtDate(a.paid_until)}`
        : a.state === 'complimentary' ? 'No payment needed' : `Ended ${fmtDate(a.ends_at)}`;
      const HIST = { pending: ['Waiting for confirmation', 'amber'], approved: ['Confirmed', 'green'], rejected: ['Not confirmed', 'red'] };
      content(`
        <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:20px">
          <div class="ns-card" style="display:flex;flex-direction:column;gap:12px;align-self:start">
            <div class="ns-h3">Your NammaStay plan</div>
            <div>${pill(label, color)}</div>
            <div style="font-family:'Sora',sans-serif;font-size:24px;font-weight:800">${a.days_left != null ? `${a.days_left} day${a.days_left === 1 ? '' : 's'} left` : esc(label)}</div>
            <div class="ns-muted" style="font-size:13.5px">${esc(until)}</div>
            ${a.pending_payment ? '<div class="ns-demo-hint">We’ve received your payment details and will confirm shortly. You can keep using NammaStay meanwhile.</div>' : ''}
            ${a.state === 'expired' ? '<div class="ns-error">New bookings are paused. Your data is safe — renew below to continue.</div>' : ''}
            <div class="ns-muted" style="font-size:12.5px;line-height:1.6">One flat price per property — all features, unlimited staff and bookings.
              ${b.pay_to?.support_whatsapp || b.pay_to?.support_email ? `<br>Questions? ${b.pay_to.support_whatsapp ? `<a href="https://wa.me/${esc(b.pay_to.support_whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener" style="font-weight:700">WhatsApp us</a>` : ''} ${b.pay_to.support_email ? `<a href="mailto:${esc(b.pay_to.support_email)}" style="font-weight:700">${esc(b.pay_to.support_email)}</a>` : ''}` : ''}</div>
          </div>
          <div class="ns-card" style="display:flex;flex-direction:column;gap:16px">
            ${a.state === 'complimentary' ? '<div class="ns-h3">Your property has complimentary access — nothing to pay.</div>' : `
            <div><div class="ns-h3">${a.state === 'active' ? 'Renew or extend' : 'Choose a plan'}</div><div class="ns-muted" style="margin-top:4px">${esc(tierNote)}</div></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px" id="plans">
              ${plans.map((x) => x.is_quote ? `<div class="ns-plan" style="cursor:default">
                <b style="font-size:15px">${esc(x.name)}</b><span class="price" style="font-size:22px">Custom</span>
                <span class="ns-muted">${esc(x.description || '')}</span>
                ${contact ? `<a class="ns-btn-ghost" style="height:34px;font-size:12px" href="${esc(contact)}" target="_blank" rel="noopener">Contact us for a quote</a>` : ''}</div>`
                : `<button type="button" class="ns-plan${x.id === chosen?.id ? ' is-on' : ''}" data-plan="${esc(x.id)}">
                <b style="font-size:15px">${esc(x.name)}</b>
                <span class="price">${rupees(x.price_paise)} <small>/ ${x.period_months === 1 ? 'month' : x.period_months === 12 ? 'year' : x.period_months + ' months'}</small></span>
                <span class="ns-muted">${esc(x.description || '')}</span></button>`).join('')}
            </div>
            ${!payable.length ? '<div class="ns-demo-hint">Your property is priced on request — tap “Contact us for a quote” above.</div>' : !owner ? '<div class="ns-muted">Only the property owner can make payments.</div>' : !upi ? '<div class="ns-demo-hint">Online payment details aren’t set up yet. Please contact NammaStay support.</div>' : `
            <div style="display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;border-top:1px solid #F0EBDB;padding-top:16px">
              <div id="qr-box" style="width:170px;height:170px;border:1px solid #F0EBDB;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#fff"><img id="qr" alt="UPI QR code" width="160" height="160"></div>
              <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
                <div style="font-size:13.5px;line-height:1.6"><b>1.</b> Pay <b id="amt"></b> to <b>${esc(upi)}</b> (${esc(b.pay_to.payee_name)}) — scan the QR or <a id="upi-open" style="font-weight:700">open your UPI app</a>.</div>
                <div style="font-size:13.5px"><b>2.</b> Enter the 12-digit UPI transaction ID (UTR) below.</div>
                <input class="ns-input" id="utr" placeholder="e.g. 412345678901" autocomplete="off" inputmode="numeric" maxlength="35">
                <button type="button" class="ns-btn" id="submit-pay">I’ve paid — submit for confirmation</button>
              </div>
            </div>`}`}
          </div>
        </div>
        ${b.history.length ? `<div class="ns-card" style="padding:0;overflow:hidden"><div class="ns-h3" style="padding:18px 20px">Payment history</div>
          <div style="overflow-x:auto"><table class="ns-table" style="min-width:600px"><thead><tr><th>Submitted</th><th>Plan</th><th>Amount</th><th>UTR</th><th>Status</th><th>Covers</th></tr></thead><tbody>
          ${b.history.map((h) => `<tr><td>${fmtDayTime(h.submitted_at)}</td><td>${esc((plans.find((x) => x.id === h.plan_id) || { name: h.plan_id }).name)}</td>
            <td style="font-weight:700">${rupees(h.amount_paise)}</td><td class="ns-muted">${esc(h.utr)}</td><td>${pill(...HIST[h.status])}${h.review_note ? `<div class="ns-muted">${esc(h.review_note)}</div>` : ''}</td>
            <td class="ns-muted">${h.period_end ? `${fmtDate(h.period_start)} – ${fmtDate(h.period_end)}` : '—'}</td></tr>`).join('')}
          </tbody></table></div></div>` : ''}`);

      const draw = async () => {
        if (!$('#qr') || !chosen) return;
        $('#amt').textContent = rupees(chosen.price_paise);
        const link = upiLink({ upiId: upi, payee: b.pay_to.payee_name, amountPaise: chosen.price_paise, note: `NammaStay ${ctx.property_name}`.slice(0, 40) });
        $('#upi-open').href = link;
        const url = await qrDataUrl(link);
        if (url) $('#qr').src = url; else $('#qr-box').hidden = true;
      };
      $$('[data-plan]').forEach((p) => p.onclick = () => {
        chosen = payable.find((x) => x.id === p.dataset.plan);
        $$('[data-plan]').forEach((x) => x.classList.toggle('is-on', x === p)); draw();
      });
      $('#submit-pay')?.addEventListener('click', async (e) => {
        const utr = $('#utr').value.replace(/\s/g, '');
        if (!/^[0-9A-Za-z]{6,35}$/.test(utr)) return toast('Enter the UPI transaction ID (UTR) from your payment app.', { error: true });
        e.target.disabled = true;
        try { await rpc('submit_subscription_payment', { p_property: ctx.property_id, p_plan: chosen.id, p_utr: utr }); toast('Thanks! We’ll confirm your payment shortly.'); show('billing'); }
        catch (err) { toast(err.message, { error: true }); e.target.disabled = false; }
      });
      draw();
      billingExtras(ctx);
    },

    // ------------------------------------------------------------ My account (password, email, devices)
    async account() {
      const email = ctx.user.email;
      content(`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div class="ns-card" style="display:flex;flex-direction:column;gap:12px" id="pw-card">
            <div class="ns-h3">Change password</div>
            <div class="ns-muted">Signed in as <b>${esc(email)}</b></div>
            ${field('Current password', '<input class="ns-input" type="password" name="cur" autocomplete="current-password">')}
            ${field('New password', '<input class="ns-input" type="password" name="new1" autocomplete="new-password" minlength="10">', 'At least 10 characters. Don’t reuse a password from another site.')}
            ${field('Type the new password again', '<input class="ns-input" type="password" name="new2" autocomplete="new-password">')}
            <button type="button" class="ns-btn" id="save-pw" style="align-self:flex-start">Change password</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:20px">
            <div class="ns-card" style="display:flex;flex-direction:column;gap:12px">
              <div class="ns-h3">Change email</div>
              ${field('New email', '<input class="ns-input" type="email" name="new-email" autocomplete="email">', 'We send a confirmation link to the new address. Your email changes after you click it.')}
              <button type="button" class="ns-btn-ghost" id="save-email2" style="align-self:flex-start">Change email</button>
            </div>
            <div class="ns-card" style="display:flex;flex-direction:column;gap:10px">
              <div class="ns-h3">Devices</div>
              <div class="ns-muted">Signed in on a phone or computer you no longer use? Sign out everywhere.</div>
              <button type="button" class="ns-btn-ghost" id="signout-all2" style="align-self:flex-start">Sign out on all devices</button>
            </div>
          </div>
        </div>`);
      $('#save-pw').onclick = async (e) => {
        const v = (n) => $(`#pw-card [name=${n}]`).value;
        if (!v('cur')) return toast('Enter your current password.', { error: true });
        if (v('new1').length < 10) return toast('The new password needs at least 10 characters.', { error: true });
        if (v('new1') !== v('new2')) return toast('The two new passwords don’t match.', { error: true });
        if (v('new1') === v('cur')) return toast('Choose a password different from the current one.', { error: true });
        e.target.disabled = true;
        try {
          const chk = await sb.auth.signInWithPassword({ email, password: v('cur') });   // confirm it's really you
          if (chk.error) throw new Error('Your current password is not correct.');
          const { error } = await sb.auth.updateUser({ password: v('new1') });
          if (error) throw new Error(error.message);
          $$('#pw-card input').forEach((i) => { i.value = ''; });
          toast('Password changed. Use the new one next time you sign in.');
        } catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
      };
      $('#save-email2').onclick = async (e) => {
        const ne = $('[name=new-email]').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ne)) return toast('Enter a valid email address.', { error: true });
        e.target.disabled = true;
        try {
          const { error } = await sb.auth.updateUser({ email: ne });
          if (error) throw new Error(error.message);
          toast(`Check ${ne} for a confirmation link. Your email changes after you click it.`, { ms: 7000 });
        } catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
      };
      $('#signout-all2').onclick = async () => {
        if (!await confirmDialog('Sign out on all devices', 'You’ll be signed out everywhere, including this device.', { confirmLabel: 'Sign out everywhere' })) return;
        await sb.auth.signOut({ scope: 'global' }).catch(() => sb.auth.signOut());
        location.replace('login.html');
      };
    },

    // ------------------------------------------------------------ Notifications
    async notifications() {
      const [p, recent, deleted] = await Promise.all([
        q(sb.from('properties').select('*').eq('id', ctx.property_id).single()),
        q(sb.from('notifications').select('title, body, booking_id, created_at, read_at').eq('property_id', ctx.property_id).order('created_at', { ascending: false }).limit(15)),
        rpc('list_deleted_bookings', { p_property: ctx.property_id, p_limit: 50 }).catch(() => []),
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
        </div>
        <div class="ns-card" style="padding:0;overflow:hidden;grid-column:1/-1" id="deleted-bookings">
          <div style="padding:18px 20px"><div class="ns-h3">Deleted bookings</div><div class="ns-muted">Bookings removed as mistakes — kept here for your records.</div></div>
          <div style="overflow-x:auto"><table class="ns-table" style="min-width:760px"><thead><tr><th>Deleted</th><th>Booking</th><th>Guest</th><th>Stay</th><th>Paid</th><th>Reason</th><th>By</th></tr></thead><tbody>
          ${deleted.map((x) => `<tr><td>${fmtDayTime(x.at)}</td><td style="font-weight:700">${esc(x.code)}</td><td>${esc(x.guest || '')}</td>
            <td class="ns-muted">${x.check_in_at ? fmtDayTime(x.check_in_at) + ' → ' + fmtDayTime(x.check_out_at) : ''}</td>
            <td>${x.paid_paise ? rupees(x.paid_paise) : '—'}</td><td>${esc(x.reason || '')}</td><td class="ns-muted">${esc(x.by || '')}</td></tr>`).join('')
            || '<tr><td colspan="7" class="ns-empty">No deleted bookings.</td></tr>'}
          </tbody></table></div>
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

// ------------------------------------------------------------ Extras & services price list
const EXTRA_CATS = [['food', 'Food & drinks'], ['laundry', 'Laundry'], ['rental', 'Rentals'], ['transport', 'Transport'], ['tour', 'Tours & activities'], ['other', 'Other']];
const SUGGESTED = [
  ['Breakfast', 'food', 150, 'plate'], ['Lunch', 'food', 200, 'plate'], ['Dinner', 'food', 200, 'plate'], ['Tea / coffee', 'food', 30, 'cup'],
  ['Laundry', 'laundry', 80, 'kg'], ['Towel', 'rental', 50, 'each'], ['Locker', 'rental', 50, 'day'], ['Bike / scooter', 'rental', 400, 'day'],
  ['Airport pickup', 'transport', 800, 'trip'], ['City tour', 'tour', 600, 'person'],
];
async function extrasCard(ctx) {
  let items = await q(sb.from('extra_items').select('*').eq('property_id', ctx.property_id).order('sort').order('name')).catch(() => null);
  const host = document.querySelector('.ns-content');
  if (items === null) {                                             // database not updated yet (016_extras.sql)
    host.insertAdjacentHTML('beforeend', '<div class="ns-card ns-muted">Extras & services need the database update <b>016_extras.sql</b>.</div>');
    return;
  }
  const removed = new Set();
  const rowHtml = (it) => `<tr data-extra="${esc(it.id || '')}">
      <td><input class="ns-input" name="x-name" maxlength="80" value="${esc(it.name || '')}" placeholder="e.g. Breakfast" style="height:36px;min-width:140px" aria-label="Item name"></td>
      <td><select class="ns-input" name="x-cat" style="height:36px" aria-label="Category">${options(EXTRA_CATS, it.category || 'other')}</select></td>
      <td><input class="ns-input" name="x-price" inputmode="decimal" value="${it.price_paise != null ? it.price_paise / 100 : ''}" style="height:36px;width:100px" aria-label="Price (₹)"></td>
      <td><input class="ns-input" name="x-unit" maxlength="30" value="${esc(it.unit || 'each')}" style="height:36px;width:90px" aria-label="Per"></td>
      <td><input type="checkbox" name="x-active" ${it.is_active !== false ? 'checked' : ''} style="width:16px;height:16px;accent-color:#1C9A6C" aria-label="Offered"></td>
      <td><button type="button" class="ns-icon-del" data-x-del aria-label="Delete item" title="Delete">✕</button></td></tr>`;
  host.insertAdjacentHTML('beforeend', `<div class="ns-card" style="padding:0;overflow:hidden" id="extras-card">
      <div style="padding:18px 20px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div><div class="ns-h3">Extras & services</div><div class="ns-muted">Food, laundry, rentals, pickups, tours — add them to a guest’s bill from the booking screen.</div></div>
        ${items.length ? '' : '<button type="button" class="ns-btn-ghost" id="x-suggest">Add suggested items</button>'}</div>
      <div style="overflow-x:auto"><table class="ns-table" style="min-width:640px"><thead><tr><th>Item</th><th>Category</th><th>Price (₹)</th><th>Per</th><th>Offered</th><th></th></tr></thead>
        <tbody id="x-rows">${items.map(rowHtml).join('')}</tbody></table></div>
      ${items.length ? '' : '<div class="ns-empty" id="x-empty" style="padding:14px">No extras yet.</div>'}
      <div style="padding:16px 20px;border-top:1px solid #F3EFE1;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <button type="button" class="ns-btn-ghost" id="x-add">+ Add item</button><button type="button" class="ns-btn" id="x-save">Save extras</button></div>
    </div>`);
  const tbody = $('#x-rows');
  const add = (it) => { $('#x-empty')?.remove(); tbody.insertAdjacentHTML('beforeend', rowHtml(it)); };
  $('#x-add').onclick = () => { add({ unit: 'each' }); tbody.lastElementChild.querySelector('[name=x-name]').focus(); };
  $('#x-suggest')?.addEventListener('click', (e) => { SUGGESTED.forEach(([name, category, rupee, unit]) => add({ name, category, price_paise: rupee * 100, unit })); e.target.remove(); toast('Suggested items added — change the prices, then Save extras.'); });
  tbody.addEventListener('click', (e) => { const b = e.target.closest('[data-x-del]'); if (!b) return; const tr = b.closest('tr'); if (tr.dataset.extra) removed.add(tr.dataset.extra); tr.remove(); });
  $('#x-save').onclick = async (e) => {
    e.target.disabled = true;
    try {
      const rows = [...tbody.querySelectorAll('tr')].map((tr, i) => ({ id: tr.dataset.extra || null, sort: i + 1,
        name: tr.querySelector('[name=x-name]').value.trim(), category: tr.querySelector('[name=x-cat]').value,
        price_paise: toPaise(tr.querySelector('[name=x-price]').value), unit: tr.querySelector('[name=x-unit]').value.trim() || 'each',
        is_active: tr.querySelector('[name=x-active]').checked }));
      const bad = rows.find((r) => !r.name || !(r.price_paise >= 0)); if (bad) throw new Error('Every item needs a name and a price.');
      for (const id of removed) await q(sb.from('extra_items').delete().eq('id', id));
      for (const r of rows) {
        const { id, ...row } = r;
        if (id) await q(sb.from('extra_items').update(row).eq('id', id));
        else await q(sb.from('extra_items').insert({ ...row, property_id: ctx.property_id }));
      }
      toast('Extras saved.'); location.replace('settings.html?tab=rooms');
    } catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
  };
}

// ------------------------------------------------------------ what each role can do (owner edits)
function permsCard(ctx) {
  const owner = ctx.role === 'owner';
  const ROLES = [['manager', 'Manager'], ['front_desk', 'Front desk'], ['accountant', 'Accountant']];
  const cur = (role, perm) => { const v = ctx.rolePermissions?.[role]?.[perm]; return typeof v === 'boolean' ? v : permDefault(role, perm); };
  document.querySelector('.ns-content').insertAdjacentHTML('beforeend', `<div class="ns-card" style="padding:0;overflow:hidden;margin-top:20px" id="perms-card">
    <div style="padding:18px 20px"><div class="ns-h3">What each role can do</div>
      <div class="ns-muted">${owner ? 'Tick what each role may do. The owner can always do everything.' : 'Only the owner can change these.'} 🔒 = not possible for that role.</div></div>
    <div style="overflow-x:auto"><table class="ns-table" style="min-width:560px"><thead><tr><th>Feature</th>${ROLES.map(([, l]) => `<th style="text-align:center">${l}</th>`).join('')}</tr></thead><tbody>
    ${PERMS.map(([k, label, help]) => `<tr><td><b style="font-size:13px">${esc(label)}</b>${help ? `<div class="ns-muted" style="font-size:11.5px">${esc(help)}</div>` : ''}</td>
      ${ROLES.map(([r]) => (PERM_LOCKED[r] || []).includes(k)
        ? '<td style="text-align:center" title="Not possible for this role">🔒</td>'
        : `<td style="text-align:center"><input type="checkbox" data-prole="${r}" data-perm="${k}" ${cur(r, k) ? 'checked' : ''} ${owner ? '' : 'disabled'}
            style="width:18px;height:18px;accent-color:#1C9A6C" aria-label="${esc(label)} — ${r}"></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    ${owner ? `<div style="padding:16px 20px;border-top:1px solid #F3EFE1;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <button type="button" class="ns-btn-ghost" id="perms-reset">Reset to defaults</button><button type="button" class="ns-btn" id="perms-save">Save permissions</button></div>` : ''}
  </div>`);
  if (!owner) return;
  $('#perms-reset').onclick = () => { $$('#perms-card [data-perm]').forEach((c) => { c.checked = permDefault(c.dataset.prole, c.dataset.perm); }); toast('Defaults restored — Save to apply.'); };
  $('#perms-save').onclick = async (e) => {
    const p = {}; $$('#perms-card [data-perm]').forEach((c) => { (p[c.dataset.prole] ||= {})[c.dataset.perm] = c.checked; });
    e.target.disabled = true;
    try { await rpc('set_role_permissions', { p_property: ctx.property_id, p }); toast('Permissions saved. Staff see the change next time they open a page.'); ctx.rolePermissions = p; }
    catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
  };
}

// ------------------------------------------------------------ invoices & GST · regular-guest offers
async function razorpayCard(ctx) {
  const st = await rpc('razorpay_status', { p_property: ctx.property_id }).catch(() => null);
  if (!st) return;                                                   // database not updated yet (021)
  const owner = ctx.role === 'owner';
  const hook = `${FUNCTIONS_URL}/razorpay?p=${ctx.property_id}`;
  document.querySelector('.ns-content').insertAdjacentHTML('beforeend', `
  <div class="ns-card" style="display:flex;flex-direction:column;gap:12px;margin-top:20px" id="rzp-card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div class="ns-h3">💳 Online payments (Razorpay)</div>
      ${st.connected ? `<span class="ns-pill green">Connected · ${st.mode === 'live' ? 'Live' : 'Test mode'} · ${esc(st.key_hint)}</span>` : '<span class="ns-pill grey">Not connected</span>'}</div>
    <div class="ns-muted" style="font-size:13px">Send guests a payment link (UPI, card, net banking). Money goes straight to <b>your</b> Razorpay account, and NammaStay marks the booking paid automatically. Razorpay charges its own fee per payment.</div>
    ${owner ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
        ${field('Key ID', `<input class="ns-input" name="rzp_id" placeholder="rzp_live_XXXXXXXX" value="${esc(st.connected ? '' : '')}" autocomplete="off">`, st.connected ? 'Saved — type a new one only to change it.' : 'Razorpay → Account & Settings → API Keys')}
        ${field('Key Secret', `<input class="ns-input" type="password" name="rzp_secret" placeholder="${st.connected ? '•••••••• saved' : 'Shown once when you create the key'}" autocomplete="new-password">`)}
        ${field('Webhook secret (recommended)', `<input class="ns-input" type="password" name="rzp_hook" placeholder="${st.webhook ? '•••••••• saved' : 'Any long password you choose'}" autocomplete="new-password">`)}</div>
      <details class="ota-howto"><summary>Set up the webhook (payments show as paid within seconds)</summary>
        <div style="font-size:12.5px;line-height:1.6;margin-top:8px">Razorpay → Account & Settings → <b>Webhooks</b> → <b>Add new webhook</b>:<br>
          URL: <input class="ns-input" readonly value="${esc(hook)}" style="height:34px;font-size:12px;margin:4px 0" id="rzp-hook-url"><br>
          Secret: the same <b>Webhook secret</b> as above · Events: tick <b>payment_link.paid</b>, <b>payment_link.expired</b>, <b>payment_link.cancelled</b>.<br>
          Without a webhook, NammaStay still checks for payment whenever the booking is opened.</div></details>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="ns-btn" id="rzp-save">Save</button>
        ${st.connected ? '<button type="button" class="ns-btn-ghost" id="rzp-test">Test connection</button><button type="button" class="ns-btn-ghost" id="rzp-off" style="color:#B23A3A">Disconnect</button>' : ''}</div>`
    : '<div class="ns-help">Only the owner can connect or change Razorpay.</div>'}
  </div>`);
  if (!owner) return;
  const v = (n) => $(`#rzp-card [name=${n}]`).value.trim();
  $('#rzp-save').onclick = async (e) => {
    const id = v('rzp_id') || (st.connected ? '__keep__' : '');
    if (!id) return toast('Paste your Razorpay Key ID (starts with rzp_live_ or rzp_test_).', { error: true });
    e.target.disabled = true;
    try {
      if (id === '__keep__') {
        if (!v('rzp_secret') && !v('rzp_hook')) return toast('Nothing to change.');
        return toast('To change secrets, paste the Key ID again too.', { error: true });
      }
      await rpc('set_razorpay_keys', { p_property: ctx.property_id, p_key_id: id, p_key_secret: v('rzp_secret'), p_webhook_secret: v('rzp_hook') });
      toast('Razorpay connected.'); location.replace('settings.html');
    } catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
  };
  $('#rzp-test')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { const { data, error } = await sb.functions.invoke('razorpay', { body: { action: 'test', property_id: ctx.property_id } });
      if (error || data?.error) throw new Error(data?.error || error.message);
      toast(`Razorpay works ✓ (${data.mode === 'live' ? 'live' : 'test'} mode)`);
    } catch (err) { toast(`${err.message} — check the keys, and that the razorpay function is deployed.`, { error: true }); } finally { e.target.disabled = false; }
  });
  $('#rzp-off')?.addEventListener('click', async () => {
    if (!await confirmDialog('Disconnect Razorpay', 'Payment links stop working until you connect again. Payments already received stay recorded.', { confirmLabel: 'Disconnect', danger: true })) return;
    await rpc('set_razorpay_keys', { p_property: ctx.property_id, p_key_id: '', p_key_secret: '', p_webhook_secret: '' }); toast('Disconnected.'); location.replace('settings.html');
  });
}

function moreCards(ctx, p) {
  razorpayCard(ctx);
  const offers = p.offers || { enabled: false, tiers: [{ from_stay: 2, pct: 5 }, { from_stay: 5, pct: 10 }] };
  const tiers = [...(offers.tiers || []), { from_stay: '', pct: '' }, { from_stay: '', pct: '' }].slice(0, 3);
  document.querySelector('.ns-content').insertAdjacentHTML('beforeend', `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;margin-top:20px">
    <div class="ns-card" style="display:flex;flex-direction:column;gap:12px" id="gst-card">
      <div class="ns-h3">🧾 Invoices & GST</div>
      ${field('GST', `<select class="ns-input" name="gst_mode">${options([['none', 'Not registered — simple bill / receipt'], ['auto', 'Automatic by room rate (nil ≤ ₹1,000 · 5% ≤ ₹7,500 · 18% above)'], ['fixed', 'Fixed rate for rooms']], p.gst_mode || 'none')}</select>`)}
      <div id="gst-more" style="display:flex;flex-direction:column;gap:12px">
        ${field('GSTIN', `<input class="ns-input" name="gstin" maxlength="15" value="${esc(p.gstin || '')}" placeholder="33ABCDE1234F1Z5" style="text-transform:uppercase">`)}
        ${field('Legal / business name', `<input class="ns-input" name="legal_name" maxlength="120" value="${esc(p.legal_name || '')}" placeholder="As on your GST certificate">`)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div id="gst-fixed">${field('Room GST %', `<input class="ns-input" name="gst_rate" type="number" min="0" max="28" step="0.5" value="${Number(p.gst_rate ?? 5)}">`)}</div>
          ${field('Food & extras GST %', `<input class="ns-input" name="extras_gst_rate" type="number" min="0" max="28" step="0.5" value="${Number(p.extras_gst_rate ?? 5)}">`)}</div>
      </div>
      ${field('Invoice number prefix', `<input class="ns-input" name="invoice_prefix" maxlength="10" value="${esc(p.invoice_prefix || 'INV')}" style="text-transform:uppercase">`, 'Invoices are numbered like INV/2026-27/0001, restarting each April.')}
      <div class="ns-help">Prices include GST. Rates change — please confirm yours with your CA.</div>
      <button type="button" class="ns-btn" id="save-gst" style="align-self:flex-start">Save invoice settings</button>
    </div>
    <div class="ns-card" style="display:flex;flex-direction:column;gap:12px" id="offer-card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div class="ns-h3">🎁 Regular-guest offers</div>
        <label style="display:flex;gap:6px;align-items:center;font-weight:800;font-size:13px"><input type="checkbox" name="on" ${offers.enabled ? 'checked' : ''} style="width:18px;height:18px;accent-color:#1C9A6C"> On</label></div>
      <div class="ns-muted" style="font-size:12.5px">Returning guests get a discount on the room charge automatically when staff book them. Owner or manager can change it on any booking.</div>
      ${tiers.map((t) => `<div style="display:grid;grid-template-columns:auto 80px auto 80px auto;gap:8px;align-items:center;font-size:13px" data-tier>
        <span>From stay no.</span><input class="ns-input" name="from" type="number" min="2" max="50" value="${t.from_stay}" style="height:36px">
        <span>get</span><input class="ns-input" name="pct" type="number" min="1" max="50" step="0.5" value="${t.pct}" style="height:36px"><span>% off</span></div>`).join('')}
      <div class="ns-help">Example: “from stay no. 2 get 5% off” = every returning guest; “from 5 get 10%” = loyal guests. Leave a row empty to skip it.</div>
      <button type="button" class="ns-btn" id="save-offers" style="align-self:flex-start">Save offers</button>
    </div>
  </div>`);
  const gm = () => { const m = $('#gst-card [name=gst_mode]').value; $('#gst-more').hidden = m === 'none'; $('#gst-fixed').hidden = m !== 'fixed'; };
  $('#gst-card [name=gst_mode]').addEventListener('change', gm); gm();
  const save = async (btn, patch, okMsg) => {
    btn.disabled = true;
    try { await q(sb.from('properties').update(patch).eq('id', ctx.property_id)); toast(okMsg); return true; }
    catch (err) {
      toast(/gstin/.test(err.message) ? 'That GSTIN doesn’t look right — it has 15 characters, e.g. 33ABCDE1234F1Z5.'
        : /invoice_prefix/.test(err.message) ? 'Prefix: capital letters, numbers and dashes only (max 10).' : err.message, { error: true });
      return false;
    } finally { btn.disabled = false; }
  };
  $('#save-gst').onclick = (e) => {
    const v = (n) => $(`#gst-card [name=${n}]`).value.trim();
    const mode = v('gst_mode');
    if (mode !== 'none' && !/^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/.test(v('gstin').toUpperCase())) return toast('Enter your GSTIN (15 characters) to show GST on invoices.', { error: true });
    save(e.target, { gst_mode: mode, gstin: v('gstin').toUpperCase() || null, legal_name: v('legal_name') || null,
      gst_rate: Number(v('gst_rate') || 5), extras_gst_rate: Number(v('extras_gst_rate') || 5), invoice_prefix: (v('invoice_prefix') || 'INV').toUpperCase() }, 'Invoice settings saved.');
  };
  $('#save-offers').onclick = (e) => {
    const t = $$('#offer-card [data-tier]').map((r) => ({ from_stay: parseInt(r.querySelector('[name=from]').value, 10), pct: Number(r.querySelector('[name=pct]').value) }))
      .filter((x) => x.from_stay >= 2 && x.pct > 0 && x.pct <= 50).sort((a, b) => a.from_stay - b.from_stay);
    const on = $('#offer-card [name=on]').checked;
    if (on && !t.length) return toast('Add at least one offer (from stay no. 2 or more, 1–50% off).', { error: true });
    save(e.target, { offers: { enabled: on, tiers: t } }, on ? 'Offers are on — they apply to new bookings.' : 'Offers saved (off).');
  };
  if (!ctx.can('owner', 'manager')) $$('#gst-card button, #offer-card button').forEach((b) => b.remove());
}

// ------------------------------------------------------------ subscription invoices (from NammaStay) + billing details
async function billingExtras(ctx) {
  const [det, inv] = await Promise.all([rpc('my_billing_details', { p_property: ctx.property_id }).catch(() => null), rpc('my_platform_invoices', { p_property: ctx.property_id }).catch(() => null)]);
  if (!det) return;                                                   // database not updated yet (023)
  const host = document.querySelector('.ns-content');
  host.insertAdjacentHTML('beforeend', `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;margin-top:20px">
    <div class="ns-card" style="display:flex;flex-direction:column;gap:12px" id="bill-det">
      <div class="ns-h3">Billing details for your invoices</div>
      <div class="ns-muted" style="font-size:12.5px">Shown on the invoices NammaStay sends you. Add your GSTIN to claim input tax credit.</div>
      ${field('Name on invoice', `<input class="ns-input" name="bill_name" maxlength="120" value="${esc(det.bill_name || '')}" placeholder="${esc(det.name)}">`)}
      ${field('GSTIN (optional)', `<input class="ns-input" name="bill_gstin" maxlength="15" value="${esc(det.bill_gstin || '')}" placeholder="33ABCDE1234F1Z5" style="text-transform:uppercase">`)}
      ${field('Billing address', `<input class="ns-input" name="bill_address" maxlength="300" value="${esc(det.bill_address || '')}" placeholder="Door no, street, city, PIN">`)}
      ${field('State', `<select class="ns-input" name="bill_state"><option value="">Choose…</option>${options(GST_STATES, det.bill_state || '')}</select>`)}
      <button type="button" class="ns-btn" id="save-bill" style="align-self:flex-start">Save billing details</button>
    </div>
    <div class="ns-card" style="padding:0;overflow:hidden">
      <div class="ns-h3" style="padding:18px 20px">Your invoices</div>
      ${inv && inv.length ? inv.map((x, i) => `<div class="pl-row" style="padding:10px 20px"><span><b>${esc(x.number)}</b> · ${fmtDate(x.issued_at)}<br><span class="ns-muted" style="font-size:12px">${esc(x.doc.period?.plan || '')} plan · ${fmtDate(x.doc.period?.from)} – ${fmtDate(x.doc.period?.to)}</span></span>
          <span style="display:flex;gap:8px;align-items:center"><b>${rupees(x.total_paise)}</b><button type="button" class="ns-btn-ghost" data-inv-i="${i}" style="height:32px;font-size:12px">View / PDF</button></span></div>`).join('')
        : '<div class="ns-empty" style="padding:18px">Invoices appear here after each payment is confirmed.</div>'}
    </div></div>`);
  $$('[data-inv-i]').forEach((b) => b.onclick = () => openPlatformInvoice(inv[+b.dataset.invI].doc));
  $('#save-bill').onclick = async (e) => {
    const v = (n) => $(`#bill-det [name=${n}]`).value.trim();
    e.target.disabled = true;
    try { await rpc('set_billing_details', { p_property: ctx.property_id, p: { bill_name: v('bill_name'), bill_gstin: v('bill_gstin').toUpperCase(), bill_address: v('bill_address'), bill_state: v('bill_state') } });
      toast('Billing details saved — used on your next invoice.'); }
    catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
  };
}
