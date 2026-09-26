// NammaStay — in-browser demo backend.
// Used automatically when assets/js/config.js has no Supabase keys.
// It mimics the Supabase client (auth, rpc, from, storage, channel) and
// re-implements the database functions from supabase/migrations/003 in
// JavaScript, over realistic sample data saved in this browser.
// Nothing here is sent anywhere.

const KEY = 'ns.demo.v1';
const SESSION = 'ns.demo.session';
const DAY = 86400000;
const LIVE_ST = ['pending', 'confirmed', 'checked_in'];
const OCC_ST = ['pending', 'confirmed', 'checked_in', 'checked_out'];
const P = 'd0000000-0000-4000-8000-000000000001';
const ME = 'd0000000-0000-4000-8000-0000000000aa';

// ---------------------------------------------------------------- helpers
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,
  (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
const ymd = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(d));
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / DAY);
const at = (day, hm) => new Date(`${day}T${hm}:00+05:30`).toISOString();
const dayStart = (day) => new Date(`${day}T00:00:00+05:30`).getTime();
const night = (day) => new Date(`${day}T20:00:00+05:30`).getTime();
const T = (iso) => new Date(iso).getTime();
const overlaps = (a1, a2, b1, b2) => T(a1) < T(b2) && T(b1) < T(a2);
const net = (p) => (p.kind === 'refund' ? -p.amount_paise : p.amount_paise);
const rupees = (p) => '₹' + (p / 100).toLocaleString('en-IN');
const digits = (s) => String(s || '').replace(/\D/g, '');
class DemoError extends Error {}
const fail = (m) => { throw new DemoError(m); };

