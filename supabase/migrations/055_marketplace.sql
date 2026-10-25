-- =====================================================================
-- NammaStay · 055_marketplace.sql — "nammaBookings": a public booking marketplace (separate web app in
-- /marketplace) where hosts register, list properties and take bookings.
--
-- Sync with the NammaStay app goes through NammaStay Connect (049): the new OTA `nammastay` is served by the
-- `marketplace-api` edge function, which only accepts NammaStay's own API key (secret NAMMASTAY_API_KEY).
-- A host copies the listing's "listing code" into NammaStay → Connect as the hotel ID.
--
-- ADD-ON ONLY — new mk_* tables, one storage bucket and one cn_otas row. Needs 049_connect.sql.
-- =====================================================================
do $$ begin
  if to_regclass('public.cn_otas') is null then raise exception 'Run 049_connect.sql first.'; end if;
end $$;

-- ---------------------------------------------------------------- tables
create table if not exists public.mk_hosts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null, phone text, created_at timestamptz not null default now()
);

create table if not exists public.mk_listings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default encode(gen_random_bytes(6), 'hex'),
  host_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 3 and 120),
  description text, property_type text not null default 'Homestay',
  city text not null, state text, address text,
  amenities text[] not null default '{}', photos text[] not null default '{}',
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);
create index if not exists mk_listings_host_idx on public.mk_listings(host_id);
create index if not exists mk_listings_city_idx on public.mk_listings(lower(city)) where status = 'published';

create table if not exists public.mk_rooms (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.mk_listings(id) on delete cascade,
  name text not null, max_guests int not null default 2 check (max_guests > 0),
  units int not null default 1 check (units >= 0),
  rate_paise bigint not null default 0 check (rate_paise >= 0),
  synced_at timestamptz
);
create index if not exists mk_rooms_listing_idx on public.mk_rooms(listing_id);

create table if not exists public.mk_bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default upper(encode(gen_random_bytes(5), 'hex')),
  listing_id uuid not null references public.mk_listings(id) on delete cascade,
  room_id uuid not null references public.mk_rooms(id) on delete cascade,
  guest_name text not null, guest_email text, guest_phone text not null,
  check_in date not null, check_out date not null, guests int not null default 1,
  amount_paise bigint not null default 0,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (check_out > check_in)
);
create index if not exists mk_bookings_room_idx on public.mk_bookings(room_id, check_in, check_out);
create index if not exists mk_bookings_listing_idx on public.mk_bookings(listing_id, updated_at desc);

-- ---------------------------------------------------------------- row level security
alter table public.mk_hosts enable row level security;
alter table public.mk_listings enable row level security;
alter table public.mk_rooms enable row level security;
alter table public.mk_bookings enable row level security;

drop policy if exists mk_hosts_own on public.mk_hosts;
create policy mk_hosts_own on public.mk_hosts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists mk_listings_read on public.mk_listings;
create policy mk_listings_read on public.mk_listings for select using (status = 'published' or host_id = auth.uid());
drop policy if exists mk_listings_write on public.mk_listings;
create policy mk_listings_write on public.mk_listings for all to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

drop policy if exists mk_rooms_read on public.mk_rooms;
create policy mk_rooms_read on public.mk_rooms for select
  using (exists (select 1 from public.mk_listings l where l.id = listing_id and (l.status = 'published' or l.host_id = auth.uid())));
drop policy if exists mk_rooms_write on public.mk_rooms;
create policy mk_rooms_write on public.mk_rooms for all to authenticated
  using (exists (select 1 from public.mk_listings l where l.id = listing_id and l.host_id = auth.uid()))
  with check (exists (select 1 from public.mk_listings l where l.id = listing_id and l.host_id = auth.uid()));

-- Hosts read their own bookings; guests never read the table (they get a reference from mk_book).
drop policy if exists mk_bookings_host_read on public.mk_bookings;
create policy mk_bookings_host_read on public.mk_bookings for select to authenticated
  using (exists (select 1 from public.mk_listings l where l.id = listing_id and l.host_id = auth.uid()));

