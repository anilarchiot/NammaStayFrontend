-- =====================================================================
-- NammaStay · 056_nammastay_search.sql — "NammaStay Search": free hostel / PG listings, guest booking
-- requests, owner replies, reviews, 360° tours, verification by the NammaStay team and monthly bills.
--
-- ADD-ON ONLY on top of 055_marketplace.sql (mk_* tables). Nothing is dropped.
-- After running it, make yourself the Search admin:
--   insert into public.mk_admins (user_id) select id from auth.users where email = 'you@example.com';
-- =====================================================================
do $$ begin
  if to_regclass('public.mk_listings') is null then raise exception 'Run 055_marketplace.sql first.'; end if;
end $$;

-- ---------------------------------------------------------------- settings + admins
create table if not exists public.mk_settings (
  id boolean primary key default true check (id),
  launch_until date not null default date '2027-03-31',   -- 0% commission for everyone until this date
  fee_pct numeric(5,2) not null default 9 check (fee_pct between 0 and 50),
  reply_hours int not null default 3 check (reply_hours between 1 and 72),
  pause_days int not null default 10 check (pause_days between 1 and 60),
  min_reviews int not null default 3 check (min_reviews >= 0),
  yearly_plan_paise bigint not null default 2799900
);
insert into public.mk_settings (id) values (true) on conflict do nothing;

create table if not exists public.mk_admins (user_id uuid primary key references auth.users(id) on delete cascade);

-- ---------------------------------------------------------------- listing / room columns
alter table public.mk_listings
  add column if not exists kind text not null default 'stay' check (kind in ('stay', 'hostel', 'pg')),
  add column if not exists area text,
  add column if not exists lat double precision, add column if not exists lng double precision,
  add column if not exists owner_name text, add column if not exists owner_phone text,
  add column if not exists ical_url text, add column if not exists proof text,
  add column if not exists instant boolean not null default false,          -- live beds (subscriber) = instant booking
  add column if not exists subscriber boolean not null default false,       -- pays 0% always
  add column if not exists verified boolean not null default false,
  add column if not exists review_status text not null default 'approved' check (review_status in ('pending', 'changes', 'approved', 'rejected')),
  add column if not exists admin_note text, add column if not exists checklist jsonb not null default '{}'::jsonb,
  add column if not exists call_at text, add column if not exists submitted_at timestamptz,
  add column if not exists tour_photos text[] not null default '{}', add column if not exists tour_url text,
  add column if not exists whatsapp_url text, add column if not exists instagram text,
  add column if not exists cancellation text, add column if not exists house_rules text,
  add column if not exists reply_hours int;
create index if not exists mk_listings_kind_idx on public.mk_listings(kind, status);

alter table public.mk_rooms
  add column if not exists women_only boolean not null default false,
  add column if not exists features text;

-- ---------------------------------------------------------------- requests, reviews, bill payments
create sequence if not exists public.mk_request_seq start 2041;

create table if not exists public.mk_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('REQ-' || nextval('public.mk_request_seq')),
  listing_id uuid not null references public.mk_listings(id) on delete cascade,
  room_id uuid not null references public.mk_rooms(id) on delete cascade,
  type text not null default 'stay' check (type in ('stay', 'visit')),
  guest_name text not null, guest_phone text not null, guest_city text,
  beds int not null default 1 check (beds between 1 and 20),
  check_in date not null, check_out date not null,
  visit_at timestamptz,
  amount_paise bigint not null default 0,
  status text not null default 'new' check (status in ('new', 'accepted', 'declined', 'ended', 'cancelled')),
  stay_status text not null default 'pending' check (stay_status in ('pending', 'stayed', 'no_show')),
  reply_by timestamptz not null,
  created_at timestamptz not null default now(), responded_at timestamptz,
  check (check_out > check_in)
);
create index if not exists mk_requests_listing_idx on public.mk_requests(listing_id, created_at desc);
create index if not exists mk_requests_room_idx on public.mk_requests(room_id, check_in, check_out) where status = 'accepted';

create table if not exists public.mk_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.mk_listings(id) on delete cascade,
  request_id uuid not null unique references public.mk_requests(id) on delete cascade,
  guest_name text not null, guest_city text,
  stars int not null check (stars between 1 and 5),
  body text check (length(body) <= 1000), tags text[] not null default '{}',
  reply text check (length(reply) <= 1000), hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mk_reviews_listing_idx on public.mk_reviews(listing_id, created_at desc);

