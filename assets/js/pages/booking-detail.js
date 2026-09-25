import {
  page, rpc, $, esc, rupees, toPaise, fmtDayTime, toInputDT, fromInputDT, avatar, statusPill, methodPill,
  modal, confirmDialog, toast, field, options, METHOD_OPTIONS, upiLink, qrDataUrl, openIdDoc, param, uuidOk,
  SITE_URL, titleCase,
} from '../core.js';

const ACTIVITY = {
  created: () => 'Booking created',
  status: (d) => `Status: ${titleCase(d.from)} → ${titleCase(d.to)}`,
  changed: (d) => `Stay changed — ${fmtDayTime(d.check_in_at)} to ${fmtDayTime(d.check_out_at)}${d.bed_changed ? ', bed moved' : ''} · total ${rupees(d.total_paise)}`,
  payment: (d) => `Payment received — ${rupees(d.amount_paise)} via ${String(d.method).toUpperCase()} (${d.code})`,
  refund: (d) => `Refund — ${rupees(d.amount_paise)} via ${String(d.method).toUpperCase()} (${d.code})`,
  self_checkin: () => 'Guest completed online check-in',
};

page(null, async (ctx) => {
  const id = param('id');
  if (!uuidOk(id)) throw new Error('Open a booking from the Bookings list.');
  const d = await rpc('booking_detail', { p_booking: id });
  const b = d.booking;
  const g = d.guest;
  const staff = ctx.can('owner', 'manager', 'front_desk');
  const live = ['pending', 'confirmed', 'checked_in'].includes(b.status);
  const editable = staff && live;
  const selfLink = b.self_checkin_token ? `${SITE_URL}/self-check-in.html?t=${b.self_checkin_token}` : null;

  document.title = `${b.code} · NammaStay`;
  const dlg = $('.ns-dialog');
  dlg.innerHTML = `
    <div style="padding:22px 26px;border-bottom:1px solid #F0EBDB;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:700">Booking ${esc(b.code)}</div>${statusPill(b.status)}
          ${b.self_checkin_at ? '<span class="ns-pill blue">Online check-in done</span>' : ''}</div>
        <div class="ns-muted" style="font-size:12.5px;margin-top:4px">Created ${fmtDayTime(b.created_at)}${d.created_by ? ' by ' + esc(d.created_by) : ''}</div>
      </div>
      <a href="bookings.html" class="ns-x" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"></path></svg></a>
    </div>

    <div style="padding:22px 26px;display:flex;flex-direction:column;gap:20px;overflow:auto;flex:1 1 auto;min-height:0">
      <div class="ns-guestbox" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;background:#FBF9F1;border:1px solid #F0EBDB">
        ${avatar(g.full_name, 38)}
        <div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:700">${esc(g.full_name)}</div>
          <div class="ns-muted" style="font-size:11.5px">${esc([g.phone, g.email].filter(Boolean).join(' · '))}</div>
          ${g.id_type ? `<div class="ns-muted" style="font-size:11.5px">${esc(titleCase(g.id_type))}${g.id_number ? ' · ' + esc(g.id_number) : ''}${g.nationality ? ' · ' + esc(g.nationality) : ''}</div>` : ''}</div>
        <div class="ns-guestbox-actions" style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          ${staff ? `<a href="guest-profile.html?id=${esc(g.id)}" style="font-size:12px;font-weight:700">View profile</a>` : ''}
          ${g.id_doc_path ? '<button type="button" class="ns-btn-ghost" id="view-id" style="height:30px;font-size:12px">View ID photo</button>' : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        ${field('Room / Bed', `<div class="ns-input" style="display:flex;align-items:center">${esc(d.bed.room)} · ${esc(d.bed.label)}</div>`)}
        ${field('Nights', `<div class="ns-input" style="display:flex;align-items:center">${b.nights} night${b.nights > 1 ? 's' : ''} · ${rupees(b.rate_paise)}/night</div>`)}
        ${field('Check-in', `<input class="ns-input" type="datetime-local" name="check_in_at" value="${toInputDT(b.check_in_at)}" ${editable && b.status !== 'checked_in' ? '' : 'disabled'}>`)}
        ${field('Check-out', `<input class="ns-input" type="datetime-local" name="check_out_at" value="${toInputDT(b.check_out_at)}" ${editable ? '' : 'disabled'}>`)}
      </div>

      <div style="border:1px solid #F0EBDB;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span class="ns-muted" style="font-size:12.5px">Room charge (${b.nights} night${b.nights > 1 ? 's' : ''})</span><b style="font-weight:600">${rupees(b.total_paise)}</b></div>
        ${d.payments.map((p) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;gap:8px">
            <span class="ns-muted" style="font-size:12.5px">${p.kind === 'refund' ? 'Refund' : 'Paid'} ${fmtDayTime(p.received_at)} ${methodPill(p.method)} ${p.reference ? '<span style="font-size:11px">' + esc(p.reference) + '</span>' : ''}</span>
            <b style="font-weight:600;color:${p.kind === 'refund' ? '#B23A3A' : '#157A56'}">${p.kind === 'refund' ? '−' : ''}${rupees(p.amount_paise)}</b></div>`).join('')}
        <div style="display:flex;justify-content:space-between;font-size:12.5px;padding-top:8px;border-top:1px solid #F0EBDB">
          <b>Balance due</b><b style="color:${b.balance_paise > 0 ? '#B23A3A' : '#157A56'}">${rupees(b.balance_paise)}</b></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
          ${b.balance_paise > 0 && !['cancelled', 'no_show'].includes(b.status) ? '<button type="button" class="ns-btn" id="pay">Record payment</button>' : ''}
          ${ctx.can('owner', 'manager') && b.paid_paise > 0 ? '<button type="button" class="ns-btn-ghost" id="refund">Refund</button>' : ''}
        </div>
      </div>

      ${d.activity.length ? `<div><div class="ns-field"><label>Activity</label></div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
          ${d.activity.map((a) => `<div style="display:flex;gap:10px"><div style="width:7px;height:7px;border-radius:50%;background:#1C9A6C;margin-top:6px;flex-shrink:0"></div>
            <div style="font-size:12.5px"><b>${esc((ACTIVITY[a.action] || (() => titleCase(a.action)))(a.details || {}))}</b> — ${fmtDayTime(a.at)}${a.by ? ` <span style="color:#9AA3B5">by ${esc(a.by)}</span>` : ''}</div></div>`).join('')}
        </div></div>` : ''}

      ${staff ? field('Note', `<textarea class="ns-input" name="note" maxlength="2000" placeholder="Add an internal note" ${editable ? '' : 'disabled'}>${esc(b.note || '')}</textarea>`) : ''}

      ${staff && live && selfLink ? `<div style="border:1px dashed #E2DAC4;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px">
          <div style="font-size:12.5px;font-weight:700">Online check-in link for the guest</div>
          <div class="ns-muted">They fill in their ID details and upload a photo before arriving.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="ns-btn-ghost" id="copy-link">Copy link</button>
            ${g.phone ? `<a class="ns-btn-ghost" target="_blank" rel="noopener" href="https://wa.me/${esc(g.phone.replace(/\D/g, ''))}?text=${encodeURIComponent(`Hi ${g.full_name.split(' ')[0]}, your booking ${b.code} at ${d.property.name} is ready. Please check in online here: ${selfLink}`)}">Send on WhatsApp</a>` : ''}
          </div></div>` : ''}
    </div>

    <div class="ns-dialog-foot" style="padding:16px 26px;border-top:1px solid #F0EBDB;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${staff && ['pending', 'confirmed'].includes(b.status) ? '<button type="button" class="ns-btn-danger" data-act="cancel">Cancel booking</button>' : ''}
        ${staff && ['pending', 'confirmed'].includes(b.status) && new Date(b.check_in_at) < new Date() ? '<button type="button" class="ns-btn-ghost" data-act="no_show">Mark no-show</button>' : ''}
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${editable ? '<button type="button" class="ns-btn-ghost" id="save">Save changes</button>' : ''}
        ${staff && b.status === 'pending' ? '<button type="button" class="ns-btn-ghost" data-act="confirm">Confirm booking</button>' : ''}
        ${staff && ['pending', 'confirmed'].includes(b.status) ? '<button type="button" class="ns-btn" data-act="check_in">Check in</button>' : ''}
        ${staff && b.status === 'checked_in' ? '<button type="button" class="ns-btn" data-act="check_out">Check out</button>' : ''}
        ${!staff || !live ? '<a class="ns-btn-ghost" href="bookings.html">Close</a>' : ''}
      </div>
    </div>`;

  const val = (n) => dlg.querySelector(`[name="${n}"]`)?.value;

  $('#view-id')?.addEventListener('click', () => openIdDoc(g.id_doc_path).catch((e) => toast(e.message, { error: true })));
  $('#copy-link')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(selfLink); toast('Link copied.'); } catch { prompt('Copy this link:', selfLink); }
  });

  $('#save')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await rpc('update_booking', { p_booking: b.id, p: {
        check_in_at: fromInputDT(val('check_in_at')), check_out_at: fromInputDT(val('check_out_at')), note: val('note') ?? '',
      } });
      toast('Changes saved.'); location.reload();
    } catch (err) { toast(err.message, { error: true }); e.target.disabled = false; }
  });

  const LABEL = { confirm: 'Confirm booking', check_in: 'Check in', check_out: 'Check out', cancel: 'Cancel booking', no_show: 'Mark as no-show' };
  dlg.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', async () => {
    const act = btn.dataset.act;
    if (['cancel', 'no_show'].includes(act)
      && !await confirmDialog(LABEL[act], `${LABEL[act]} ${b.code} for ${g.full_name}? This frees the bed.`, { confirmLabel: LABEL[act], danger: true })) return;
    btn.disabled = true;
    try {
      await rpc('booking_action', { p_booking: b.id, p_action: act, p_force: false });
      toast(`${LABEL[act]} — done.`); location.reload();
    } catch (err) {
      btn.disabled = false;
      if (act === 'check_out' && /Balance/.test(err.message)) {
        if (await confirmDialog('Balance still due', err.message + ' Check out anyway?', { confirmLabel: 'Check out anyway', danger: true })) {
          await rpc('booking_action', { p_booking: b.id, p_action: act, p_force: true });
          location.reload();
        }
      } else toast(err.message, { error: true });
    }
  }));

  $('#pay')?.addEventListener('click', () => paymentDialog('payment'));
  $('#refund')?.addEventListener('click', () => paymentDialog('refund'));

  function paymentDialog(kind) {
    const max = kind === 'refund' ? b.paid_paise : b.balance_paise;
    const upi = kind === 'payment' && d.property.upi_id;
    const m = modal({
      title: kind === 'refund' ? `Refund · ${b.code}` : `Record payment · ${b.code}`,
      body: `
        ${field('Amount (₹)', `<input class="ns-input" name="amount" inputmode="decimal" value="${max / 100}">`, `${kind === 'refund' ? 'Paid so far' : 'Balance due'}: ${rupees(max)}`)}
        ${field('Method', `<select class="ns-input" name="method">${options(METHOD_OPTIONS, 'upi')}</select>`)}
        ${field('Reference', '<input class="ns-input" name="reference" autocomplete="off" placeholder="UPI transaction ID (UTR) / slip no.">',
          'For UPI, copy the 12-digit UTR from the guest’s payment screen. Check it arrived in your bank app before saving.')}
        ${upi ? '<div id="qr-box" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px;border:1px solid #F0EBDB;border-radius:12px"><div class="ns-muted">Guest scans to pay ' + esc(d.property.upi_id) + '</div><img id="qr" alt="UPI QR code" width="200" height="200"></div>' : ''}
        ${!upi && kind === 'payment' && ctx.can('owner', 'manager') ? '<div class="ns-help">Add your UPI ID in Settings to show a payment QR here.</div>' : ''}`,
      actions: [{ label: 'Cancel' }, {
        label: kind === 'refund' ? 'Record refund' : 'Save payment', kind: 'primary', onClick: async (el) => {
          const amount = toPaise(el.querySelector('[name=amount]').value);
          if (!(amount > 0)) throw new Error('Enter a valid amount.');
          await rpc('record_payment', {
            p_booking: b.id, p_amount_paise: amount, p_method: el.querySelector('[name=method]').value,
            p_reference: el.querySelector('[name=reference]').value || null, p_kind: kind, p_note: null,
          });
          toast(kind === 'refund' ? 'Refund recorded.' : 'Payment saved.');
          location.reload();
        },
      }],
    });
    if (upi) {
      const amt = m.el.querySelector('[name=amount]');
      const method = m.el.querySelector('[name=method]');
      const draw = async () => {
        const p = toPaise(amt.value);
        m.el.querySelector('#qr-box').hidden = method.value !== 'upi' || !(p > 0);
        if (p > 0) {
          const url = await qrDataUrl(upiLink({ upiId: d.property.upi_id, payee: d.property.name, amountPaise: p, note: b.code }));
          if (url) m.el.querySelector('#qr').src = url; else m.el.querySelector('#qr-box').hidden = true;
        }
      };
      amt.addEventListener('input', draw); method.addEventListener('change', draw); draw();
    }
  }
});