-- ---------------------------------------------------------------- functions
-- Free units of a room for [p_in, p_out): units minus overlapping confirmed bookings.
create or replace function public.mk_free_units(p_room uuid, p_in date, p_out date) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(0, r.units - coalesce((
    select max(c) from (
      select count(*) c from public.mk_bookings b, generate_series(p_in, p_out - 1, interval '1 day') d
       where b.room_id = r.id and b.status = 'confirmed' and d::date >= b.check_in and d::date < b.check_out group by d
    ) x), 0))::int
  from public.mk_rooms r where r.id = p_room $$;

-- Published listings with their cheapest room; optionally only those with a free room for the dates/guests.
create or replace function public.mk_search(p_city text default null, p_in date default null, p_out date default null, p_guests int default 1)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb) from (
    select l.id, l.title, l.city, l.state, l.property_type, l.photos[1] as photo, l.created_at,
           min(r.rate_paise) as from_paise
      from public.mk_listings l join public.mk_rooms r on r.listing_id = l.id
     where l.status = 'published'
       and (nullif(trim(p_city), '') is null or l.city ilike '%' || trim(p_city) || '%' or l.title ilike '%' || trim(p_city) || '%')
       and r.max_guests >= greatest(p_guests, 1)
       and (p_in is null or p_out is null or public.mk_free_units(r.id, p_in, p_out) > 0)
     group by l.id order by l.created_at desc limit 60) t $$;

create or replace function public.mk_book(p_room uuid, p_in date, p_out date, p_guests int, p_name text, p_phone text, p_email text default null)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.mk_rooms; l public.mk_listings; v_ref text; v_amount bigint;
begin
  if p_in is null or p_out is null or p_in < current_date or p_out <= p_in or p_out - p_in > 60 then raise exception 'Choose valid dates (up to 60 nights).'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter your name.'; end if;
  if coalesce(p_phone, '') !~ '^[0-9+ -]{8,16}$' then raise exception 'Enter a valid phone number.'; end if;
  if nullif(p_email, '') is not null and p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;
  select * into r from public.mk_rooms where id = p_room for update;
  if not found then raise exception 'Room not found.'; end if;
  select * into l from public.mk_listings where id = r.listing_id and status = 'published';
  if not found then raise exception 'Property is not available.'; end if;
  if p_guests < 1 or p_guests > r.max_guests then raise exception 'This room sleeps up to % guests.', r.max_guests; end if;
  if public.mk_free_units(r.id, p_in, p_out) < 1 then raise exception 'Sorry, this room is no longer available for those dates.'; end if;
  v_amount := r.rate_paise * (p_out - p_in);
  insert into public.mk_bookings (listing_id, room_id, guest_name, guest_email, guest_phone, check_in, check_out, guests, amount_paise)
  values (l.id, r.id, trim(p_name), nullif(trim(p_email), ''), trim(p_phone), p_in, p_out, p_guests, v_amount) returning ref into v_ref;
  return v_ref;
end $$;

-- Host cancels one of their own bookings.
create or replace function public.mk_cancel(p_booking uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.mk_bookings b set status = 'cancelled', updated_at = now()
   where b.id = p_booking and exists (select 1 from public.mk_listings l where l.id = b.listing_id and l.host_id = auth.uid()) $$;

revoke all on function public.mk_cancel(uuid) from public, anon;
grant execute on function public.mk_free_units(uuid, date, date) to anon, authenticated;
grant execute on function public.mk_search(text, date, date, int) to anon, authenticated;
grant execute on function public.mk_book(uuid, date, date, int, text, text, text) to anon, authenticated;
grant execute on function public.mk_cancel(uuid) to authenticated;

-- ---------------------------------------------------------------- photos bucket (public read, host writes own folder)
insert into storage.buckets (id, name, public) values ('mk-photos', 'mk-photos', true) on conflict (id) do nothing;
drop policy if exists mk_photos_write on storage.objects;
create policy mk_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'mk-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists mk_photos_delete on storage.objects;
create policy mk_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'mk-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- NammaStay Connect channel
insert into public.cn_otas (ota, name, hint, enabled, sort) values
  ('nammastay', 'nammaBookings (marketplace)', 'Listing code from your host dashboard', true, 5)
on conflict (ota) do nothing;