create table if not exists public.mk_bill_payments (
  listing_id uuid not null references public.mk_listings(id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  utr text not null check (utr ~ '^[0-9A-Za-z]{8,30}$'),
  amount_paise bigint not null default 0,
  status text not null default 'utr' check (status in ('utr', 'paid')),
  paid_at timestamptz, created_at timestamptz not null default now(),
  primary key (listing_id, month)
);

alter table public.mk_settings enable row level security;
alter table public.mk_admins enable row level security;
alter table public.mk_requests enable row level security;
alter table public.mk_reviews enable row level security;
alter table public.mk_bill_payments enable row level security;
-- No policies on these tables: every read and write goes through the security-definer functions below.
-- (mk_listings / mk_rooms keep their 055 policies; the guard trigger below protects the review fields.)

-- ---------------------------------------------------------------- helpers
create or replace function public.mk2_is_admin() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.mk_admins where user_id = auth.uid()) $$;

create or replace function public.mk2_owns(p_listing uuid) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.mk_listings where id = p_listing and host_id = auth.uid()) $$;

create or replace function public._mk2_require_owner(p_listing uuid) returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin if auth.uid() is null or not public.mk2_owns(p_listing) then raise exception 'Not allowed.'; end if; end $$;

create or replace function public._mk2_require_admin() returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin if auth.uid() is null or not public.mk2_is_admin() then raise exception 'Admins only.'; end if; end $$;

create or replace function public._mk2_digits(p text) returns text language sql immutable as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10) $$;

-- Requests nobody answered in time end by themselves.
create or replace function public.mk2_expire() returns void language sql security definer set search_path = public, pg_temp as $$
  update public.mk_requests set status = 'ended' where status = 'new' and reply_by < now() $$;

-- Owners can never grant themselves the badge, approval, subscriber status or skip the review.
create or replace function public._mk2_guard_listing() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.mk2_is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.kind in ('hostel', 'pg') then
      new.verified := false; new.subscriber := false; new.instant := false;
      new.review_status := 'pending'; new.status := 'draft'; new.checklist := '{}'; new.admin_note := null; new.submitted_at := now();
    end if;
    return new;
  end if;
  if old.kind in ('hostel', 'pg') then
    new.kind := old.kind; new.verified := old.verified; new.subscriber := old.subscriber; new.instant := old.instant;
    new.review_status := old.review_status; new.checklist := old.checklist; new.admin_note := old.admin_note; new.call_at := old.call_at;
    if old.review_status <> 'approved' then new.status := 'draft'; end if;
  end if;
  return new;
end $$;
drop trigger if exists mk2_guard_listing on public.mk_listings;
create trigger mk2_guard_listing before insert or update on public.mk_listings for each row execute function public._mk2_guard_listing();

-- Beds taken on the busiest night of [p_in, p_out): NammaBookings bookings + accepted Search requests.
create or replace function public.mk2_free_beds(p_room uuid, p_in date, p_out date) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(0, r.units - coalesce((
    select max(t) from (
      select (select count(*) from public.mk_bookings b where b.room_id = r.id and b.status = 'confirmed' and d::date >= b.check_in and d::date < b.check_out)
           + (select coalesce(sum(q.beds), 0) from public.mk_requests q where q.room_id = r.id and q.type = 'stay' and q.status = 'accepted' and d::date >= q.check_in and d::date < q.check_out) as t
        from generate_series(p_in, p_out - 1, interval '1 day') d) x), 0))::int
  from public.mk_rooms r where r.id = p_room $$;

-- ---------------------------------------------------------------- bills
-- Stays NammaStay Search brought in a month (counted when the guest stayed; no answer 2 days after check-out counts as stayed).
create or replace function public.mk2_bill(p_listing uuid, p_month date) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s public.mk_settings; l public.mk_listings; m date := date_trunc('month', p_month)::date;
  v_stays jsonb; v_value bigint; v_count int; v_noshow int; v_fee bigint; v_waived boolean; p public.mk_bill_payments; v_status text; v_due date;
