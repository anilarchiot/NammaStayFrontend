// NammaStay — shared front-end core (ES module, no build step).
// Every page script imports from here.
const CFG = window.NAMMASTAY_CONFIG || {};
/** DEMO only when opened on purpose (login.html?demo=1); LIVE = real Supabase; NOT_CONNECTED = keys missing. */
const DEMO_ON = (() => {
  try {
    const q = new URLSearchParams(location.search).get('demo');
    if (q === '1') localStorage.setItem('ns.demo.on', '1');
    if (q === '0') { localStorage.removeItem('ns.demo.on'); localStorage.removeItem('ns.demo.session'); }
    return localStorage.getItem('ns.demo.on') === '1';
  } catch { return false; }
})();
export const DEMO = DEMO_ON;
/** Base URL of the server functions (iCal links, OTA sync) */
export const FUNCTIONS_URL = (CFG.supabaseUrl ? CFG.supabaseUrl.replace(/\/$/, '') : 'https://YOUR-PROJECT.supabase.co') + '/functions/v1';
export const LIVE = !DEMO && !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
export const NOT_CONNECTED = !DEMO && !LIVE;                      // keys missing: nothing works, nobody gets in
export const sb = LIVE
  ? (await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')).createClient(CFG.supabaseUrl, CFG.supabaseAnonKey)
  : DEMO ? (await import('./demo-backend.js')).createDemoClient() : null;
const HERE = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '').replace(/\/$/, '');
export const SITE_URL = LIVE ? (CFG.siteUrl || location.origin).replace(/\/$/, '') : HERE;
export const TZ = 'Asia/Kolkata';
/** One website: homepage, hostel app, admin pages and legal pages all live on thenammastay.com */
export const MARKETING_URL = SITE_URL;
export const ADMIN_URL = SITE_URL;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------------------------------------------------------------- text & numbers
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
export function rupees(paise) {
  const n = Number(paise || 0) / 100;
  return (n < 0 ? '−₹' : '₹') + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}
