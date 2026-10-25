// nammaBookings marketplace API — the endpoint NammaStay Connect calls for the `nammastay` OTA.
// Callers authenticate with NammaStay's own API key (verify_jwt is off for this function in config.toml).
//
// Secrets: NAMMASTAY_API_KEY  the key (random, 24+ chars). Connect reads the same secret to call this API.
//          NAMMASTAY_API_URL  https://<project>.supabase.co/functions/v1/marketplace-api  (read by Connect)
//
//   POST /rooms         { hotel_id }                                      -> { rooms: [{ota_room_id, ota_rate_id, room_name, rate_name}] }
//   POST /availability  { hotel_id, rooms: [{ota_room_id, units?, rate_paise?}] } -> { ok, updated }
//   POST /reservations  { hotel_id }                                      -> { reservations: [{ref, guest, arrival, departure, amount, currency, status}] }
// hotel_id is the listing code shown in the host dashboard.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const expected = Deno.env.get('NAMMASTAY_API_KEY') ?? '';
  const given = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (expected.length < 24 || !safeEqual(given, expected)) return json({ error: 'Invalid API key' }, 401);

  const action = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  let body: { hotel_id?: string; rooms?: { ota_room_id?: string; units?: number; rate_paise?: number }[] };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.hotel_id || !/^[0-9a-f]{12}$/i.test(body.hotel_id)) return json({ error: 'hotel_id (listing code) required' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: listing } = await db.from('mk_listings').select('id').eq('code', body.hotel_id.toLowerCase()).maybeSingle();
  if (!listing) return json({ error: 'Unknown listing code' }, 404);

  if (action === 'rooms') {
    const { data } = await db.from('mk_rooms').select('id, name').eq('listing_id', listing.id).order('name');
    return json({ rooms: (data ?? []).map((r) => ({ ota_room_id: r.id, ota_rate_id: 'standard', room_name: r.name, rate_name: 'Standard' })) });
  }

  if (action === 'availability') {
    let updated = 0;
    for (const r of body.rooms ?? []) {
      if (!r.ota_room_id || !/^[0-9a-f-]{36}$/i.test(r.ota_room_id)) continue;
      const patch: Record<string, unknown> = { synced_at: new Date().toISOString() };
      if (Number.isInteger(r.units) && r.units! >= 0) patch.units = r.units;
      if (Number.isInteger(r.rate_paise) && r.rate_paise! > 0) patch.rate_paise = r.rate_paise;
      const { data } = await db.from('mk_rooms').update(patch).eq('id', r.ota_room_id).eq('listing_id', listing.id).select('id');
      updated += data?.length ?? 0;
    }
    return json({ ok: true, updated });
  }

  if (action === 'reservations') {
    const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const { data } = await db.from('mk_bookings')
      .select('ref, guest_name, check_in, check_out, amount_paise, status, created_at, updated_at')
      .eq('listing_id', listing.id).gte('check_out', since).order('created_at', { ascending: false }).limit(500);
    return json({
      reservations: (data ?? []).map((b) => ({
        ref: b.ref, guest: b.guest_name, arrival: b.check_in, departure: b.check_out, amount: b.amount_paise / 100, currency: 'INR',
        status: b.status === 'cancelled' ? 'cancelled' : 'new',
      })),
    });
  }

  return json({ error: 'Unknown endpoint' }, 404);
});