begin
  select * into s from public.mk_settings; select * into l from public.mk_listings where id = p_listing;
  select coalesce(jsonb_agg(jsonb_build_object('name', q.guest_name, 'nights', q.check_out - q.check_in, 'beds', q.beds, 'amount_paise', q.amount_paise, 'check_in', q.check_in) order by q.check_in), '[]'),
         coalesce(sum(q.amount_paise), 0), count(*)
    into v_stays, v_value, v_count
    from public.mk_requests q
   where q.listing_id = p_listing and q.type = 'stay' and q.status = 'accepted' and q.check_in >= m and q.check_in < m + interval '1 month'
     and (q.stay_status = 'stayed' or (q.stay_status = 'pending' and q.check_out + 2 < current_date));
  select count(*) into v_noshow from public.mk_requests q
   where q.listing_id = p_listing and q.type = 'stay' and q.status = 'accepted' and q.stay_status = 'no_show' and q.check_in >= m and q.check_in < m + interval '1 month';
  v_waived := l.subscriber or m <= s.launch_until;
  v_fee := round(v_value * s.fee_pct / 100);
  select * into p from public.mk_bill_payments where listing_id = p_listing and month = m;
  v_due := (m + interval '1 month')::date + 6;
  v_status := case when v_waived or v_fee = 0 then 'waived' when p.status = 'paid' then 'paid' when p.status = 'utr' then 'utr'
                   when current_date > v_due then 'overdue' else 'open' end;
  return jsonb_build_object('month', m, 'stays', v_stays, 'count', v_count, 'no_shows', v_noshow, 'value_paise', v_value,
    'fee_pct', s.fee_pct, 'fee_paise', case when v_waived then 0 else v_fee end, 'would_be_fee_paise', v_fee, 'waived', v_waived,
    'subscriber', l.subscriber, 'launch_until', s.launch_until, 'status', v_status, 'utr', p.utr, 'paid_at', p.paid_at,
    'due', v_due, 'paused', v_status = 'overdue' and current_date > v_due + s.pause_days, 'yearly_plan_paise', s.yearly_plan_paise);
end $$;

-- A listing pauses itself when a bill stays unpaid [pause_days] after its due date.
create or replace function public.mk2_paused(p_listing uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from generate_series(1, 3) i
     where (public.mk2_bill(p_listing, (date_trunc('month', current_date) - make_interval(months => i))::date)->>'paused')::boolean) $$;

-- ---------------------------------------------------------------- guest side
create or replace function public._mk2_rating(p_listing uuid) returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('count', count(*), 'avg', case when count(*) >= (select min_reviews from public.mk_settings) then round(avg(stars), 1) end)
    from public.mk_reviews where listing_id = p_listing and not hidden $$;

create or replace function public.mk2_search(p_city text default null, p_in date default null, p_out date default null, p_beds int default 1,
  p_kind text default null, p_women boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
  if p_in is not null and (p_out is null or p_out <= p_in or p_out - p_in > 60) then raise exception 'Pick a check-in and a later check-out date.'; end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.has_free desc, t.verified desc, t.from_paise), '[]') into v from (
    select l.id, l.title, l.kind, l.city, l.area, l.photos[1] as photo, l.verified, l.lat, l.lng,
           (l.instant or l.subscriber) as live, l.tour_url is not null or cardinality(l.tour_photos) > 0 as has_tour,
           bool_or(r.women_only) as women_only, min(r.rate_paise) as from_paise,
           sum(case when p_in is null then r.units else public.mk2_free_beds(r.id, p_in, p_out) end)::int as free_beds,
           sum(case when p_in is null then r.units else public.mk2_free_beds(r.id, p_in, p_out) end) > 0 as has_free,
           public._mk2_rating(l.id) as rating
      from public.mk_listings l join public.mk_rooms r on r.listing_id = l.id
     where l.kind in ('hostel', 'pg') and l.status = 'published' and l.review_status = 'approved'
       and (p_kind is null or l.kind = p_kind)
       and (nullif(trim(p_city), '') is null or l.city ilike '%' || trim(p_city) || '%' or l.area ilike '%' || trim(p_city) || '%' or l.title ilike '%' || trim(p_city) || '%')
       and (not coalesce(p_women, false) or r.women_only)
       and not public.mk2_paused(l.id)
     group by l.id) t
   where p_in is null or t.free_beds >= greatest(p_beds, 1);
  return v;
end $$;

-- A listing page: public facts only. The full address is released by mk2_track after the owner accepts.
create or replace function public.mk2_listing(p_id uuid, p_in date default null, p_out date default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare l public.mk_listings; s public.mk_settings;
begin
  select * into s from public.mk_settings;
  select * into l from public.mk_listings where id = p_id and kind in ('hostel', 'pg') and status = 'published' and review_status = 'approved';
  if not found then return null; end if;
  return jsonb_build_object(
    'id', l.id, 'title', l.title, 'kind', l.kind, 'city', l.city, 'state', l.state, 'area', l.area, 'description', l.description,
    'amenities', l.amenities, 'photos', l.photos, 'tour_photos', l.tour_photos, 'tour_url', l.tour_url, 'verified', l.verified,
    'live', l.instant or l.subscriber, 'lat', l.lat, 'lng', l.lng, 'cancellation', l.cancellation, 'house_rules', l.house_rules,
    'reply_hours', coalesce(l.reply_hours, s.reply_hours), 'rating', public._mk2_rating(l.id),
    'rooms', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'rate_paise', r.rate_paise, 'beds', r.units, 'women_only', r.women_only,
        'features', r.features, 'free', case when p_in is null or p_out is null then null else public.mk2_free_beds(r.id, p_in, p_out) end) order by r.rate_paise)
        from public.mk_rooms r where r.listing_id = l.id), '[]'),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('name', v.guest_name, 'city', v.guest_city, 'stars', v.stars, 'body', v.body, 'tags', v.tags,
        'reply', v.reply, 'at', v.created_at) order by v.created_at desc) from (select * from public.mk_reviews where listing_id = l.id and not hidden order by created_at desc limit 20) v), '[]'));