export function toPaise(v) {
  const n = parseFloat(String(v ?? '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
export function initials(name) {
  const p = String(name || '?').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ---------------------------------------------------------------- dates (always India time)
const fmt = (o) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...o });
const fDay = fmt({ day: 'numeric', month: 'short' });
const fDate = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const fTime = fmt({ hour: 'numeric', minute: '2-digit', hour12: true });
const fWeek = fmt({ weekday: 'short' });
const fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const sep = (x) => x.replace('Sept', 'Sep');
export const fmtDay = (d) => sep(fDay.format(new Date(d)));
export const fmtDate = (d) => sep(fDate.format(new Date(d)));
export const fmtTime = (d) => fTime.format(new Date(d)).replace(/\s?(am|pm)$/i, (m) => ' ' + m.trim().toUpperCase());
export const fmtDayTime = (d) => `${fmtDay(d)}, ${fmtTime(d)}`;
export const fmtLong = (d) => fLong.format(new Date(d));  // full month names
export const fmtWeekday = (ymd) => `${fWeek.format(new Date(ymd + 'T12:00:00+05:30'))} ${Number(ymd.slice(8, 10))}`;

/** 'YYYY-MM-DD' for a moment, in India time */
export function ymd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
}
export function addDays(ymdStr, n) {
  const d = new Date(ymdStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
/** value for <input type="datetime-local"> in India time */
export function toInputDT(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/** '2026-09-22T14:00' (India time) → ISO string with offset */
export const fromInputDT = (v) => (v ? `${v}:00+05:30` : null);

// ---------------------------------------------------------------- API
function friendly(error) {
  const m = error?.message || String(error || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No connection. Check your internet and try again.';
  if (/JWT|session|refresh token/i.test(m)) return 'Your session expired. Please sign in again.';
  if (/subscription has ended|account is suspended/i.test(m)) return m;
  return m || 'Something went wrong. Please try again.';
}
export async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(friendly(error));
  return data;
}
export async function q(promise, { withCount = false } = {}) {
  const { data, error, count } = await promise;
  if (error) throw new Error(friendly(error));
  return withCount ? { data, count } : data;
}

// ---------------------------------------------------------------- page lifecycle
const PAGE_ROLES = {
  dashboard: null, bookings: null, calendar: null, rooms: null, payments: null,
  guests: ['owner', 'manager', 'front_desk'],
  ota: ['owner', 'manager'],
  formc: ['owner', 'manager', 'front_desk'],
  housekeeping: ['owner', 'manager', 'front_desk'],
  setup: ['owner', 'manager'],
  expenses: ['owner', 'manager', 'accountant'],
  checkin: ['owner', 'manager', 'front_desk'],
  reports: ['owner', 'manager', 'accountant'],
  settings: ['owner', 'manager'],
};
const NAV_KEY = {
  'guest-profile.html': 'guests', 'check-in.html': 'checkin', 'reports.html': 'reports', 'settings.html': 'settings',
};
// Words follow the property type: hostels/PGs sell beds, hotels/homestays sell rooms
const WORDS = {
  hostel: { kind: 'hostel', unit: 'bed', Unit: 'Bed', units: 'beds', Units: 'Beds', setup: 'Rooms & beds', group: 'Room', groups: 'room types',
    perf: 'RevPAB', perfLong: 'Revenue per available bed per night', example: '“6-Bed Mixed Dorm” with 6 beds at ₹700' },
  hotel: { kind: 'hotel', unit: 'room', Unit: 'Room', units: 'rooms', Units: 'Rooms', setup: 'Rooms', group: 'Room type', groups: 'room types',
    perf: 'RevPAR', perfLong: 'Revenue per available room per night', example: '“Deluxe Double” with 4 rooms (101–104) at ₹2,500' },
  homestay: { kind: 'homestay', unit: 'room', Unit: 'Room', units: 'rooms', Units: 'Rooms', setup: 'Rooms', group: 'Room type', groups: 'room types',
    perf: 'RevPAR', perfLong: 'Revenue per available room per night', example: '“Garden Room” at ₹1,800 for 2 guests' },
};
export let W = WORDS.hostel;
const W_ = { get unit() { return W.unit; } };
export const setKind = (k) => { W = WORDS[k] || WORDS.hostel; return W; };
export const roomsMode = () => W.unit === 'room';
export const guestsText = (adults, children) => `${adults || 1} adult${(adults || 1) > 1 ? 's' : ''}${children ? ` · ${children} child${children > 1 ? 'ren' : ''}` : ''}`;

// ---- role permissions (the database enforces the same rules: 017_role_permissions.sql)
export const PERMS = [
  ['view_reports', 'See reports & revenue', 'Reports page (revenue, occupancy, trends)'],
  ['view_payments', 'See payments', 'Payments page and payment totals'],
  ['record_payments', 'Take payments', 'Record payments, including when booking'],
  ['refunds', 'Give refunds', ''],
  ['cancel_bookings', 'Cancel bookings', ''],
  ['delete_bookings', 'Delete bookings', 'Front desk: only their own from the last 24 hours with no payment'],
  ['delete_guests', 'Delete guests', 'Removes the guest and all their bookings'],
  ['manage_rooms', 'Change rooms, beds & prices', 'Rooms, rates and the extras price list'],
  ['add_extras', 'Add extras to bills', 'Food, laundry, rentals…'],
  ['export_data', 'Export CSV files', 'Guest list and other downloads'],
];
/** Fixed limits that can't be switched on for a role */
export const PERM_LOCKED = {
  front_desk: ['view_reports', 'refunds', 'delete_guests', 'manage_rooms'],
  accountant: ['record_payments', 'refunds', 'cancel_bookings', 'delete_bookings', 'delete_guests', 'manage_rooms', 'add_extras'],
};
export function permDefault(role, perm) {
  if (role === 'owner' || role === 'manager') return true;
  if (role === 'front_desk') return ['view_payments', 'record_payments', 'cancel_bookings', 'delete_bookings', 'add_extras'].includes(perm);
  if (role === 'accountant') return ['view_reports', 'view_payments', 'export_data'].includes(perm);
  return false;
}

// ---------------------------------------------------------------- languages (Tamil, Kannada, Telugu, Malayalam)
// Menus, buttons, labels and headings are translated; longer messages stay in English for now.
const I18N = {"Dashboard": ["டாஷ்போர்டு", "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", "డ్యాష్‌బోర్డ్", "ഡാഷ്‌ബോർഡ്"], "Bookings": ["முன்பதிவுகள்", "ಬುಕಿಂಗ್‌ಗಳು", "బుకింగ్‌లు", "ബുക്കിംഗുകൾ"], "Calendar": ["நாள்காட்டி", "ಕ್ಯಾಲೆಂಡರ್", "క్యాలెండర్", "കലണ്ടർ"], "Guests": ["விருந்தினர்கள்", "ಅತಿಥಿಗಳು", "అతిథులు", "അതിഥികൾ"], "Check-in": ["செக்-இன்", "ಚೆಕ್-ಇನ್", "చెక్-ఇన్", "ചെക്ക്-ഇൻ"], "Rooms & beds": ["அறைகள் & படுக்கைகள்", "ಕೊಠಡಿಗಳು & ಹಾಸಿಗೆಗಳು", "గదులు & పడకలు", "മുറികളും കിടക്കകളും"], "Rooms": ["அறைகள்", "ಕೊಠಡಿಗಳು", "గదులు", "മുറികൾ"], "Payments": ["கட்டணங்கள்", "ಪಾವತಿಗಳು", "చెల్లింపులు", "പേയ്മെന്റുകൾ"], "Reports": ["அறிக்கைகள்", "ವರದಿಗಳು", "నివేదికలు", "റിപ്പോർട്ടുകൾ"], "Settings": ["அமைப்புகள்", "ಸೆಟ್ಟಿಂಗ್‌ಗಳು", "సెట్టింగ్‌లు", "ക്രമീകരണങ്ങൾ"], "Sign out": ["வெளியேறு", "ಸೈನ್ ಔಟ್", "సైన్ అవుట్", "സൈൻ ഔട്ട്"], "Guest profile": ["விருந்தினர் விவரம்", "ಅತಿಥಿ ಪ್ರೊಫೈಲ್", "అతిథి ప్రొఫైల్", "അതിഥി പ്രൊഫൈൽ"], "Save": ["சேமி", "ಉಳಿಸಿ", "సేవ్ చేయి", "സേവ് ചെയ്യുക"], "Save changes": ["மாற்றங்களைச் சேமி", "ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ", "మార్పులను సేవ్ చేయి", "മാറ്റങ്ങൾ സേവ് ചെയ്യുക"], "Cancel": ["ரத்து", "ರದ್ದುಮಾಡಿ", "రద్దు చేయి", "റദ്ദാക്കുക"], "Close": ["மூடு", "ಮುಚ್ಚಿ", "మూసివేయి", "അടയ്ക്കുക"], "Delete": ["நீக்கு", "ಅಳಿಸಿ", "తొలగించు", "ഇല്ലാതാക്കുക"], "Edit": ["திருத்து", "ತಿದ್ದು", "సవరించు", "എഡിറ്റ് ചെയ്യുക"], "Open": ["திற", "ತೆರೆಯಿರಿ", "తెరువు", "തുറക്കുക"], "Remove": ["நீக்கு", "ತೆಗೆದುಹಾಕಿ", "తీసివేయి", "നീക്കം ചെയ്യുക"], "Download": ["பதிவிறக்கு", "ಡೌನ್‌ಲೋಡ್", "డౌన్‌లోడ్", "ഡൗൺലോഡ്"], "Print": ["அச்சிடு", "ಮುದ್ರಿಸಿ", "ముద్రించు", "പ്രിന്റ് ചെയ്യുക"], "Share": ["பகிர்", "ಹಂಚಿಕೊಳ್ಳಿ", "షేర్ చేయి", "പങ്കിടുക"], "Continue": ["தொடர்", "ಮುಂದುವರಿಸಿ", "కొనసాగించు", "തുടരുക"], "Sign in": ["உள்நுழை", "ಸೈನ್ ಇನ್", "సైన్ ఇన్", "സൈൻ ഇൻ"], "Check in": ["செக்-இன் செய்", "ಚೆಕ್-ಇನ್ ಮಾಡಿ", "చెక్-ఇన్ చేయి", "ചെക്ക്-ഇൻ ചെയ്യുക"], "Check out": ["செக்-அவுட் செய்", "ಚೆಕ್-ಔಟ್ ಮಾಡಿ", "చెక్-అవుట్ చేయి", "ചെക്ക്-ഔട്ട് ചെയ്യുക"], "+ New booking": ["+ புதிய முன்பதிவு", "+ ಹೊಸ ಬುಕಿಂಗ್", "+ కొత్త బుకింగ్", "+ പുതിയ ബുക്കിംഗ്"], "+ New registration": ["+ புதிய பதிவு", "+ ಹೊಸ ನೋಂದಣಿ", "+ కొత్త నమోదు", "+ പുതിയ രജിസ്ട്രേഷൻ"], "New registration": ["புதிய பதிவு", "ಹೊಸ ನೋಂದಣಿ", "కొత్త నమోదు", "പുതിയ രജിസ്ട്രേഷൻ"], "Record payment": ["கட்டணத்தைப் பதிவு செய்", "ಪಾವತಿ ದಾಖಲಿಸಿ", "చెల్లింపు నమోదు చేయి", "പേയ്മെന്റ് രേഖപ്പെടുത്തുക"], "Refund": ["பணம் திருப்பு", "ಮರುಪಾವತಿ", "రీఫండ్", "റീഫണ്ട്"], "Export CSV": ["CSV ஏற்றுமதி", "CSV ರಫ್ತು", "CSV ఎగుమతి", "CSV എക്സ്പോർട്ട്"], "WhatsApp details": ["WhatsApp விவரங்கள்", "WhatsApp ವಿವರಗಳು", "WhatsApp వివరాలు", "WhatsApp വിവരങ്ങൾ"], "Invoice": ["விலைப்பட்டியல்", "ಇನ್‌ವಾಯ್ಸ್", "ఇన్‌వాయిస్", "ഇൻവോയ്സ്"], "Receipt": ["ரசீது", "ರಸೀದಿ", "రసీదు", "രസീത്"], "Delete booking": ["முன்பதிவை நீக்கு", "ಬುಕಿಂಗ್ ಅಳಿಸಿ", "బుకింగ్ తొలగించు", "ബുക്കിംഗ് ഇല്ലാതാക്കുക"], "Cancel booking": ["முன்பதிவை ரத்து செய்", "ಬುಕಿಂಗ್ ರದ್ದುಮಾಡಿ", "బుకింగ్ రద్దు చేయి", "ബുക്കിംഗ് റദ്ദാക്കുക"], "View profile": ["விவரம் பார்", "ಪ್ರೊಫೈಲ್ ನೋಡಿ", "ప్రొఫైల్ చూడు", "പ്രൊഫൈൽ കാണുക"], "Today": ["இன்று", "ಇಂದು", "ఈ రోజు", "ഇന്ന്"], "Occupancy today": ["இன்றைய நிரம்பல்", "ಇಂದಿನ ಭರ್ತಿ", "ఈ రోజు ఆక్యుపెన్సీ", "ഇന്നത്തെ ഒക്യുപൻസി"], "Check-ins today": ["இன்றைய செக்-இன்கள்", "ಇಂದಿನ ಚೆಕ್-ಇನ್‌ಗಳು", "ఈ రోజు చెక్-ఇన్‌లు", "ഇന്നത്തെ ചെക്ക്-ഇനുകൾ"], "Check-outs today": ["இன்றைய செக்-அவுட்கள்", "ಇಂದಿನ ಚೆಕ್-ಔಟ್‌ಗಳು", "ఈ రోజు చెక్-అవుట్‌లు", "ഇന്നത്തെ ചെക്ക്-ഔട്ടുകൾ"], "Revenue today": ["இன்றைய வருவாய்", "ಇಂದಿನ ಆದಾಯ", "ఈ రోజు ఆదాయం", "ഇന്നത്തെ വരുമാനം"], "Pending dues": ["நிலுவைத் தொகை", "ಬಾಕಿ ಮೊತ್ತ", "బకాయిలు", "കുടിശ്ശിക"], "Arriving today": ["இன்று வருபவர்கள்", "ಇಂದು ಬರುವವರು", "ఈ రోజు వచ్చేవారు", "ഇന്ന് എത്തുന്നവർ"], "Departing today": ["இன்று புறப்படுபவர்கள்", "ಇಂದು ಹೊರಡುವವರು", "ఈ రోజు వెళ్లేవారు", "ഇന്ന് പോകുന്നവർ"], "Checked in today": ["இன்று செக்-இன் ஆனவர்கள்", "ಇಂದು ಚೆಕ್-ಇನ್ ಆದವರು", "ఈ రోజు చెక్-ఇన్ అయినవారు", "ഇന്ന് ചെക്ക്-ഇൻ ചെയ്തവർ"], "Next 7 days": ["அடுத்த 7 நாட்கள்", "ಮುಂದಿನ 7 ದಿನಗಳು", "తదుపరి 7 రోజులు", "അടുത്ത 7 ദിവസം"], "Quick actions": ["விரைவு செயல்கள்", "ತ್ವರಿತ ಕ್ರಿಯೆಗಳು", "త్వరిత చర్యలు", "ദ്രുത പ്രവർത്തനങ്ങൾ"], "View all": ["அனைத்தும் பார்", "ಎಲ್ಲವನ್ನೂ ನೋಡಿ", "అన్నీ చూడు", "എല്ലാം കാണുക"], "Guest details": ["விருந்தினர் விவரங்கள்", "ಅತಿಥಿ ವಿವರಗಳು", "అతిథి వివరాలు", "അതിഥി വിവരങ്ങൾ"], "Stay details": ["தங்கும் விவரங்கள்", "ವಾಸ್ತವ್ಯದ ವಿವರಗಳು", "బస వివరాలు", "താമസ വിവരങ്ങൾ"], "Full name *": ["முழுப் பெயர் *", "ಪೂರ್ಣ ಹೆಸರು *", "పూర్తి పేరు *", "മുഴുവൻ പേര് *"], "Full name": ["முழுப் பெயர்", "ಪೂರ್ಣ ಹೆಸರು", "పూర్తి పేరు", "മുഴുവൻ പേര്"], "Phone number": ["தொலைபேசி எண்", "ಫೋನ್ ಸಂಖ್ಯೆ", "ఫోన్ నంబర్", "ഫോൺ നമ്പർ"], "Phone": ["தொலைபேசி", "ಫೋನ್", "ఫోన్", "ഫോൺ"], "Email address": ["மின்னஞ்சல் முகவரி", "ಇಮೇಲ್ ವಿಳಾಸ", "ఇమెయిల్ చిరునామా", "ഇമെയിൽ വിലാസം"], "Email": ["மின்னஞ்சல்", "ಇಮೇಲ್", "ఇమెయిల్", "ഇമെയിൽ"], "Password": ["கடவுச்சொல்", "ಪಾಸ್‌ವರ್ಡ್", "పాస్‌వర్డ్", "പാസ്‌വേഡ്"], "Date of birth": ["பிறந்த தேதி", "ಹುಟ್ಟಿದ ದಿನಾಂಕ", "పుట్టిన తేదీ", "ജനനത്തീയതി"], "Nationality": ["நாடு", "ರಾಷ್ಟ್ರೀಯತೆ", "జాతీయత", "ദേശീയത"], "Proof of identity": ["அடையாளச் சான்று", "ಗುರುತಿನ ಪುರಾವೆ", "గుర్తింపు రుజువు", "തിരിച്ചറിയൽ രേഖ"], "ID document number": ["அடையாள ஆவண எண்", "ಗುರುತಿನ ದಾಖಲೆ ಸಂಖ್ಯೆ", "గుర్తింపు పత్రం నంబర్", "തിരിച്ചറിയൽ രേഖ നമ്പർ"], "Check-in date & time *": ["செக்-இன் தேதி & நேரம் *", "ಚೆಕ್-ಇನ್ ದಿನಾಂಕ & ಸಮಯ *", "చెక్-ఇన్ తేదీ & సమయం *", "ചെക്ക്-ഇൻ തീയതിയും സമയവും *"], "Check-out date & time *": ["செக்-அவுட் தேதி & நேரம் *", "ಚೆಕ್-ಔಟ್ ದಿನಾಂಕ & ಸಮಯ *", "చెక్-అవుట్ తేదీ & సమయం *", "ചെക്ക്-ഔട്ട് തീയതിയും സമയവും *"], "Check-out": ["செக்-அவுட்", "ಚೆಕ್-ಔಟ್", "చెక్-అవుట్", "ചെക്ക്-ഔട്ട്"], "Booked via": ["முன்பதிவு வழி", "ಬುಕ್ ಮಾಡಿದ ವಿಧಾನ", "బుక్ చేసిన విధానం", "ബുക്ക് ചെയ്ത വഴി"], "Note (optional)": ["குறிப்பு (விருப்பம்)", "ಟಿಪ್ಪಣಿ (ಐಚ್ಛಿಕ)", "గమనిక (ఐచ్ఛికం)", "കുറിപ്പ് (ഐച്ഛികം)"], "Booking summary": ["முன்பதிவு சுருக்கம்", "ಬುಕಿಂಗ್ ಸಾರಾಂಶ", "బుకింగ్ సారాంశం", "ബുക്കിംഗ് സംഗ്രഹം"], "Nights": ["இரவுகள்", "ರಾತ್ರಿಗಳು", "రాత్రులు", "രാത്രികൾ"], "Total": ["மொத்தம்", "ಒಟ್ಟು", "మొత్తం", "ആകെ"], "Paid now (₹)": ["இப்போது செலுத்தியது (₹)", "ಈಗ ಪಾವತಿಸಿದ್ದು (₹)", "ఇప్పుడు చెల్లించినది (₹)", "ഇപ്പോൾ അടച്ചത് (₹)"], "Payment method": ["கட்டண முறை", "ಪಾವತಿ ವಿಧಾನ", "చెల్లింపు విధానం", "പേയ്മെന്റ് രീതി"], "Balance due": ["செலுத்த வேண்டிய மீதி", "ಬಾಕಿ ಮೊತ್ತ", "చెల్లించాల్సిన బాకీ", "അടയ്ക്കാനുള്ള ബാക്കി"], "Adults": ["பெரியவர்கள்", "ವಯಸ್ಕರು", "పెద్దలు", "മുതിർന്നവർ"], "Children": ["குழந்தைகள்", "ಮಕ್ಕಳು", "పిల్లలు", "കുട്ടികൾ"], "Room": ["அறை", "ಕೊಠಡಿ", "గది", "മുറി"], "Bed": ["படுக்கை", "ಹಾಸಿಗೆ", "పడక", "കിടക്ക"], "Room / Bed": ["அறை / படுக்கை", "ಕೊಠಡಿ / ಹಾಸಿಗೆ", "గది / పడక", "മുറി / കിടക്ക"], "Guest": ["விருந்தினர்", "ಅತಿಥಿ", "అతిథి", "അതിഥി"], "Booking": ["முன்பதிவு", "ಬುಕಿಂಗ್", "బుకింగ్", "ബുക്കിംഗ്"], "Status": ["நிலை", "ಸ್ಥಿತಿ", "స్థితి", "നില"], "Amount": ["தொகை", "ಮೊತ್ತ", "మొత్తం", "തുക"], "Date": ["தேதி", "ದಿನಾಂಕ", "తేదీ", "തീയതി"], "Method": ["முறை", "ವಿಧಾನ", "విధానం", "രീതി"], "Paid": ["செலுத்தப்பட்டது", "ಪಾವತಿಸಲಾಗಿದೆ", "చెల్లించారు", "അടച്ചു"], "Confirmed": ["உறுதி செய்யப்பட்டது", "ದೃಢಪಡಿಸಲಾಗಿದೆ", "నిర్ధారించబడింది", "സ്ഥിരീകരിച്ചു"], "Pending": ["நிலுவையில்", "ಬಾಕಿ", "పెండింగ్", "തീർപ്പാകാത്തത്"], "Checked-in": ["செக்-இன் ஆனது", "ಚೆಕ್-ಇನ್ ಆಗಿದೆ", "చెక్-ఇన్ అయింది", "ചെക്ക്-ഇൻ ചെയ്തു"], "Checked-out": ["செக்-அவுட் ஆனது", "ಚೆಕ್-ಔಟ್ ಆಗಿದೆ", "చెక్-అవుట్ అయింది", "ചെക്ക്-ഔട്ട് ചെയ്തു"], "Cancelled": ["ரத்து செய்யப்பட்டது", "ರದ್ದಾಗಿದೆ", "రద్దు చేయబడింది", "റദ്ദാക്കി"], "Walk-in": ["நேரில் வந்தவர்", "ನೇರವಾಗಿ ಬಂದವರು", "నేరుగా వచ్చినవారు", "നേരിട്ട് വന്നവർ"], "Activity": ["செயல்பாடு", "ಚಟುವಟಿಕೆ", "కార్యకలాపం", "പ്രവർത്തനം"], "Note": ["குறிப்பு", "ಟಿಪ್ಪಣಿ", "గమనిక", "കുറിപ്പ്"], "Stay history": ["தங்கிய வரலாறு", "ವಾಸ್ತವ್ಯ ಇತಿಹಾಸ", "బస చరిత్ర", "താമസ ചരിത്രം"], "Identity": ["அடையாளம்", "ಗುರುತು", "గుర్తింపు", "തിരിച്ചറിയൽ"], "Notes": ["குறிப்புகள்", "ಟಿಪ್ಪಣಿಗಳು", "గమనికలు", "കുറിപ്പുകൾ"], "Save notes": ["குறிப்புகளைச் சேமி", "ಟಿಪ್ಪಣಿಗಳನ್ನು ಉಳಿಸಿ", "గమనికలు సేవ్ చేయి", "കുറിപ്പുകൾ സേവ് ചെയ്യുക"], "✎ Edit profile": ["✎ விவரத்தைத் திருத்து", "✎ ಪ್ರೊಫೈಲ್ ತಿದ್ದು", "✎ ప్రొఫైల్ సవరించు", "✎ പ്രൊഫൈൽ എഡിറ്റ് ചെയ്യുക"], "Message guest": ["விருந்தினருக்குச் செய்தி", "ಅತಿಥಿಗೆ ಸಂದೇಶ", "అతిథికి సందేశం", "അതിഥിക്ക് സന്ദേശം"], "Welcome back": ["மீண்டும் வருக", "ಮತ್ತೆ ಸ್ವಾಗತ", "మళ్ళీ స్వాగతం", "വീണ്ടും സ്വാഗതം"], "Keep me signed in on this device": ["இந்தச் சாதனத்தில் உள்நுழைந்தே இரு", "ಈ ಸಾಧನದಲ್ಲಿ ಸೈನ್ ಇನ್ ಆಗಿರಲಿ", "ఈ పరికరంలో సైన్ ఇన్‌లో ఉంచు", "ഈ ഉപകരണത്തിൽ സൈൻ ഇൻ ആയി നിലനിർത്തുക"], "Forgot?": ["மறந்துவிட்டதா?", "ಮರೆತಿರಾ?", "మర్చిపోయారా?", "മറന്നോ?"], "Your booking": ["உங்கள் முன்பதிவு", "ನಿಮ್ಮ ಬುಕಿಂಗ್", "మీ బుకింగ్", "നിങ്ങളുടെ ബുക്കിംഗ്"], "Complete check-in": ["செக்-இன் முடி", "ಚೆಕ್-ಇನ್ ಪೂರ್ಣಗೊಳಿಸಿ", "చెక్-ఇన్ పూర్తి చేయండి", "ചെക്ക്-ഇൻ പൂർത്തിയാക്കുക"], "Property details": ["சொத்து விவரங்கள்", "ಆಸ್ತಿ ವಿವರಗಳು", "ప్రాపర్టీ వివరాలు", "പ്രോപ്പർട്ടി വിവരങ്ങൾ"], "Users & roles": ["பயனர்கள் & பங்குகள்", "ಬಳಕೆದಾರರು & ಪಾತ್ರಗಳು", "వినియోగదారులు & పాత్రలు", "ഉപയോക്താക്കളും റോളുകളും"], "Room types & pricing": ["அறை வகைகள் & விலை", "ಕೊಠಡಿ ಪ್ರಕಾರಗಳು & ಬೆಲೆ", "గది రకాలు & ధరలు", "മുറി തരങ്ങളും വിലയും"], "Notifications": ["அறிவிப்புகள்", "ಅಧಿಸೂಚನೆಗಳು", "నోటిఫికేషన్‌లు", "അറിയിപ്പുകൾ"], "Billing": ["பில்லிங்", "ಬಿಲ್ಲಿಂಗ್", "బిల్లింగ్", "ബില്ലിംഗ്"], "My account": ["என் கணக்கு", "ನನ್ನ ಖಾತೆ", "నా ఖాతా", "എന്റെ അക്കൗണ്ട്"], "Language": ["மொழி", "ಭಾಷೆ", "భాష", "ഭാഷ"], "Search": ["தேடு", "ಹುಡುಕಿ", "వెతకండి", "തിരയുക"]};
export const LANGS = [['en', 'English'], ['ta', 'தமிழ்'], ['kn', 'ಕನ್ನಡ'], ['te', 'తెలుగు'], ['ml', 'മലയാളം']];
const LANG_IX = { ta: 0, kn: 1, te: 2, ml: 3 };
export function getLang() { try { const l = localStorage.getItem('ns.lang'); return LANG_IX[l] !== undefined ? l : 'en'; } catch { return 'en'; } }
export function setLang(l) { try { localStorage.setItem('ns.lang', l); } catch { /* ignore */ } location.reload(); }
export function tr(text) { const l = getLang(); if (l === 'en') return text; const r = I18N[text]; return r ? r[LANG_IX[l]] : text; }
function translateTree(root) {
  const l = getLang(); if (l === 'en' || !root) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const v = n.nodeValue; const k = v && v.trim();
    if (k && I18N[k] && !n.parentElement?.closest('textarea, [data-no-tr]')) n.nodeValue = v.replace(k, I18N[k][LANG_IX[l]]);
  }
}
export function langPicker(extraStyle = '') {
  const sel = document.createElement('select');
  sel.className = 'ns-lang'; sel.setAttribute('aria-label', 'Language'); sel.style.cssText = extraStyle;
  sel.innerHTML = LANGS.map(([v, n]) => `<option value="${v}"${v === getLang() ? ' selected' : ''}>${n}</option>`).join('');
  sel.addEventListener('change', () => setLang(sel.value));
  return sel;
}
(function startI18n() {
  if (getLang() === 'en' || typeof document === 'undefined' || !document.body) return;
  document.documentElement.lang = getLang();
  translateTree(document.body);
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') translateTree(m.target.parentElement);
      else m.addedNodes.forEach((nd) => (nd.nodeType === 3 ? translateTree(nd.parentElement) : nd.nodeType === 1 && translateTree(nd)));
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();


// ---------------------------------------------------------------- friendly guest faces (same face for the same guest, every time)
const FACE_BG = ['#FDE2C8', '#D5F0E3', '#DCE7FB', '#F8D9E4', '#EDE3FA', '#FFF1BF', '#D9F3F7', '#FBE0D5'];
const FACE_SKIN = ['#F9D3B4', '#EFC09A', '#D9A172', '#C68A5E', '#A86E45', '#8A5634'];
const FACE_HAIR = ['#2B1B12', '#4A2E1C', '#1F2937', '#7A4B24', '#B7791F', '#5B4636'];
export function guestFace(name = '', size = 22) {
  let h = 2166136261; for (const ch of String(name)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const pick = (arr, sh) => arr[(h >>> sh) % arr.length];
  const bg = pick(FACE_BG, 0); const skin = pick(FACE_SKIN, 3); const hair = pick(FACE_HAIR, 7); const style = (h >>> 11) % 5; const glasses = (h >>> 15) % 6 === 0;
  const top = '<path d="M9 21 Q9 8.5 20 8.5 Q31 8.5 31 21 Q27.5 14.5 20 14.5 Q12.5 14.5 9 21Z" fill="' + hair + '"/>';
  const hairBack = style === 1 ? `<rect x="8.5" y="15" width="23" height="19" rx="8" fill="${hair}"/>` : '';
  const hairTop = style === 0 ? top : style === 1 ? top : style === 2 ? `<circle cx="20" cy="7.5" r="4.2" fill="${hair}"/>${top}`
    : style === 3 ? [11.5, 15.5, 20, 24.5, 28.5].map((x, i) => `<circle cx="${x}" cy="${13 - (i % 2) * 2}" r="4.4" fill="${hair}"/>`).join('')
    : `<path d="M9.5 18 Q10 9 20 9 Q30 9 30.5 18Z" fill="${hair}"/><rect x="7.5" y="16.5" width="25" height="3" rx="1.5" fill="${hair}"/>`;
  return `<svg class="gface" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="${bg}"/>${hairBack}
    <circle cx="20" cy="22.5" r="10.5" fill="${skin}"/>${hairTop}
    <circle cx="16.2" cy="22.5" r="1.35" fill="#1F2937"/><circle cx="23.8" cy="22.5" r="1.35" fill="#1F2937"/>
    <circle cx="14" cy="26" r="1.6" fill="#F28B82" opacity=".35"/><circle cx="26" cy="26" r="1.6" fill="#F28B82" opacity=".35"/>
    <path d="M16.5 26.6 Q20 29.8 23.5 26.6" stroke="#1F2937" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    ${glasses ? '<g stroke="#1F2937" stroke-width="1" fill="none"><circle cx="16.2" cy="22.5" r="3"/><circle cx="23.8" cy="22.5" r="3"/><path d="M19.2 22.5h1.6"/></g>' : ''}</svg>`;
}

// ---- OTA channels (calendar sync)
export const OTA = {
  airbnb: { name: 'Airbnb', color: '#FF5A5F' }, booking: { name: 'Booking.com', color: '#003580' }, agoda: { name: 'Agoda', color: '#5C2D91' },
  vrbo: { name: 'Vrbo', color: '#1E64C8' }, google: { name: 'Google Calendar', color: '#188038' }, other: { name: 'Other', color: '#6B7280' },
};
export const otaOf = (reason) => { const m = /^🔗 (.+?) ·/.exec(String(reason || '')); if (!m) return null;
  const key = Object.keys(OTA).find((k) => OTA[k].name === m[1]) || 'other'; return { key, ...OTA[key], label: m[1] }; };

// ---- countries (nationality dropdowns): India first, then A–Z
export const COUNTRIES = 'Afghanistan,Albania,Algeria,Andorra,Angola,Antigua and Barbuda,Argentina,Armenia,Australia,Austria,Azerbaijan,Bahamas,Bahrain,Bangladesh,Barbados,Belarus,Belgium,Belize,Benin,Bhutan,Bolivia,Bosnia and Herzegovina,Botswana,Brazil,Brunei,Bulgaria,Burkina Faso,Burundi,Cabo Verde,Cambodia,Cameroon,Canada,Central African Republic,Chad,Chile,China,Colombia,Comoros,Congo,Costa Rica,Côte d’Ivoire,Croatia,Cuba,Cyprus,Czechia,Democratic Republic of the Congo,Denmark,Djibouti,Dominica,Dominican Republic,Ecuador,Egypt,El Salvador,Equatorial Guinea,Eritrea,Estonia,Eswatini,Ethiopia,Fiji,Finland,France,Gabon,Gambia,Georgia,Germany,Ghana,Greece,Grenada,Guatemala,Guinea,Guinea-Bissau,Guyana,Haiti,Honduras,Hong Kong,Hungary,Iceland,India,Indonesia,Iran,Iraq,Ireland,Israel,Italy,Jamaica,Japan,Jordan,Kazakhstan,Kenya,Kiribati,Kuwait,Kyrgyzstan,Laos,Latvia,Lebanon,Lesotho,Liberia,Libya,Liechtenstein,Lithuania,Luxembourg,Macau,Madagascar,Malawi,Malaysia,Maldives,Mali,Malta,Marshall Islands,Mauritania,Mauritius,Mexico,Micronesia,Moldova,Monaco,Mongolia,Montenegro,Morocco,Mozambique,Myanmar,Namibia,Nauru,Nepal,Netherlands,New Zealand,Nicaragua,Niger,Nigeria,North Korea,North Macedonia,Norway,Oman,Pakistan,Palau,Palestine,Panama,Papua New Guinea,Paraguay,Peru,Philippines,Poland,Portugal,Qatar,Romania,Russia,Rwanda,Saint Kitts and Nevis,Saint Lucia,Saint Vincent and the Grenadines,Samoa,San Marino,São Tomé and Príncipe,Saudi Arabia,Senegal,Serbia,Seychelles,Sierra Leone,Singapore,Slovakia,Slovenia,Solomon Islands,Somalia,South Africa,South Korea,South Sudan,Spain,Sri Lanka,Sudan,Suriname,Sweden,Switzerland,Syria,Taiwan,Tajikistan,Tanzania,Thailand,Timor-Leste,Togo,Tonga,Trinidad and Tobago,Tunisia,Turkey,Turkmenistan,Tuvalu,Uganda,Ukraine,United Arab Emirates,United Kingdom,United States,Uruguay,Uzbekistan,Vanuatu,Vatican City,Venezuela,Vietnam,Yemen,Zambia,Zimbabwe'.split(',');
/** <option> list for a nationality <select>; keeps an older free-text value that isn't in the list */
export function countryOptions(selected = '', { placeholder = 'Choose country…' } = {}) {
  const sel = String(selected || '').trim();
  const known = COUNTRIES.find((c) => c.toLowerCase() === sel.toLowerCase());
  const o = (c) => `<option value="${esc(c)}"${(known || sel) === c ? ' selected' : ''}>${esc(c)}</option>`;
  return `<option value="">${esc(placeholder)}</option>${sel && !known ? o(sel) : ''}${o('India')}<option disabled>──────────</option>${COUNTRIES.filter((c) => c !== 'India').map(o).join('')}`;
}

export const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', front_desk: 'Front desk', accountant: 'Accountant' };

class Stop extends Error {}
export function reveal() { document.documentElement.classList.remove('ns-booting'); }

export function showFatal(message, { signIn = false } = {}) {
  const box = `<div class="ns-card" style="max-width:520px;margin:40px auto;text-align:center;display:flex;flex-direction:column;gap:14px;align-items:center">
      <div class="ns-h3">${esc(message)}</div>
      ${signIn ? '<a class="ns-btn" href="login.html">Go to sign in</a>' : '<button type="button" class="ns-btn-ghost" data-reload>Try again</button>'}
    </div>`;
  const host = $('.ns-content') || $('.ns-dialog') || document.body;
  host.innerHTML = box;
  host.querySelector('[data-reload]')?.addEventListener('click', () => location.reload());
  host.removeAttribute?.('style');
  if (host.classList?.contains('ns-content')) host.style.padding = '24px';
  reveal();
}

/** Run a page: check the login, apply the role, then render. */
export function page(key, fn) {
  if (NOT_CONNECTED) { location.replace('login.html'); return; }
  (async () => {
    try {
      const ctx = await boot(key);
      await fn(ctx);
      reveal();
    } catch (e) {
      if (e instanceof Stop) return;
      console.error(e);
      showFatal(e.message || 'Something went wrong.');
    }
  })();
}

// ---------------------------------------------------------------- NammaStay admin area (separate login: admin-login.html)
const ADMIN_NAV = [
  ['admin.html', 'Overview', '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"></path><path d="M9 12l2 2 4-4"></path>'],
  ['subscribers.html', 'Subscribers', '<rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path>'],
  ['revenue.html', 'Revenue & coupons', '<path d="M3 3v18h18"></path><path d="M7 15l4-4 3 3 6-6"></path>'],
  ['leads.html', 'Leads', '<path d="M22 12h-6l-2 3h-4l-2-3H2"></path><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"></path>'],
  ['activity.html', 'Activity log', '<path d="M12 8v4l3 2"></path><circle cx="12" cy="12" r="9"></circle>'],
];
const hostelHref = (page) => page;
function adminChrome(user, hasProperty) {
  document.body.classList.add('ns-admin-area');
  const brand = $('.ns-sidebar .ns-brand');
  if (brand) { brand.href = 'admin.html'; if (!brand.querySelector('.ns-admin-tag')) brand.insertAdjacentHTML('beforeend', '<span class="ns-admin-tag">Admin</span>'); }
  const here = __PATH().split('/').pop() || 'admin.html';
  const nav = $('.ns-sidebar .ns-nav');
  if (nav) nav.innerHTML = ADMIN_NAV.map(([href, label, svg]) => `<a href="${href}" class="ns-nav-link${here === href ? ' is-active" aria-current="page' : ''}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg><span>${label}</span></a>`).join('')
    + (hasProperty ? `<div class="ns-nav-section">Your property</div><a href="${hostelHref('dashboard.html')}" class="ns-nav-link"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"></path></svg><span>Open hostel app</span></a>` : '');
  $$('.ns-sidebar a[href="settings.html"], .ns-sidebar .ns-demo-badge, .ns-bell, .ns-mobilebar .ns-bell').forEach((e) => e.remove());
  const userBox = $('.ns-sidebar .ns-user');
  const nm = userBox?.querySelector('.ns-user-name'); const sub = userBox?.querySelector('.ns-user-sub'); const av = userBox?.querySelector('.ns-avatar') || userBox?.firstElementChild;
  if (nm) nm.textContent = user?.email || 'Admin'; if (sub) sub.textContent = 'NammaStay admin';
  if (av && av.children.length === 0) av.textContent = (user?.email || 'A')[0].toUpperCase();
  userBox?.classList.add('is-ready');
  const so = $('.ns-sidebar .ns-signout');
  if (so) { so.href = 'login.html'; so.addEventListener('click', async (e) => { e.preventDefault(); await sb.auth.signOut().catch(() => {}); location.replace('login.html'); }); }
}
/** Admin screens: their own login, their own menu, no property needed. */
export function adminPage(fn) {
  if (NOT_CONNECTED) { location.replace('admin-login.html'); return; }
  (async () => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { location.replace('admin-login.html?next=' + encodeURIComponent(__PATH().split('/').pop() + location.search)); return; }
      if (!DEMO) {                                                      // 2-step login: set up / code entered?
        const mfa = await rpc('admin_mfa_info').catch(() => null);
        if (mfa && mfa.admin && mfa.has_factor && mfa.aal !== 'aal2') {   // code only if an authenticator is set up
          location.replace('admin-login.html?next=' + encodeURIComponent(__PATH().split('/').pop() + location.search)); return;
        }
      }
      const isAdmin = await rpc('is_platform_admin').catch(() => false);
      const mems = isAdmin ? await rpc('my_memberships').catch(() => []) : [];
      adminChrome(session.user, (mems || []).length > 0);
      if (!isAdmin) {
        const host = $('.ns-content'); host.style.padding = '24px';
        host.innerHTML = `<div class="ns-card" style="max-width:520px;margin:40px auto;text-align:center;display:flex;flex-direction:column;gap:14px;align-items:center">
          <div class="ns-h3">This account doesn’t have NammaStay admin access.</div>
          <button type="button" class="ns-btn" id="adm-switch">Sign in with an admin account</button></div>`;
        $('#adm-switch').onclick = async () => { await sb.auth.signOut().catch(() => {}); location.replace('admin-login.html'); };
        reveal(); return;
      }
      await fn({ user: session.user, isAdmin: true });
      reveal();
    } catch (e) { console.error(e); showFatal(e.message || 'Something went wrong.'); }
  })();
}

export const TEMP_KEY = 'ns.temp.session';
export function markBrowserSession() { try { document.cookie = 'ns_alive=1; path=/; SameSite=Lax'; } catch { /* ignore */ } }
async function boot(key) {
  // "Keep me signed in" was unticked and the browser has since been closed → sign out
  if (LIVE) {
    let temp = false; try { temp = localStorage.getItem(TEMP_KEY) === '1'; } catch { /* ignore */ }
    if (temp && !/(^|;\s*)ns_alive=1/.test(document.cookie)) {
      await sb.auth.signOut().catch(() => {});
      try { localStorage.removeItem(TEMP_KEY); } catch { /* ignore */ }
    }
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const here = location.pathname.split('/').pop() + location.search;
    location.replace('login.html?next=' + encodeURIComponent(here));
    throw new Stop();
  }
  // Properties added for this email by NammaStay admin get linked on sign-in
  const claimKey = 'ns.claimed.' + session.user.id;
  if (Date.now() - Number(localStorage.getItem(claimKey) || 0) > 5 * 60e3) {
    await rpc('claim_property_invites').catch(() => 0);
    localStorage.setItem(claimKey, String(Date.now()));
  }
  const mems = await rpc('my_memberships');
  if (!mems?.length) {
    // New owner who signed up but hasn't created a property yet → finish setup.
    // (Invited staff get linked by the owner in Settings → Users & roles.)
    location.replace('signup.html?step=property');
    throw new Stop();
  }
  const saved = localStorage.getItem('ns.property');
  const m = mems.find((x) => x.property_id === saved) || mems[0];
  localStorage.setItem('ns.property', m.property_id);
  const kindRow = await sb.from('properties').select('kind, role_permissions').eq('id', m.property_id).limit(1)
    .then((r) => (r.data && r.data[0]) || {}, () => sb.from('properties').select('kind').eq('id', m.property_id).limit(1).then((r2) => (r2.data && r2.data[0]) || {}, () => ({})));
  setKind(kindRow.kind);
  const rolePerms = (kindRow.role_permissions && kindRow.role_permissions[m.role]) || {};
  const ctx = {
    kind: W.kind, words: W, rolePermissions: kindRow.role_permissions || {},
    /** What this person's role may do (owner: everything). Mirrors the database rules. */
    allow: (perm) => m.role === 'owner' || (typeof rolePerms[perm] === 'boolean' ? rolePerms[perm] : permDefault(m.role, perm)),
    user: session.user, memberships: mems,
    property_id: m.property_id, property_name: m.property_name, role: m.role,
    name: m.display_name || session.user.email,
    can: (...roles) => roles.includes(m.role),
  };
  ctx.isAdmin = await rpc('is_platform_admin').catch(() => false);   // NammaStay platform admin (leads)
  applyChrome(ctx);
  const allowed = PAGE_ROLES[key];
  if (allowed && !allowed.includes(ctx.role)) {
    showFatal('Your role doesn’t have access to this page.');
    throw new Stop();
  }
  const PAGE_PERM = { reports: 'view_reports', payments: 'view_payments', expenses: 'view_reports' };
  if (PAGE_PERM[key] && !ctx.allow(PAGE_PERM[key])) {
    showFatal('Your role doesn’t have access to this page. Ask the owner if you need it.');
    throw new Stop();
  }
  ctx.access = await rpc('property_access', { p_property: ctx.property_id }).catch(() => null);
  accessBanner(ctx);
  rpc('touch_presence', { p_property: ctx.property_id }).catch(() => {});
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.replace('login.html'); });
  startNotifications(ctx);
  return ctx;
}

function applyChrome(ctx) {
  const userBox = $('.ns-sidebar .ns-user');
  const nameEl = userBox?.querySelector('.ns-user-name'); if (nameEl) nameEl.textContent = ctx.name;
  const subEl = userBox?.querySelector('.ns-user-sub'); if (subEl) subEl.textContent = `${ROLE_LABEL[ctx.role]} · ${ctx.property_name}`;
  const av = userBox?.querySelector('.ns-avatar'); if (av) av.textContent = initials(ctx.name);
  userBox?.classList.add('is-ready');
  $$('.ns-nav-link').forEach((a) => {
    const k = NAV_KEY[a.getAttribute('href')];
    if (k && PAGE_ROLES[k] && !PAGE_ROLES[k].includes(ctx.role)) a.style.display = 'none';
  });
  const roomsLink = $('.ns-sidebar .ns-nav-link[href="rooms.html"] span'); if (roomsLink) roomsLink.textContent = W.setup;
  const so = $('.ns-sidebar a[href="login.html"], .ns-sidebar [data-signout], .ns-sidebar button:last-of-type');
  if (!$('.ns-sidebar .ns-lang')) {
    const wrap = document.createElement('div'); wrap.style.cssText = 'padding:4px 12px 8px';
    wrap.appendChild(langPicker('width:100%;height:34px;border-radius:8px;border:1px solid #2A3963;background:#15244A;color:#FBF3DE;font:600 12.5px Manrope,sans-serif;padding:0 8px'));
    const foot = $('.ns-sidebar .ns-user') || so; foot?.parentElement?.insertBefore(wrap, foot);
  }
  if (!ctx.allow('view_reports')) $$('a[href="reports.html"]').forEach((a) => { a.style.display = 'none'; });
  if (['owner', 'manager', 'front_desk'].includes(ctx.role) && !$('.ns-sidebar a[href="housekeeping.html"]')) {   // Housekeeping
    const rb = $('.ns-sidebar .ns-nav-link[href="rooms.html"]');
    if (rb) {
      const a = document.createElement('a'); a.href = 'housekeeping.html'; a.className = 'ns-nav-link';
      a.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M6 21V10l6-5 6 5v11"></path><path d="M10 21v-5h4v5"></path></svg><span>Housekeeping</span><b class="ns-nav-count" id="hk-count" hidden></b>';
      if (/housekeeping\.html$/.test(__PATH())) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
      rb.insertAdjacentElement('afterend', a);
      rpc('hk_counts', { p_property: ctx.property_id }).then((c) => { const n = (c?.dirty || 0) + (c?.cleaning || 0); const el = $('#hk-count'); if (el && n > 0) { el.textContent = n; el.hidden = false; } }).catch(() => {});
    }
  }
  if (['owner', 'manager', 'front_desk'].includes(ctx.role) && !$('.ns-sidebar a[href="formc.html"]')) {   // Form C (foreign guests)
    const ci = $('.ns-sidebar .ns-nav-link[href="check-in.html"]');
    if (ci) {
      const a = document.createElement('a'); a.href = 'formc.html'; a.className = 'ns-nav-link';
      a.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"></path></svg><span>Form C</span><b class="ns-nav-count" id="formc-count" hidden></b>';
      if (/formc\.html$/.test(__PATH())) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
      ci.insertAdjacentElement('afterend', a);
      rpc('formc_due_count', { p_property: ctx.property_id }).then((n) => { const c = $('#formc-count'); if (c && n > 0) { c.textContent = n; c.hidden = false; } }).catch(() => {});
    }
  }
  if (['owner', 'manager'].includes(ctx.role) && !$('.ns-sidebar a[href="ota.html"]')) {         // OTA calendar sync
    const rl = $('.ns-sidebar .ns-nav-link[href="rooms.html"]');
    if (rl) {
      const a = document.createElement('a'); a.href = 'ota.html'; a.className = 'ns-nav-link';
      a.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 01-15.5 6.2"></path><path d="M3 12a9 9 0 0115.5-6.2"></path><path d="M18 2v4h-4"></path><path d="M6 22v-4h4"></path></svg><span>OTA sync</span>';
      if (/ota\.html$/.test(__PATH())) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
      rl.insertAdjacentElement('afterend', a);
    }
  }
  if (!ctx.allow('view_payments')) $$('a[href="payments.html"]').forEach((a) => { a.style.display = 'none'; });
  $$('.ns-mobile-nav a[href="rooms.html"], .ns-drawer a[href="rooms.html"]').forEach((a) => { const sp = a.querySelector('span') || a; sp.textContent = W.setup; });
  if (!['owner', 'manager', 'front_desk'].includes(ctx.role)) {
    $$('a[href^="check-in.html"]').forEach((a) => { a.style.display = 'none'; });
  }
  if (['owner', 'manager', 'accountant'].includes(ctx.role) && ctx.allow('view_reports') && !$('.ns-sidebar a[href="expenses.html"]')) {   // Expenses & profit
    const rp = $('.ns-sidebar .ns-nav-link[href="reports.html"]');
    if (rp) {
      const a = document.createElement('a'); a.href = 'expenses.html'; a.className = 'ns-nav-link';
      a.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"></path><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"></path></svg><span>Expenses &amp; profit</span>';
      if (/expenses\.html$/.test(__PATH())) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
      rp.insertAdjacentElement('afterend', a);
    }
  }
  if (ctx.isAdmin && !$('.ns-sidebar a[data-admin-link]')) {   // NammaStay admins only: admin pages right in the menu
    const nav = $('.ns-sidebar .ns-nav');
    if (nav) {
      const h = document.createElement('div'); h.className = 'ns-nav-section'; h.textContent = 'NammaStay admin';
      nav.append(h);
      ADMIN_NAV.forEach(([href, label, svg]) => {
        const a = document.createElement('a'); a.href = href; a.className = 'ns-nav-link'; a.dataset.adminLink = '1';
        a.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg><span>${label}</span>`;
        nav.append(a);
      });
    }
  }
  if (DEMO) demoBadge();
  const out = $('.ns-signout');
  if (out) out.addEventListener('click', async (e) => {
    e.preventDefault();
    await sb.auth.signOut();
    localStorage.removeItem('ns.property');
    location.replace('login.html');
  });
  if (ctx.memberships.length > 1 && subEl) {         // switch property
    subEl.style.cursor = 'pointer';
    subEl.title = 'Switch property';
    subEl.addEventListener('click', () => choose('Switch property',
      ctx.memberships.map((m) => ({ label: `${m.property_name} (${ROLE_LABEL[m.role]})`, value: m.property_id })))
      .then((v) => { if (v) { localStorage.setItem('ns.property', v); location.reload(); } }));
  }
}

// Trial / expiry banner at the top of every screen
function accessBanner(ctx) {
  const a = ctx.access;
  const main = $('.ns-main') || $('.ns-dialog');
  if (a?.state === 'suspended' && main) {
    const el = document.createElement('div'); el.className = 'ns-access-banner danger'; el.setAttribute('role', 'alert');
    el.innerHTML = '<b>This account is suspended — new bookings are paused.</b> Your data is safe. Please contact NammaStay support.';
    const mb = $('.ns-mobilebar'); if (mb && mb.parentNode === main) mb.insertAdjacentElement('afterend', el); else main.prepend(el);
    rpc('property_suspension', { p_property: ctx.property_id }).then((x) => { if (x?.reason) el.insertAdjacentHTML('beforeend', ` <span style="font-weight:600">Reason: ${esc(x.reason)}</span>`); }).catch(() => {});
    return;
  }
  if (!a || !main || ['complimentary', 'active'].includes(a.state) && !(a.state === 'active' && a.days_left <= 5)) return;
  const canPay = ctx.can('owner');
  const link = canPay ? ' <a href="settings.html?tab=billing">Choose a plan →</a>' : ' Ask the owner to renew.';
  let cls = 'info'; let text;
  if (a.pending_payment) { text = 'Payment received — waiting for confirmation from NammaStay.'; }
  else if (a.state === 'trial') { text = `Free trial: <b>${a.days_left} day${a.days_left === 1 ? '' : 's'} left</b>.` + link; cls = a.days_left <= 3 ? 'warn' : 'info'; }
  else if (a.state === 'active') { text = `Your plan renews in <b>${a.days_left} day${a.days_left === 1 ? '' : 's'}</b>.` + (canPay ? ' <a href="settings.html?tab=billing">Pay now →</a>' : ''); cls = 'warn'; }
  else if (a.state === 'grace') { text = '<b>Your subscription has ended.</b> New bookings stop in a few days.' + link; cls = 'warn'; }
  else { text = '<b>Subscription ended — new bookings are paused.</b> Your data is safe and still visible.' + link; cls = 'danger'; }
  const el = document.createElement('div');
  el.className = 'ns-access-banner ' + cls; el.setAttribute('role', 'status'); el.innerHTML = text;
  const mobilebar = $('.ns-mobilebar');
  if (mobilebar && mobilebar.parentNode === main) mobilebar.insertAdjacentElement('afterend', el); else main.prepend(el);
}

const __PATH = () => location.pathname;

function demoBadge() {
  if ($('.ns-demo-badge')) return;                                   // floating "Demo ▾" button (not in the sidebar)
  const el = document.createElement('div');
  el.className = 'ns-demo-badge';
  const k = sb.kind?.() || 'hostel';
  const role = sb.viewAs?.() || 'owner';
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('');
  el.innerHTML = `<details class="ns-demo-menu">
      <summary aria-label="Demo options"><b>Demo</b><span>▾</span></summary>
      <div class="ns-demo-panel">
        <label>View as<select data-role-as>${opt([['owner', 'Owner'], ['manager', 'Manager'], ['front_desk', 'Front desk'], ['accountant', 'Accountant']], role)}</select></label>
        <label>Property type<select data-kind>${opt([['hostel', 'Hostel'], ['hotel', 'Hotel'], ['homestay', 'Homestay']], k)}</select></label>
        <div class="ns-demo-acts"><button type="button" data-reset>Reset data</button><button type="button" data-exit>Exit demo</button></div>
        <a href="admin-login.html?demo=1" class="ns-demo-admin">Open NammaStay admin area →</a>
        <div class="ns-demo-note">Sample data, saved only in this browser.</div>
      </div></details>`;
  el.querySelector('[data-role-as]').addEventListener('change', (e) => {
    sb.setViewAs(e.target.value); location.replace(e.target.value === 'accountant' ? 'reports.html' : 'dashboard.html');
  });
  el.querySelector('[data-kind]').addEventListener('change', (e) => { sb.setKind(e.target.value); location.replace('dashboard.html'); });
  el.querySelector('[data-exit]').addEventListener('click', async () => {
    try { localStorage.removeItem('ns.demo.on'); } catch { /* ignore */ }
    location.replace('login.html?demo=0');
  });
  el.querySelector('[data-reset]').addEventListener('click', async () => {
    if (await confirmDialog('Reset demo data', 'Start again with fresh sample bookings? Changes you made in the demo will be cleared.', { confirmLabel: 'Reset' })) {
      sb.reset(); location.reload();
    }
  });
  document.body.appendChild(el);
  document.addEventListener('click', (e) => { const d = el.querySelector('details'); if (d?.open && !el.contains(e.target)) d.open = false; });
}

/** Replace a page-header subtitle (the grey line under the page title) */
export function setSubtitle(text) {
  const el = $('.ns-main > [style*="height:76px"] [style*="font-size:13px;color:#6B7280"]');
  if (el) el.textContent = text;
}
/** The right-hand side of the page header (buttons area) */
export function headerActions() {
  const head = $('.ns-main > [style*="height:76px"]');
  if (!head) return null;
  let box = head.children[1];
  if (!box) { box = document.createElement('div'); head.appendChild(box); }
  box.setAttribute('style', 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;');
  return box;
}
/** Turn the design's static search pill in the header into a real input */
export function headerSearch(placeholder, onSearch, initial = '') {
  // the pill itself = the div whose own <span> says "Search…" (not the wrapper that also holds the buttons)
  const pillEl = $$('.ns-main > [style*="height:76px"] div')
    .find((d) => [...d.children].some((c) => c.tagName === 'SPAN' && /Search/.test(c.textContent)));
  if (!pillEl) return null;
  pillEl.className = 'ns-search';
  pillEl.removeAttribute('style');
  const span = pillEl.querySelector('span');
  const input = document.createElement('input');
  input.type = 'search'; input.placeholder = placeholder; input.value = initial;
  input.setAttribute('aria-label', placeholder);
  span.replaceWith(input);
  input.addEventListener('input', debounce(() => onSearch(input.value.trim(), false), 350));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSearch(input.value.trim(), true); });
  return input;
}

/** Swap the static content area for live markup */
export function content(html, style = 'padding:24px 32px;display:flex;flex-direction:column;gap:20px;') {
  const el = $('.ns-content');
  el.setAttribute('style', style);
  el.innerHTML = html;
  return el;
}

// ---------------------------------------------------------------- notifications (in-app badge)
const BELL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 003.4 0"></path></svg>';
async function startNotifications(ctx) {
  const bells = [];
  for (const host of [$('.ns-sidebar'), $('.ns-mobilebar')]) {
    if (!host) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ns-bell'; b.setAttribute('aria-label', 'Notifications'); b.innerHTML = BELL;
    b.addEventListener('click', () => openNotifications(ctx, setCount));
    host.appendChild(b); bells.push(b);
  }
  if (!bells.length) return;
  function setCount(n) {
    bells.forEach((b) => {
      b.querySelector('.ns-bell-count')?.remove();
      b.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
      if (n) b.insertAdjacentHTML('beforeend', `<span class="ns-bell-count">${n > 99 ? '99+' : n}</span>`);
    });
    document.title = document.title.replace(/^\(\d+\+?\)\s/, '');
    if (n) document.title = `(${n > 99 ? '99+' : n}) ${document.title}`;
  }
  let unread = 0;
  try {
    const { count } = await q(sb.from('notifications').select('id', { count: 'exact', head: true })
      .eq('property_id', ctx.property_id).is('read_at', null), { withCount: true });
    unread = count || 0; setCount(unread);
  } catch { /* badge is best-effort */ }
  sb.channel('ns-notifications-' + ctx.property_id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `property_id=eq.${ctx.property_id}` },
      (p) => { unread += 1; setCount(unread); toast(p.new.title + (p.new.body ? ' · ' + p.new.body : '')); })
    .subscribe();
}
async function openNotifications(ctx, setCount) {
  const rows = await q(sb.from('notifications').select('title, body, booking_id, created_at, read_at')
    .eq('property_id', ctx.property_id).order('created_at', { ascending: false }).limit(20));
  const list = rows.length ? rows.map((n) => `
      <a ${n.booking_id ? `href="booking-detail.html?id=${esc(n.booking_id)}"` : ''} class="ns-list-row" style="color:inherit">
        <div><div style="font-size:13px;font-weight:${n.read_at ? 600 : 800}">${esc(n.title)}</div>
        <div class="ns-muted">${esc(n.body || '')}</div></div>
        <div class="ns-muted" style="white-space:nowrap">${fmtDayTime(n.created_at)}</div>
      </a>`).join('') : '<div class="ns-empty">No notifications yet.</div>';
  modal({ title: 'Notifications', body: `<div>${list}</div>`, actions: [{ label: 'Close' }] });
  rpc('mark_notifications_read', { p_property: ctx.property_id }).then(() => setCount(0)).catch(() => {});
}

// ---------------------------------------------------------------- UI helpers
export function toast(message, { error = false, ms = 3500 } = {}) {
  $('.ns-toast')?.remove();
  const t = document.createElement('div');
  t.className = 'ns-toast' + (error ? ' is-error' : '');
  t.setAttribute('role', error ? 'alert' : 'status');
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/**
 * Open a dialog. actions: [{ label, kind: 'primary'|'ghost'|'danger', onClick(el) → false to keep open }]
 * Returns { el, close }.
 */
export function modal({ title, body, actions = [], width }) {
  const prevFocus = document.activeElement;
  const ov = document.createElement('div');
  ov.className = 'ns-overlay';
  ov.innerHTML = `<div class="ns-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${width ? `style="width:${width}px"` : ''}>
      <div class="ns-modal-head"><div class="ns-h3" style="font-size:17px">${esc(title)}</div>
        <button type="button" class="ns-x" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div>
      <div class="ns-modal-body">${body}<div class="ns-error" data-modal-error hidden></div></div>
      ${actions.length ? '<div class="ns-modal-foot"></div>' : ''}
    </div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelector('.ns-x').addEventListener('click', close);
  const foot = ov.querySelector('.ns-modal-foot');
  const errEl = ov.querySelector('[data-modal-error]');
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.kind === 'primary' ? 'ns-btn' : a.kind === 'danger' ? 'ns-btn-danger' : 'ns-btn-ghost';
    b.textContent = a.label;
    b.addEventListener('click', async () => {
      if (!a.onClick) return close();
      errEl.hidden = true;
      b.disabled = true;
      try {
        const keep = await a.onClick(ov);
        if (keep !== false) close();
      } catch (e) {
        errEl.textContent = e.message; errEl.hidden = false;
      } finally { b.disabled = false; }
    });
    foot.appendChild(b);
  });
  document.body.appendChild(ov);
  (ov.querySelector('input,select,textarea') || ov.querySelector('.ns-x')).focus();
  return { el: ov, close };
}

export function confirmDialog(title, message, { confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = modal({
      title, body: `<p style="margin:0;font-size:14px;line-height:1.6">${esc(message)}</p>`,
      actions: [{ label: 'Go back', onClick: () => resolve(false) },
                { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => resolve(true) }],
    });
    m.el.querySelector('.ns-x').addEventListener('click', () => resolve(false));
  });
}

export function choose(title, options) {
  return new Promise((resolve) => {
    const body = options.map((o, i) => `<button type="button" class="ns-btn-ghost" data-i="${i}" style="justify-content:flex-start;width:100%">${esc(o.label)}</button>`).join('');
    const m = modal({ title, body });
    m.el.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { resolve(options[b.dataset.i].value); m.close(); }));
    m.el.querySelector('.ns-x').addEventListener('click', () => resolve(null));
  });
}

/** Read form values inside an element by [name] */
export function formValues(root) {
  const out = {};
  root.querySelectorAll('[name]').forEach((el) => {
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  });
  return out;
}

export const field = (label, control, help = '') =>
  `<div class="ns-field"><label>${esc(label)}</label>${control}${help ? `<div class="ns-help">${help}</div>` : ''}</div>`;

export function options(list, selected) {
  return list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`).join('');
}

// ---------------------------------------------------------------- WhatsApp booking details to the guest
// Free click-to-chat: opens WhatsApp with the message ready; staff tap Send.
const fWa = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const waDate = (d) => {
  const p = Object.fromEntries(fWa.formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.weekday}, ${p.day} ${sep(p.month)} ${p.year}, ${fmtTime(d)}`;          // Mon, 26 Oct 2026, 2:00 PM
};
export function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;                     // Indian mobile saved without country code
  return d.length >= 8 ? d : '';
}
export function bookingMessage({ booking: b, guest: g, bed, property: p, contact = {} }) {
  const first = String(g.full_name || '').trim().split(/\s+/)[0] || 'there';
  const head = b.status === 'checked_in' ? `Welcome to ${p.name}! You’re checked in. 🙌`
    : b.status === 'pending' ? `We’ve received your booking request at ${p.name}. We’ll confirm it shortly.`
    : `Your booking at ${p.name} is confirmed. ✅`;
  const lines = [`Hi ${first}! 🙏`, head, '',
    `*Booking:* ${b.code}`, `*Name:* ${g.full_name}`, `*${W.Unit}:* ${bed.room} · ${bed.label}`,
    ...(roomsMode() ? [`*Guests:* ${guestsText(b.visitors, b.children)}`] : []),
    `*Check-in:* ${waDate(b.check_in_at)}`, `*Check-out:* ${waDate(b.check_out_at)}`,
    `*Nights:* ${b.nights}`,
    `*Total:* ${rupees(b.total_paise)}${b.paid_paise ? ` · Paid: ${rupees(b.paid_paise)}` : ''}${b.balance_paise > 0 ? ` · *Balance due: ${rupees(b.balance_paise)}*` : ''}`];
  if (b.self_checkin_token && ['pending', 'confirmed'].includes(b.status) && !b.self_checkin_at) {
    lines.push('', 'Save time at the desk — check in online:', `${SITE_URL}/self-check-in.html?t=${b.self_checkin_token}`);
  }
  const addr = [contact.address, contact.city].filter(Boolean).join(', ');
  if (addr || contact.phone) lines.push('');
  if (addr) lines.push(`📍 ${addr}`);
  if (contact.phone) lines.push(`📞 ${contact.phone}`);
  lines.push('', b.status === 'checked_in' ? 'Enjoy your stay!' : 'See you soon!');
  return lines.join('\n');
}
// ---- Booking confirmation as a picture card (poster design) ----
function cardInfo(d, contact) {
  const b = d.booking; const tz = { timeZone: TZ };
  const day = (x) => new Intl.DateTimeFormat('en-IN', { ...tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(x)).replace('Sept', 'Sep');
  const dnum = (x) => new Intl.DateTimeFormat('en-IN', { ...tz, day: 'numeric' }).format(new Date(x));
  const mon = (x) => new Intl.DateTimeFormat('en-IN', { ...tz, month: 'short' }).format(new Date(x)).replace('Sept', 'Sep').toUpperCase();
  const head = b.status === 'checked_in' ? 'Welcome — you’re checked in' : b.status === 'pending' ? 'Booking request received' : 'Booking confirmed';
  return { property: d.property.name, code: b.code, guest: d.guest.full_name, first: String(d.guest.full_name || '').split(/\s+/)[0],
    room: d.bed.room, bed: d.bed.label, nights: b.nights, status: b.status, head,
    inDay: day(b.check_in_at), inTime: fmtTime(b.check_in_at), outDay: day(b.check_out_at), outTime: fmtTime(b.check_out_at),
    inNum: dnum(b.check_in_at), inMon: mon(b.check_in_at), outNum: dnum(b.check_out_at), outMon: mon(b.check_out_at),
    guests: roomsMode() ? guestsText(b.visitors, b.children) : null,
    total: rupees(b.total_paise), paid: b.paid_paise ? rupees(b.paid_paise) : null, balance: b.balance_paise > 0 ? rupees(b.balance_paise) : null,
    address: [contact.address, contact.city].filter(Boolean).join(', '), phone: contact.phone || '' };
}
function rr(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
function fit(x, text, maxW, size, weight = 800, fam = 'Sora') {
  let s2 = size; x.font = `${weight} ${s2}px ${fam}, Manrope, system-ui, sans-serif`;
  while (x.measureText(text).width > maxW && s2 > 18) { s2 -= 2; x.font = `${weight} ${s2}px ${fam}, Manrope, system-ui, sans-serif`; }
  let t = String(text); while (x.measureText(t).width > maxW && t.length > 3) t = t.slice(0, -2) + '…';
  return t;
}
const F = (w, px, fam = 'Manrope') => `${w} ${px}px ${fam}, system-ui, sans-serif`;
const C = { navy: '#0E1B3D', navy2: '#1D2F63', cream: '#FBF3DE', green: '#1C9A6C', mint: '#7BE0B6', amber: '#E2A03F', muted: '#8B93A8', ink: '#101A3D', line: '#E7DFC7' };

export function drawBookingCard(i) {
  const c = document.createElement('canvas'); const x = c.getContext('2d');
  const label = (t, px, py, col = C.muted) => { x.fillStyle = col; x.font = F(800, 22); x.fillText(t.toUpperCase(), px, py); };
  const val = (t, px, py, size = 34, col = C.ink, maxW = 400) => { x.fillStyle = col; x.font = F(800, size, 'Sora'); x.fillText(fit(x, t, maxW, size), px, py); };
  // Poster design (1080 × 1350, story-size)
  const W = 1080; const H = 1350; c.width = W; c.height = H;
  x.fillStyle = C.cream; x.fillRect(0, 0, W, H);
  x.fillStyle = C.navy; x.fillRect(0, 0, W, 150);
  x.fillStyle = C.cream; x.font = F(800, 40, 'Sora'); x.fillText(fit(x, i.property, W - 160, 40), 80, 95);
  x.fillStyle = i.status === 'pending' ? '#B7791F' : C.green; x.font = F(800, 28); x.fillText(i.head.toUpperCase(), 80, 250);
  x.fillStyle = C.ink; x.font = F(800, 76, 'Sora');
  const greet = i.status === 'checked_in' ? `Welcome, ${i.first}!` : `See you soon, ${i.first}!`;
  x.fillText(fit(x, greet, W - 160, 76), 80, 340);
  // big date blocks
  const block = (px, num, mon, lab, time, col) => {
    rr(x, px, 420, 380, 360, 32); x.fillStyle = col; x.fill();
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = F(800, 26); x.fillText(lab, px + 40, 480);
    x.fillStyle = '#fff'; x.font = F(800, 150, 'Sora'); x.fillText(num, px + 34, 640);
    x.font = F(800, 44, 'Sora'); x.fillText(mon, px + 40, 700);
    x.font = F(700, 28); x.fillStyle = 'rgba(255,255,255,.85)'; x.fillText(time, px + 40, 748);
  };
  block(80, i.inNum, i.inMon, 'CHECK-IN', i.inTime, C.green);
  block(W - 460, i.outNum, i.outMon, 'CHECK-OUT', i.outTime, C.navy);
  x.fillStyle = C.ink; x.font = F(800, 60, 'Sora'); x.textAlign = 'center'; x.fillText('→', W / 2, 620); x.textAlign = 'left';
  // details panel
  rr(x, 80, 830, W - 160, 300, 28); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = C.line; x.lineWidth = 2; x.stroke();
  label(`Your ${W_.unit}`, 130, 895); val(`${i.room} · ${i.bed}`, 130, 945, 40, C.ink, W - 260);
  label('Booking', 130, 1015); val(i.code, 130, 1062, 36, C.ink, 300);
  if (i.guests) { label('Guests', 440, 1015); val(i.guests, 440, 1062, 28, C.ink, 230); }
  else { label('Nights', 440, 1015); val(String(i.nights), 440, 1062, 36, C.ink, 150); }
  label(i.balance ? 'Balance due' : 'Total', 700, 1015);
  val(i.balance || (i.paid ? `${i.total} ✓` : i.total), 700, 1062, 36, i.balance ? '#B23A3A' : C.green, 250);
  x.fillStyle = C.ink; x.font = F(700, 28);
  if (i.address) x.fillText(fit(x, '📍 ' + i.address, W - 160, 28, 700, 'Manrope'), 80, 1205);
  if (i.phone) { x.fillStyle = C.ink; x.font = F(700, 28); x.fillText('📞 ' + i.phone, 80, 1255); }
  x.fillStyle = C.muted; x.font = F(700, 22); x.fillText(`${i.nights} night${i.nights > 1 ? 's' : ''}  ·  Powered by NammaStay`, 80, 1310);
  return c;
}

/** Send booking details to the guest: poster picture card or text. */
export async function sendBookingWhatsApp(bookingId, { justSaved = false } = {}) {
  const d = await rpc('booking_detail', { p_booking: bookingId });
  const contact = await sb.from('properties').select('name, address, city, phone').eq('id', d.property.id).limit(1)
    .then((r) => (r.data && r.data[0]) || {}, () => ({}));
  const text = bookingMessage({ booking: d.booking, guest: d.guest, bed: d.bed, property: d.property, contact });
  const info = cardInfo(d, contact);
  const num = waNumber(d.guest.phone);
  const caption = `${info.head} — ${info.property}\n${info.guest} · ${info.code}\n${info.inDay}, ${info.inTime} → ${info.outDay}, ${info.outTime}`
    + (d.booking.self_checkin_token && ['pending', 'confirmed'].includes(d.booking.status) && !d.booking.self_checkin_at
      ? `\n\nCheck in online: ${SITE_URL}/self-check-in.html?t=${d.booking.self_checkin_token}` : '');
  const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] }));
  const canCopyImg = !!(window.ClipboardItem && navigator.clipboard?.write);
  let blob = null; let url = null;
  try { await document.fonts?.ready; } catch { /* fonts are optional */ }

  const m = modal({
    title: justSaved ? `Booking ${d.booking.code} saved ✓` : 'Send booking details', width: 620,
    body: `${justSaved ? '<div style="font-size:14px">Send the booking details to the guest on WhatsApp?</div>' : ''}
      ${num ? `<div class="ns-muted" style="font-size:13px">To <b>${esc(d.guest.full_name)}</b> · ${esc(d.guest.phone)}</div>`
        : '<div class="ns-demo-hint">No phone number saved for this guest — WhatsApp will ask you to pick the contact.</div>'}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;background:#FBF9F1">
        <span style="font-size:13px">Need a bill for the guest?</span>
        <button type="button" class="ns-btn-ghost" id="wa-invoice" style="height:34px;font-size:12.5px">🧾 Invoice / bill</button></div>
      <div class="ns-seg light" role="tablist" id="wa-mode"><button type="button" class="is-on" data-mode="card">🖼 Picture card</button><button type="button" data-mode="text">💬 Text message</button></div>
      <div id="wa-card-pane" style="display:flex;flex-direction:column;gap:10px">
        <img id="wa-card" alt="Booking card preview" style="width:100%;border-radius:12px;box-shadow:0 10px 26px rgba(14,27,61,.18);background:#F5F1E3;max-height:52vh;object-fit:contain">
        <div class="ns-help" id="wa-card-help">${canShareFiles ? 'Tap <b>Share card</b> → choose <b>WhatsApp</b> → the guest. The card goes with a short caption.'
          : canCopyImg ? 'Click <b>Copy image</b>, then paste it (Ctrl+V) into the guest’s chat in WhatsApp — <b>Open chat</b> opens it for you.'
          : 'Click <b>Download</b>, then attach the image in the guest’s WhatsApp chat.'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button type="button" class="ns-btn-ghost" id="wa-dl">Download</button>
          ${canCopyImg ? '<button type="button" class="ns-btn-ghost" id="wa-copy">Copy image</button>' : ''}
          ${canShareFiles ? '<button type="button" class="ns-btn" id="wa-share" style="background:#25D366;border-color:#25D366">Share card</button>'
            : `<a class="ns-btn" id="wa-chat" style="background:#25D366;border-color:#25D366" target="_blank" rel="noopener" href="https://wa.me/${num}?text=${encodeURIComponent(caption)}">Open chat</a>`}
        </div>
      </div>
      <div id="wa-text-pane" hidden style="display:flex;flex-direction:column;gap:10px">
        <textarea class="ns-input" id="wa-text" rows="14" style="font-size:13px;line-height:1.5">${esc(text)}</textarea>
        <div class="ns-help">You can edit the message before sending.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="ns-btn-ghost" id="wa-copy-text">Copy</button>
          <button type="button" class="ns-btn" id="wa-open" style="background:#25D366;border-color:#25D366">Open WhatsApp</button></div>
      </div>`,
    actions: [{ label: justSaved ? 'Not now' : 'Close' }],
  });
  const $m = (sel) => m.el.querySelector(sel);
  $m('#wa-invoice').addEventListener('click', () => openInvoice(bookingId).catch((e) => toast(e.message, { error: true })));
  const fileName = () => `${info.code}-booking.png`;
  const render = async () => {
    const canvas = drawBookingCard(info);
    blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob); $m('#wa-card').src = url;
  };
  $m('#wa-mode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    m.el.querySelectorAll('#wa-mode button').forEach((x) => x.classList.toggle('is-on', x === b));
    $m('#wa-card-pane').hidden = b.dataset.mode !== 'card'; $m('#wa-text-pane').hidden = b.dataset.mode !== 'text';
  });
  $m('#wa-dl').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = fileName(); a.click(); };
  $m('#wa-copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('Card copied — paste it into the WhatsApp chat.'); }
    catch { toast('Couldn’t copy the image — use Download instead.', { error: true }); }
  });
  $m('#wa-share')?.addEventListener('click', async () => {
    const f = new File([blob], fileName(), { type: 'image/png' });
    try { await navigator.share({ files: [f], text: caption, title: info.head }); } catch { /* cancelled */ }
  });
  $m('#wa-copy-text').onclick = async () => {
    try { await navigator.clipboard.writeText($m('#wa-text').value); toast('Message copied.'); } catch { $m('#wa-text').select(); toast('Select and copy the message.'); }
  };
  $m('#wa-open').onclick = () => window.open(`https://wa.me/${num}?text=${encodeURIComponent($m('#wa-text').value)}`, '_blank', 'noopener');
  await render();
  return m;
}