function rng(seed) {                       // deterministic sample data
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- sample data
const PEOPLE = [
  ['Rahul Kannan', 'India', '+919840012233'], ['Emma Torres', 'Spain', '+34611220987'], ['Aravind V.', 'India', '+919884455667'],
  ['Priya N.', 'India', '+919790011223'], ['Sofia Jensen', 'Norway', '+4790233110'], ['Marco Klein', 'Germany', '+4915112345678'],
  ['Noa Levi', 'Israel', '+972501234567'], ['Karthik R.', 'India', '+919600112233'], ['Lena Fischer', 'Germany', '+4917612345678'],
  ['Arjun Mehta', 'India', '+919820098200'], ['Chloe Martin', 'France', '+33612345678'], ['Deepa S.', 'India', '+919445566778'],
  ['Tom Baker', 'United Kingdom', '+447700900123'], ['Ananya Iyer', 'India', '+919003344556'], ['Jake Wilson', 'Australia', '+61412345678'],
  ['Meera Pillai', 'India', '+919847012345'], ['Lucas Silva', 'Brazil', '+5511912345678'], ['Sneha Reddy', 'India', '+919912345678'],
  ['Yuki Tanaka', 'Japan', '+819012345678'], ['Vikram Rao', 'India', '+919866012345'], ['Hannah Berg', 'Netherlands', '+31612345678'],
  ['Rohit Das', 'India', '+919830012345'], ['Isabel Garcia', 'Spain', '+34622334455'], ['Farah Ali', 'United Kingdom', '+447700900456'],
  ['Nikhil Joshi', 'India', '+919821234567'], ['Kavya Menon', 'India', '+919895012345'], ['Ben Cohen', 'Israel', '+972521234567'],
  ['Julia Weber', 'Germany', '+4915212345678'], ['Sai Kiran', 'India', '+919989012345'], ['Olivia Brown', 'United States', '+12025550143'],
];

function seed() {
  const r = rng(20260923);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const today = ymd();
  const now = Date.now();
  const db = {
    base: today, seq: { bk: 1001, txn: 10001 },
    properties: [{ id: P, name: 'Social Backpackers Hostel', kind: 'hostel', address: 'Little Mount', city: 'Chennai', phone: '+91 98400 00000',
      email: 'hello@socialbackpackers.in', upi_id: 'socialbackpackers@okaxis', timezone: 'Asia/Kolkata', checkin_time: '14:00:00',
      checkout_time: '11:00:00', id_doc_retention_days: 180, created_at: at(addDays(today, -60), '09:00') }],
    members: [
      { property_id: P, user_id: ME, role: 'owner', display_name: 'Hostel Owner', email: 'owner@demo.nammastay', last_seen_at: new Date().toISOString() },
      { property_id: P, user_id: uuid(), role: 'manager', display_name: 'Divya Menon', email: 'divya@socialbackpackers.in', last_seen_at: new Date(now - 2 * 3600e3).toISOString() },
      { property_id: P, user_id: uuid(), role: 'front_desk', display_name: 'Karthik J.', email: 'karthik@socialbackpackers.in', last_seen_at: new Date(now - 26 * 3600e3).toISOString() },
      { property_id: P, user_id: uuid(), role: 'front_desk', display_name: 'Anitha R.', email: 'anitha@socialbackpackers.in', last_seen_at: new Date(now - 72 * 3600e3).toISOString() },
      { property_id: P, user_id: uuid(), role: 'accountant', display_name: 'Vikram P.', email: 'vikram@socialbackpackers.in', last_seen_at: null },
    ],
    rooms: [], beds: [], blocks: [], guests: [], bookings: [], payments: [], notifications: [], audit: [],
  };
  const r6 = uuid(); const r3 = uuid();
  db.rooms.push({ id: r6, property_id: P, name: '6-Bed Mixed Dorm', description: 'Fan · Shared bath', sort: 1 },
    { id: r3, property_id: P, name: '3-Bed Dorm', description: 'AC · Shared bath', sort: 2 });
  [['Lower A1', 'lower', 70000], ['Upper A1', 'upper', 60000], ['Lower A2', 'lower', 70000], ['Upper A2', 'upper', 60000],
    ['Lower A3', 'lower', 70000], ['Upper A3', 'upper', 60000]].forEach(([label, position, rate], i) =>
    db.beds.push({ id: uuid(), property_id: P, room_id: r6, label, position, rate_paise: rate, is_active: true, sort: i + 1 }));
  ['Lower C1', 'Lower C2', 'Lower C3'].forEach((label, i) =>
    db.beds.push({ id: uuid(), property_id: P, room_id: r3, label, position: 'lower', rate_paise: 85000, is_active: true, sort: i + 1 }));

  const blockBed = db.beds[5];
  const block = { id: uuid(), property_id: P, bed_id: blockBed.id, starts_at: at(addDays(today, -1), '12:00'), ends_at: at(addDays(today, 2), '12:00'), reason: 'Fan repair' };
  db.blocks.push(block);

  const guests = PEOPLE.map(([full_name, nationality, phone], i) => {
    const indian = nationality === 'India';
    return { id: uuid(), property_id: P, full_name, phone, email: full_name.split(' ')[0].toLowerCase() + '@mail.com',
      dob: `${1985 + (i * 7) % 18}-${String(1 + (i * 5) % 12).padStart(2, '0')}-${String(1 + (i * 11) % 27).padStart(2, '0')}`,
      nationality, id_type: indian ? 'aadhaar' : 'passport',
      id_number: indian ? `XXXX XXXX ${String(1000 + i * 373).slice(-4)}` : `${nationality[0]}${String(4000000 + i * 91357)}`,
      id_doc_path: i % 3 === 0 ? `${P}/staff/sample-${i}.jpg` : null,
      notes: i === 4 ? 'Prefers lower bunk near the window. Travels with a small dog on request — confirm pet-friendly bed ahead of arrival.' : null,
      tags: [], consent_at: at(addDays(today, -40), '10:00'), created_at: at(addDays(today, -45 + i), '10:00'), updated_at: at(today, '09:00') };
  });
  db.guests = guests;

  const raw = [];
  db.beds.forEach((bed) => {
    let d = addDays(today, -34 - Math.floor(r() * 3));
    while (d < addDays(today, 21)) {
      const ahead = daysBetween(today, d);
      const gapChance = ahead > 6 ? 0.55 : 0.2;
      if (r() < gapChance) { d = addDays(d, 1 + Math.floor(r() * (ahead > 6 ? 3 : 2))); continue; }
      const n = 1 + Math.floor(r() * 4);
      const ci = at(d, `${String(12 + Math.floor(r() * 7)).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`);
      const co = at(addDays(d, n), pick(['10:00', '10:30', '11:00', '11:00']));
      if (bed.id === block.bed_id && overlaps(ci, co, block.starts_at, block.ends_at)) { d = ymd(block.ends_at); continue; }
      raw.push({ bed, ci, co, n, d });
      d = addDays(d, n);
    }
  });
  raw.sort((a, b) => T(a.ci) - T(b.ci));
  raw.forEach((x, i) => {
    const g = pick(guests);
    const created = new Date(Math.min(T(x.ci) - (1 + Math.floor(r() * 9)) * DAY, now - 3600e3)).toISOString();
    let status;
    const roll = r();
    if (T(x.co) <= now) status = roll < 0.05 ? 'cancelled' : roll < 0.07 ? 'no_show' : 'checked_out';
    else if (T(x.ci) <= now) status = daysBetween(ymd(x.ci), today) === 0 && roll < 0.35 ? 'confirmed' : 'checked_in';
    else status = roll < 0.06 ? 'cancelled' : roll < 0.3 ? 'pending' : 'confirmed';
    const total = x.n * x.bed.rate_paise;
    const b = { id: uuid(), property_id: P, code: 'BK-' + db.seq.bk++, guest_id: g.id, bed_id: x.bed.id, visitors: 1,
      check_in_at: x.ci, check_out_at: x.co, nights: x.n, rate_paise: x.bed.rate_paise, total_paise: total, paid_paise: 0,
      status, source: pick(['walk_in', 'walk_in', 'walk_in', 'direct', 'direct', 'ota', 'referral']), note: null, send_confirmation: true,
      self_checkin_token: uuid(), self_checkin_at: status !== 'pending' && r() < 0.4 ? created : null, self_checkin_count: 0,
      arrived_at: ['checked_in', 'checked_out'].includes(status) ? x.ci : null,
      departed_at: status === 'checked_out' ? x.co : null, cancelled_at: status === 'cancelled' ? created : null,
      created_by: pick(db.members.slice(0, 4)).user_id, created_at: created, updated_at: created };
    db.bookings.push(b);
    db.audit.push({ booking_id: b.id, action: 'created', details: { status: 'pending', total_paise: total }, actor: b.created_by, at: created });
    if (['checked_in', 'checked_out'].includes(status)) db.audit.push({ booking_id: b.id, action: 'status', details: { from: 'confirmed', to: 'checked_in' }, actor: b.created_by, at: x.ci });
    if (status === 'checked_out') db.audit.push({ booking_id: b.id, action: 'status', details: { from: 'checked_in', to: 'checked_out' }, actor: b.created_by, at: x.co });
    if (['cancelled', 'no_show'].includes(status)) db.audit.push({ booking_id: b.id, action: 'status', details: { from: 'confirmed', to: status }, actor: b.created_by, at: created });
    const pay = (amount, when) => {
      const method = pick(['upi', 'upi', 'upi', 'upi', 'cash', 'cash', 'card']);
      const p = { id: uuid(), property_id: P, booking_id: b.id, code: 'TXN-' + db.seq.txn++, kind: 'payment', method, amount_paise: amount,
        reference: method === 'upi' ? String(400000000000 + Math.floor(r() * 99999999999)) : null, note: null,
        received_at: when, received_by: b.created_by, created_at: when };
      db.payments.push(p); b.paid_paise += amount;
      db.audit.push({ booking_id: b.id, action: 'payment', details: { amount_paise: amount, method, code: p.code }, actor: b.created_by, at: when });
    };
    const inAt = new Date(T(x.ci) + 20 * 60e3).toISOString();
    if (status === 'checked_out') { if (r() < 0.93) pay(total, inAt); else pay(x.bed.rate_paise, inAt); }
    else if (status === 'checked_in') pay(r() < 0.55 ? total : x.bed.rate_paise, inAt);
    else if (status === 'confirmed' && r() < 0.4) pay(x.bed.rate_paise, created);
    if (i % 17 === 0 && status === 'checked_out' && b.paid_paise >= 60000) {
      const p = { id: uuid(), property_id: P, booking_id: b.id, code: 'TXN-' + db.seq.txn++, kind: 'refund', method: 'upi', amount_paise: 20000,
        reference: null, note: 'Early departure', received_at: x.co, received_by: ME, created_at: x.co };
      db.payments.push(p); b.paid_paise -= 20000;
    }
  });
  const recent = db.bookings.filter((b) => T(b.created_at) > now - 3 * DAY).slice(-3);
  recent.forEach((b) => db.notifications.push({ id: uuid(), property_id: P, user_id: null, kind: 'booking_created',
    title: 'New booking ' + b.code, body: guestOf(db, b).full_name, booking_id: b.id, read_at: null, created_at: b.created_at }));
  return db;
}
const guestOf = (db, b) => db.guests.find((g) => g.id === b.guest_id);

// Keep sample dates fresh: slide everything forward to today on each visit
function shift(db) {
  const n = daysBetween(db.base, ymd());
  if (!n) return db;
  const ms = n * DAY;
  const mv = (o, keys) => keys.forEach((k) => { if (o[k]) o[k] = new Date(T(o[k]) + ms).toISOString(); });
  db.bookings.forEach((b) => mv(b, ['check_in_at', 'check_out_at', 'self_checkin_at', 'arrived_at', 'departed_at', 'cancelled_at', 'created_at', 'updated_at']));
  db.payments.forEach((p) => mv(p, ['received_at', 'created_at']));
  db.blocks.forEach((k) => mv(k, ['starts_at', 'ends_at']));
  db.guests.forEach((g) => mv(g, ['created_at', 'updated_at', 'consent_at']));
  (db.leads || []).forEach((l) => mv(l, ['created_at', 'updated_at', 'contacted_at']));
  db.notifications.forEach((x) => mv(x, ['created_at', 'read_at']));
  db.audit.forEach((a) => mv(a, ['at']));
  db.members.forEach((m) => mv(m, ['last_seen_at']));
  db.base = ymd();
  return db;
}

function seedLeads() {
  const now = Date.now(); const H = 3600e3;
  const L = (h, name, phone, email, property_name, city, property_type, beds, message, status, notes, source) =>
    ({ id: uuid(), name, phone, email, property_name, city, property_type, beds, message, source, status, notes,
      contacted_at: status === 'new' ? null : new Date(now - (h - 2) * H).toISOString(),
      created_at: new Date(now - h * H).toISOString(), updated_at: new Date(now - h * H).toISOString() });
  return [
    L(3, 'Meera Krishnan', '+919840055512', 'meera@zostelish.in', 'Blue Door Hostel', 'Pondicherry', 'hostel', 24, 'We use a Google Sheet today. Want UPI QR at the desk.', 'new', null, 'source=instagram'),
    L(9, 'Rahul Varma', '+919895011223', null, 'Varma Homestay', 'Munnar', 'homestay', 5, null, 'new', null, 'direct'),
    L(20, 'Aisha Khan', null, 'aisha@hilltop.co', 'Hilltop Backpackers', 'Manali', 'hostel', 40, 'Two properties — can staff switch between them?', 'contacted', 'Asked about multi-property. Sent demo link.', 'source=google'),
    L(44, 'Joseph D’Souza', '+919822012345', 'joseph@goabeach.in', 'Beach Shack Stays', 'Goa', 'hotel', 12, null, 'demo_booked', 'Demo Friday 4 PM on Meet.', 'ref=https://www.google.com/'),
    L(70, 'Priyanka S.', '+919003312345', 'priyanka@citynest.in', 'City Nest', 'Bengaluru', 'hostel', 18, 'Need Form C details for foreigners.', 'won', 'Signed up. Onboarding next week.', 'source=whatsapp'),
    L(95, 'Karan Mehta', '+919819912345', null, 'Mehta Guest House', 'Udaipur', 'hotel', 8, null, 'lost', 'Went with an OTA channel manager.', 'direct'),
    L(130, 'Divya Nair', '+919847099887', 'divya@kovalam.in', 'Lighthouse Homestay', 'Kovalam', 'homestay', 4, 'Just me and my mother running it.', 'contacted', null, 'source=instagram'),
  ];
}

let DB;
function load() {
  if (DB) return DB;
  try { DB = JSON.parse(localStorage.getItem(KEY)); } catch { DB = null; }
  DB = shift(DB && DB.bookings ? DB : seed());
  if (!DB.leads) DB.leads = seedLeads();
  save();
  return DB;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch { /* storage full: keep in memory */ } }
export function resetDemo() { localStorage.removeItem(KEY); DB = null; }

// ---------------------------------------------------------------- shared lookups
const bedOf = (id) => DB.beds.find((x) => x.id === id);
const roomOf = (id) => DB.rooms.find((x) => x.id === id);
const nameOf = (uid) => { const m = DB.members.find((x) => x.user_id === uid); return m ? m.display_name || m.email : null; };
const balance = (b) => b.total_paise - b.paid_paise;
const withBal = (b) => ({ ...b, balance_paise: balance(b) });
const activeBeds = () => DB.beds.filter((b) => b.is_active);
const occupiedOn = (day, statuses = OCC_ST, beds = null) => DB.bookings.filter((b) => statuses.includes(b.status)
  && (!beds || beds.includes(b.bed_id)) && T(b.check_in_at) <= night(day) && night(day) < T(b.check_out_at)).length;
function audit(b, action, details = {}) { DB.audit.push({ booking_id: b.id, action, details, actor: ME, at: new Date().toISOString() }); }
const listeners = [];
function notify(title, body, bookingId) {
  const n = { id: uuid(), property_id: P, user_id: null, kind: 'info', title, body, booking_id: bookingId, read_at: null, created_at: new Date().toISOString() };
  DB.notifications.push(n);
  setTimeout(() => listeners.forEach((cb) => cb({ new: n })), 50);
}
function blocked(bedId, a, z) { return DB.blocks.some((k) => k.bed_id === bedId && overlaps(a, z, k.starts_at, k.ends_at)); }
function booked(bedId, a, z, exceptId) {
  return DB.bookings.some((b) => b.id !== exceptId && b.bed_id === bedId && LIVE_ST.includes(b.status) && overlaps(a, z, b.check_in_at, b.check_out_at));
}
const nightsFor = (a, z) => Math.max(1, daysBetween(ymd(a), ymd(z)));
function cleanPhone(p) {
  if (!p || !p.trim()) return null;
  const d = digits(p);
  if (p.trim().startsWith('+')) return '+' + d;
  if (d.length === 10) return '+91' + d;
  if (d.length === 12 && d.startsWith('91')) return '+' + d;
  return d;
}
function maskId(type, num) {
  if (!num || !String(num).trim()) return null;
  if (type === 'aadhaar') {
    const d = digits(num);
    if (d.length === 12 || d.length === 4) return 'XXXX XXXX ' + d.slice(-4);
    fail('Aadhaar number must have 12 digits.');
  }
  return String(num).trim().replace(/\s+/g, ' ').toUpperCase();
}
function checkDob(dob) {
  if (!dob) return;
  if (dob > ymd()) fail('Date of birth can’t be in the future.');
  if (dob < addDays(ymd(), -120 * 366)) fail('Please check the date of birth.');
}

// ---------------------------------------------------------------- the database functions
const RPC = {
  my_memberships: () => [{ property_id: P, property_name: DB.properties[0].name, role: 'owner', display_name: 'Hostel Owner' }],
  touch_presence: () => null,
  mark_notifications_read: () => { DB.notifications.forEach((n) => { n.read_at = n.read_at || new Date().toISOString(); }); return null; },

  dashboard_summary: () => {
    const today = ymd(); const t0 = dayStart(today); const t1 = t0 + DAY; const y0 = t0 - DAY; const now = Date.now();
    const inDay = (iso, a, z) => T(iso) >= a && T(iso) < z;
    const rev = (a, z) => DB.payments.filter((p) => inDay(p.received_at, a, z)).reduce((s, p) => s + net(p), 0);
    const dues = DB.bookings.filter((b) => balance(b) > 0 && ['checked_in', 'checked_out'].includes(b.status));
    const row = (b) => { const bed = bedOf(b.bed_id); return { id: b.id, guest: guestOf(DB, b).full_name, room: roomOf(bed.room_id).name, bed: bed.label,
      check_in_at: b.check_in_at, check_out_at: b.check_out_at, status: b.status, overdue: b.status === 'checked_in' && T(b.check_out_at) < now }; };
    return {
      today, beds_total: activeBeds().length,
      beds_occupied: occupiedOn(today, LIVE_ST), beds_occupied_yesterday: occupiedOn(addDays(today, -1)),
      checkins_today: DB.bookings.filter((b) => inDay(b.check_in_at, t0, t1) && LIVE_ST.includes(b.status)).length,
      checkins_pending: DB.bookings.filter((b) => inDay(b.check_in_at, t0, t1) && ['pending', 'confirmed'].includes(b.status)).length,
      checkouts_today: DB.bookings.filter((b) => inDay(b.check_out_at, t0, t1) && ['checked_in', 'checked_out'].includes(b.status)).length,
      checkouts_late: DB.bookings.filter((b) => b.status === 'checked_in' && T(b.check_out_at) < now).length,
      revenue_today: rev(t0, t1), revenue_yesterday: rev(y0, t0),
      dues_paise: dues.reduce((s, b) => s + balance(b), 0), dues_count: dues.length,
      series: Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i - 6); return { day: d, occupied: occupiedOn(d) }; }),
      arriving: DB.bookings.filter((b) => inDay(b.check_in_at, t0, t1) && LIVE_ST.includes(b.status)).sort((a, b) => T(a.check_in_at) - T(b.check_in_at)).slice(0, 8).map(row),
      departing: DB.bookings.filter((b) => (inDay(b.check_out_at, t0, t1) && ['checked_in', 'checked_out'].includes(b.status)) || (b.status === 'checked_in' && T(b.check_out_at) < t0))
        .sort((a, b) => T(a.check_out_at) - T(b.check_out_at)).slice(0, 8).map(row),
    };
  },

  occupancy_series: ({ p_from, p_to }) => {
    const out = []; const total = activeBeds().length;
    for (let d = p_from; d <= p_to; d = addDays(d, 1)) out.push({ day: d, occupied: occupiedOn(d), total });
    return out;
  },

  booking_status_counts: () => {
    const from = Date.now() - 30 * DAY; const c = { all: 0 };
    DB.bookings.filter((b) => T(b.check_out_at) >= from).forEach((b) => { c[b.status] = (c[b.status] || 0) + 1; c.all++; });
    return c;
  },

  list_bookings: ({ p_status, p_q, p_cursor_check_in, p_cursor_id, p_limit = 30 }) => {
    const q = (p_q || '').trim(); const dq = digits(q); const lq = q.toLowerCase(); const from = Date.now() - 30 * DAY;
    return DB.bookings.filter((b) => {
      const g = guestOf(DB, b);
      if (p_status && b.status !== p_status) return false;
      if (!q && T(b.check_out_at) < from) return false;
      if (q && !(b.code.toLowerCase() === lq || (dq && b.code === 'BK-' + dq) || g.full_name.toLowerCase().includes(lq)
        || (dq.length >= 4 && digits(g.phone).includes(dq)))) return false;
      return true;
    }).sort((a, b) => T(b.check_in_at) - T(a.check_in_at) || (b.id > a.id ? 1 : -1))
      .filter((b) => !p_cursor_check_in || T(b.check_in_at) < T(p_cursor_check_in) || (T(b.check_in_at) === T(p_cursor_check_in) && b.id < p_cursor_id))
      .slice(0, Math.min(p_limit, 100))
      .map((b) => { const g = guestOf(DB, b); const bed = bedOf(b.bed_id);
        return { id: b.id, code: b.code, guest_id: g.id, guest_name: g.full_name, guest_phone: g.phone, room_name: roomOf(bed.room_id).name, bed_label: bed.label,
          check_in_at: b.check_in_at, check_out_at: b.check_out_at, total_paise: b.total_paise, paid_paise: b.paid_paise, balance_paise: balance(b), status: b.status, source: b.source }; });
  },

  booking_detail: ({ p_booking }) => {
    const b = DB.bookings.find((x) => x.id === p_booking) || fail('Booking not found.');
    const g = guestOf(DB, b); const bed = bedOf(b.bed_id); const p = DB.properties[0];
    return {
      booking: withBal(b), guest: { ...g }, bed: { id: bed.id, label: bed.label, room: roomOf(bed.room_id).name },
      property: { id: p.id, name: p.name, upi_id: p.upi_id, timezone: p.timezone }, created_by: nameOf(b.created_by),
      payments: DB.payments.filter((x) => x.booking_id === b.id).sort((x, y) => T(x.received_at) - T(y.received_at)),
      activity: DB.audit.filter((a) => a.booking_id === b.id).sort((x, y) => T(x.at) - T(y.at)).map((a) => ({ ...a, by: nameOf(a.actor) })),
    };
  },

  bed_board: () => {
    const today = ymd(); const t0 = new Date(dayStart(today)).toISOString(); const t1 = new Date(dayStart(today) + DAY).toISOString(); const now = new Date().toISOString();
    return DB.rooms.slice().sort((a, b) => a.sort - b.sort).map((r) => ({ ...r,
      beds: DB.beds.filter((b) => b.room_id === r.id).sort((a, b) => a.sort - b.sort).map((bd) => {
        const block = DB.blocks.find((k) => k.bed_id === bd.id && T(k.starts_at) <= T(now) && T(now) < T(k.ends_at));
        const bk = DB.bookings.filter((b) => b.bed_id === bd.id && LIVE_ST.includes(b.status) && overlaps(b.check_in_at, b.check_out_at, t0, t1))
          .sort((a, b) => (b.status === 'checked_in') - (a.status === 'checked_in') || T(a.check_in_at) - T(b.check_in_at))[0];
        return { ...bd, block: block ? block.reason : null,
          booking: bk ? { id: bk.id, guest: guestOf(DB, bk).full_name, status: bk.status, check_out_at: bk.check_out_at } : null };
      }) }));
  },

  calendar_range: ({ p_from, p_days = 9 }) => {
    const a = new Date(dayStart(p_from)).toISOString(); const z = new Date(dayStart(addDays(p_from, p_days))).toISOString();
    const beds = activeBeds().map((b) => ({ b, r: roomOf(b.room_id) })).sort((x, y) => x.r.sort - y.r.sort || x.b.sort - y.b.sort);
    return {
      beds: beds.map(({ b, r }) => ({ id: b.id, label: b.label, room: r.name, room_id: r.id })),
      bookings: DB.bookings.filter((b) => OCC_ST.includes(b.status) && overlaps(b.check_in_at, b.check_out_at, a, z))
        .map((b) => ({ id: b.id, bed_id: b.bed_id, guest: guestOf(DB, b).full_name, status: b.status, balance_paise: balance(b), paid_paise: b.paid_paise,
          check_in_at: b.check_in_at, check_out_at: b.check_out_at })),
      blocks: DB.blocks.filter((k) => overlaps(k.starts_at, k.ends_at, a, z)),
    };
  },

  available_beds: ({ p_in, p_out }) => activeBeds().filter((b) => !booked(b.id, p_in, p_out) && !blocked(b.id, p_in, p_out))
    .map((b) => ({ b, r: roomOf(b.room_id) })).sort((x, y) => x.r.sort - y.r.sort || x.b.sort - y.b.sort)
    .map(({ b, r }) => ({ id: b.id, label: b.label, room_id: r.id, room_name: r.name, rate_paise: b.rate_paise })),

  set_bed_block: ({ p_bed, p_from, p_to, p_reason }) => {
    const bed = bedOf(p_bed) || fail('Bed not found.');
    if (!p_from || !p_to || T(p_to) <= T(p_from)) fail('End must be after start.');
    if (!p_reason || p_reason.trim().length < 2) fail('Add a short reason.');
    if (booked(p_bed, p_from, p_to)) fail(`${bed.label} has bookings in that period. Move them first.`);
    if (blocked(p_bed, p_from, p_to)) fail(`${bed.label} is already blocked for part of that period.`);
    const id = uuid(); DB.blocks.push({ id, property_id: P, bed_id: p_bed, starts_at: p_from, ends_at: p_to, reason: p_reason.trim() });
    return id;
  },

  create_booking: ({ p }) => {
    const a = p.check_in_at; const z = p.check_out_at; const status = p.status || 'pending'; const now = Date.now();
    if (!a || !z) fail('Check-in and check-out are required.');
    if (T(z) <= T(a)) fail('Check-out must be after check-in.');
    if (T(a) < now - 2 * DAY) fail('Check-in can’t be more than 2 days in the past.');
    if (status === 'checked_in' && ymd(a) > ymd()) fail('You can only check in a guest whose stay starts today.');
    const bed = bedOf(p.bed_id) || fail('Please choose a bed.');
    if (!bed.is_active) fail(`${bed.label} is not in use.`);
    if (blocked(bed.id, a, z)) fail(`${bed.label} is blocked for maintenance on those dates.`);
    if (booked(bed.id, a, z)) fail(`${bed.label} is already booked for part of those dates.`);
    let g;
    if (p.guest_id) g = DB.guests.find((x) => x.id === p.guest_id) || fail('Guest not found.');
    else {
      const G = p.guest || {};
      if (!G.full_name || G.full_name.trim().length < 2) fail('Guest name is required.');
      checkDob(G.dob);
      const phone = cleanPhone(G.phone);
      if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) fail('Please check the phone number.');
      if (G.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(G.email)) fail('Please check the email address.');
      g = { id: uuid(), property_id: P, full_name: G.full_name.trim(), phone, email: G.email ? G.email.trim().toLowerCase() : null, dob: G.dob || null,
        nationality: G.nationality || null, id_type: G.id_type || null, id_number: maskId(G.id_type, G.id_number), id_doc_path: G.id_doc_path || null,
        notes: null, tags: [], consent_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      DB.guests.push(g);
    }
    const n = nightsFor(a, z);
    const b = { id: uuid(), property_id: P, code: 'BK-' + DB.seq.bk++, guest_id: g.id, bed_id: bed.id, visitors: Number(p.visitors) || 1,
      check_in_at: a, check_out_at: z, nights: n, rate_paise: bed.rate_paise, total_paise: n * bed.rate_paise, paid_paise: 0, status,
      source: p.source || 'walk_in', note: p.note || null, send_confirmation: !!p.send_confirmation, self_checkin_token: uuid(), self_checkin_at: null,
      self_checkin_count: 0, arrived_at: status === 'checked_in' ? new Date().toISOString() : null, departed_at: null, cancelled_at: null,
      created_by: ME, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    DB.bookings.push(b);
    audit(b, 'created', { status, total_paise: b.total_paise });
    notify('New booking ' + b.code, g.full_name, b.id);
    if (p.payment && p.payment.amount_paise > 0) RPC.record_payment({ p_booking: b.id, p_amount_paise: p.payment.amount_paise, p_method: p.payment.method, p_reference: p.payment.reference, p_kind: 'payment' });
    return { id: b.id, code: b.code, nights: n, total_paise: b.total_paise, self_checkin_token: b.self_checkin_token };
  },

  update_booking: ({ p_booking, p }) => {
    const b = DB.bookings.find((x) => x.id === p_booking) || fail('Booking not found.');
    if (!LIVE_ST.includes(b.status)) fail(`This booking is ${b.status.replace('_', ' ')} and can’t be changed.`);
    const a = p.check_in_at || b.check_in_at; const z = p.check_out_at || b.check_out_at;
    if (b.status === 'checked_in' && T(a) !== T(b.check_in_at)) fail('Guest is already checked in; only the check-out can change.');
    if (T(z) <= T(a)) fail('Check-out must be after check-in.');
    const bed = bedOf(b.bed_id);
    if (blocked(bed.id, a, z)) fail(`${bed.label} is blocked for maintenance on those dates.`);
    if (booked(bed.id, a, z, b.id)) fail(`${bed.label} is already booked for part of those dates.`);
    const n = nightsFor(a, z);
    if (n * b.rate_paise < b.paid_paise) fail('New total is less than what’s already paid. Record a refund first.');
    const changed = T(a) !== T(b.check_in_at) || T(z) !== T(b.check_out_at);
    Object.assign(b, { check_in_at: a, check_out_at: z, nights: n, total_paise: n * b.rate_paise, updated_at: new Date().toISOString() });
    if ('note' in p) b.note = p.note ? p.note.trim() : null;
    if (changed) audit(b, 'changed', { check_in_at: a, check_out_at: z, total_paise: b.total_paise });
    return { id: b.id, total_paise: b.total_paise, nights: n };
  },

  booking_action: ({ p_booking, p_action, p_force }) => {
    const b = DB.bookings.find((x) => x.id === p_booking) || fail('Booking not found.');
    const from = b.status; const now = new Date().toISOString(); const today = ymd();
    if (p_action === 'confirm') { if (b.status !== 'pending') fail('Only pending bookings can be confirmed.'); b.status = 'confirmed'; }
    else if (p_action === 'check_in') {
      if (!['pending', 'confirmed'].includes(b.status)) fail('This booking can’t be checked in.');
      if (ymd(b.check_in_at) > today) fail(`Check-in is on ${new Date(b.check_in_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}. Change the dates to check in early.`);
      if (T(b.check_out_at) <= Date.now()) fail('This stay has already ended.');
      b.status = 'checked_in'; b.arrived_at = now;
    } else if (p_action === 'check_out') {
      if (b.status !== 'checked_in') fail('Only checked-in guests can be checked out.');
      if (balance(b) > 0 && !p_force) fail(`Balance of ${rupees(balance(b))} is still due. Record the payment first.`);
      b.status = 'checked_out'; b.departed_at = now; if (T(b.check_out_at) > Date.now()) b.check_out_at = now;
    } else if (p_action === 'cancel') {
      if (!['pending', 'confirmed'].includes(b.status)) fail('Only pending or confirmed bookings can be cancelled.');
      b.status = 'cancelled'; b.cancelled_at = now;
    } else if (p_action === 'no_show') {
      if (!['pending', 'confirmed'].includes(b.status)) fail('Only pending or confirmed bookings can be marked no-show.');
      if (ymd(b.check_in_at) > today) fail('The guest isn’t due yet.');
      b.status = 'no_show';
    } else fail('Unknown action.');
    b.updated_at = now;
    audit(b, 'status', { from, to: b.status });
    return { id: b.id, action: p_action };
  },

  record_payment: ({ p_booking, p_amount_paise, p_method, p_reference, p_kind = 'payment', p_note }) => {
    const b = DB.bookings.find((x) => x.id === p_booking) || fail('Booking not found.');
    const ref = p_reference ? String(p_reference).replace(/\s/g, '').toUpperCase() : null;
    if (!(p_amount_paise > 0)) fail('Enter an amount greater than zero.');
    if (!['upi', 'cash', 'card', 'bank'].includes(p_method)) fail('Choose a payment method.');
    if (p_kind === 'payment') {
      if (['cancelled', 'no_show'].includes(b.status)) fail(`Can’t take payment on a ${b.status.replace('_', '-')} booking.`);
      if (p_amount_paise > balance(b)) fail(`Amount is more than the balance due (${rupees(balance(b))}).`);
      if (p_method === 'upi' && !/^[0-9A-Z]{6,35}$/.test(ref || '')) fail('Enter the UPI transaction ID (UTR) from the guest’s payment screen.');
      if (p_method === 'upi' && DB.payments.some((x) => x.method === 'upi' && x.kind === 'payment' && x.reference === ref)) fail(`UPI transaction ${ref} was already recorded.`);
    } else if (p_amount_paise > b.paid_paise) fail('Refund is more than the amount paid.');
    const now = new Date().toISOString();
    const pay = { id: uuid(), property_id: P, booking_id: b.id, code: 'TXN-' + DB.seq.txn++, kind: p_kind, method: p_method, amount_paise: p_amount_paise,
      reference: ref, note: p_note || null, received_at: now, received_by: ME, created_at: now };
    DB.payments.push(pay);
    b.paid_paise += net(pay);
    audit(b, p_kind, { amount_paise: p_amount_paise, method: p_method, code: pay.code });
    return { id: pay.id, code: pay.code };
  },

  list_payments: ({ p_method, p_from, p_to, p_cursor_at, p_cursor_id, p_limit = 30 }) => {
    const a = p_from ? dayStart(p_from) : -Infinity; const z = p_to ? dayStart(addDays(p_to, 1)) : Infinity;
    return DB.payments.filter((x) => (!p_method || x.method === p_method) && T(x.received_at) >= a && T(x.received_at) < z)
      .sort((x, y) => T(y.received_at) - T(x.received_at) || (y.id > x.id ? 1 : -1))
      .filter((x) => !p_cursor_at || T(x.received_at) < T(p_cursor_at) || (T(x.received_at) === T(p_cursor_at) && x.id < p_cursor_id))
      .slice(0, Math.min(p_limit, 100))
      .map((x) => { const b = DB.bookings.find((y) => y.id === x.booking_id);
        return { ...x, booking_code: b.code, guest_name: guestOf(DB, b).full_name, booking_balance_paise: balance(b) }; });
  },

  payment_summary: ({ p_from, p_to }) => {
    const a = dayStart(p_from); const z = dayStart(addDays(p_to, 1)); const pa = a - (z - a);
    const sum = (f) => DB.payments.filter(f).reduce((s, p) => s + net(p), 0);
    const cur = (p) => T(p.received_at) >= a && T(p.received_at) < z;
    const dues = DB.bookings.filter((b) => balance(b) > 0 && ['checked_in', 'checked_out'].includes(b.status));
    return { revenue: sum(cur), previous: sum((p) => T(p.received_at) >= pa && T(p.received_at) < a),
      upi: sum((p) => cur(p) && p.method === 'upi'), cash: sum((p) => cur(p) && p.method === 'cash'),
      card: sum((p) => cur(p) && p.method === 'card'), bank: sum((p) => cur(p) && p.method === 'bank'),
      dues_paise: dues.reduce((s, b) => s + balance(b), 0), dues_count: dues.length };
  },

  guest_profile: ({ p_guest }) => {
    const g = DB.guests.find((x) => x.id === p_guest) || fail('Guest not found.');
    const bs = DB.bookings.filter((b) => b.guest_id === g.id).sort((a, b) => T(b.check_in_at) - T(a.check_in_at));
    const lastStay = bs.find((b) => ['checked_in', 'checked_out'].includes(b.status));
    const cur = bs.find((b) => b.status === 'checked_in');
    const bedInfo = (b) => { const bed = bedOf(b.bed_id); return { room: roomOf(bed.room_id).name, bed: bed.label }; };
    return { guest: { ...g }, visits: bs.filter((b) => ['confirmed', 'checked_in', 'checked_out'].includes(b.status)).length,
      spend_paise: bs.reduce((s, b) => s + b.paid_paise, 0),
      last_stay: lastStay ? { check_in_at: lastStay.check_in_at, check_out_at: lastStay.check_out_at } : null,
      current: cur ? { id: cur.id, ...bedInfo(cur), check_out_at: cur.check_out_at } : null,
      stays: bs.slice(0, 50).map((b) => ({ id: b.id, code: b.code, ...bedInfo(b), check_in_at: b.check_in_at, check_out_at: b.check_out_at, paid_paise: b.paid_paise, status: b.status })) };
  },

  search_guests: ({ p_q }) => {
    const q = (p_q || '').trim(); const d = digits(q);
    if (q.length < 3) return [];
    return DB.guests.filter((g) => (d.length >= 6 && digits(g.phone).includes(d)) || g.full_name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => T(b.created_at) - T(a.created_at)).slice(0, 8)
      .map((g) => ({ id: g.id, full_name: g.full_name, phone: g.phone, email: g.email, nationality: g.nationality,
        last_check_in: DB.bookings.filter((b) => b.guest_id === g.id).map((b) => b.check_in_at).sort().pop() || null }));
  },

  report_summary: ({ p_from, p_to }) => {
    const a = dayStart(p_from); const z = dayStart(addDays(p_to, 1)); const days = daysBetween(p_from, p_to) + 1;
    const beds = activeBeds().length;
    const pays = DB.payments.filter((p) => T(p.received_at) >= a && T(p.received_at) < z);
    const revenue = pays.reduce((s, p) => s + net(p), 0);
    let bedNights = 0; for (let d = p_from; d <= p_to; d = addDays(d, 1)) bedNights += occupiedOn(d);
    const inRange = DB.bookings.filter((b) => T(b.check_in_at) >= a && T(b.check_in_at) < z);
    const good = inRange.filter((b) => ['confirmed', 'checked_in', 'checked_out'].includes(b.status));
    const weekly = [];
    for (let d = p_from; d <= p_to; d = addDays(d, 7)) {
      const wa = dayStart(d); const wz = Math.min(dayStart(addDays(d, 7)), z);
      const w = pays.filter((p) => T(p.received_at) >= wa && T(p.received_at) < wz);
      weekly.push({ start: d, digital: w.filter((p) => p.method !== 'cash').reduce((s, p) => s + net(p), 0), cash: w.filter((p) => p.method === 'cash').reduce((s, p) => s + net(p), 0) });
    }
    const rooms = DB.rooms.slice().sort((x, y) => x.sort - y.sort).map((r) => {
      const ids = DB.beds.filter((b) => b.room_id === r.id && b.is_active).map((b) => b.id);
      let n = 0; for (let d = p_from; d <= p_to; d = addDays(d, 1)) n += occupiedOn(d, OCC_ST, ids);
      const rev = pays.filter((p) => ids.includes(DB.bookings.find((b) => b.id === p.booking_id).bed_id)).reduce((s, p) => s + net(p), 0);
      return { name: r.name, beds: ids.length, occupancy: ids.length * days ? Math.round((n / (ids.length * days)) * 1e4) / 1e4 : 0, revenue: rev };
    });
    const sources = {}; const nats = {};
    inRange.filter((b) => b.status !== 'cancelled').forEach((b) => {
      sources[b.source] = (sources[b.source] || 0) + 1;
      const nat = guestOf(DB, b).nationality || 'Unknown'; nats[nat] = (nats[nat] || 0) + 1;
    });
    return { revenue, days, beds, occupancy: beds * days ? Math.round((bedNights / (beds * days)) * 1e4) / 1e4 : 0,
      revpab: beds * days ? Math.round(revenue / (beds * days)) : 0,
      alos: good.length ? Math.round((good.reduce((s, b) => s + b.nights, 0) / good.length) * 10) / 10 : 0,
      weekly, rooms, sources,
      nationalities: Object.entries(nats).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([name, n]) => ({ name, n })) };
  },

  list_members: () => DB.members.map(({ user_id, display_name, email, role, last_seen_at }) => ({ user_id, display_name, email, role, last_seen_at }))
    .sort((a, b) => ['owner', 'manager', 'front_desk', 'accountant'].indexOf(a.role) - ['owner', 'manager', 'front_desk', 'accountant'].indexOf(b.role)),
  add_member: ({ p_email, p_role, p_name }) => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p_email || '')) fail('Enter a valid email.');
    const m = DB.members.find((x) => x.email === p_email.toLowerCase());
    if (m) { m.role = p_role; m.display_name = p_name || m.display_name; }
    else DB.members.push({ property_id: P, user_id: uuid(), role: p_role, display_name: p_name || null, email: p_email.toLowerCase(), last_seen_at: null });
    return null;
  },
  remove_member: ({ p_user }) => {
    const m = DB.members.find((x) => x.user_id === p_user);
    if (m?.role === 'owner' && DB.members.filter((x) => x.role === 'owner').length <= 1) fail('A property needs at least one owner.');
    DB.members = DB.members.filter((x) => x.user_id !== p_user);
    return null;
  },

  selfcheckin_get: ({ p_token }) => {
    const b = DB.bookings.find((x) => x.self_checkin_token === p_token && LIVE_ST.includes(x.status) && T(x.check_out_at) > Date.now())
      || fail('This check-in link is invalid or has expired. Please ask the front desk.');
    const bed = bedOf(b.bed_id);
    return { property_id: P, property: DB.properties[0].name, code: b.code, status: b.status, room: roomOf(bed.room_id).name, bed: bed.label,
      nights: b.nights, check_in_at: b.check_in_at, check_out_at: b.check_out_at, full_name: guestOf(DB, b).full_name, submitted: !!b.self_checkin_at };
  },
  selfcheckin_submit: ({ p_token, p }) => {
    const b = DB.bookings.find((x) => x.self_checkin_token === p_token && LIVE_ST.includes(x.status) && T(x.check_out_at) > Date.now())
      || fail('This check-in link is invalid or has expired. Please ask the front desk.');
    if (b.self_checkin_count >= 5) fail('Too many attempts. Please finish check-in at the front desk.');
    if (!p.consent) fail('Please confirm your details and accept the house rules.');
    if (!p.full_name) fail('Full name is required.');
    if (!p.dob) fail('Date of birth is required.');
    checkDob(p.dob);
    if (p.dob > addDays(ymd(), -18 * 365 - 4)) fail('Guests must be 18 or older to check in.');
    if (!p.id_type) fail('Choose a proof of identity.');
    const g = guestOf(DB, b);
    Object.assign(g, { full_name: p.full_name.trim(), dob: p.dob, phone: cleanPhone(p.phone) || g.phone, email: p.email || g.email,
      nationality: p.nationality || g.nationality, id_type: p.id_type, id_number: maskId(p.id_type, p.id_number) || g.id_number,
      id_doc_path: p.id_doc_path || g.id_doc_path, consent_at: new Date().toISOString() });
    b.self_checkin_at = new Date().toISOString(); b.self_checkin_count++;
    audit(b, 'self_checkin'); notify('Self check-in submitted', b.code, b.id);
    return { ok: true, code: b.code };
  },
  // ---- homepage leads (NammaStay admin) ----
  is_platform_admin: () => true,
  submit_lead: ({ p }) => {
    if (p.website) return { ok: true };
    if (!p.name || p.name.trim().length < 2) fail('Please enter your name.');
    if (!p.phone && !p.email) fail('Please enter a phone number or email so we can reach you.');
    DB.leads.push({ id: uuid(), name: p.name.trim(), phone: cleanPhone(p.phone), email: p.email || null, property_name: p.property_name || null,
      city: p.city || null, property_type: p.property_type || null, beds: Number(p.beds) || null, message: p.message || null, source: p.source || null,
      status: 'new', notes: null, contacted_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { ok: true };
  },
  lead_counts: () => {
    const c = { all: DB.leads.length, last_7_days: DB.leads.filter((l) => T(l.created_at) > Date.now() - 7 * DAY).length };
    DB.leads.forEach((l) => { c[l.status] = (c[l.status] || 0) + 1; });
    return c;
  },
  list_leads: ({ p_status, p_q, p_cursor_at, p_cursor_id, p_limit = 50 }) => {
    const q = (p_q || '').toLowerCase().trim(); const d = digits(q);
    return DB.leads.filter((l) => (!p_status || l.status === p_status)
      && (!q || [l.name, l.email, l.property_name, l.city].some((x) => (x || '').toLowerCase().includes(q)) || (d.length >= 4 && digits(l.phone).includes(d))))
      .sort((a, b) => T(b.created_at) - T(a.created_at) || (b.id > a.id ? 1 : -1))
      .filter((l) => !p_cursor_at || T(l.created_at) < T(p_cursor_at) || (T(l.created_at) === T(p_cursor_at) && l.id < p_cursor_id))
      .slice(0, Math.min(p_limit, 200)).map((l) => ({ ...l }));
  },
  update_lead: ({ p_id, p_status, p_notes }) => {
    const l = DB.leads.find((x) => x.id === p_id) || fail('Lead not found.');
    if (p_status) { if (p_status !== 'new' && !l.contacted_at) l.contacted_at = new Date().toISOString(); l.status = p_status; }
    if (p_notes !== null && p_notes !== undefined) l.notes = p_notes;
    l.updated_at = new Date().toISOString();
    return null;
  },
  demo_checkin_token: () => {
    const b = DB.bookings.filter((x) => ['pending', 'confirmed'].includes(x.status) && T(x.check_in_at) > Date.now() && !x.self_checkin_at)
      .sort((x, y) => T(x.check_in_at) - T(y.check_in_at))[0];
    return b ? b.self_checkin_token : null;
  },
};

// ---------------------------------------------------------------- table access (the few direct reads/writes pages make)
const TABLES = { properties: 'properties', rooms: 'rooms', beds: 'beds', guests: 'guests', notifications: 'notifications' };
function table(name) {
  const st = { filters: [], order: null, limit: null, op: 'select', payload: null, head: false, returning: false };
  const run = async (single) => {
    try {
      load();
      const rows = DB[TABLES[name]] || [];
      const hit = rows.filter((r) => st.filters.every((f) => f(r)));
      let data;
      if (st.op === 'insert') {
        const list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map((x) => ({ id: uuid(), created_at: new Date().toISOString(), ...x }));
        list.forEach((x) => {
          if (name === 'rooms' && rows.some((r) => r.name === x.name)) fail('A room with that name already exists.');
          if (name === 'beds' && rows.some((r) => r.room_id === x.room_id && r.label === x.label)) fail('A bed with that name already exists in this room.');
          if (name === 'beds') x.is_active = x.is_active ?? true;
        });
        rows.push(...list); data = list;
      } else if (st.op === 'update') {
        const v = st.payload;
        if (name === 'properties' && v.upi_id && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(v.upi_id)) fail('new row violates check constraint "properties_upi_id_check"');
        if (name === 'properties' && v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) fail('Please check the email address.');
        if (name === 'beds' && 'rate_paise' in v && !(v.rate_paise >= 0)) fail('Check the rates.');
        if ('name' in v && !String(v.name || '').trim()) fail('Name can’t be empty.');
        hit.forEach((r) => Object.assign(r, v)); data = hit;
      } else {
        data = hit.slice();
        if (st.order) { const [k, asc] = st.order; data.sort((x, y) => (x[k] > y[k] ? 1 : x[k] < y[k] ? -1 : 0) * (asc ? 1 : -1)); }
        if (st.limit) data = data.slice(0, st.limit);
      }
      if (st.op !== 'select') save();
      if (st.head) return { data: null, count: hit.length, error: null };
      if (single) return data.length ? { data: { ...data[0] }, error: null } : { data: null, error: { message: 'Not found.' } };
      return { data: data.map((x) => ({ ...x })), count: null, error: null };
    } catch (e) { return { data: null, error: { message: e.message } }; }
  };
  const api = {
    select(_cols, opts) { if (st.op === 'select') st.head = !!opts?.head; else st.returning = true; return api; },
    eq(k, v) { st.filters.push((r) => r[k] === v); return api; },
    is(k, v) { st.filters.push((r) => (r[k] ?? null) === v); return api; },
    order(k, o = {}) { st.order = [k, o.ascending !== false]; return api; },
    limit(n) { st.limit = n; return api; },
    insert(p) { st.op = 'insert'; st.payload = p; return api; },
    update(p) { st.op = 'update'; st.payload = p; return api; },
    single() { return run(true); },
    then(res, rej) { return run(false).then(res, rej); },
  };
  return api;
}

// ---------------------------------------------------------------- files (kept in memory for this tab)
const files = new Map();
function sampleIdCard(path) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" rx="24" fill="#FBF3DE"/>
    <rect x="24" y="24" width="592" height="352" rx="18" fill="#fff" stroke="#E7DFC7" stroke-width="2"/>
    <rect x="56" y="80" width="150" height="190" rx="10" fill="#F0EBDB"/><circle cx="131" cy="150" r="38" fill="#DAD2B6"/>
    <rect x="96" y="200" width="70" height="50" rx="30" fill="#DAD2B6"/>
    <text x="240" y="110" font-family="sans-serif" font-size="30" font-weight="700" fill="#0E1B3D">SAMPLE ID</text>
    <text x="240" y="150" font-family="sans-serif" font-size="18" fill="#6B7280">Demo mode placeholder</text>
    <rect x="240" y="190" width="300" height="14" rx="7" fill="#F0EBDB"/><rect x="240" y="220" width="240" height="14" rx="7" fill="#F0EBDB"/>
    <rect x="240" y="250" width="270" height="14" rx="7" fill="#F0EBDB"/>
    <text x="56" y="330" font-family="sans-serif" font-size="14" fill="#9AA3B5">${path.replace(/[<&>]/g, '')}</text></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

// ---------------------------------------------------------------- the client
export function createDemoClient() {
  load();
  const authListeners = [];
  const session = () => (localStorage.getItem(SESSION) ? { user: { id: ME, email: localStorage.getItem(SESSION) } } : null);
  const ok = (data) => ({ data, error: null });
  return {
    demo: true,
    reset: resetDemo,
    auth: {
      getSession: async () => ok({ session: session() }),
      signInWithPassword: async ({ email, password }) => {
        if (!email || !password) return { data: null, error: { message: 'Enter your email and password.' } };
        localStorage.setItem(SESSION, email);
        return ok({ session: session() });
      },
      signOut: async () => { localStorage.removeItem(SESSION); authListeners.forEach((cb) => cb('SIGNED_OUT', null)); return { error: null }; },
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
      onAuthStateChange: (cb) => { authListeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    },
    rpc: async (fn, args = {}) => {
      await new Promise((r) => setTimeout(r, 60));          // feel like a network call
      load();
      if (!RPC[fn]) return { data: null, error: { message: `Unknown function ${fn}` } };
      try { const data = RPC[fn](args); save(); return ok(data); }
      catch (e) { if (!(e instanceof DemoError)) console.error(e); return { data: null, error: { message: e.message } }; }
    },
    from: table,
    channel: () => { const ch = { on: (_e, _f, cb) => { listeners.push(cb); return ch; }, subscribe: () => ch }; return ch; },
    storage: {
      from: () => ({
        upload: async (path, file) => { files.set(path, file); return { data: { path }, error: null }; },
        createSignedUrl: async (path) => ok({ signedUrl: URL.createObjectURL(files.get(path) || sampleIdCard(path)) }),
      }),
    },
  };
}