end $$;

create or replace function public.mk2_request(p_room uuid, p_in date, p_out date, p_beds int, p_name text, p_phone text,
  p_city text default null, p_women_ok boolean default false, p_type text default 'stay', p_visit_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.mk_rooms; l public.mk_listings; s public.mk_settings; q public.mk_requests; v_hours int; v_amount bigint; v_status text; v_in date := p_in; v_out date := p_out;
begin
  perform public.mk2_expire();
  select * into s from public.mk_settings;
  if p_type not in ('stay', 'visit') then raise exception 'Unknown request type.'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter your name.'; end if;
  if coalesce(p_phone, '') !~ '^[0-9+ -]{8,16}$' or length(public._mk2_digits(p_phone)) < 10 then raise exception 'Enter a valid phone number.'; end if;
  select * into r from public.mk_rooms where id = p_room for update;
  if not found then raise exception 'Room not found.'; end if;
  select * into l from public.mk_listings where id = r.listing_id and kind in ('hostel', 'pg') and status = 'published' and review_status = 'approved';
  if not found or public.mk2_paused(l.id) then raise exception 'This property is not taking requests right now.'; end if;
  if r.women_only and not coalesce(p_women_ok, false) then raise exception 'Women-only beds: please confirm that all guests are women.'; end if;

  if p_type = 'visit' then
    if l.kind <> 'pg' then raise exception 'Visits are for PGs.'; end if;
    if p_visit_at is null or p_visit_at < now() or p_visit_at > now() + interval '30 days' then raise exception 'Pick a visit time in the next 30 days.'; end if;
    v_in := p_visit_at::date; v_out := v_in + 1; v_amount := 0; v_status := 'new';
  else
    if l.kind = 'pg' then v_out := v_in + 30; end if;
    if v_in is null or v_out is null or v_in < current_date or v_out <= v_in or v_out - v_in > 60 then raise exception 'Choose valid dates (up to 60 nights).'; end if;
    if p_beds < 1 or p_beds > 10 then raise exception 'Choose 1 to 10 beds.'; end if;
    if public.mk2_free_beds(r.id, v_in, v_out) < p_beds then raise exception 'Sorry, not enough beds are free for those dates.'; end if;
    v_amount := case when l.kind = 'pg' then r.rate_paise * p_beds else r.rate_paise * p_beds * (v_out - v_in) end;
    v_status := case when l.instant or l.subscriber then 'accepted' else 'new' end;
  end if;
  if exists (select 1 from public.mk_requests where room_id = r.id and type = p_type and status in ('new', 'accepted') and check_in = v_in
             and public._mk2_digits(guest_phone) = public._mk2_digits(p_phone)) then raise exception 'You already have a request for this.'; end if;
  v_hours := coalesce(l.reply_hours, s.reply_hours);
  insert into public.mk_requests (listing_id, room_id, type, guest_name, guest_phone, guest_city, beds, check_in, check_out, visit_at, amount_paise, status, reply_by, responded_at)
  values (l.id, r.id, p_type, trim(p_name), trim(p_phone), nullif(trim(p_city), ''), case when p_type = 'visit' then 1 else p_beds end, v_in, v_out,
          p_visit_at, v_amount, v_status, now() + make_interval(hours => v_hours), case when v_status = 'accepted' then now() end)
  returning * into q;
  return jsonb_build_object('ref', q.ref, 'status', q.status, 'reply_by', q.reply_by, 'amount_paise', q.amount_paise, 'sent_at', q.created_at);
end $$;

-- Guest follows a request with reference + phone. Address and community links are released only when accepted.
create or replace function public.mk2_track(p_ref text, p_phone text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare q public.mk_requests; l public.mk_listings; r public.mk_rooms; v_ok boolean;
begin
  perform public.mk2_expire();
  select * into q from public.mk_requests where ref = upper(trim(p_ref)) and public._mk2_digits(guest_phone) = public._mk2_digits(p_phone);
  if not found then raise exception 'We could not find that request. Check the reference and phone number.'; end if;
  select * into l from public.mk_listings where id = q.listing_id; select * into r from public.mk_rooms where id = q.room_id;
  v_ok := q.status = 'accepted';
  return jsonb_build_object('ref', q.ref, 'type', q.type, 'status', q.status, 'listing_id', l.id, 'title', l.title, 'verified', l.verified, 'kind', l.kind,
    'area', l.area, 'city', l.city, 'room', r.name, 'beds', q.beds, 'check_in', q.check_in, 'check_out', q.check_out, 'visit_at', q.visit_at,
    'amount_paise', q.amount_paise, 'rate_paise', r.rate_paise, 'sent_at', q.created_at, 'reply_by', q.reply_by, 'instant', l.instant or l.subscriber,
    'address', case when v_ok then l.address end, 'lat', case when v_ok then l.lat end, 'lng', case when v_ok then l.lng end,
    'whatsapp_phone', case when v_ok or q.status = 'new' then l.owner_phone end,
    'community_url', case when v_ok then l.whatsapp_url end, 'instagram', case when v_ok then l.instagram end,
    'can_review', q.type = 'stay' and q.status = 'accepted' and q.stay_status <> 'no_show' and q.check_out <= current_date
                  and not exists (select 1 from public.mk_reviews where request_id = q.id),
    'reviewed', exists (select 1 from public.mk_reviews where request_id = q.id));
end $$;

create or replace function public.mk2_cancel_request(p_ref text, p_phone text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.mk_requests set status = 'cancelled' where ref = upper(trim(p_ref)) and public._mk2_digits(guest_phone) = public._mk2_digits(p_phone)
    and status in ('new', 'accepted') and (type = 'visit' or check_in > current_date or status = 'new');
  if not found then raise exception 'This request cannot be cancelled any more.'; end if;
end $$;

create or replace function public.mk2_review(p_ref text, p_phone text, p_stars int, p_body text default null, p_tags text[] default '{}') returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare q public.mk_requests;
begin
  select * into q from public.mk_requests where ref = upper(trim(p_ref)) and public._mk2_digits(guest_phone) = public._mk2_digits(p_phone);
  if not found then raise exception 'Request not found.'; end if;
  if q.type <> 'stay' or q.status <> 'accepted' or q.stay_status = 'no_show' or q.check_out > current_date then raise exception 'You can review after your stay.'; end if;
  if p_stars not between 1 and 5 then raise exception 'Choose 1 to 5 stars.'; end if;
  if exists (select 1 from public.mk_reviews where request_id = q.id) then raise exception 'You already reviewed this stay.'; end if;
  insert into public.mk_reviews (listing_id, request_id, guest_name, guest_city, stars, body, tags)
  values (q.listing_id, q.id, split_part(q.guest_name, ' ', 1), q.guest_city, p_stars, left(nullif(trim(p_body), ''), 1000), coalesce(p_tags, '{}'));
  update public.mk_requests set stay_status = 'stayed' where id = q.id and stay_status = 'pending';
end $$;

-- ---------------------------------------------------------------- owner side
create or replace function public.mk2_create_listing(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; rm jsonb; n int := 0;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p->>'kind' not in ('hostel', 'pg') then raise exception 'Choose hostel or PG.'; end if;
  if length(trim(coalesce(p->>'title', ''))) < 3 then raise exception 'Enter the property name.'; end if;
  if length(trim(coalesce(p->>'address', ''))) < 8 or nullif(trim(p->>'city'), '') is null then raise exception 'Enter the full address and city.'; end if;
  if coalesce(p->>'owner_phone', '') !~ '^[0-9+ -]{8,16}$' then raise exception 'Enter your phone number.'; end if;
  if jsonb_array_length(coalesce(p->'photos', '[]')) < 5 then raise exception 'Add at least 5 real photos.'; end if;
  if length(trim(coalesce(p->>'proof', ''))) < 5 then raise exception 'Add your GST number or ID proof.'; end if;
  if jsonb_array_length(coalesce(p->'rooms', '[]')) < 1 then raise exception 'Add at least one room type.'; end if;
  insert into public.mk_hosts (user_id, name, phone) values (auth.uid(), coalesce(p->>'owner_name', 'Owner'), p->>'owner_phone')
    on conflict (user_id) do update set phone = excluded.phone;
  insert into public.mk_listings (host_id, kind, title, property_type, city, area, address, lat, lng, photos, ical_url, proof, owner_name, owner_phone, description)
  values (auth.uid(), p->>'kind', trim(p->>'title'), case p->>'kind' when 'pg' then 'PG' else 'Hostel' end, trim(p->>'city'), nullif(trim(p->>'area'), ''), trim(p->>'address'),
          nullif(p->>'lat', '')::double precision, nullif(p->>'lng', '')::double precision,
          array(select jsonb_array_elements_text(p->'photos')), nullif(trim(p->>'ical_url'), ''), trim(p->>'proof'), p->>'owner_name', trim(p->>'owner_phone'), nullif(trim(p->>'description'), ''))
  returning id into v_id;
  for rm in select * from jsonb_array_elements(p->'rooms') loop
    if length(trim(coalesce(rm->>'name', ''))) < 2 or coalesce((rm->>'beds')::int, 0) < 1 or coalesce((rm->>'rate_paise')::bigint, 0) < 1 then raise exception 'Each room needs a name, beds and a price.'; end if;
    insert into public.mk_rooms (listing_id, name, units, rate_paise, max_guests, women_only)
    values (v_id, trim(rm->>'name'), (rm->>'beds')::int, (rm->>'rate_paise')::bigint, 1, coalesce((rm->>'women_only')::boolean, false));
    n := n + 1;
  end loop;
  return v_id;
end $$;

create or replace function public.mk2_my_listings() returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'kind', l.kind, 'city', l.city, 'area', l.area, 'status', l.status, 'review_status', l.review_status,
    'verified', l.verified, 'admin_note', l.admin_note, 'subscriber', l.subscriber, 'call_at', l.call_at, 'tour_photos', l.tour_photos, 'tour_url', l.tour_url,
    'whatsapp_url', l.whatsapp_url, 'instagram', l.instagram, 'rating', public._mk2_rating(l.id),
    'rooms', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'beds', r.units, 'rate_paise', r.rate_paise, 'women_only', r.women_only) order by r.rate_paise), '[]')
                from public.mk_rooms r where r.listing_id = l.id)) order by l.created_at desc), '[]')
    from public.mk_listings l where l.host_id = auth.uid() and l.kind in ('hostel', 'pg') $$;

