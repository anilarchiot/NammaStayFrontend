// NammaStay Connect edge function. Actions (POST JSON, signed-in owner/manager/admin):
//   { action: 'rooms', connection_id }            fetch the OTA's rooms/rates into cn_ota_rooms
//   { action: 'sync', connection_id, full? }      push availability/rates, pull reservations into cn_reservations
// Booking.com and Airbnb are not handled here — they go through Beds24.
//
// Each OTA is reached through a partner endpoint saved as Supabase secrets, once the OTA has approved NammaStay:
//   <OTA>_API_URL  e.g. MMT_API_URL, AGODA_API_URL, EXPEDIA_API_URL, HOSTELWORLD_API_URL
//   <OTA>_API_KEY
// The endpoint must accept JSON: POST {url}/rooms, POST {url}/availability, POST {url}/reservations (see adapter below).
// The `test` OTA is a built-in simulator and needs no secrets.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const BLOCKED = new Set(['booking', 'airbnb', 'beds24']);

type Conn = { id: string; property_id: string; ota: string; ota_hotel_id: string; status: string; fails: number };
type Res = { ref: string; guest?: string; arrival?: string; departure?: string; amount?: number; currency?: string; status?: string };

async function partner(ota: string, path: string, body: unknown) {
  const base = Deno.env.get(`${ota.toUpperCase()}_API_URL`);
  const key = Deno.env.get(`${ota.toUpperCase()}_API_KEY`);
  if (!base || !key) throw new Error(`${ota} is not set up for NammaStay yet (partner credentials missing).`);
  const r = await fetch(`${base.replace(/\/$/, '')}/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${ota} answered ${r.status}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { action?: string; connection_id?: string; full?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (!body.connection_id || !/^[0-9a-f-]{36}$/i.test(body.connection_id)) return json({ error: 'connection_id required' }, 400);

  const { data: conn } = await db.from('cn_connections').select('*').eq('id', body.connection_id).maybeSingle();
  if (!conn) return json({ error: 'Connection not found' }, 404);
  const c = conn as Conn;
  if (BLOCKED.has(c.ota)) return json({ error: 'Booking.com and Airbnb connect through Beds24.' }, 400);

  // Access check: cn_status raises unless the caller owns/manages the property or is a platform admin.
  const { error: denied } = await asUser.rpc('cn_status', { p_property: c.property_id });
  if (denied) return json({ error: 'Not allowed' }, 403);

  const log = (dir: string, kind: string, ok: boolean, summary: string, detail?: unknown) =>
    db.from('cn_log').insert({ connection_id: c.id, dir, kind, ok, summary, detail: detail ? JSON.stringify(detail).slice(0, 4000) : null });

  try {
    if (body.action === 'rooms') {
      const rooms: { ota_room_id: string; ota_rate_id?: string; room_name: string; rate_name?: string }[] = c.ota === 'test'
        ? [{ ota_room_id: 'T1', ota_rate_id: 'R1', room_name: 'Test dorm', rate_name: 'Standard' }, { ota_room_id: 'T2', ota_rate_id: 'R1', room_name: 'Test private', rate_name: 'Standard' }]
        : (await partner(c.ota, 'rooms', { hotel_id: c.ota_hotel_id })).rooms ?? [];
      await db.from('cn_ota_rooms').delete().eq('connection_id', c.id);
      if (rooms.length) await db.from('cn_ota_rooms').insert(rooms.map((r) => ({ connection_id: c.id, ota_room_id: String(r.ota_room_id), ota_rate_id: String(r.ota_rate_id ?? ''), room_name: r.room_name, rate_name: r.rate_name ?? null })));
      await log('in', 'rooms', true, `${rooms.length} rooms/rates fetched`);
      return json({ rooms });
    }

    if (body.action === 'sync') {
      if (c.status !== 'live') return json({ error: 'Connection is not live.' }, 400);
      const { data: maps } = await db.from('cn_room_map').select('group_key, ota_room_id, ota_rate_id').eq('connection_id', c.id).neq('ota_room_id', '');
      let reservations: Res[] = [];
      if (c.ota !== 'test') {
        // Send live unit counts and rates with the room mapping so the OTA can update its inventory.
        const { data: groups } = await db.rpc('_cn_groups', { p_property: c.property_id });
        const byKey = new Map(((groups ?? []) as { group_key: string; units: number; rate_paise: number }[]).map((g) => [g.group_key, g]));
        const rooms = (maps ?? []).map((m) => ({ ...m, units: byKey.get(m.group_key)?.units, rate_paise: byKey.get(m.group_key)?.rate_paise }));
        await partner(c.ota, 'availability', { hotel_id: c.ota_hotel_id, full: !!body.full, rooms });
        reservations = (await partner(c.ota, 'reservations', { hotel_id: c.ota_hotel_id })).reservations ?? [];
      }
      await db.from('cn_connections').update({ last_push_at: new Date().toISOString(), last_pull_at: new Date().toISOString(), last_error: null, fails: 0, retry_at: null }).eq('id', c.id);
      await log('out', 'push', true, `Availability and rates sent for ${maps?.length ?? 0} room types`);
      if (reservations.length) {
        await db.from('cn_reservations').upsert(reservations.map((r) => ({
          connection_id: c.id, property_id: c.property_id, ota: c.ota, ota_ref: String(r.ref), guest: r.guest ?? null, arrival: r.arrival ?? null,
          departure: r.departure ?? null, amount: r.amount ?? null, currency: r.currency ?? 'INR',
          status: ['new', 'modified', 'cancelled'].includes(r.status ?? '') ? r.status : 'new', raw: r, updated_at: new Date().toISOString(),
        })), { onConflict: 'connection_id,ota_ref' });
      }
      await log('in', 'pull', true, `${reservations.length} reservation${reservations.length === 1 ? '' : 's'} checked`);
      return json({ ok: true, reservations: reservations.length });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    const msg = (e as Error).message;
    const fails = (c.fails ?? 0) + 1;
    await db.from('cn_connections').update({ last_error: msg, fails, retry_at: new Date(Date.now() + Math.min(2 ** fails, 64) * 60000).toISOString() }).eq('id', c.id);
    await log('info', body.action ?? 'error', false, msg);
    return json({ error: msg }, 502);
  }
});
