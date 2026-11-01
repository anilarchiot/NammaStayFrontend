// Shared currency helpers. Prices are authored in INR and shown in the viewer's local currency.
// Rates are fixed approximations (INR per 1 unit of currency); update them here when they drift.
const INR_PER_UNIT = { INR: 1, USD: 88, LKR: 88 / 300 };
const LOCALES = { USD: 'en-US', INR: 'en-IN', LKR: 'en-LK' };
const ROUND_TO = { INR: 1, USD: 1, LKR: 10 };
const TIMEZONES = { 'Asia/Kolkata': 'INR', 'Asia/Calcutta': 'INR', 'Asia/Colombo': 'LKR' };
const REGIONS = { IN: 'INR', LK: 'LKR' };

export function viewerCurrency() {
  try {
    const zone = TIMEZONES[Intl.DateTimeFormat().resolvedOptions().timeZone];
    if (zone) return zone;
    for (const lang of navigator.languages || [navigator.language]) {
      const region = String(lang || '').split('-')[1]?.toUpperCase();
      if (REGIONS[region]) return REGIONS[region];
    }
  } catch { /* Fall back to USD. */ }
  return 'USD';
}

/** Convert an INR amount (rupees) to a rounded amount in `currency`. */
export function fromInr(inr, currency = viewerCurrency()) {
  const step = ROUND_TO[currency] || 1;
  return Math.round(inr / INR_PER_UNIT[currency] / step) * step;
}

export function formatMoney(amount, currency = viewerCurrency()) {
  return new Intl.NumberFormat(LOCALES[currency] || 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

/** Format an INR amount (rupees) in the viewer's currency. */
export function priceFromInr(inr, currency = viewerCurrency()) {
  return formatMoney(fromInr(inr, currency), currency);
}

/** Rewrite "₹19,989"-style amounts inside free text, e.g. plan descriptions. */
export function localizeText(text, currency = viewerCurrency()) {
  if (currency === 'INR') return text;
  return String(text).replace(/₹\s?([\d,]+(?:\.\d+)?)/g, (_, n) => priceFromInr(parseFloat(n.replace(/,/g, '')), currency));
}

export const USD_TO_INR = INR_PER_UNIT.USD;