create or replace function public.mk2_owner_save(p_listing uuid, p_women jsonb default '{}', p_tour_photos text[] default null, p_tour_url text default null,
  p_whatsapp text default null, p_instagram text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare k text;
begin
  perform public._mk2_require_owner(p_listing);
  if nullif(p_tour_url, '') is not null and p_tour_url !~* '^https://' then raise exception 'The 360° tour link must start with https://'; end if;
  if nullif(p_whatsapp, '') is not null and p_whatsapp !~* '^https://(chat\.whatsapp\.com|wa\.me|whatsapp\.com)/' then raise exception 'Use a WhatsApp group or community link (https://chat.whatsapp.com/…).'; end if;
  if p_tour_photos is not null and cardinality(p_tour_photos) > 6 then raise exception 'Up to 6 360° photos.'; end if;
  for k in select jsonb_object_keys(p_women) loop
    update public.mk_rooms set women_only = (p_women->>k)::boolean where id = k::uuid and listing_id = p_listing;
  end loop;
  update public.mk_listings set tour_photos = coalesce(p_tour_photos, tour_photos), tour_url = nullif(trim(p_tour_url), ''),
    whatsapp_url = nullif(trim(p_whatsapp), ''), instagram = left(nullif(trim(p_instagram), ''), 60) where id = p_listing;
end $$;

create or replace function public.mk2_owner_requests(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
  perform public._mk2_require_owner(p_listing); perform public.mk2_expire();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]') into v from (
    select q.id, q.ref, q.type, q.status, q.stay_status, q.guest_name, q.guest_phone, q.beds, q.check_in, q.check_out, q.visit_at, q.amount_paise, q.reply_by, q.created_at,
           r.name as room, r.women_only
      from public.mk_requests q join public.mk_rooms r on r.id = q.room_id where q.listing_id = p_listing order by q.created_at desc limit 100) x;
  return v;
