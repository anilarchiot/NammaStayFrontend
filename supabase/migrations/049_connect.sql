-- =====================================================================
-- NammaStay · 049_connect.sql — NammaStay Connect: direct OTA connections (MakeMyTrip, Agoda, Expedia,
-- Hostelworld, Test OTA). Booking.com and Airbnb are NOT connected here — they go through Beds24.
--
-- Owners/managers connect an OTA with its hotel ID, match rooms and go live. The `connect` edge function
-- pushes availability/rates and pulls reservations into cn_reservations. Platform admins see every
-- property, every reservation, and switch each OTA on once it has approved NammaStay.
--
-- Needs 036_investment.sql (uses _inv_owner) and the platform-admin function is_platform_admin().
-- Room types are read from public.rooms by name (see _cn_groups) — adjust that one function if your
-- rooms table differs. Safe to run more than once. Rollback: supabase/rollbacks/049_connect.sql
-- =====================================================================

do $$ begin
  if to_regprocedure('public._inv_owner(uuid)') is null then raise exception 'Run 036_investment.sql first.'; end if;
  if to_regprocedure('public.is_platform_admin()') is null then raise exception 'is_platform_admin() is missing.'; end if;
end $$;

-- ---------------------------------------------------------------- tables
create table if not exists public.cn_otas (
  ota text primary key, name text not null, hint text, enabled boolean not null default false, sort int not null default 0,
  constraint cn_otas_not_beds24_channels check (ota not in ('booking', 'airbnb'))
);
insert into public.cn_otas (ota, name, hint, enabled, sort) values
  ('mmt', 'MakeMyTrip / Goibibo', 'MMT Hotel ID', false, 10),
  ('agoda', 'Agoda', 'Agoda property ID', false, 20),
  ('expedia', 'Expedia', 'Expedia property ID', false, 30),
  ('hostelworld', 'Hostelworld', 'Hostelworld property ID', false, 40),
  ('test', 'Test OTA (simulator)', 'any code', true, 90)
on conflict (ota) do nothing;

create table if not exists public.cn_connections (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  ota text not null references public.cn_otas(ota),
  ota_hotel_id text not null,
  status text not null default 'setup' check (status in ('setup', 'waiting', 'live', 'paused')),
  last_push_at timestamptz, last_pull_at timestamptz, last_error text, fails int not null default 0, retry_at timestamptz,
  created_at timestamptz not null default now(),
  unique (property_id, ota)
);
create index if not exists cn_connections_property_idx on public.cn_connections(property_id);

create table if not exists public.cn_room_map (
  connection_id uuid not null references public.cn_connections(id) on delete cascade,
  group_key text not null, ota_room_id text not null default '', ota_rate_id text not null default '',
  primary key (connection_id, group_key)
);

create table if not exists public.cn_ota_rooms (
  connection_id uuid not null references public.cn_connections(id) on delete cascade,
  ota_room_id text not null, ota_rate_id text not null default '', room_name text not null, rate_name text,
  primary key (connection_id, ota_room_id, ota_rate_id)
);

create table if not exists public.cn_reservations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.cn_connections(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  ota text not null, ota_ref text not null, guest text, arrival date, departure date,
  amount numeric, currency text default 'INR', status text not null default 'new' check (status in ('new', 'modified', 'cancelled')),
  problem text, booking_ids uuid[] not null default '{}', raw jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (connection_id, ota_ref)
);
create index if not exists cn_reservations_property_idx on public.cn_reservations(property_id, created_at desc);

create table if not exists public.cn_log (
  id bigint generated always as identity primary key,
  connection_id uuid not null references public.cn_connections(id) on delete cascade,
  at timestamptz not null default now(), dir text not null default 'out' check (dir in ('out', 'in', 'info')),
  kind text not null, ok boolean not null default true, summary text, detail text
);
create index if not exists cn_log_conn_idx on public.cn_log(connection_id, at desc);

