// Demo mode for Branches (043): the demo owner has 3 properties.
// The branch being viewed is the normal demo property (real demo bookings and money); the other branches show sample numbers.
// Switching branch re-opens the demo as that branch (its type's sample data). Kept in localStorage "ns.demo.branches".
const KEY = 'ns.demo.branches';
export const BRANCH_FUNCTIONS = ['my_memberships', 'branches_overview', 'branch_team', 'branch_access_set', 'branch_create'];

const SAMPLES = {
  hostel: [['Social Backpackers – Koramangala', 'hostel', 'Bengaluru', 12, true], ['Coorg Hills Homestay', 'homestay', 'Madikeri', 5]],
  hotel: [['Marina Residency – Airport Road', 'hotel', 'Chennai', 18, true], ['Ooty Tea Garden Homestay', 'homestay', 'Ooty', 4]],
  homestay: [['Green Leaf – Lake View', 'homestay', 'Kodaikanal', 4, true], ['Mysuru Backpackers', 'hostel', 'Mysuru', 10]],
  pg: [['Namma Co-Living – Whitefield', 'pg', 'Bengaluru', 24], ['Indiranagar Backpackers', 'hostel', 'Bengaluru', 12]],
};
const PEOPLE = [['Priya', 'priya@example.com', 'manager', [0, 1]], ['Arjun', 'arjun@example.com', 'front_desk', [1]], ['Meena', 'meena@example.com', 'accountant', [0, 1, 2]]];

const rnd = (seed) => { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; }; };
const beds = (x) => (x.DB.beds || []).filter((b) => b.is_active !== false).length;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const store = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full: demo still works */ } };

function state(x) {
  let s = load();
  const kind = x.demoKind();
  const act = s && s.list.find((b) => b.id === s.active);
  if (!s || !act || (act.mode !== kind && !s.switching)) {            // first visit, or the type was changed from the Demo menu
    const p0 = x.DB.properties[0];
    const main = { id: 'demo-br-main', name: p0.name, mode: kind, city: p0.city, phone: p0.phone, units: beds(x), created_at: '2025-04-01T00:00:00Z', plan: 'active' };
    const more = (SAMPLES[kind] || SAMPLES.hostel).map(([name, mode, city, units, busy], i) => ({ id: `demo-br-${i + 1}`, name, mode, city, units, busy: !!busy,
      phone: '+91 98450 1000' + i, created_at: `2026-0${i + 2}-01T00:00:00Z`, plan: 'active' }));
    const list = [main, ...more];
    s = { active: main.id, list,
      team: PEOPLE.map(([name, email, role, at], i) => ({ user_id: `demo-user-${i + 1}`, name, email, access: at.map((k) => ({ branch: list[k].id, role })) })) };
    store(s);
  }
  return s;
}

// Sample numbers for a branch that isn't the one being viewed (stable for the day)
function sample(b, x) {
  const today = x.ymd(); const r = rnd(b.id + today);
  const m0 = today.slice(0, 8) + '01'; const days = Number(today.slice(8, 10));
  if (!b.units) {
    return { tonight: 0, arriving: 0, arriving_unpaid: 0, leaving: 0, collected_today: 0, cash_today: 0, dues: 0,
      month: { from: m0, days, revenue: 0, expenses: 0, profit: 0, nights_sold: 0, occupancy: 0, bookings: 0, direct: 0 },
      nights: Array.from({ length: 14 }, (_, i) => ({ day: x.addDays(today, i), occupied: 0 })), alerts: {} };
  }
  const rate = { hostel: 65000, pg: 0, hotel: 280000, homestay: 390000, resort: 650000 }[b.mode] || 100000;
  const nights = Array.from({ length: 14 }, (_, i) => {
    const day = x.addDays(today, i); const dow = new Date(day + 'T12:00:00Z').getUTCDay();
    let occ = Math.round(b.units * (b.mode === 'pg' ? 0.9 : 0.5 + r() * 0.3 + (dow === 5 || dow === 6 ? 0.2 : 0)));
    if (b.busy && (i === 1 || i === 2)) occ = b.units;                                 // full on the next two nights: shows "full here, free there"
    return { day, occupied: Math.min(b.units, occ) };
  });
  const sold = Math.round(b.units * days * (b.mode === 'pg' ? 0.9 : 0.62 + r() * 0.15));
  const revenue = b.mode === 'pg' ? b.units * 850000 * 0.9 : sold * rate; const expenses = Math.round(revenue * (0.38 + r() * 0.12));
  const bookings = b.mode === 'pg' ? 3 : Math.round(sold / (b.mode === 'hostel' ? 2.4 : 1.8));
  const arriving = b.mode === 'pg' ? 0 : 1 + Math.floor(r() * Math.max(2, b.units / 3));
  const collected = b.mode === 'pg' ? 850000 : arriving * rate + Math.round(r() * 4) * rate;
  return { tonight: nights[0].occupied, arriving, arriving_unpaid: Math.floor(arriving / 3), leaving: Math.max(0, arriving - 1),
    collected_today: collected, cash_today: Math.round(collected * 0.3 / 100) * 100, dues: Math.round(r() * 4) * rate,
    month: { from: m0, days, revenue: Math.round(revenue), expenses, profit: Math.round(revenue) - expenses, nights_sold: sold,
      occupancy: Math.round((sold / (b.units * days)) * 10000) / 10000, bookings, direct: Math.round(bookings * 0.4) },
    nights, alerts: { to_clean: Math.floor(r() * 4), formc_due: b.mode === 'hostel' ? Math.floor(r() * 3) : 0, staff_todo: Math.floor(r() * 2) } };
}