end $$;

create or replace function public.mk2_respond(p_request uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare q public.mk_requests;
begin
  select * into q from public.mk_requests where id = p_request for update;
  if not found then raise exception 'Request not found.'; end if;
  perform public._mk2_require_owner(q.listing_id); perform public.mk2_expire();
  select * into q from public.mk_requests where id = p_request;
  if q.status <> 'new' then raise exception 'This request is already %.', q.status; end if;
  if p_accept and q.type = 'stay' and public.mk2_free_beds(q.room_id, q.check_in, q.check_out) < q.beds then raise exception 'Not enough free beds for those dates any more.'; end if;
  update public.mk_requests set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = p_request;
  return case when p_accept then 'accepted' else 'declined' end;
end $$;

create or replace function public.mk2_mark_stay(p_request uuid, p_stayed boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare q public.mk_requests;
begin
  select * into q from public.mk_requests where id = p_request;
  if not found then raise exception 'Request not found.'; end if;
  perform public._mk2_require_owner(q.listing_id);
  if q.status <> 'accepted' or q.type <> 'stay' or q.check_in > current_date then raise exception 'You can mark this after the guest arrives.'; end if;
  update public.mk_requests set stay_status = case when p_stayed then 'stayed' else 'no_show' end where id = p_request;
end $$;

create or replace function public.mk2_owner_bill(p_listing uuid, p_month date default current_date) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin perform public._mk2_require_owner(p_listing); return public.mk2_bill(p_listing, p_month); end $$;

create or replace function public.mk2_owner_reply_review(p_review uuid, p_reply text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.mk_reviews set reply = left(nullif(trim(p_reply), ''), 1000)
   where id = p_review and exists (select 1 from public.mk_listings l where l.id = listing_id and l.host_id = auth.uid());
  if not found then raise exception 'Review not found.'; end if;
end $$;

create or replace function public.mk2_owner_reviews(p_listing uuid) returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public._mk2_require_owner(p_listing);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', guest_name, 'city', guest_city, 'stars', stars, 'body', body, 'reply', reply, 'at', created_at) order by created_at desc)
    from public.mk_reviews where listing_id = p_listing and not hidden), '[]');
end $$;

-- Owner pays by UPI and enters the transaction id; the team confirms it.
create or replace function public.mk2_pay_utr(p_listing uuid, p_month date, p_utr text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare b jsonb; m date := date_trunc('month', p_month)::date;
begin
  perform public._mk2_require_owner(p_listing);
  b := public.mk2_bill(p_listing, m);
  if (b->>'fee_paise')::bigint <= 0 then raise exception 'There is nothing to pay for this month.'; end if;
  if coalesce(trim(p_utr), '') !~ '^[0-9A-Za-z]{8,30}$' then raise exception 'Enter the UPI transaction id (UTR).'; end if;
  insert into public.mk_bill_payments (listing_id, month, utr, amount_paise) values (p_listing, m, trim(p_utr), (b->>'fee_paise')::bigint)
  on conflict (listing_id, month) do update set utr = excluded.utr, amount_paise = excluded.amount_paise where public.mk_bill_payments.status <> 'paid';
end $$;

-- ---------------------------------------------------------------- admin side
create or replace function public.mk2_admin_queue() returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._mk2_require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'kind', l.kind, 'city', l.city, 'area', l.area, 'address', l.address, 'lat', l.lat, 'lng', l.lng,
      'owner_name', l.owner_name, 'owner_phone', l.owner_phone, 'proof', l.proof, 'ical_url', l.ical_url, 'photos', l.photos, 'review_status', l.review_status,
      'checklist', l.checklist, 'admin_note', l.admin_note, 'call_at', l.call_at, 'verified', l.verified, 'status', l.status, 'subscriber', l.subscriber, 'submitted_at', l.submitted_at,
      'similar', (select count(*) from public.mk_listings o where o.id <> l.id and o.kind in ('hostel', 'pg') and lower(o.title) = lower(l.title)),
      'rooms', (select coalesce(jsonb_agg(jsonb_build_object('name', r.name, 'beds', r.units, 'rate_paise', r.rate_paise, 'women_only', r.women_only)), '[]') from public.mk_rooms r where r.listing_id = l.id))
    order by (l.review_status in ('pending', 'changes')) desc, l.submitted_at desc nulls last) from public.mk_listings l where l.kind in ('hostel', 'pg')), '[]');