-- No direct access: owners go through the functions below, the edge function uses the service role.
alter table public.cn_otas enable row level security;
alter table public.cn_connections enable row level security;
alter table public.cn_room_map enable row level security;
alter table public.cn_ota_rooms enable row level security;
alter table public.cn_reservations enable row level security;
alter table public.cn_log enable row level security;
revoke all on public.cn_otas, public.cn_connections, public.cn_room_map, public.cn_ota_rooms, public.cn_reservations, public.cn_log from anon, authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function public._cn_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$ select coalesce(public.is_platform_admin(), false) $$;

create or replace function public._cn_require_admin() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin if not public._cn_admin() then raise exception 'Only NammaStay admins can do this.' using errcode = '42501'; end if; end $$;

-- Owner (or platform admin) of a property.
create or replace function public._cn_require_property(p_property uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public._cn_admin() then return; end if;
  perform public._inv_owner(p_property);
end $$;

create or replace function public._cn_property_of(p_connection uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$ select property_id from public.cn_connections where id = p_connection $$;

-- NammaStay room types of a property: one group per room name. Tolerant of column names on public.rooms.
create or replace function public._cn_groups(p_property uuid)
returns table (group_key text, title text, units int, rate_paise bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if to_regclass('public.rooms') is null then return; end if;
  return query execute $q$
    select coalesce(j->>'name', 'Room') as group_key, coalesce(j->>'name', 'Room') as title, count(*)::int as units,
           max(coalesce(nullif(j->>'rate_paise', ''), nullif(j->>'base_rate_paise', ''), '0')::bigint) as rate_paise
      from (select to_jsonb(r) as j from public.rooms r where r.property_id = $1) x group by 1, 2 order by 1 $q$ using p_property;
end $$;

create or replace function public._cn_log(p_connection uuid, p_dir text, p_kind text, p_ok boolean, p_summary text, p_detail text default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.cn_log (connection_id, dir, kind, ok, summary, detail) values (p_connection, p_dir, p_kind, p_ok, p_summary, p_detail) $$;

create or replace function public._cn_conn_json(c public.cn_connections) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', c.id, 'property_id', c.property_id, 'ota', c.ota, 'ota_name', o.name, 'ota_hotel_id', c.ota_hotel_id, 'status', c.status,
    'last_push_at', c.last_push_at, 'last_pull_at', c.last_pull_at, 'last_error', c.last_error, 'fails', c.fails, 'retry_at', c.retry_at,
    'maps', coalesce((select jsonb_agg(jsonb_build_object('group_key', g.group_key, 'title', g.title, 'units', g.units, 'rate_paise', g.rate_paise,
              'ota_room_id', coalesce(m.ota_room_id, ''), 'ota_rate_id', coalesce(m.ota_rate_id, '')) order by g.title)
            from public._cn_groups(c.property_id) g left join public.cn_room_map m on m.connection_id = c.id and m.group_key = g.group_key), '[]'::jsonb),
    'ota_rooms', coalesce((select jsonb_agg(jsonb_build_object('ota_room_id', r.ota_room_id, 'ota_rate_id', r.ota_rate_id, 'room_name', r.room_name, 'rate_name', r.rate_name)
            order by r.room_name, r.rate_name) from public.cn_ota_rooms r where r.connection_id = c.id), '[]'::jsonb),
    'reservations', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'guest', v.guest, 'arrival', v.arrival, 'departure', v.departure, 'code', v.ota_ref,
              'amount', v.amount, 'currency', v.currency, 'status', v.status, 'problem', v.problem, 'booking_ids', v.booking_ids) order by v.created_at desc)
            from (select * from public.cn_reservations where connection_id = c.id order by created_at desc limit 10) v), '[]'::jsonb))
  from public.cn_otas o where o.ota = c.ota $$;

