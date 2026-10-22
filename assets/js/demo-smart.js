// Demo mode only — Smart pricing (041), mirrored in the browser with the same rules as the database.
// Prices change through "Smart pricing" price rules in the demo's own rate rules, so every demo page uses them.
export const SMART_FUNCTIONS = ['sp_get', 'sp_settings_save', 'sp_limits_save', 'sp_date_save', 'sp_date_delete', 'sp_apply', 'sp_skip',
  'sp_night_lock', 'sp_run_now', 'sp_pause', 'sp_undo'];

const ACTIVE = ['pending', 'confirmed', 'checked_in'];
const dowOf = (d) => new Date(d + 'T12:00:00Z').getUTCDay();
const diff = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
const key = (room, night) => room + '|' + night;
const r10 = (p) => Math.round(p / 1000) * 1000;

export function smartDemo(name, args, h) {
  const { DB, P, fail, uuid, ymd, addDays, nightRate } = h;
  const today = ymd();
  if (!DB.smart) DB.smart = seed(DB, today, addDays);
  const S = DB.smart; const p = args?.p;
  const groups = () => {
    const by = new Map();
    DB.beds.filter((b) => b.is_active !== false).forEach((b) => { const k = b.room_id + '|' + b.rate_paise; if (!by.has(k)) by.set(k, { room_id: b.room_id, rate_paise: b.rate_paise, beds: [] }); by.get(k).beds.push(b); });
    const list = [...by.values()].map((g) => {
      const room = DB.rooms.find((r) => r.id === g.room_id) || { name: 'Room', sort: 0 };
      const multi = [...by.values()].filter((x) => x.room_id === g.room_id).length > 1;
      const pos = new Set(g.beds.map((b) => b.position)); const one = pos.size === 1 ? [...pos][0] : null;
      const lim = S.limits.find((l) => l.room_id === g.room_id && l.rate_paise === g.rate_paise);
      return { room_id: g.room_id, room: room.name, rate_paise: g.rate_paise, beds: g.beds.length, rsort: room.sort || 0,
        label: room.name + (multi ? ' · ' + (one ? one[0].toUpperCase() + one.slice(1) : '₹' + g.rate_paise / 100) : ''),
        min_paise: lim ? lim.min_paise : r10(g.rate_paise * 0.85), max_paise: lim ? lim.max_paise : r10(g.rate_paise * 1.5), custom: !!lim };
    });
    return list.sort((a, b) => a.rsort - b.rsort || a.room.localeCompare(b.room) || b.rate_paise - a.rate_paise);
  };
  const smartIds = () => new Set(S.rules);
  const rebuild = () => {
    const ids = smartIds(); DB.rateRules = (DB.rateRules || []).filter((r) => !ids.has(r.id)); S.rules = [];
    const rows = Object.values(S.nights).filter((n) => n.night >= today && n.auto_pct !== 0 && !n.locked && !n.owner_rule && DB.rooms.some((r) => r.id === n.room_id))
      .map((n) => ({ ...n, adj: n.owner_pct === 0 ? 'amount' : 'percent', val: n.owner_pct === 0 ? (n.auto_amt || 0) : Math.round((100 + n.owner_pct) * (100 + n.auto_pct) / 100 - 100) }))
      .filter((n) => n.val !== 0).sort((a, b) => (a.room_id + a.night < b.room_id + b.night ? -1 : 1));
    let run = null; const flush = () => { if (!run) return; const id = uuid();
      DB.rateRules.push({ id, property_id: P, name: 'Smart pricing', kind: 'season', weekdays: null, date_from: run.d0, date_to: run.d1, adjust: run.adj, value: run.val,
        room_ids: [run.room_id], min_nights: null, priority: -1, is_active: true, created_at: new Date().toISOString() }); S.rules.push(id); run = null; };
    rows.forEach((n) => { if (run && run.room_id === n.room_id && run.adj === n.adj && run.val === n.val && addDays(run.d1, 1) === n.night) run.d1 = n.night; else { flush(); run = { room_id: n.room_id, adj: n.adj, val: n.val, d0: n.night, d1: n.night }; } });
    flush();
  };
  const ownerRule = (room, night) => {
    const ids = smartIds(); const dow = dowOf(night);
    return (DB.rateRules || []).filter((r) => r.is_active && !ids.has(r.id) && (!r.room_ids || r.room_ids.includes(room))
      && ((r.kind === 'weekend' && (r.weekdays || []).includes(dow)) || (r.kind === 'season' && night >= r.date_from && night <= r.date_to && (!r.weekdays || r.weekdays.includes(dow)))))
      .sort((a, b) => (b.kind === 'season') - (a.kind === 'season') || (b.priority || 0) - (a.priority || 0) || (a.created_at < b.created_at ? 1 : -1))[0];
  };
  const covers = (b, night) => ymd(b.check_in_at) <= night && ymd(b.check_out_at) > night;

  function run(by) {
    const st = S.settings;
    if (st.mode === 'off' || DB.pgMode) return { ran: false };
    if (st.paused_until && st.paused_until >= today) return { ran: false, paused: true };
    const beds = DB.beds.filter((b) => b.is_active !== false); const nBeds = beds.length;
    const U = (DB.properties && DB.properties[0] && DB.properties[0].kind === 'hostel') ? 'beds' : 'rooms';   // hotels, homestays, resorts sell rooms
    const past = DB.bookings.filter((b) => !['cancelled', 'no_show'].includes(b.status));
    let hist = 0; const usual = [1, 3, 7, 14, 30].map(() => 0);
    for (let k = 1; k <= 56; k++) { const hd = addDays(today, -k);
      past.forEach((b) => { if (!covers(b, hd)) return; hist++; [1, 3, 7, 14, 30].forEach((bk, i) => { if (ymd(b.created_at || b.check_in_at) <= addDays(hd, -bk)) usual[i]++; }); }); }
    const usualPct = usual.map((u) => u / Math.max(56 * nBeds, 1));
    const G = groups(); let up = 0; let down = 0; let sug = 0; const undo = [];
    for (const room of [...new Set(G.map((g) => g.room_id))]) {
      const rbeds = beds.filter((b) => b.room_id === room); const rg = G.filter((g) => g.room_id === room);
      for (let i = 0; i < 60; i++) {
        const night = addDays(today, i); const k = key(room, night); const cur = S.nights[k];
        if (cur && cur.locked) continue;
        const vCur = cur ? cur.auto_pct : 0;
        const blocked = new Set((DB.blocks || []).filter((x) => rbeds.some((b) => b.id === x.bed_id) && ymd(x.starts_at) <= night && (ymd(x.ends_at) > night || ymd(x.starts_at) === night)).map((x) => x.bed_id)).size;
        const cap = rbeds.length - blocked;
        const booked = new Set(DB.bookings.filter((b) => ACTIVE.includes(b.status) && rbeds.some((x) => x.id === b.bed_id) && covers(b, night)).map((b) => b.bed_id)).size;
        const o = ownerRule(room, night); const own = !!o && (o.kind === 'season' || o.adjust !== 'percent'); const opct = o && !own ? o.value : 0;
        const occ = cap > 0 ? booked / cap : 1; const L = i; const wk = [5, 6].includes(dowOf(night));
        const fest = S.dates.filter((d) => night >= d.date_from && night <= d.date_to).map((d) => d.name).join(', ') || null;
        const pace = hist >= 30 ? occ / Math.max(usualPct[L >= 30 ? 4 : L >= 14 ? 3 : L >= 7 ? 2 : L >= 3 ? 1 : 0], 0.05) : null;
        let t = 0; let why = null; const bk = `${booked} of ${cap} ${U} booked`;
        if (cap <= 0) why = `No ${U} to sell`;
        else if (own) why = 'Your own seasonal price';
        else {
          if (occ >= 0.85) { t = 10; why = 'Nearly full — ' + bk; } else if (occ >= 0.7) { t = 5; why = 'Filling well — ' + bk; }
          if (pace != null && L >= 3 && pace >= 1.5 && occ >= 0.4) { t += 5; why = (why ? why + ', ' : bk + ', ') + 'going faster than usual'; }
          if (fest && L >= 1) { t = Math.max(t, 10) + (occ >= 0.7 ? 5 : 0); why = fest + (why ? ' · ' + why : ''); }
          else if (occ < 0.5 && !(wk && st.no_weekend_discount)) {
            if (L <= 2) { t = -10; why = `Only ${bk}, ${L === 0 ? 'tonight' : L === 1 ? 'tomorrow' : 'in 2 days'}`; }
            else if (L <= 6 && occ < 0.35) { t = -5; why = `Only ${bk}, ${L} days away`; }
            else if (pace != null && pace <= 0.5 && L <= 14 && occ < 0.35) { t = -5; why = 'Filling slower than usual — ' + bk; }
          }
          if (t !== 0) {
            const lo = Math.max(...rg.map((g) => (g.min_paise * 10000) / (g.rate_paise * (100 + opct)) - 100));
            const hi = Math.min(...rg.map((g) => (g.max_paise * 10000) / (g.rate_paise * (100 + opct)) - 100));
            t = t > 0 ? Math.max(0, Math.min(t, Math.floor(hi))) : Math.min(0, Math.max(t, Math.ceil(lo)));
          }
          if (booked >= cap) { t = vCur; why = `Full — no ${U} left to sell`; }
        }
        let vNew = own || cap <= 0 ? 0 : vCur + Math.max(-st.max_step_pct, Math.min(st.max_step_pct, t - vCur)); let amt = null;
        if (opct === 0 && vNew !== 0) {
          const rep = Math.max(...rg.map((g) => g.rate_paise)); const alo = Math.max(...rg.map((g) => g.min_paise - g.rate_paise)); const ahi = Math.min(...rg.map((g) => g.max_paise - g.rate_paise));
          amt = Math.max(alo, Math.min(ahi, r10(rep * vNew / 100)));
          if (amt === 0) { vNew = 0; amt = null; }
        }
        const row = S.nights[k] || (S.nights[k] = { room_id: room, night, auto_pct: 0, auto_amt: null, suggest_pct: null, suggest_amt: null, skip_pct: null, locked: false, applied_at: null });
        Object.assign(row, { owner_pct: opct, owner_rule: own, booked, cap, reason: why });
        if (st.mode === 'auto' || own) {
          if (vNew !== vCur || (vNew !== 0 && amt !== row.auto_amt)) {
            undo.push({ room, night, pct: vCur, amt: row.auto_amt }); Object.assign(row, { auto_pct: vNew, auto_amt: amt, applied_at: new Date().toISOString(), suggest_pct: null, suggest_amt: null });
            if (vNew > vCur) up++; else if (vNew < vCur) down++;
          } else Object.assign(row, { suggest_pct: null, suggest_amt: null });
        } else if (vNew !== vCur && vNew !== row.skip_pct) { Object.assign(row, { suggest_pct: vNew, suggest_amt: amt }); sug++; }
        else Object.assign(row, { suggest_pct: null, suggest_amt: null });
      }
    }
    Object.values(S.nights).forEach((n) => { if (n.night < today) { n.suggest_pct = null; n.suggest_amt = null; } });
    rebuild(); st.last_run_at = new Date().toISOString();
    if (up + down > 0 || sug > 0) S.runs.unshift({ id: uuid(), ran_at: st.last_run_at, kind: st.mode === 'auto' ? 'auto' : 'suggest', up, down, suggested: sug, undo, undone_at: null });
    return { ran: true, up, down, suggested: sug };
  }

  const pick = (list) => Object.values(S.nights).filter((n) => n.suggest_pct != null && n.night >= today && (!Array.isArray(list) || list.some((x) => x.room_id === n.room_id && x.night === n.night)));
  const roomName = (id) => (DB.rooms.find((r) => r.id === id) || {}).name || 'Room';
  switch (name) {
    case 'sp_get': {
      if (DB.pgMode) return { is_pg: true };
      const st = S.settings;
      if (st.mode !== 'off' && (!st.last_run_at || Date.now() - new Date(st.last_run_at).getTime() > 20 * 3600e3)) run(null);
      const G = groups(); const days = Array.from({ length: 60 }, (_, i) => addDays(today, i));
      const act = DB.beds.filter((b) => b.is_active !== false);
      const nights = days.map((d) => {
        const cap = act.filter((b) => !(DB.blocks || []).some((x) => x.bed_id === b.id && ymd(x.starts_at) <= d && (ymd(x.ends_at) > d || ymd(x.starts_at) === d))).length;
        const booked = new Set(DB.bookings.filter((b) => ACTIVE.includes(b.status) && act.some((x) => x.id === b.bed_id) && covers(b, d)).map((b) => b.bed_id)).size;
        return { night: d, weekend: [5, 6].includes(dowOf(d)), booked, cap,
          festival: S.dates.filter((x) => d >= x.date_from && d <= x.date_to).map((x) => x.name).join(', ') || null }; });
      const prices = G.map((g) => ({ room_id: g.room_id, rate_paise: g.rate_paise, label: g.label, cells: days.map((d) => { const n = S.nights[key(g.room_id, d)] || {};
        return { night: d, price_paise: nightRate({ room_id: g.room_id }, g.rate_paise, d), auto_pct: n.auto_pct || 0, locked: !!n.locked, owner_rule: !!n.owner_rule, suggest: n.suggest_pct != null }; }) }));
      const suggestions = Object.values(S.nights).filter((n) => n.suggest_pct != null && n.night >= today).map((n) => {
        const rep = Math.max(...G.filter((g) => g.room_id === n.room_id).map((g) => g.rate_paise));
        return { room_id: n.room_id, room: roomName(n.room_id), night: n.night, pct: n.suggest_pct, reason: n.reason, rate_paise: rep,
          from_paise: nightRate({ room_id: n.room_id }, rep, n.night), to_paise: n.owner_pct === 0 ? rep + (n.suggest_amt || 0) : Math.round(rep * (100 + n.owner_pct) * (100 + n.suggest_pct) / 10000) };
      }).filter((x) => Number.isFinite(x.rate_paise)).sort((a, b) => (a.night < b.night ? -1 : a.night > b.night ? 1 : 0));
      let extra = 0; let upN = 0; let downN = 0;
      DB.bookings.filter((b) => !['cancelled', 'no_show'].includes(b.status) && b.created_at && Date.now() - new Date(b.created_at).getTime() < 30 * 864e5).forEach((b) => {
        const bed = DB.beds.find((x) => x.id === b.bed_id); if (!bed) return;
        for (let d = ymd(b.check_in_at); d < ymd(b.check_out_at); d = addDays(d, 1)) {
          const n = S.nights[key(bed.room_id, d)]; if (!n || !n.auto_pct || !n.applied_at || n.applied_at > b.created_at) continue;
          if (n.auto_pct > 0) { upN++; extra += n.owner_pct === 0 ? (n.auto_amt || 0) : Math.round(bed.rate_paise * (100 + n.owner_pct) / 100 * n.auto_pct / 100); } else downN++;
        }
      });
      const fut = Object.values(S.nights).filter((n) => n.night >= today && !n.locked && !n.owner_rule);
      return { is_pg: false, today,
        settings: { mode: st.mode, max_step_pct: st.max_step_pct, no_weekend_discount: st.no_weekend_discount, paused_until: st.paused_until && st.paused_until >= today ? st.paused_until : null, last_run_at: st.last_run_at },
        groups: G, nights, prices, suggestions,
        stats: { extra_30_paise: extra, up_nights_30: upN, discount_nights_30: downN, up_now: new Set(fut.filter((n) => n.auto_pct > 0).map((n) => n.night)).size, down_now: new Set(fut.filter((n) => n.auto_pct < 0).map((n) => n.night)).size },
        runs: S.runs.slice(0, 8).map((r) => ({ id: r.id, ran_at: r.ran_at, kind: r.kind, up: r.up, down: r.down, suggested: r.suggested, undone: !!r.undone_at,
          can_undo: !r.undone_at && r.undo.length > 0 && Date.now() - new Date(r.ran_at).getTime() < 7 * 864e5 })),
        dates: S.dates.filter((d) => d.date_to >= today).sort((a, b) => (a.date_from < b.date_from ? -1 : 1)) };
    }
    case 'sp_settings_save': {
      if (DB.pgMode) fail('Smart pricing is for nightly stays, not monthly PG tenants.');
      const mode = p.mode || 'off'; const step = p.max_step_pct == null ? 10 : Number(p.max_step_pct);
      if (!['off', 'suggest', 'auto'].includes(mode)) fail('Choose Suggest only, Automatic or Off.');
      if (![5, 10, 15, 20].includes(step)) fail('Biggest change in one day: 5, 10, 15 or 20%.');
      const old = S.settings.mode;
      Object.assign(S.settings, { mode, max_step_pct: step, no_weekend_discount: p.no_weekend_discount == null ? S.settings.no_weekend_discount : !!p.no_weekend_discount, paused_until: mode === 'off' ? null : S.settings.paused_until });
      if (mode === 'off' && old !== 'off') {
        const undo = []; Object.values(S.nights).forEach((n) => { if (n.night >= today && n.auto_pct !== 0) undo.push({ room: n.room_id, night: n.night, pct: n.auto_pct, amt: n.auto_amt });
          if (n.night >= today) Object.assign(n, { auto_pct: 0, auto_amt: null, suggest_pct: null, suggest_amt: null }); });
        rebuild(); S.runs.unshift({ id: uuid(), ran_at: new Date().toISOString(), kind: 'off', up: 0, down: 0, suggested: 0, undo, undone_at: null });
        return { ran: false };
      }
      if (mode !== 'off') { if (mode === 'auto' && old === 'suggest') Object.values(S.nights).forEach((n) => { n.suggest_pct = null; n.suggest_amt = null; }); return run('me'); }
      return { ran: false };
    }
    case 'sp_limits_save': {
      const G = groups();
      (p || []).forEach((x) => {
        const g = G.find((y) => y.room_id === x.room_id && y.rate_paise === x.rate_paise) || fail('That bed type no longer exists — reload the page.');
        if (!(x.min_paise > 0) || !(x.max_paise > 0)) fail(`Enter the lowest and highest price for ${g.label}.`);
        if (x.min_paise > g.rate_paise) fail(`${g.label}: the lowest price can’t be above the normal price (₹${g.rate_paise / 100}).`);
        if (x.max_paise < g.rate_paise) fail(`${g.label}: the highest price can’t be below the normal price (₹${g.rate_paise / 100}).`);
        if (x.min_paise < g.rate_paise * 0.5) fail(`${g.label}: the lowest price can be at most 50% below normal.`);
        if (x.max_paise > g.rate_paise * 3) fail(`${g.label}: the highest price can be at most 3 times normal.`);
        const ex = S.limits.find((l) => l.room_id === x.room_id && l.rate_paise === x.rate_paise);
        if (ex) Object.assign(ex, { min_paise: x.min_paise, max_paise: x.max_paise }); else S.limits.push({ room_id: x.room_id, rate_paise: x.rate_paise, min_paise: x.min_paise, max_paise: x.max_paise });
      });
      return null;
    }
    case 'sp_date_save': {
      const nm = String(p.name || '').trim(); const from = p.date_from; const to = p.date_to || p.date_from;
      if (nm.length < 2) fail('Name the festival or event, e.g. "Diwali".'); if (!from) fail('Pick the first night.');
      if (to < from) fail('The last night is before the first night.'); if (diff(from, to) > 30) fail('Keep it to 31 nights or fewer.');
      const id = uuid(); S.dates.push({ id, name: nm, date_from: from, date_to: to }); return id;
    }
    case 'sp_date_delete': S.dates = S.dates.filter((d) => d.id !== args.p_id); return null;
    case 'sp_apply': {
      const list = pick(p); if (!list.length) fail('Nothing to apply — the suggestions may have changed. Reload the page.');
      const undo = list.map((n) => ({ room: n.room_id, night: n.night, pct: n.auto_pct, amt: n.auto_amt }));
      const up = list.filter((n) => n.suggest_pct > n.auto_pct).length; const down = list.length - up;
      list.forEach((n) => Object.assign(n, { auto_pct: n.suggest_pct, auto_amt: n.suggest_amt, suggest_pct: null, suggest_amt: null, skip_pct: null, applied_at: new Date().toISOString() }));
      rebuild(); S.runs.unshift({ id: uuid(), ran_at: new Date().toISOString(), kind: 'applied', up, down, suggested: 0, undo, undone_at: null });
      return list.length;
    }
    case 'sp_skip': { const list = pick(p); list.forEach((n) => Object.assign(n, { skip_pct: n.suggest_pct, suggest_pct: null, suggest_amt: null })); return list.length; }
    case 'sp_night_lock': {
      if (args.p_night < today) fail('That night has passed.');
      const k = key(args.p_room, args.p_night);
      const n = S.nights[k] || (S.nights[k] = { room_id: args.p_room, night: args.p_night, auto_pct: 0, auto_amt: null, owner_pct: 0, owner_rule: false, suggest_pct: null, suggest_amt: null, skip_pct: null });
      n.locked = !!args.p_locked; if (n.locked) Object.assign(n, { auto_pct: 0, auto_amt: null }); Object.assign(n, { suggest_pct: null, suggest_amt: null });
      rebuild(); S.runs.unshift({ id: uuid(), ran_at: new Date().toISOString(), kind: 'pinned', up: 0, down: 0, suggested: 0, undo: [], undone_at: null });
      return null;
    }
    case 'sp_run_now': return run('me');
    case 'sp_pause': {
      const d = Number(args.p_days); if (!(d >= 0 && d <= 60)) fail('Pause for 0 to 60 days.');
      S.settings.paused_until = d === 0 ? null : addDays(today, d - 1); return S.settings.paused_until;
    }
    case 'sp_undo': {
      const r = S.runs.find((x) => x.id === args.p_run) || fail('Change not found.'); if (r.undone_at) fail('Already undone.');
      let n = 0; r.undo.forEach((e) => { const row = S.nights[key(e.room, e.night)]; if (e.night >= today && row && !row.locked) { Object.assign(row, { auto_pct: e.pct, auto_amt: e.amt, skip_pct: row.suggest_pct ?? row.skip_pct, suggest_pct: null, suggest_amt: null, applied_at: new Date().toISOString() }); n++; } });
      if (r.kind === 'off') S.settings.mode = (S.runs.find((x) => ['auto', 'suggest'].includes(x.kind)) || { kind: 'suggest' }).kind;
      r.undone_at = new Date().toISOString(); rebuild();
      S.runs.unshift({ id: uuid(), ran_at: new Date().toISOString(), kind: 'undo', up: 0, down: 0, suggested: 0, undo: [], undone_at: null });
      return n;
    }
    default: return fail(`Unknown function ${name}`);
  }
}