end $$;

create or replace function public.mk2_admin_decide(p_listing uuid, p_action text, p_note text default null, p_checklist jsonb default null, p_call_at text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.mk_listings; k text;
begin
  perform public._mk2_require_admin();
  select * into l from public.mk_listings where id = p_listing and kind in ('hostel', 'pg');
  if not found then raise exception 'Listing not found.'; end if;
  if p_checklist is not null then update public.mk_listings set checklist = p_checklist where id = p_listing; end if;
  if p_call_at is not null then update public.mk_listings set call_at = nullif(trim(p_call_at), '') where id = p_listing; end if;
  if p_action = 'approve' then
    foreach k in array array['phone', 'address', 'proof', 'video', 'prices'] loop
      if coalesce((coalesce(p_checklist, l.checklist)->>k)::boolean, false) is not true then raise exception 'Tick every checklist item before approving.'; end if;
    end loop;
    update public.mk_listings set review_status = 'approved', status = 'published', verified = true, admin_note = null where id = p_listing;
  elsif p_action = 'changes' then
    if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Write a note to the owner.'; end if;
    update public.mk_listings set review_status = 'changes', status = 'draft', verified = false, admin_note = trim(p_note) where id = p_listing;
  elsif p_action = 'reject' then
    if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Write a note to the owner.'; end if;
    update public.mk_listings set review_status = 'rejected', status = 'draft', verified = false, admin_note = trim(p_note) where id = p_listing;
  elsif p_action = 'subscriber' then update public.mk_listings set subscriber = true where id = p_listing;
  elsif p_action = 'unsubscriber' then update public.mk_listings set subscriber = false where id = p_listing;
  else raise exception 'Unknown action.'; end if;
end $$;

create or replace function public.mk2_admin_bills(p_month date default current_date) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare m date := date_trunc('month', p_month)::date;
begin
  perform public._mk2_require_admin();
  return jsonb_build_object('settings', (select to_jsonb(s) from public.mk_settings s), 'month', m, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('listing_id', l.id, 'title', l.title, 'kind', l.kind, 'city', coalesce(l.area, l.city), 'phone', l.owner_phone, 'bill', public.mk2_bill(l.id, m)) order by l.title)
      from public.mk_listings l where l.kind in ('hostel', 'pg') and l.review_status = 'approved'), '[]'));
