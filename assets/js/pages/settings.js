import { page, DEMO, rpc, q, sb, content, esc, rupees, toPaise, field, options, modal, confirmDialog, toast, ROLE_LABEL, fmtDayTime, fmtDate, avatar, pill, upiLink, qrDataUrl, $, $$ } from '../core.js';

const ROLE_PILL = { owner: 'navy', manager: 'green', front_desk: 'blue', accountant: 'amber' };
const TABS = ['property', 'team', 'rooms', 'notifications', 'billing'];
const STATE = { trial: ['Free trial', 'blue'], active: ['Active', 'green'], grace: ['Payment due', 'amber'], expired: ['Ended', 'red'], complimentary: ['Free — complimentary', 'green'] };

page('settings', async (ctx) => {
  const owner = ctx.can('owner');
  const tabsRow = $$('.ns-main > div').find((d) => /Users & roles/.test(d.textContent) && d.children.length === 4);
  const tabEls = tabsRow ? [...tabsRow.children] : [];
  if (tabsRow && tabEls.length === 4) {                 // add the Billing tab next to the design's four
    const t = tabEls[0].cloneNode(false); t.textContent = 'Billing'; tabsRow.appendChild(t); tabEls.push(t);
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

    // ------------------------------------------------------------ Billing (subscription)
    async billing() {
      const b = await rpc('billing_info', { p_property: ctx.property_id });
      const a = b.access; const [label, color] = STATE[a.state] || [a.state, 'grey'];
      const plans = b.plans; let chosen = plans.find((x) => x.id === a.plan_id) || plans[plans.length - 1] || plans[0];
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
            <div class="ns-h3">${a.state === 'active' ? 'Renew or extend' : 'Choose a plan'}</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px" id="plans">
              ${plans.map((x) => `<button type="button" class="ns-plan${x.id === chosen?.id ? ' is-on' : ''}" data-plan="${esc(x.id)}">
                <b style="font-size:15px">${esc(x.name)}</b>
                <span class="price">${rupees(x.price_paise)} <small>/ ${x.period_months === 1 ? 'month' : x.period_months === 12 ? 'year' : x.period_months + ' months'}</small></span>
                <span class="ns-muted">${esc(x.description || '')}</span></button>`).join('')}
            </div>
            ${!owner ? '<div class="ns-muted">Only the property owner can make payments.</div>' : !upi ? '<div class="ns-demo-hint">Online payment details aren’t set up yet. Please contact NammaStay support.</div>' : `
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
        chosen = plans.find((x) => x.id === p.dataset.plan);
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