// Sample history so the demo shows what a month of Smart pricing looks like
function seed(DB, today, addDays) {
  const nights = {}; const rooms = [...new Set((DB.beds || []).map((b) => b.room_id))];
  const long = new Date(Date.now() - 40 * 864e5).toISOString();
  for (let i = 1; i <= 28; i++) {
    const d = addDays(today, -i); const dow = dowOf(d);
    rooms.forEach((room) => {
      if (dow === 5 || dow === 6) nights[key(room, d)] = { room_id: room, night: d, auto_pct: 10, auto_amt: null, owner_pct: 15, owner_rule: false, locked: false, suggest_pct: null, suggest_amt: null, skip_pct: null, applied_at: long, booked: 0, cap: 0, reason: 'Nearly full' };
      else if (dow === 2 && room === rooms[rooms.length - 1]) nights[key(room, d)] = { room_id: room, night: d, auto_pct: -5, auto_amt: -4000, owner_pct: 0, owner_rule: false, locked: false, suggest_pct: null, suggest_amt: null, skip_pct: null, applied_at: long, booked: 0, cap: 0, reason: 'Quiet night' };
    });
  }
  const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();
  return {
    settings: { mode: 'suggest', max_step_pct: 10, no_weekend_discount: true, paused_until: null, last_run_at: null },
    limits: [], rules: [], nights,
    dates: [{ id: 'd1', name: 'Local festival', date_from: addDays(today, 22), date_to: addDays(today, 23) }, { id: 'd2', name: 'Christmas', date_from: `${today.slice(0, 4)}-12-24`, date_to: `${today.slice(0, 4)}-12-25` },
      { id: 'd3', name: 'New Year’s Eve', date_from: `${today.slice(0, 4)}-12-31`, date_to: `${today.slice(0, 4)}-12-31` }],
    runs: [{ id: 'r1', ran_at: ago(1), kind: 'applied', up: 2, down: 1, suggested: 0, undo: [], undone_at: null }, { id: 'r2', ran_at: ago(1.05), kind: 'suggest', up: 0, down: 0, suggested: 3, undo: [], undone_at: null }],
  };
}