end $$;

create or replace function public.mk2_admin_confirm_paid(p_listing uuid, p_month date) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._mk2_require_admin();
  update public.mk_bill_payments set status = 'paid', paid_at = now() where listing_id = p_listing and month = date_trunc('month', p_month)::date;
  if not found then raise exception 'The owner has not sent a UTR for this month.'; end if;
end $$;

create or replace function public.mk2_admin_set_settings(p_launch_until date, p_fee_pct numeric, p_reply_hours int, p_pause_days int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._mk2_require_admin();
  update public.mk_settings set launch_until = p_launch_until, fee_pct = p_fee_pct, reply_hours = p_reply_hours, pause_days = p_pause_days;
end $$;

create or replace function public.mk2_admin_hide_review(p_review uuid, p_hidden boolean default true) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin perform public._mk2_require_admin(); update public.mk_reviews set hidden = p_hidden where id = p_review; end $$;

create or replace function public.mk2_public_settings() returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('launch_until', launch_until, 'fee_pct', fee_pct, 'reply_hours', reply_hours, 'yearly_plan_paise', yearly_plan_paise) from public.mk_settings $$;

-- ---------------------------------------------------------------- grants
revoke all on function
  public.mk2_is_admin(), public.mk2_owns(uuid), public._mk2_require_owner(uuid), public._mk2_require_admin(), public.mk2_expire(), public._mk2_guard_listing(),
  public.mk2_free_beds(uuid, date, date), public.mk2_bill(uuid, date), public.mk2_paused(uuid), public._mk2_rating(uuid),
  public.mk2_search(text, date, date, int, text, boolean), public.mk2_listing(uuid, date, date),
  public.mk2_request(uuid, date, date, int, text, text, text, boolean, text, timestamptz), public.mk2_track(text, text), public.mk2_cancel_request(text, text),
  public.mk2_review(text, text, int, text, text[]), public.mk2_create_listing(jsonb), public.mk2_my_listings(),
  public.mk2_owner_save(uuid, jsonb, text[], text, text, text), public.mk2_owner_requests(uuid), public.mk2_respond(uuid, boolean), public.mk2_mark_stay(uuid, boolean),
  public.mk2_owner_bill(uuid, date), public.mk2_owner_reply_review(uuid, text), public.mk2_owner_reviews(uuid), public.mk2_pay_utr(uuid, date, text),
  public.mk2_admin_queue(), public.mk2_admin_decide(uuid, text, text, jsonb, text), public.mk2_admin_bills(date), public.mk2_admin_confirm_paid(uuid, date),
  public.mk2_admin_set_settings(date, numeric, int, int), public.mk2_admin_hide_review(uuid, boolean), public.mk2_public_settings()
  from public, anon, authenticated;

grant execute on function public.mk2_search(text, date, date, int, text, boolean), public.mk2_listing(uuid, date, date),
  public.mk2_request(uuid, date, date, int, text, text, text, boolean, text, timestamptz), public.mk2_track(text, text), public.mk2_cancel_request(text, text),
  public.mk2_review(text, text, int, text, text[]), public.mk2_public_settings() to anon, authenticated;
grant execute on function public.mk2_is_admin(), public.mk2_create_listing(jsonb), public.mk2_my_listings(), public.mk2_owner_save(uuid, jsonb, text[], text, text, text),
  public.mk2_owner_requests(uuid), public.mk2_respond(uuid, boolean), public.mk2_mark_stay(uuid, boolean), public.mk2_owner_bill(uuid, date),
  public.mk2_owner_reply_review(uuid, text), public.mk2_owner_reviews(uuid), public.mk2_pay_utr(uuid, date, text),
  public.mk2_admin_queue(), public.mk2_admin_decide(uuid, text, text, jsonb, text), public.mk2_admin_bills(date), public.mk2_admin_confirm_paid(uuid, date),
  public.mk2_admin_set_settings(date, numeric, int, int), public.mk2_admin_hide_review(uuid, boolean) to authenticated;

-- Make PostgREST pick up the new functions immediately.
notify pgrst, 'reload schema';
