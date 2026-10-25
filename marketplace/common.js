// nammaBookings — shared helpers (Supabase settings come from config.js).
const CFG = window.NAMMASTAY_CONFIG || {};
export const configured = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
export const sb = configured
  ? (await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')).createClient(CFG.supabaseUrl, CFG.supabaseAnonKey)
  : null;

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const inr = (paise) => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const today = () => new Date().toISOString().slice(0, 10);

export function say(el, text, isErr = false) {
  el.innerHTML = text ? `<div class="msg${isErr ? ' err' : ''}">${esc(text)}</div>` : '';
}

// Only http(s) photo URLs from our own storage bucket are rendered as images.
export function photoUrl(u) {
  return typeof u === 'string' && u.startsWith(`${CFG.supabaseUrl}/storage/v1/object/public/mk-photos/`) ? u : '';
}
