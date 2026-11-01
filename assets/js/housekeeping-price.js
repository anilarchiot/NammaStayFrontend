// Housekeeping add-on price: US$10 a month, shown in the viewer's local currency.
import { USD_TO_INR, viewerCurrency, priceFromInr, formatMoney } from './currency.js';

export const HK_PRICE_USD = 10;
const HK_PRICE_INR = HK_PRICE_USD * USD_TO_INR;

/** What UPI collects and what the backend records: the INR equivalent, in paise. */
export const HK_PRICE_INR_PAISE = Math.round(HK_PRICE_INR * 100);

/** The monthly price in the viewer's currency, e.g. "₹880" in India, "LKR 3,000" in Sri Lanka, "$10" elsewhere. */
export function housekeepingPrice(currency = viewerCurrency()) {
  return { currency, text: currency === 'USD' ? formatMoney(HK_PRICE_USD, 'USD') : priceFromInr(HK_PRICE_INR, currency) };
}
