// First-time setup wizard: property → rooms & beds → UPI → staff → done. Each step saves as you go.
import { page, headerActions, rpc, q, sb, content, setSubtitle, esc, rupees, toPaise, field, options, toast, W, ROLE_LABEL, $, $$ } from '../core.js';

const STEPS = [['details', 'Your property'], ['rooms', W.units === 'beds' ? 'Rooms & beds' : 'Rooms'], ['upi', 'Payments'], ['staff', 'Your team'], ['done', 'All set']];

page('setup', async (ctx) => {
  if (!ctx.can('owner', 'manager')) { location.replace('dashboard.html'); return; }
  let step = 0;
  headerActions().innerHTML = '<a class="ns-btn-ghost" href="dashboard.html">Do it later</a>';
  const pr = await q(sb.from('properties').select('*').eq('id', ctx.property_id).single());
  const hostel = (pr.kind || 'hostel') === 'hostel';

  async function draw() {
    const prog = await rpc('setup_progress', { p_property: ctx.property_id }).catch(() => ({}));
    setSubtitle(`Step ${step + 1} of ${STEPS.length} · about 5 minutes · you can change everything later`);
    content(`<div class="su-wrap">
      <ol class="su-track">${STEPS.map(([k, l], i) => `<li class="${i === step ? 'is-on' : ''}${i < step || prog[k] ? ' is-done' : ''}"><span>${i < step || prog[k] ? '✓' : i + 1}</span>${l}</li>`).join('')}</ol>
      <div class="ns-card su-card" id="su-body"></div></div>`, 'padding:24px 32px;');
    ({ details, rooms, upi, staff, done })[STEPS[step][0]]();
  }
  const nav = (back = true, nextLabel = 'Save & continue') => `<div class="su-nav">${back && step > 0 ? '<button type="button" class="ns-btn-ghost" id="su-back">← Back</button>' : '<span></span>'}
      <span style="display:flex;gap:8px"><button type="button" class="ns-btn-ghost" id="su-skip">Skip for now</button><button type="button" class="ns-btn" id="su-next">${nextLabel}</button></span></div>`;
  const wire = (save) => {
    $('#su-back')?.addEventListener('click', () => { step--; draw(); });
    $('#su-skip')?.addEventListener('click', () => { step++; draw(); });
    $('#su-next').onclick = async (e) => { e.target.disabled = true; try { if (await save() !== false) { step++; draw(); } } catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; } };
  };
  const body = (html) => { $('#su-body').innerHTML = html; };

  // ---------------------------------------------------------------- 1. property
  function details() {
    body(`<div class="su-h">Tell guests where you are</div><div class="ns-muted su-sub">Shown on bills, WhatsApp confirmations and invoices.</div>
      <div class="su-grid">
        ${field('Property name', `<input class="ns-input" name="name" value="${esc(pr.name || '')}">`)}
        ${field('Phone / WhatsApp', `<input class="ns-input" name="phone" inputmode="tel" value="${esc(pr.phone || '')}" placeholder="+91 98400 12345">`)}
        <div style="grid-column:1/-1">${field('Address', `<input class="ns-input" name="address" value="${esc(pr.address || '')}" placeholder="Door no, street, area">`)}</div>
        ${field('City', `<input class="ns-input" name="city" value="${esc(pr.city || '')}">`)}
        ${field('Email (optional)', `<input class="ns-input" type="email" name="email" value="${esc(pr.email || '')}">`)}
        ${field('Check-in from', `<input class="ns-input" type="time" name="checkin_time" value="${esc((pr.checkin_time || '14:00').slice(0, 5))}">`)}
        ${field('Check-out by', `<input class="ns-input" type="time" name="checkout_time" value="${esc((pr.checkout_time || '11:00').slice(0, 5))}">`)}
      </div>${nav(false)}`);
    wire(async () => {
      const v = (n) => $(`#su-body [name=${n}]`).value.trim();
      const phone = v('phone').replace(/[\s-]/g, '');
      if (!v('name')) throw new Error('Enter your property name.');
      if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) throw new Error('Check the phone number.');
      const upd = { name: v('name'), phone: phone || null, address: v('address') || null, city: v('city') || null, email: v('email') || null, checkin_time: v('checkin_time') || '14:00', checkout_time: v('checkout_time') || '11:00' };
      await q(sb.from('properties').update(upd).eq('id', ctx.property_id)); Object.assign(pr, upd);
    });
  }

  // ---------------------------------------------------------------- 2. rooms & beds
  async function rooms() {
    const have = await q(sb.from('beds').select('id,room_id,rate_paise').eq('property_id', ctx.property_id).eq('is_active', true));
    const row = (r = {}) => `<div class="su-row">
        <input class="ns-input" name="rname" placeholder="${hostel ? 'e.g. 6-Bed Mixed Dorm' : 'e.g. Deluxe Room'}" value="${esc(r.name || '')}" aria-label="Room name">
        <input class="ns-input" name="count" type="number" min="1" max="${hostel ? 40 : 200}" value="${r.count || ''}" placeholder="${hostel ? 'Beds' : 'Rooms'}" aria-label="How many">
        ${hostel ? `<select class="ns-input" name="pos" aria-label="Bed type">${options([['lower', 'Lower'], ['upper', 'Upper'], ['single', 'Single']], r.pos || 'lower')}</select>` : `<input class="ns-input" name="max" type="number" min="1" max="10" value="${r.max || 2}" aria-label="Max guests" title="Max guests">`}
        <input class="ns-input" name="rate" inputmode="decimal" value="${r.rate || ''}" placeholder="₹ / night" aria-label="Price per night">
        <button type="button" class="ns-icon-del" data-del aria-label="Remove row">✕</button></div>`;
    const sample = hostel ? [{ name: '6-Bed Mixed Dorm', count: 3, pos: 'lower', rate: 700 }, { name: '6-Bed Mixed Dorm', count: 3, pos: 'upper', rate: 600 }]
      : [{ name: 'Standard Room', count: 5, max: 2, rate: 1800 }];
    body(`<div class="su-h">${hostel ? 'Add your dorms and beds' : 'Add your rooms'}</div>
      <div class="ns-muted su-sub">${hostel ? 'One line per group of beds with the same price. Same room name on two lines = one dorm (e.g. 3 lower beds ₹700 + 3 upper beds ₹600).' : 'One line per room type. Rooms are numbered 101, 102… — rename them later in Rooms.'}</div>
      ${have.length ? `<div class="su-have">✓ You already have <b>${have.length} ${have.length === 1 ? W.unit : W.units}</b>. Add more below, or skip.</div>` : ''}
      <div class="su-rows-head"><span>${hostel ? 'Dorm / room' : 'Room type'}</span><span>${hostel ? 'Beds' : 'Rooms'}</span><span>${hostel ? 'Bed type' : 'Max guests'}</span><span>Price / night</span><span></span></div>
      <div id="su-rows">${(have.length ? [{}] : sample).map(row).join('')}</div>
      <button type="button" class="ns-btn-ghost" id="su-add" style="align-self:flex-start">+ Add a line</button>
      ${nav()}`);
    const bind = () => $$('#su-rows [data-del]').forEach((b) => b.onclick = () => { b.closest('.su-row').remove(); });
    bind(); $('#su-add').onclick = () => { $('#su-rows').insertAdjacentHTML('beforeend', row()); bind(); };
    wire(async () => {
      const lines = $$('#su-rows .su-row').map((r) => ({ name: r.querySelector('[name=rname]').value.trim(), count: parseInt(r.querySelector('[name=count]').value, 10),
        rate: toPaise(r.querySelector('[name=rate]').value), pos: r.querySelector('[name=pos]')?.value || 'single', max: parseInt(r.querySelector('[name=max]')?.value, 10) || 2 }))
        .filter((l) => l.name || l.count || l.rate);
      if (!lines.length) { if (have.length) return true; throw new Error(`Add at least one line, or tap Skip for now.`); }
      for (const l of lines) if (!l.name || !(l.count >= 1) || !(l.rate > 0)) throw new Error('Each line needs a name, how many, and a price.');
      const byRoom = {}; lines.forEach((l) => { (byRoom[l.name] ||= []).push(l); });
      let made = 0; let roomNo = 101;
      for (const [name, ls] of Object.entries(byRoom)) {
        const room = await q(sb.from('rooms').insert({ property_id: ctx.property_id, name, sort: 99 }).select('id').single());
        let i = 0; const beds = [];
        for (const l of ls) for (let k = 0; k < l.count; k++) {
          i++;
          beds.push(hostel ? { property_id: ctx.property_id, room_id: room.id, label: `${l.pos === 'upper' ? 'Upper' : l.pos === 'lower' ? 'Lower' : 'Bed'} ${i}`, rate_paise: l.rate, sort: i, position: l.pos }
            : { property_id: ctx.property_id, room_id: room.id, label: String(roomNo++), rate_paise: l.rate, sort: i, position: 'single', max_guests: l.max, base_guests: Math.min(l.max, 2), extra_guest_paise: 0 });
        }
        await q(sb.from('beds').insert(beds)); made += beds.length;
      }
      toast(`${made} ${made === 1 ? W.unit : W.units} added.`);
    });
  }

  // ---------------------------------------------------------------- 3. payments
  function upi() {
    body(`<div class="su-h">Get paid by UPI — no gateway fees</div>
      <div class="ns-muted su-sub">Guests scan a QR on their booking and pay straight into your bank. Find your UPI ID in GPay / PhonePe / Paytm → profile.</div>
      <div class="su-grid">${field('Your UPI ID', `<input class="ns-input" name="upi" value="${esc(pr.upi_id || '')}" placeholder="yourname@okaxis">`)}</div>
      <div class="ns-help">Card / net-banking payment links (Razorpay) and GST invoices can be switched on later in Settings.</div>${nav()}`);
    wire(async () => {
      const u = $('#su-body [name=upi]').value.trim().replace(/\s+/g, '');
      if (!u) return true;
      if (!/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(u)) throw new Error('That UPI ID doesn’t look right — e.g. name@okaxis or 9840012345@ybl.');
      await q(sb.from('properties').update({ upi_id: u }).eq('id', ctx.property_id)); pr.upi_id = u;
    });
  }

  // ---------------------------------------------------------------- 4. team
  function staff() {
    const line = () => `<div class="su-row su-row-team"><input class="ns-input" name="tname" placeholder="Name"><input class="ns-input" name="temail" type="email" placeholder="Email (they sign in with it)">
      <select class="ns-input" name="trole">${options(Object.entries(ROLE_LABEL).filter(([k]) => k !== 'owner'), 'front_desk')}</select></div>`;
    body(`<div class="su-h">Invite your team (optional)</div>
      <div class="ns-muted su-sub">Each person gets their own sign-in. You decide what each role can see and do (Settings → Users &amp; roles). Unlimited staff is included.</div>
      <div id="su-team">${line()}${line()}</div><button type="button" class="ns-btn-ghost" id="su-addt" style="align-self:flex-start">+ Another person</button>${nav(true, 'Invite & continue')}`);
    $('#su-addt').onclick = () => $('#su-team').insertAdjacentHTML('beforeend', line());
    wire(async () => {
      const ppl = $$('#su-team .su-row').map((r) => ({ name: r.querySelector('[name=tname]').value.trim(), email: r.querySelector('[name=temail]').value.trim(), role: r.querySelector('[name=trole]').value })).filter((x) => x.email);
      for (const x of ppl) await rpc('add_member', { p_property: ctx.property_id, p_email: x.email, p_role: x.role, p_name: x.name || x.email.split('@')[0] });
      if (ppl.length) toast(`${ppl.length} ${ppl.length === 1 ? 'person' : 'people'} invited — they sign up with that email.`);
    });
  }

  // ---------------------------------------------------------------- 5. done
  async function done() {
    await rpc('setup_finish', { p_property: ctx.property_id, p_done: true }).catch(() => {});
    const prog = await rpc('setup_progress', { p_property: ctx.property_id }).catch(() => ({}));
    const item = (ok, label, href, cta) => `<div class="su-done-row${ok ? ' is-ok' : ''}"><span>${ok ? '✅' : '⬜'} ${label}</span>${ok ? '' : `<a class="ns-btn-ghost" href="${href}">${cta}</a>`}</div>`;
    body(`<div class="su-h">🎉 You’re ready</div><div class="ns-muted su-sub">Your 15-day free trial is running. Here’s what’s left — or come back to it any time from the dashboard.</div>
      ${item(prog.details, 'Property details', 'setup.html', 'Add')}
      ${item(prog.rooms, hostel ? 'Dorms & beds' : 'Rooms', 'rooms.html', 'Add')}
      ${item(prog.upi, 'UPI ID for payments', 'settings.html', 'Add')}
      ${item(prog.staff, 'Team invited', 'settings.html?tab=team', 'Invite')}
      ${item(prog.booking, 'First booking', 'check-in.html?new=1', 'Make one')}
      <div class="su-next">
        <a class="ns-btn ns-btn-lg" href="check-in.html?new=1">➕ Make your first booking</a>
        <a class="ns-btn-ghost" href="ota.html">🔗 Connect Airbnb / Booking.com</a>
        <a class="ns-btn-ghost" href="settings.html?tab=rooms">💰 Weekend &amp; season prices</a>
        <a class="ns-btn-ghost" href="dashboard.html">Go to dashboard</a></div>`);
  }

  await draw();
});