// Real numbers for the branch being viewed, from the demo's own bookings
function real(x) {
  const R = x.RPC; const today = x.ymd(); const m0 = today.slice(0, 8) + '01'; const days = Number(today.slice(8, 10));
  const d = R.dashboard_summary(); const pr = R.profit_summary({ p_from: m0, p_to: today });
  const series = R.occupancy_series({ p_from: m0, p_to: today }); const sold = series.reduce((s, n) => s + n.occupied, 0);
  const units = d.beds_total; const T = (iso) => new Date(iso).getTime();
  const t0 = new Date(today + 'T00:00:00+05:30').getTime(); const t1 = t0 + 86400000;
  const inMonth = x.DB.bookings.filter((b) => T(b.check_in_at) >= new Date(m0 + 'T00:00:00+05:30').getTime() && T(b.check_in_at) < t1 && !['cancelled', 'no_show'].includes(b.status));
  const cash = (x.DB.payments || []).filter((p) => p.method === 'cash' && T(p.received_at) >= t0 && T(p.received_at) < t1)
    .reduce((s, p) => s + (p.kind === 'refund' ? -p.amount_paise : p.amount_paise), 0);
  const safe = (f) => { try { return f(); } catch { return 0; } };
  const hk = safe(() => R.hk_counts?.({}) || {});
  return { units, tonight: d.beds_occupied, arriving: d.checkins_today,
    arriving_unpaid: x.DB.bookings.filter((b) => T(b.check_in_at) >= t0 && T(b.check_in_at) < t1 && ['pending', 'confirmed'].includes(b.status) && (b.paid_paise || 0) < b.total_paise).length,
    leaving: d.checkouts_today, collected_today: d.revenue_today, cash_today: cash, dues: d.dues_paise,
    month: { from: m0, days, revenue: pr.revenue_paise, expenses: pr.expenses_paise, profit: pr.profit_paise, nights_sold: sold,
      occupancy: units ? Math.round((sold / (units * days)) * 10000) / 10000 : 0, bookings: inMonth.length, direct: inMonth.filter((b) => b.source !== 'ota').length },
    nights: R.occupancy_series({ p_from: today, p_to: x.addDays(today, 13) }).map((n) => ({ day: n.day, occupied: n.occupied })),
    alerts: { to_clean: (hk.dirty || 0) + (hk.cleaning || 0), formc_due: safe(() => R.formc_due_count?.({}) || 0), staff_todo: safe(() => R.staff_counts?.({}) || 0) } };
}

const pid = (s, b, x) => (b.id === s.active ? x.P : b.id);               // the branch being viewed is the demo property
const bid = (s, id, x) => (id === x.P ? s.active : id);

function plan(b, x) {
  const today = x.ymd();
  if (b.plan === 'trial') return { state: 'trial', ends_at: x.addDays(today, 9) + 'T12:00:00+05:30', days_left: 9 };
  if (b.plan === 'new') return { state: 'trial', ends_at: x.addDays(today, 15) + 'T12:00:00+05:30', days_left: 15 };
  return { state: 'active', ends_at: x.addDays(today, 84) + 'T12:00:00+05:30', days_left: 84 };
}

function team(s, x) {
  return s.team.filter((p) => p.access.length).map((p) => ({ user_id: p.user_id, name: p.name, email: p.email,
    access: p.access.map((a) => ({ property_id: pid(s, { id: a.branch }, x), role: a.role })) }));
}

