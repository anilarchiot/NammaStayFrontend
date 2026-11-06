// Paid add-on gate shared by Housekeeping and OTA sync: locked page, UPI/UTR payment, admin approval unlocks it monthly.
import { housekeepingPrice as addonPrice, HK_PRICE_INR_PAISE as ADDON_PRICE_INR_PAISE } from './housekeeping-price.js';
import { otaTile, OTA_LIST } from './ota-icons.js';
import { rpc, content, setSubtitle, headerActions, esc, modal, field, toast, fmtDate, rupees, upiLink, qrDataUrl, $ } from './core.js';

const LOCK = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 018 0v3"></path></svg>';

// cfg: { rpc, name, eyebrow, ownerHeading, staffHeading, ownerText, staffText, ctaLabel, asideIcon, asideOwner: [title, text], asideStaff: [title, text] }
// Resolves true when the add-on is active; otherwise renders the locked screen and resolves false.
export async function requireAddon(ctx, cfg) {
  let addon = await rpc(`${cfg.rpc}_status`, { p_property: ctx.property_id });
  if (addon.active) return true;
  await renderGate();
  return false;

  async function renderGate() {
    headerActions().replaceChildren();
    const price = addonPrice();
    setSubtitle(`${cfg.name} · ${price.text} per month`);
    const owner = ctx.can('owner');
    content(`
      <section class="hk-addon-layout">
        <div class="hk-addon-card">
          <div class="hk-addon-lock">${LOCK}</div>
          <div class="hk-addon-eyebrow">${esc(cfg.eyebrow)}</div>
          <h2>${esc(owner ? cfg.ownerHeading : cfg.staffHeading)}</h2>
          <p>${esc(owner ? cfg.ownerText : cfg.staffText)}</p>
          ${cfg.channels ? `<div class="ota-tiles" aria-label="Supported OTAs">${OTA_LIST.map((o) => otaTile(o)).join('')}<span class="ota-tile is-more"><b>+ any OTA with an iCal link</b></span></div>` : ''}
          ${cfg.features ? `<ul class="hk-addon-features">${cfg.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
          ${addon.active_until ? `<div class="hk-addon-note">Access ended ${esc(fmtDate(addon.active_until))}.</div>` : ''}
          ${addon.pending ? `<div class="hk-addon-note is-pending">Payment submitted. ${esc(cfg.name)} will turn on after TheNammaStay confirms it.</div>` : ''}
          ${owner && addon.last_status === 'rejected' ? `<div class="hk-addon-note is-rejected">${esc(addon.review_note || 'The last payment could not be confirmed. Check the UTR and try again.')}</div>` : ''}
          ${owner && !addon.pending ? `<div class="hk-addon-price">${price.text} <span>/ month</span></div><button type="button" class="ns-btn" id="hk-addon-pay">${esc(cfg.ctaLabel)}</button>` : ''}
          ${owner ? '<div class="hk-addon-footnote">Monthly access starts when your payment is approved.</div>' : ''}
        </div>
        <aside class="hk-addon-aside">
          <div class="hk-addon-aside-icon">${cfg.asideIcon}</div>
          <div><b>${esc(owner ? cfg.asideOwner[0] : cfg.asideStaff[0])}</b><p>${esc(owner ? cfg.asideOwner[1] : cfg.asideStaff[1])}</p></div>
        </aside>
      </section>`, 'padding:24px 32px;display:flex;flex-direction:column;gap:16px;');
    $('#hk-addon-pay')?.addEventListener('click', () => startPayment().catch((error) => toast(error.message, { error: true })));
  }

  async function startPayment() {
    const billing = await rpc('billing_info', { p_property: ctx.property_id });
    const payTo = billing.pay_to || {};
    if (!payTo.upi_id) { toast('UPI payment details are not set up. Contact TheNammaStay support.', { error: true }); return; }
    const price = addonPrice();
    const inr = rupees(ADDON_PRICE_INR_PAISE);
    const link = upiLink({ upiId: payTo.upi_id, payee: payTo.payee_name || 'TheNammaStay', amountPaise: ADDON_PRICE_INR_PAISE, note: `${cfg.name} ${ctx.property_name}`.slice(0, 40) });
    const payment = modal({
      title: cfg.ctaLabel,
      body: `<div class="hk-addon-payment"><div class="hk-addon-payment-amount">${price.text} <span>/ month</span></div>
        <p>${price.currency === 'INR' ? `Pay ${inr} using UPI` : `UPI payments are collected in Indian rupees (${inr}). Pay ${inr} using UPI`}, then enter the transaction ID. Access starts after payment is confirmed.</p>
        <div class="hk-addon-payment-tools"><div class="hk-addon-qr" id="hk-addon-qr-box"><img id="hk-addon-qr" alt="UPI payment QR code" width="156" height="156"></div>
          <a class="ns-btn" href="${esc(link)}">Open UPI app</a></div>
        ${field('UPI transaction ID (UTR)', '<input class="ns-input" name="utr" inputmode="numeric" autocomplete="off" maxlength="35" placeholder="Enter the UTR from your payment app">', 'We’ll review the payment before enabling access.')}</div>`,
      actions: [{ label: 'Cancel' }, { label: 'I’ve paid — submit UTR', kind: 'primary', onClick: async (el) => {
        const utr = el.querySelector('[name="utr"]').value.replace(/\s/g, '').toUpperCase();
        if (!/^[0-9A-Z]{6,35}$/.test(utr)) throw new Error('Enter a valid UPI transaction ID (UTR).');
        await rpc(`${cfg.rpc}_submit`, { p_property: ctx.property_id, p_utr: utr });
        addon = await rpc(`${cfg.rpc}_status`, { p_property: ctx.property_id });
        await renderGate();
        toast('Payment submitted for confirmation.');
      } }],
    });
    qrDataUrl(link).then((url) => {
      const image = payment.el.querySelector('#hk-addon-qr'); const box = payment.el.querySelector('#hk-addon-qr-box');
      if (url && image) image.src = url; else if (box) box.hidden = true;
    });
  }
}