// ---------------------------------------------------------------- invoices & receipts (preview, PDF, print, share)
const pdfMoney = (p) => 'Rs. ' + (Number(p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money2 = (p) => '₹' + (Number(p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const docDate = (iso) => (iso ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso)).replace('Sept', 'Sep') : '');
export function invoiceHtml(d) {
  const row = (l) => `<tr><td>${esc(l.desc)}</td><td>${esc(l.sac || '')}</td><td style="text-align:right">${Number(l.qty)}</td>
    <td style="text-align:right">${money2(l.rate_paise)}</td>${d.gst ? `<td style="text-align:right">${Number(l.gst_rate)}%</td>` : ''}<td style="text-align:right">${money2(l.amount_paise)}</td></tr>`;
  return `<div class="inv">
    <div class="inv-head"><div><div class="inv-prop">${esc(d.seller.name)}</div>
        ${d.seller.legal_name && d.seller.legal_name !== d.seller.name ? `<div>${esc(d.seller.legal_name)}</div>` : ''}
        <div>${esc(d.seller.address || '')}</div><div>${esc([d.seller.phone, d.seller.email].filter(Boolean).join(' · '))}</div>
        ${d.seller.gstin ? `<div><b>GSTIN:</b> ${esc(d.seller.gstin)}</div>` : ''}</div>
      <div style="text-align:right"><div class="inv-title">${esc(d.title)}</div><div><b>${esc(d.number)}</b></div><div>${docDate(d.issued_at)}</div></div></div>
    <div class="inv-parties"><div><div class="inv-lbl">Billed to</div><b>${esc(d.buyer.company || d.buyer.name)}</b>
        ${d.buyer.company ? `<div>${d.subscription ? 'Property' : 'Guest'}: ${esc(d.subscription ? d.buyer.company : d.buyer.name)}</div>` : ''}${d.buyer.gstin ? `<div>GSTIN: ${esc(d.buyer.gstin)}</div>` : ''}${d.buyer.address ? `<div>${esc(d.buyer.address)}</div>` : ''}
        <div>${esc([d.buyer.phone, d.buyer.email].filter(Boolean).join(' · '))}</div></div>
      ${d.stay ? `<div><div class="inv-lbl">Stay</div><b>${esc(d.stay.code)}</b> · ${esc(d.stay.room)} · ${esc(d.stay.bed)}
        <div>${docDate(d.stay.check_in_at)} → ${docDate(d.stay.check_out_at)} · ${d.stay.nights} night${d.stay.nights > 1 ? 's' : ''}</div></div>`
        : `<div><div class="inv-lbl">Subscription</div><b>${esc(d.period?.plan || '')} plan</b> · ${esc(d.period?.property || '')}
        <div>${docDate(d.period?.from)} → ${docDate(d.period?.to)}</div></div>`}</div>
    <table class="inv-table"><thead><tr><th>Description</th><th>SAC</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th>${d.gst ? '<th style="text-align:right">GST</th>' : ''}<th style="text-align:right">Amount</th></tr></thead>
      <tbody>${d.lines.map(row).join('')}</tbody></table>
    <div class="inv-totals">
      ${d.gst ? `<div><span>Taxable value</span><span>${money2(d.taxable_paise)}</span></div>${d.igst_paise ? `<div><span>IGST</span><span>${money2(d.igst_paise)}</span></div>` : `<div><span>CGST</span><span>${money2(d.cgst_paise)}</span></div><div><span>SGST</span><span>${money2(d.sgst_paise)}</span></div>`}` : ''}
      <div class="inv-grand"><span>Total${d.gst ? ' (incl. GST)' : ''}</span><span>${money2(d.amount_paise)}</span></div>
      <div><span>Paid</span><span>${money2(d.paid_paise)}</span></div>
      <div class="inv-bal"><span>Balance due</span><span>${money2(d.balance_paise)}</span></div></div>
    ${d.payments?.length ? `<div class="inv-lbl" style="margin-top:14px">Payments</div>${d.payments.map((x) => `<div class="inv-pay">${docDate(x.received_at)} · ${esc(x.code)} · ${esc(String(x.method).toUpperCase())}${x.reference ? ' · ' + esc(x.reference) : ''}<span>${x.kind === 'refund' ? '−' : ''}${money2(x.amount_paise)}</span></div>`).join('')}` : ''}
    <div class="inv-foot">${d.gst ? 'Prices include GST. ' : ''}This is a computer-generated ${d.gst ? 'invoice' : 'bill'}; no signature is required.</div>
  </div>`;
}
export function receiptDoc({ property, guest, booking, payment }) {
  return { receipt: true, number: payment.code, issued_at: payment.received_at, title: payment.kind === 'refund' ? 'Refund receipt' : 'Payment receipt',
    seller: { name: property.name, address: [property.address, property.city].filter(Boolean).join(', '), phone: property.phone, email: property.email, gstin: property.gstin },
    buyer: { name: guest.full_name, phone: guest.phone }, booking, payment };
}
export function receiptHtml(r) {
  return `<div class="inv">
    <div class="inv-head"><div><div class="inv-prop">${esc(r.seller.name)}</div><div>${esc(r.seller.address || '')}</div>
      <div>${esc([r.seller.phone, r.seller.email].filter(Boolean).join(' · '))}</div>${r.seller.gstin ? `<div><b>GSTIN:</b> ${esc(r.seller.gstin)}</div>` : ''}</div>
      <div style="text-align:right"><div class="inv-title">${esc(r.title)}</div><div><b>${esc(r.number)}</b></div><div>${docDate(r.issued_at)}</div></div></div>
    <div class="inv-rcpt"><div>${r.payment.kind === 'refund' ? 'Refunded to' : 'Received from'} <b>${esc(r.buyer.name)}</b></div>
      <div class="inv-amt">${money2(r.payment.amount_paise)}</div>
      <div>by <b>${esc(String(r.payment.method).toUpperCase())}</b>${r.payment.reference ? ` · Ref ${esc(r.payment.reference)}` : ''}</div>
      <div>for booking <b>${esc(r.booking.code)}</b> · ${esc(r.booking.room)} · ${docDate(r.booking.check_in_at)} → ${docDate(r.booking.check_out_at)}</div>
      <div style="margin-top:8px">Booking total ${money2(r.booking.total_paise)} · Paid so far ${money2(r.booking.paid_paise)} · Balance ${money2(r.booking.balance_paise)}</div></div>
    <div class="inv-foot">This is a computer-generated receipt; no signature is required.</div></div>`;
}
async function loadPdfLib() {
  if (window.PDFLib?.PDFDocument) return window.PDFLib;
  await new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    sc.onload = res; sc.onerror = () => rej(new Error('Couldn’t load the PDF maker. Use Print → “Save as PDF” instead.'));
    document.head.appendChild(sc);
  });
  return window.PDFLib;
}
const ascii = (t) => String(t ?? '').replace(/₹/g, 'Rs.').replace(/[—–]/g, '-').replace(/[’‘]/g, "'").replace(/·/g, '|').replace(/→/g, 'to').replace(/[^\x20-\x7E]/g, '');
export async function documentPdf(d) {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const doc = await PDFDocument.create();
  const R = await doc.embedFont(StandardFonts.Helvetica); const B = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595; const H = 842; const M = 42; let page = doc.addPage([W, H]); let y = 50;
  const col = (hex) => { const n = parseInt(hex.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
  const t = (txt, x, yy, o = {}) => {
    const f = o.b ? B : R; const size = o.s || 9.5; const str = ascii(txt);
    const w = f.widthOfTextAtSize(str, size);
    page.drawText(str, { x: o.r ? x - w : x, y: H - yy, size, font: f, color: col(o.c || '#101A3D') });
  };
  const line = (x1, yy, x2) => page.drawLine({ start: { x: x1, y: H - yy }, end: { x: x2, y: H - yy }, thickness: 0.8, color: col('#E7DFC7') });
  const wrap = (txt, width, size = 9.5) => {
    const words = ascii(txt).split(' '); const out = []; let cur = '';
    for (const wd of words) { const tryS = cur ? cur + ' ' + wd : wd; if (R.widthOfTextAtSize(tryS, size) > width && cur) { out.push(cur); cur = wd; } else cur = tryS; }
    if (cur) out.push(cur); return out;
  };
  const newPageIfNeeded = () => { if (y > 770) { page = doc.addPage([W, H]); y = 60; } };
  t(d.seller.name, M, y, { b: true, s: 15 }); t(d.title.toUpperCase(), W - M, y, { b: true, s: 12, r: true, c: '#1C9A6C' });
  y += 16;
  const left = [d.seller.legal_name && d.seller.legal_name !== d.seller.name ? d.seller.legal_name : null, d.seller.address,
    [d.seller.phone, d.seller.email].filter(Boolean).join(' | '), d.seller.gstin ? 'GSTIN: ' + d.seller.gstin : null].filter(Boolean);
  left.forEach((l, i) => t(l, M, y + i * 12, { c: '#4B5563' }));
  t(d.number, W - M, y, { b: true, r: true }); t(docDate(d.issued_at), W - M, y + 12, { r: true, c: '#4B5563' });
  y += Math.max(left.length, 2) * 12 + 12; line(M, y, W - M); y += 20;
  if (d.receipt) {
    t(`${d.payment.kind === 'refund' ? 'Refunded to' : 'Received from'}: ${d.buyer.name}`, M, y, { s: 11 }); y += 30;
    t(pdfMoney(d.payment.amount_paise), M, y, { b: true, s: 22 }); y += 24;
    t(`Method: ${String(d.payment.method).toUpperCase()}${d.payment.reference ? '   Ref: ' + d.payment.reference : ''}`, M, y); y += 14;
    t(`Booking ${d.booking.code} | ${d.booking.room} | ${docDate(d.booking.check_in_at)} to ${docDate(d.booking.check_out_at)}`, M, y); y += 14;
    t(`Booking total ${pdfMoney(d.booking.total_paise)} | Paid so far ${pdfMoney(d.booking.paid_paise)} | Balance ${pdfMoney(d.booking.balance_paise)}`, M, y, { c: '#4B5563' }); y += 30;
    t('This is a computer-generated receipt; no signature is required.', M, y, { s: 8, c: '#6B7280' });
    return new Blob([await doc.save()], { type: 'application/pdf' });
  }
  t('BILLED TO', M, y, { b: true, s: 8, c: '#6B7280' }); t(d.stay ? 'STAY' : 'SUBSCRIPTION', W / 2, y, { b: true, s: 8, c: '#6B7280' }); y += 13;
  const bl = [d.buyer.company && !d.subscription ? d.buyer.company : d.buyer.name, d.buyer.company ? (d.subscription ? 'Property: ' + d.buyer.company : 'Guest: ' + d.buyer.name) : null,
    d.buyer.gstin ? 'GSTIN: ' + d.buyer.gstin : null, d.buyer.address || null,
    [d.buyer.phone, d.buyer.email].filter(Boolean).join(' | ')].filter(Boolean);
  const sl = d.stay ? [`${d.stay.code} | ${d.stay.room} | ${d.stay.bed}`, `${docDate(d.stay.check_in_at)} to ${docDate(d.stay.check_out_at)} | ${d.stay.nights} night(s)`]
    : [`${d.period?.plan || ''} plan | ${d.period?.property || ''}`, `${docDate(d.period?.from)} to ${docDate(d.period?.to)}`];
  bl.forEach((l, i) => t(l, M, y + i * 12, { b: i === 0 })); sl.forEach((l, i) => t(l, W / 2, y + i * 12, { b: i === 0 }));
  y += Math.max(bl.length, sl.length) * 12 + 16;
  const cols = d.gst ? [[M, 'Description'], [300, 'SAC'], [370, 'Qty', 1], [440, 'Rate', 1], [485, 'GST', 1], [W - M, 'Amount', 1]]
    : [[M, 'Description'], [330, 'SAC'], [400, 'Qty', 1], [470, 'Rate', 1], [W - M, 'Amount', 1]];
  page.drawRectangle({ x: M - 6, y: H - y - 5, width: W - 2 * M + 12, height: 18, color: col('#F5F1E3') });
  cols.forEach(([x, h, r]) => t(h, x, y + 8, { b: true, s: 8.5, r })); y += 26;
  for (const l of d.lines) {
    const desc = wrap(l.desc, (d.gst ? 300 : 330) - M - 10);
    desc.forEach((ln, i) => t(ln, M, y + i * 11));
    const vals = d.gst ? [l.sac || '', String(Number(l.qty)), pdfMoney(l.rate_paise), Number(l.gst_rate) + '%', pdfMoney(l.amount_paise)]
      : [l.sac || '', String(Number(l.qty)), pdfMoney(l.rate_paise), pdfMoney(l.amount_paise)];
    cols.slice(1).forEach(([x, , r], i) => t(vals[i], x, y, { r }));
    y += desc.length * 11 + 8; newPageIfNeeded();
  }
  line(M, y - 4, W - M); y += 14;
  const tot = [];
  if (d.gst) tot.push(['Taxable value', d.taxable_paise], ...(d.igst_paise ? [['IGST', d.igst_paise]] : [['CGST', d.cgst_paise], ['SGST', d.sgst_paise]]));
  tot.push([`Total${d.gst ? ' (incl. GST)' : ''}`, d.amount_paise, 1], ['Paid', d.paid_paise], ['Balance due', d.balance_paise, 1]);
  tot.forEach(([l, v, b]) => { t(l, 380, y, { b }); t(pdfMoney(v), W - M, y, { b, r: 1 }); y += 14; });
  if (d.payments?.length) {
    y += 8; t('PAYMENTS', M, y, { b: true, s: 8, c: '#6B7280' }); y += 12;
    d.payments.forEach((x) => { newPageIfNeeded(); t(`${docDate(x.received_at)} | ${x.code} | ${String(x.method).toUpperCase()}${x.reference ? ' | ' + x.reference : ''}`, M, y, { c: '#4B5563' });
      t((x.kind === 'refund' ? '- ' : '') + pdfMoney(x.amount_paise), W - M, y, { r: 1, c: '#4B5563' }); y += 12; });
  }
  y += 18; t(`${d.gst ? 'Prices include GST. ' : ''}This is a computer-generated ${d.gst ? 'invoice' : 'bill'}; no signature is required.`, M, y, { s: 8, c: '#6B7280' });
  return new Blob([await doc.save()], { type: 'application/pdf' });
}
export function printHtml(html) {
  let host = document.getElementById('ns-print');
  if (!host) { host = document.createElement('div'); host.id = 'ns-print'; document.body.appendChild(host); }
  host.innerHTML = html; document.body.classList.add('ns-printing');
  const done = () => { document.body.classList.remove('ns-printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); window.print(); setTimeout(done, 60000);
}
function docModal({ title, html, d, fileName, extra = '', onExtra }) {
  const m = modal({
    title, width: 720,
    body: `${extra}<div class="inv-preview" data-no-tr>${html}</div>`,
    actions: [{ label: 'Close' },
      { label: 'Print', onClick: () => { printHtml(m.el.querySelector('.inv-preview').innerHTML); return false; } },
      { label: 'Download PDF', onClick: async () => {
        try { const blob = await documentPdf(d); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click(); }
        catch (e) { toast(e.message, { error: true }); }
        return false;
      } },
      { label: 'Share', kind: 'primary', onClick: async () => {
        try {
          const blob = await documentPdf(d); const f = new File([blob], fileName, { type: 'application/pdf' });
          if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title }).catch(() => {});
          else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click(); toast('PDF downloaded — attach it in WhatsApp or email.'); }
        } catch (e) { toast(e.message, { error: true }); }
        return false;
      } }],
  });
  onExtra?.(m);
  return m;
}
export async function openInvoice(bookingId, buyer = null) {
  const d = await rpc('issue_invoice', { p_booking: bookingId, p_buyer: buyer });
  const safe = d.number.replace(/[^A-Za-z0-9-]+/g, '-');
  docModal({ title: `${d.title} ${d.number}`, html: invoiceHtml(d), d, fileName: `${safe}.pdf`,
    extra: `<details class="inv-company"${buyer ? ' open' : ''}><summary>Bill to a company (GSTIN)</summary>
      <div style="display:grid;grid-template-columns:1.4fr 1fr auto;gap:8px;align-items:end;margin-top:8px">
        ${field('Company name', `<input class="ns-input" name="co" value="${esc(buyer?.name || '')}">`)}
        ${field('Company GSTIN', `<input class="ns-input" name="cogst" maxlength="15" value="${esc(buyer?.gstin || '')}" style="text-transform:uppercase">`)}
        <button type="button" class="ns-btn-ghost" data-co style="height:44px">Update bill</button></div></details>`,
    onExtra: (m) => m.el.querySelector('[data-co]').addEventListener('click', async () => {
      const b = { name: m.el.querySelector('[name=co]').value.trim(), gstin: m.el.querySelector('[name=cogst]').value.trim().toUpperCase() };
      try { await openInvoice(bookingId, b.name || b.gstin ? b : null); m.el.querySelector('.ns-x').click(); } catch (e) { toast(e.message, { error: true }); }
    }) });
}
/** NammaStay subscription invoice (NammaStay → property) */
export function openPlatformInvoice(d) {
  docModal({ title: `${d.title} ${d.number}`, html: invoiceHtml(d), d, fileName: `${d.number.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf` });
}
export const GST_STATES = [['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'], ['06', 'Haryana'],
  ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'],
  ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'],
  ['23', 'Madhya Pradesh'], ['24', 'Gujarat'], ['26', 'Dadra & Nagar Haveli and Daman & Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman & Nicobar Islands'], ['36', 'Telangana'],
  ['37', 'Andhra Pradesh'], ['38', 'Ladakh']];
export function openReceipt(r) {
  docModal({ title: `${r.title} ${r.number}`, html: receiptHtml(r), d: r, fileName: `Receipt-${r.number}.pdf` });
}

// ---------------------------------------------------------------- delete a booking entered by mistake
// Used from the booking screen and from the calendar. Removes only this stay.
export function deleteBookingDialog({ ctx, id, guest, room, bed, checkIn, checkOut, status, paidPaise = 0, paymentsCount = null, createdAt = null, onDone }) {
  if (ctx.allow && !ctx.allow('delete_bookings')) { toast('Your role can’t delete bookings. Ask the owner.', { error: true }); return; }
  const nPay = paymentsCount ?? (paidPaise > 0 ? 1 : 0);
  if (ctx.role === 'front_desk' && (nPay > 0 || (createdAt && Date.now() - new Date(createdAt) > 24 * 3600e3))) {
    toast('Front desk can only delete bookings made in the last 24 hours with no payments. Please ask the owner or manager.', { error: true });
    return;
  }
  modal({
    title: `Delete ${guest}’s stay?`,
    body: `<p style="margin:0;font-size:14px;line-height:1.6">This removes only this stay — <b>${esc(room)} · ${esc(bed)}</b>,
        <b>${fmtDayTime(checkIn)} → ${fmtDayTime(checkOut)}</b> — and frees the ${W.unit} for those dates.
        ${esc(guest)}’s profile and other bookings are not affected.</p>
      ${status === 'checked_in' ? '<div class="ns-demo-hint">This guest is <b>checked in right now</b>. Only delete if the booking was entered by mistake — to end a real stay, use <b>Check out</b>.</div>' : ''}
      ${paidPaise > 0 ? `<div class="ns-error" style="font-weight:600">${rupees(paidPaise)} paid on this booking will be deleted too. If you really received this money, record it on the correct booking.</div>` : ''}
      ${field('Reason', `<select class="ns-input" name="reason">${options([['Entered by mistake', 'Entered by mistake'], ['Duplicate booking', 'Duplicate booking'],
        ['Wrong guest', 'Wrong guest'], ['Wrong bed or dates', 'Wrong bed or dates'], ['Test booking', 'Test booking'], ['Other', 'Other']], 'Entered by mistake')}</select>`)}
      <div class="ns-help">A copy is kept in Settings → Notifications → Deleted bookings.</div>`,
    actions: [{ label: 'Keep booking' }, { label: 'Delete booking', kind: 'danger', onClick: async (el) => {
      const r = await rpc('delete_booking', { p_booking: id, p_reason: el.querySelector('[name=reason]').value });
      toast(`${r.code} deleted — bed is free again.`);
      onDone?.(r);
    } }],
  });
}

// ---------------------------------------------------------------- delete a guest completely (owner / manager)
export async function deleteGuestDialog(ctx, guestId, onDone) {
  if (!ctx.can('owner', 'manager') || !ctx.allow('delete_guests')) { toast('Your role can’t delete guests. Ask the owner.', { error: true }); return; }
  const d = await rpc('guest_profile', { p_guest: guestId });
  const g = d.guest; const n = d.stays.length;
  const active = d.stays.filter((x) => ['pending', 'confirmed', 'checked_in'].includes(x.status));
  const inHouse = active.some((x) => x.status === 'checked_in');
  modal({
    title: `Delete ${g.full_name}?`,
    body: `<p style="margin:0;font-size:14px;line-height:1.6">This permanently removes <b>${esc(g.full_name)}</b>’s profile${n ? `, <b>all ${n} booking${n > 1 ? 's' : ''}</b>` : ''}${d.spend_paise ? ` and <b>${rupees(d.spend_paise)}</b> in payments` : ''}${g.id_doc_path || g.id_doc_back_path ? ', and their ID photos' : ''}.</p>
      ${d.spend_paise ? `<div class="ns-error" style="font-weight:600">${rupees(d.spend_paise)} will be removed from your revenue and reports.</div>` : ''}
      ${inHouse ? '<div class="ns-demo-hint">This guest is <b>checked in right now</b> — their ${W.unit} will show as free.</div>'
        : active.length ? `<div class="ns-demo-hint">${active.length} upcoming booking${active.length > 1 ? 's' : ''} will be cancelled and the ${W.units} freed.</div>` : ''}
      ${n ? `<div class="ns-muted" style="font-size:12.5px">To delete just one stay instead, use the 🗑 on that row in Stay history.</div>` : ''}
      ${field('Reason', `<select class="ns-input" name="reason">${options([['Entered by mistake', 'Entered by mistake'], ['Duplicate guest', 'Duplicate guest'],
        ['Guest asked to delete their data', 'Guest asked to delete their data'], ['Test entry', 'Test entry'], ['Other', 'Other']], 'Entered by mistake')}</select>`)}
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;font-weight:600"><input type="checkbox" name="sure" style="margin-top:2px">
        I understand this can’t be undone.</label>
      <div class="ns-help">A copy of each deleted booking is kept in Settings → Notifications → Deleted bookings.</div>`,
    actions: [{ label: 'Keep guest' }, { label: 'Delete guest', kind: 'danger', onClick: async (el) => {
      if (!el.querySelector('[name=sure]').checked) throw new Error('Tick the box to confirm.');
      const r = await rpc('delete_guest', { p_guest: guestId, p_reason: el.querySelector('[name=reason]').value });
      if (r.id_doc_paths?.length) await sb.storage.from('guest-ids').remove(r.id_doc_paths).catch(() => {});
      toast(`${r.guest} deleted${r.bookings_removed ? ` with ${r.bookings_removed} booking${r.bookings_removed > 1 ? 's' : ''}` : ''}.`);
      onDone?.(r);
    } }],
  });
}

// ---------------------------------------------------------------- pills
const STATUS = {
  pending: ['Pending', 'amber'], confirmed: ['Confirmed', 'navy'], checked_in: ['Checked-in', 'green'],
  checked_out: ['Checked-out', 'grey'], cancelled: ['Cancelled', 'red'], no_show: ['No-show', 'red'],
};
export const pill = (text, color) => `<span class="ns-pill ${color}">${esc(text)}</span>`;
export const statusPill = (s) => pill(...(STATUS[s] || [titleCase(s), 'grey']));
export const statusLabel = (s) => (STATUS[s] || [titleCase(s)])[0];
export function payPill(total, paid) {
  if (total > 0 && paid >= total) return pill('Paid', 'green');
  if (paid > 0) return pill('Partial', 'amber');
  return total > 0 ? pill('Unpaid', 'red') : pill('—', 'grey');
}
const METHOD = { upi: ['UPI', 'blue'], cash: ['Cash', 'grey'], card: ['Card', 'purple'], bank: ['Bank', 'blue'] };
export const methodPill = (m) => pill(...(METHOD[m] || [m, 'grey']));
export const METHOD_OPTIONS = [['upi', 'UPI'], ['cash', 'Cash'], ['card', 'Card'], ['bank', 'Bank transfer']];
export const ID_TYPES = [['aadhaar', 'Aadhaar card'], ['passport', 'Passport'], ['driving_licence', 'Driving licence'],
  ['pan', 'PAN card'], ['voter_id', 'Voter ID'], ['other', 'Other']];
export const SOURCES = [['walk_in', 'Walk-in'], ['direct', 'Direct (phone/WhatsApp/website)'], ['ota', 'Hostelworld / OTA'], ['referral', 'Referral']];

export function avatar(name, size = 30) {
  return `<div class="ns-avatar-sm" style="width:${size}px;height:${size}px;${size > 30 ? 'font-size:13px' : ''}">${esc(initials(name))}</div>`;
}

// ---------------------------------------------------------------- UPI (direct to your UPI ID, no gateway)
export function upiLink({ upiId, payee, amountPaise, note }) {
  const p = new URLSearchParams({ pa: upiId, pn: payee, am: (amountPaise / 100).toFixed(2), cu: 'INR', tn: note });
  return 'upi://pay?' + p.toString().replace(/\+/g, '%20');
}
export async function qrDataUrl(text) {
  try {
    const { default: QRCode } = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
    return await QRCode.toDataURL(text, { margin: 1, width: 220, color: { dark: '#0E1B3D', light: '#FFFFFF' } });
  } catch { return null; }                                  // QR is a convenience; the payment still works
}

// ---------------------------------------------------------------- ID photo upload (compressed in the browser)
export async function compressImage(file, maxSide = 1600, quality = 0.72) {
  if (!file) return null;
  if (file.type === 'application/pdf') {
    if (file.size > 5 * 1024 * 1024) throw new Error('PDF must be under 5 MB.');
    return file;
  }
  if (!/^image\//.test(file.type)) throw new Error('Upload a photo (JPG, PNG) or a PDF.');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
  return new File([blob], 'id.jpg', { type: 'image/jpeg' });
}
export async function uploadIdDoc(path, file) {
  const { error } = await sb.storage.from('guest-ids').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message.includes('row-level security')
    ? 'Upload not allowed. The link may have expired.' : error.message);
  return path;
}
// ---- ID photos: front + back, shown inside the app (new tabs get blocked as pop-ups)
const isPdf = (p) => /\.pdf$/i.test(p || '');
export async function viewIdDocs({ front, back, name }) {
  const sides = [['Front', front], ['Back', back]].filter(([, p]) => p);
  if (!sides.length) { toast('No ID photo on file for this guest.', { error: true }); return; }
  const loaded = await Promise.all(sides.map(async ([label, path]) => {
    const [view, dl] = await Promise.all([
      sb.storage.from('guest-ids').createSignedUrl(path, 300),
      sb.storage.from('guest-ids').createSignedUrl(path, 300, { download: `${String(name || 'guest').replace(/\W+/g, '-')}-id-${label.toLowerCase()}${isPdf(path) ? '.pdf' : '.jpg'}` }),
    ]);
    return { label, path, url: view.data?.signedUrl, dl: dl.data?.signedUrl || view.data?.signedUrl, error: view.error?.message };
  }));
  modal({
    title: `ID · ${name || ''}`, width: sides.length > 1 ? 900 : 560,
    body: `<div style="display:grid;grid-template-columns:repeat(${sides.length},minmax(0,1fr));gap:16px" class="ns-id-grid">
      ${loaded.map((x) => `<figure style="margin:0;display:flex;flex-direction:column;gap:8px;min-width:0">
          <figcaption style="font-size:12px;font-weight:800;color:#6B7280;text-transform:uppercase;letter-spacing:.04em">${x.label} side</figcaption>
          ${x.error || !x.url ? `<div class="ns-empty" style="border:1px dashed #E2DAC4;border-radius:12px">Couldn’t load this file${x.error ? ': ' + esc(x.error) : ''}.<br>It may have been deleted after the retention period.</div>`
            : isPdf(x.path) ? `<div class="ns-empty" style="border:1px dashed #E2DAC4;border-radius:12px">PDF document</div>`
            : `<img src="${esc(x.url)}" alt="${x.label} of ID" style="width:100%;max-height:60vh;object-fit:contain;background:#F5F1E3;border-radius:12px" data-img>`}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${x.url ? `<a class="ns-btn-ghost" style="height:34px;font-size:12px" href="${esc(x.url)}" target="_blank" rel="noopener">Open full size</a>
              <a class="ns-btn-ghost" style="height:34px;font-size:12px" href="${esc(x.dl)}" download>Download</a>` : ''}
          </div></figure>`).join('')}
      </div>
      <div class="ns-help">Links expire in 5 minutes. ID photos are deleted automatically after the retention period in Settings.</div>`,
    actions: [{ label: 'Close' }],
  }).el.querySelectorAll('[data-img]').forEach((img) => img.addEventListener('error', () => {
    img.outerHTML = '<div class="ns-empty" style="border:1px dashed #E2DAC4;border-radius:12px">Couldn’t load this image. It may have been deleted after the retention period.</div>';
  }));
}
/** Two file inputs (front / back) with a small preview each */
export function idUploadFields({ front = 'ID photo — front', back = 'ID photo — back (not needed for passports)', hasFront = false, hasBack = false } = {}) {
  const one = (name, label, has) => `<div class="ns-field"><label>${esc(label)}</label>
    <label class="ns-id-drop"><input type="file" name="${name}" accept="image/*,application/pdf" capture="environment">
      <img alt="" hidden><span>${has ? 'Replace photo' : 'Take or choose a photo'}</span></label></div>`;
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="ns-id-upload">${one('id_file', front, hasFront)}${one('id_file_back', back, hasBack)}</div>`;
}
export function wireIdPreviews(root) {
  root.querySelectorAll('.ns-id-drop input[type=file]').forEach((inp) => inp.addEventListener('change', () => {
    const f = inp.files[0]; const img = inp.parentElement.querySelector('img'); const span = inp.parentElement.querySelector('span');
    if (!f) { img.hidden = true; return; }
    if (/^image\//.test(f.type)) { img.src = URL.createObjectURL(f); img.hidden = false; } else img.hidden = true;
    span.textContent = f.name.length > 28 ? f.name.slice(0, 25) + '…' : f.name;
  }));
}
/** Upload whichever sides were chosen. Returns { id_doc_path?, id_doc_back_path? } */
export async function uploadIdSides(root, folder) {
  const out = {};
  for (const [name, key] of [['id_file', 'id_doc_path'], ['id_file_back', 'id_doc_back_path']]) {
    const f = root.querySelector(`[name=${name}]`)?.files?.[0];
    if (!f) continue;
    const small = await compressImage(f);
    out[key] = await uploadIdDoc(`${folder}/${newId()}.${small.type === 'application/pdf' ? 'pdf' : 'jpg'}`, small);
  }
  return out;
}

export async function openIdDoc(path) {
  const { data, error } = await sb.storage.from('guest-ids').createSignedUrl(path, 120);
  if (error) throw new Error(error.message);
  window.open(data.signedUrl, '_blank', 'noopener');
}

export function debounce(fn, ms = 300) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((v) => {
    const s = String(v ?? '');
    const risky = /^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s().-]*$/.test(s));   // block formulas; keep phone numbers & amounts
    return /[",\n]/.test(s) || risky ? `"${(risky ? "'" : '') + s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,
  (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
export const param = (k) => new URLSearchParams(location.search).get(k);
export const uuidOk = (v) => /^[0-9a-f-]{36}$/i.test(v || '');