export function branchDemo(fn, a, x) {
  const s = state(x);
  const owner = (x.DB.viewAs || 'owner') === 'owner';
  const needOwner = () => { if (!owner) x.fail('Only the owner can manage branches.'); };

  if (fn === 'my_memberships') {
    const saved = localStorage.getItem('ns.property');
    const pick = s.list.find((b) => b.id === saved && b.id !== s.active);
    if (pick) {                                                          // switching branch: re-open the demo as that branch
      const prev = s.list.find((b) => b.id === s.active); if (prev) { prev.units = beds(x); prev.busy = false; try { prev.plan = x.RPC.property_access().state === 'trial' ? 'trial' : 'active'; } catch { /* keep */ } }
      s.active = pick.id; s.switching = true; store(s);
      localStorage.setItem('ns.property', x.P);
      setTimeout(() => { x.setDemoKind(pick.mode === 'resort' ? 'hotel' : pick.mode); location.reload(); }, 0);
      return new Promise(() => {});                                      // the page reloads before using this
    }
    if (s.switching) { delete s.switching; store(s); }
    const act = s.list.find((b) => b.id === s.active);
    x.DB.properties[0].name = act.name; if (act.city) x.DB.properties[0].city = act.city;
    const base = x.base(a)[0] || {};
    const mine = owner ? s.list : [act];
    return [act, ...mine.filter((b) => b.id !== act.id)].map((b) => ({ property_id: pid(s, b, x), property_name: b.name, role: base.role || 'owner', display_name: base.display_name }));
  }
  needOwner();
  if (fn === 'branch_team') return team(s, x);
  if (fn === 'branches_overview') {
    const branches = s.list.map((b) => {
      const n = b.id === s.active ? real(x) : sample(b, x);
      let pl = plan(b, x);
      if (b.id === s.active) { try { const r = x.RPC.property_access(); pl = { state: r.state, ends_at: r.ends_at, days_left: r.days_left }; } catch { /* keep sample */ } }
      return { id: pid(s, b, x), name: b.name, kind: b.mode === 'pg' ? 'hostel' : b.mode, mode: b.mode, city: b.city, phone: b.phone, created_at: b.created_at,
        today: x.ymd(), setup_done: (n.units ?? b.units) > 0, plan: pl, units: n.units ?? b.units, booking_slug: null, ...n };
    });
    return { branches, team: team(s, x), features: { pg: true, resort: false, staff: !!x.RPC.staff_get, guide: true } };
  }
  if (fn === 'branch_access_set') {
    const p = s.team.find((t) => t.user_id === a.p_user); if (!p) x.fail('This person doesn’t work at any of your branches. Add them first in Settings → Users & roles.');
    const br = bid(s, a.p_property, x);
    if (!s.list.some((b) => b.id === br)) x.fail('You don’t have permission to do this.');
    p.access = p.access.filter((q) => q.branch !== br);
    if (a.p_role) {
      if (!['manager', 'front_desk', 'accountant'].includes(a.p_role)) x.fail('Choose manager, front desk or accountant.');
      p.access.push({ branch: br, role: a.p_role });
    }
    store(s);
    return a.p_role ? { role: a.p_role } : { removed: true };
  }
  if (fn === 'branch_create') {
    const p = a.p || {}; const name = String(p.name || '').trim();
    if (name.length < 2) x.fail('Enter the branch name.');
    if (s.list.some((b) => b.name.toLowerCase() === name.toLowerCase())) x.fail(`You already have a branch called "${name}". Use a different name, e.g. add the area.`);
    if (s.list.filter((b) => (b.id === s.active ? (() => { try { return x.RPC.property_access().state; } catch { return 'active'; } })() : plan(b, x).state) === 'trial').length >= 2) x.fail('Two of your branches are still on the free trial. Choose a plan for one of them in Settings → Billing, then add the next branch.');
    const src = p.copy_from ? s.list.find((b) => b.id === bid(s, p.copy_from, x)) : null;
    const copy = Array.isArray(p.copy) ? p.copy : [];
    if (src && copy.includes('rooms') && src.mode !== p.kind) x.fail('Rooms and prices can only be copied from a branch of the same type.');
    const srcUnits = src ? (src.id === s.active ? real(x).units : src.units) : 0;
    const b = { id: 'demo-br-' + x.uuid().slice(0, 8), name, mode: p.kind || 'hostel', city: p.city || '', phone: p.phone || src?.phone || '',
      units: src && copy.includes('rooms') ? srcUnits : 0, created_at: new Date().toISOString(), plan: 'new' };
    s.list.push(b);
    (p.team || []).forEach((u) => { const t = s.team.find((q) => q.user_id === u); if (t && t.access[0]) t.access.push({ branch: b.id, role: t.access[0].role }); });
    store(s);
    return { property_id: b.id, name, invoice_prefix: p.invoice_prefix || name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 6), rooms_copied: 0, team_added: (p.team || []).length };
  }
  return x.base ? x.base(a) : null;
}