-- ---------------------------------------------------------------- owner / manager
create or replace function public.cn_status(p_property uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._cn_require_property(p_property);
  return jsonb_build_object(
    'is_admin', public._cn_admin(),
    'otas', coalesce((select jsonb_agg(jsonb_build_object('ota', ota, 'name', name, 'hint', hint, 'enabled', enabled) order by sort) from public.cn_otas), '[]'::jsonb),
    'connections', coalesce((select jsonb_agg(public._cn_conn_json(c) order by c.created_at) from public.cn_connections c where c.property_id = p_property), '[]'::jsonb));
end $$;

create or replace function public.cn_save_connection(p_property uuid, p_ota text, p_hotel_id text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public._cn_require_property(p_property);
  if p_ota in ('booking', 'airbnb') then raise exception 'Booking.com and Airbnb connect through Beds24, not NammaStay Connect.'; end if;
  if not exists (select 1 from public.cn_otas where ota = p_ota) then raise exception 'Unknown OTA.'; end if;
  if length(btrim(coalesce(p_hotel_id, ''))) not between 1 and 40 then raise exception 'Enter the OTA hotel ID.'; end if;
  insert into public.cn_connections (property_id, ota, ota_hotel_id) values (p_property, p_ota, btrim(p_hotel_id))
  on conflict (property_id, ota) do update set ota_hotel_id = excluded.ota_hotel_id returning id into v_id;
  perform public._cn_log(v_id, 'info', 'setup', true, 'Connection saved');
  return v_id;
end $$;

create or replace function public.cn_save_map(p_connection uuid, p_maps jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m jsonb;
begin
  perform public._cn_require_property(public._cn_property_of(p_connection));
  for m in select * from jsonb_array_elements(coalesce(p_maps, '[]'::jsonb)) loop
    insert into public.cn_room_map (connection_id, group_key, ota_room_id, ota_rate_id)
    values (p_connection, m->>'group_key', coalesce(m->>'ota_room_id', ''), coalesce(m->>'ota_rate_id', ''))
    on conflict (connection_id, group_key) do update set ota_room_id = excluded.ota_room_id, ota_rate_id = excluded.ota_rate_id;
  end loop;
end $$;

create or replace function public.cn_go_live(p_connection uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.cn_connections; v_on boolean;
begin
  perform public._cn_require_property(public._cn_property_of(p_connection));
  select * into c from public.cn_connections where id = p_connection;
  select enabled into v_on from public.cn_otas where ota = c.ota;
  update public.cn_connections set status = case when v_on then 'live' else 'waiting' end, last_error = null, fails = 0, retry_at = null where id = p_connection;
  perform public._cn_log(p_connection, 'info', 'go_live', true, case when v_on then 'Live' else 'Waiting for OTA approval' end);
  return case when v_on then 'live' else 'waiting' end;
end $$;

create or replace function public.cn_pause(p_connection uuid, p_paused boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._cn_require_property(public._cn_property_of(p_connection));
  update public.cn_connections set status = case when p_paused then 'paused' else 'live' end where id = p_connection and status in ('live', 'paused');
end $$;

create or replace function public.cn_delete(p_connection uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._cn_require_property(public._cn_property_of(p_connection));
  delete from public.cn_connections where id = p_connection;
end $$;

-- ---------------------------------------------------------------- platform admin
create or replace function public.cn_admin_overview() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._cn_require_admin();
  return jsonb_build_object(
    'otas', coalesce((select jsonb_agg(jsonb_build_object('ota', o.ota, 'name', o.name, 'enabled', o.enabled,
        'connections', (select count(*) from public.cn_connections c where c.ota = o.ota),
        'waiting', (select count(*) from public.cn_connections c where c.ota = o.ota and c.status = 'waiting')) order by o.sort) from public.cn_otas o), '[]'::jsonb),
    'connections', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'property_id', c.property_id, 'property', coalesce(to_jsonb(p)->>'name', 'Property'), 'ota', c.ota, 'ota_name', o.name,
        'ota_hotel_id', c.ota_hotel_id, 'status', c.status, 'last_push_at', c.last_push_at, 'last_pull_at', c.last_pull_at,
        'last_error', c.last_error, 'fails', c.fails,
        'groups', (select count(*) from public._cn_groups(c.property_id)),
        'mapped', (select count(*) from public._cn_groups(c.property_id) g join public.cn_room_map m on m.connection_id = c.id and m.group_key = g.group_key and m.ota_room_id <> ''),
        'reservations', (select count(*) from public.cn_reservations r where r.connection_id = c.id),
        'problems', (select count(*) from public.cn_reservations r where r.connection_id = c.id and r.problem is not null and r.created_at > now() - interval '30 days'))
        order by c.created_at desc)
      from public.cn_connections c join public.cn_otas o on o.ota = c.ota join public.properties p on p.id = c.property_id), '[]'::jsonb));
end $$;

-- Every reservation fetched from every OTA, newest first (admin "OTA reservations" table).
create or replace function public.cn_admin_reservations(p_ota text default null, p_limit int default 200) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._cn_require_admin();
  return coalesce((select jsonb_agg(x order by (x->>'created_at') desc) from (
    select jsonb_build_object('id', r.id, 'property_id', r.property_id, 'property', coalesce(to_jsonb(p)->>'name', 'Property'), 'ota', r.ota, 'ota_name', o.name,
      'code', r.ota_ref, 'guest', r.guest, 'arrival', r.arrival, 'departure', r.departure, 'amount', r.amount, 'currency', r.currency,
      'status', r.status, 'problem', r.problem, 'booking_ids', r.booking_ids, 'created_at', r.created_at) as x
    from public.cn_reservations r join public.cn_otas o on o.ota = r.ota join public.properties p on p.id = r.property_id
    where p_ota is null or r.ota = p_ota order by r.created_at desc limit least(greatest(coalesce(p_limit, 200), 1), 1000)) s), '[]'::jsonb);
end $$;

create or replace function public.cn_admin_set_ota(p_ota text, p_enabled boolean) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  perform public._cn_require_admin();
  update public.cn_otas set enabled = p_enabled where ota = p_ota;
  if p_enabled then update public.cn_connections set status = 'live', last_error = null, fails = 0 where ota = p_ota and status = 'waiting';
  else update public.cn_connections set status = 'waiting' where ota = p_ota and status = 'live'; end if;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.cn_admin_retry(p_connection uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._cn_require_admin();
  update public.cn_connections set last_error = null, fails = 0, retry_at = null where id = p_connection;
end $$;

create or replace function public.cn_admin_log(p_connection uuid, p_limit int default 100) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._cn_require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('at', at, 'dir', dir, 'kind', kind, 'ok', ok, 'summary', summary, 'detail', detail) order by at desc)
    from (select * from public.cn_log where connection_id = p_connection order by at desc limit least(coalesce(p_limit, 100), 500)) l), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- who may call what
do $$ declare f text; begin
  foreach f in array array['cn_status(uuid)','cn_save_connection(uuid,text,text)','cn_save_map(uuid,jsonb)','cn_go_live(uuid)','cn_pause(uuid,boolean)','cn_delete(uuid)',
      'cn_admin_overview()','cn_admin_reservations(text,int)','cn_admin_set_ota(text,boolean)','cn_admin_retry(uuid)','cn_admin_log(uuid,int)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  foreach f in array array['_cn_admin()','_cn_require_admin()','_cn_require_property(uuid)','_cn_property_of(uuid)','_cn_groups(uuid)',
      '_cn_log(uuid,text,text,boolean,text,text)','_cn_conn_json(public.cn_connections)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
end $$;

-- Check: should say true
select to_regclass('public.cn_connections') is not null and to_regprocedure('public.cn_admin_overview()') is not null as connect_installed;
