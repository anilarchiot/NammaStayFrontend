// Demo mode for the owner portal: an in-memory stand-in for Supabase.
// Opened with owner.html?demo=1. Nothing is read from or written to a real backend.
const iso = (offDays) => { const d = new Date(); d.setDate(d.getDate() + offDays); return d.toISOString().slice(0, 10); };
const ts = (offHours) => new Date(Date.now() + offHours * 36e5).toISOString();

const listing = {
  id: 'demo-listing', kind: 'hostel', title: 'Demo Backpackers Hostel', city: 'Chennai', area: 'Mylapore',
  review_status: 'approved', verified: true, subscriber: false, rating: { avg: 4.6, count: 12 },
  tour_photos: [], tour_url: '', whatsapp_url: '', instagram: '@demohostel',
  rooms: [
    { id: 'r1', name: '8-Bed Mixed Dorm', beds: 8, rate_paise: 80000, women_only: false },
    { id: 'r2', name: '6-Bed Female Dorm', beds: 6, rate_paise: 90000, women_only: true },
    { id: 'r3', name: 'Private Room', beds: 2, rate_paise: 220000, women_only: false }
  ]
};

const settings = { fee_pct: 9, launch_until: iso(120), yearly_plan_paise: 1200000 };

let requests = [
  { id: 'q1', status: 'new', type: 'stay', guest_name: 'Aarav Mehta', guest_phone: '9876543210', beds: 2, room: '8-Bed Mixed Dorm', check_in: iso(3), check_out: iso(5), amount_paise: 320000, women_only: false, reply_by: ts(20) },
  { id: 'q2', status: 'new', type: 'stay', guest_name: 'Isha Rao', guest_phone: '9845012345', beds: 1, room: '6-Bed Female Dorm', check_in: iso(6), check_out: iso(8), amount_paise: 180000, women_only: true, reply_by: ts(9) },
  { id: 'q3', status: 'accepted', type: 'stay', stay_status: 'pending', guest_name: 'Kiran Das', guest_phone: '9900011122', beds: 1, room: 'Private Room', check_in: iso(-2), check_out: iso(-1), amount_paise: 220000, reply_by: ts(-40) },
  { id: 'q4', status: 'accepted', type: 'stay', stay_status: 'stayed', guest_name: 'Meera Nair', guest_phone: '9811122233', beds: 2, room: '8-Bed Mixed Dorm', check_in: iso(-12), check_out: iso(-10), amount_paise: 320000, reply_by: ts(-300) },
  { id: 'q5', status: 'declined', type: 'stay', guest_name: 'Rahul Verma', guest_phone: '9822233344', beds: 3, room: '8-Bed Mixed Dorm', check_in: iso(-20), check_out: iso(-18), amount_paise: 480000, reply_by: ts(-500) }
];

const reviews = [
  { id: 'v1', name: 'Meera', city: 'Kochi', stars: 5, at: ts(-300), body: 'Clean dorms, friendly staff and a great common room.', reply: '' },
  { id: 'v2', name: 'Arjun', city: 'Pune', stars: 4, at: ts(-900), body: 'Good location. Water pressure could be better.', reply: 'Thanks Arjun, we have fixed it.' }
];

const bill = (month) => ({
  month, fee_pct: 9, launch_until: settings.launch_until, yearly_plan_paise: settings.yearly_plan_paise,
  subscriber: false, waived: true, status: 'waived', count: 3, no_shows: 1,
  value_paise: 860000, fee_paise: 0, would_be_fee_paise: 77400, due: month, utr: null, paid_at: null,
  stays: [
    { name: 'Meera Nair', nights: 2, amount_paise: 320000 },
    { name: 'Kiran Das', nights: 1, amount_paise: 220000 },
    { name: 'Sana Iqbal', nights: 3, amount_paise: 320000 }
  ]
});

const ok = (data) => Promise.resolve({ data, error: null });
const handlers = {
  mk2_public_settings: () => ok(settings),
  mk2_my_listings: () => ok([listing]),
  mk2_owner_requests: () => ok(requests),
  mk2_owner_reviews: () => ok(reviews),
  mk2_owner_bill: (a) => ok(bill(a.p_month)),
  mk2_respond: (a) => { requests = requests.map((r) => (r.id === a.p_request ? { ...r, status: a.p_accept ? 'accepted' : 'declined', stay_status: 'pending' } : r)); return ok(true); },
  mk2_mark_stay: (a) => { requests = requests.map((r) => (r.id === a.p_request ? { ...r, stay_status: a.p_stayed ? 'stayed' : 'no_show' } : r)); return ok(true); },
  mk2_owner_reply_review: (a) => { const r = reviews.find((x) => x.id === a.p_review); if (r) r.reply = a.p_reply; return ok(true); },
  mk2_owner_save: (a) => {
    listing.tour_url = a.p_tour_url || ''; listing.whatsapp_url = a.p_whatsapp || ''; listing.instagram = a.p_instagram || '';
    listing.rooms.forEach((r) => { r.women_only = !!a.p_women?.[r.id]; });
    return ok(true);
  },
  mk2_pay_utr: () => ok(true),
  mk2_create_listing: () => ok(listing.id)
};

const fail = () => Promise.resolve({ data: null, error: { message: 'Not available in demo mode.' } });
const user = { id: 'demo-user', email: 'demo@nammabookings.com' };

export const demoSb = {
  rpc: (name, args = {}) => (handlers[name] ? handlers[name](args) : fail()),
  auth: {
    getSession: () => ok({ session: { user } }),
    signOut: () => ok(null),
    signUp: fail, signInWithPassword: fail, resend: fail
  },
  storage: { from: () => ({ upload: fail, getPublicUrl: () => ({ data: { publicUrl: '' } }) }) }
};
