-- =====================================================================
-- NammaStay · PG / co-living tenants and monthly rent
-- Run after 031_pg_mode_rpc.sql.
-- =====================================================================

begin;

create sequence if not exists public.pg_receipt_code_seq start 1001;

create table if not exists public.pg_tenancies (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  guest_id        uuid not null,
  bed_id          uuid not null,
  block_id        uuid references public.bed_blocks(id) on delete set null,
  start_date      date not null,
  move_out_on     date,
  notice_given_on date,
  status          text not null default 'active' check (status in ('active', 'notice', 'moved_out')),
  cycle           text not null default 'movein' check (cycle in ('movein', 'calendar')),
  rent_paise      int not null check (rent_paise > 0),
  food_paise      int not null default 0 check (food_paise >= 0),
  deposit_paise   int not null default 0 check (deposit_paise >= 0),
  notice_days     int not null default 30 check (notice_days between 0 and 180),
  held_until      date,
  note            text check (char_length(note) <= 1000),
  settled         jsonb,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (guest_id, property_id) references public.guests(id, property_id) on delete restrict,
  foreign key (bed_id, property_id) references public.beds(id, property_id) on delete restrict
);

create unique index if not exists pg_tenancies_live_bed
  on public.pg_tenancies (bed_id) where status <> 'moved_out';
create index if not exists pg_tenancies_property
  on public.pg_tenancies (property_id, status, start_date desc);

create table if not exists public.pg_rent_dues (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  tenancy_id    uuid not null references public.pg_tenancies(id) on delete cascade,
  kind          text not null check (kind in ('rent', 'food', 'deposit', 'electricity', 'maintenance', 'late_fee', 'damage', 'other')),
  label         text not null check (char_length(btrim(label)) between 1 and 100),
  due_on        date not null,
  period_start  date,
  period_end    date,
  amount_paise  int not null check (amount_paise >= 0),
  paid_paise    int not null default 0 check (paid_paise >= 0),
  edited        boolean not null default false,
  note          text check (char_length(note) <= 300),
  created_at    timestamptz not null default now(),
  check (period_end is null or period_start is not null),
  check (period_end is null or period_end > period_start)
);

drop index if exists public.pg_rent_dues_period;
create unique index pg_rent_dues_period
  on public.pg_rent_dues (tenancy_id, kind, period_start)
  where kind in ('rent', 'food');
create index if not exists pg_rent_dues_open
  on public.pg_rent_dues (tenancy_id, due_on) where amount_paise > paid_paise;

create table if not exists public.pg_rent_payments (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  tenancy_id    uuid not null references public.pg_tenancies(id) on delete cascade,
  due_id        uuid references public.pg_rent_dues(id) on delete restrict,
  code          text not null,
  kind          text not null default 'payment' check (kind in ('payment', 'deposit_adjust', 'refund')),
  method        text not null check (method in ('upi', 'cash', 'card', 'bank', 'deposit')),
  amount_paise  int not null check (amount_paise > 0),
  reference     text check (char_length(reference) <= 80),
  note          text check (char_length(note) <= 500),
  received_at   timestamptz not null default now(),
  received_by   uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

create index if not exists pg_rent_payments_tenancy
  on public.pg_rent_payments (tenancy_id, received_at desc);
create index if not exists pg_rent_payments_property
  on public.pg_rent_payments (property_id, received_at desc);

drop trigger if exists pg_tenancies_touch on public.pg_tenancies;
create trigger pg_tenancies_touch before update on public.pg_tenancies
  for each row execute function public._touch_updated_at();

alter table public.pg_tenancies enable row level security;
alter table public.pg_rent_dues enable row level security;
alter table public.pg_rent_payments enable row level security;

drop policy if exists pg_tenancies_select on public.pg_tenancies;
create policy pg_tenancies_select on public.pg_tenancies for select to authenticated
  using (property_id in (select public.my_property_ids()));
drop policy if exists pg_rent_dues_select on public.pg_rent_dues;
create policy pg_rent_dues_select on public.pg_rent_dues for select to authenticated
  using (property_id in (select public.my_property_ids()));
drop policy if exists pg_rent_payments_select on public.pg_rent_payments;
create policy pg_rent_payments_select on public.pg_rent_payments for select to authenticated
  using (property_id in (select public.my_property_ids()));

revoke all on public.pg_tenancies, public.pg_rent_dues, public.pg_rent_payments from anon, authenticated;
grant select on public.pg_tenancies, public.pg_rent_dues, public.pg_rent_payments to authenticated;

-- Return the requested day of a month, clamped to that month's last day.
create or replace function public._pg_cycle_date(p_start date, p_month date)
returns date
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when extract(day from p_start)::int = 1 then date_trunc('month', p_month)::date
    else make_date(
      extract(year from p_month)::int,
      extract(month from p_month)::int,
      least(
        extract(day from p_start)::int,
        extract(day from (date_trunc('month', p_month) + interval '1 month - 1 day'))::int
      )
    )
  end
$$;

create or replace function public._pg_sync(p_tenancy uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.pg_tenancies%rowtype;
  v_today date;
  v_month date;
  v_due date;
  v_next date;
  v_end date;
  v_amount int;
begin
  select * into v_t from public.pg_tenancies where id = p_tenancy;
  if not found or v_t.status = 'moved_out' then return; end if;

  v_today := public._local_date(v_t.property_id, now());
  v_end := least(coalesce(v_t.move_out_on, v_today), v_today);
  v_month := date_trunc('month', v_t.start_date)::date;

  while v_month <= date_trunc('month', v_end)::date loop
    if v_t.cycle = 'calendar' then
      v_due := greatest(v_t.start_date, v_month);
      v_next := (v_month + interval '1 month')::date;
      v_amount := case
        when v_due = v_month then v_t.rent_paise
        else round(v_t.rent_paise * (v_next - v_due)::numeric / greatest(1, v_next - v_month))::int
      end;
    else
      v_due := public._pg_cycle_date(v_t.start_date, v_month);
      v_next := public._pg_cycle_date(v_t.start_date, (v_month + interval '1 month')::date);
      v_amount := v_t.rent_paise;
    end if;

    if v_due >= v_t.start_date and v_due <= v_end then
      insert into public.pg_rent_dues
        (property_id, tenancy_id, kind, label, due_on, period_start, period_end, amount_paise)
      values
        (v_t.property_id, v_t.id, 'rent', 'Rent · ' || to_char(v_due, 'Mon YYYY'),
         v_due, v_due, v_next, v_amount)
      on conflict do nothing;

      if v_t.food_paise > 0 then
        insert into public.pg_rent_dues
          (property_id, tenancy_id, kind, label, due_on, period_start, period_end, amount_paise)
        values
          (v_t.property_id, v_t.id, 'food', 'Food · ' || to_char(v_due, 'Mon YYYY'),
           v_due, v_due, v_next,
           case when v_t.cycle = 'calendar' and v_due <> v_month
             then round(v_t.food_paise * (v_next - v_due)::numeric / greatest(1, v_next - v_month))::int
             else v_t.food_paise end)
        on conflict do nothing;
      end if;
    end if;

    v_month := (v_month + interval '1 month')::date;
  end loop;
end
$$;

create or replace function public._pg_next_due(p_tenancy uuid, p_today date)
returns date
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.pg_tenancies%rowtype;
  v_month date;
  v_due date;
begin
  select * into v_t from public.pg_tenancies where id = p_tenancy;
  if not found or v_t.status = 'moved_out' then return null; end if;
  v_month := date_trunc('month', p_today)::date;
  if v_t.cycle = 'calendar' then
    v_due := v_month;
  else
    v_due := public._pg_cycle_date(v_t.start_date, v_month);
  end if;
  if v_due <= p_today then
    v_month := (v_month + interval '1 month')::date;
    v_due := case when v_t.cycle = 'calendar' then v_month else public._pg_cycle_date(v_t.start_date, v_month) end;
  end if;
  return v_due;
end
$$;

create or replace function public._pg_tenant_json(p_tenancy uuid, p_details boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.pg_tenancies%rowtype;
  v_today date;
  v_result jsonb;
begin
  select * into v_t from public.pg_tenancies where id = p_tenancy;
  if not found then raise exception 'Tenant not found.' using errcode = 'P0404'; end if;
  v_today := public._local_date(v_t.property_id, now());

  select jsonb_build_object(
    'id', v_t.id,
    'property_id', v_t.property_id,
    'guest', jsonb_build_object(
      'id', g.id, 'full_name', g.full_name, 'phone', g.phone,
      'nationality', g.nationality, 'id_type', g.id_type, 'id_number', g.id_number,
      'has_id', g.id_doc_path is not null or g.id_doc_back_path is not null
    ),
    'bed', jsonb_build_object('id', b.id, 'label', b.label, 'room', r.name),
    'booking_id', null,
    'self_checkin_token', null,
    'start_date', v_t.start_date,
    'move_out_on', v_t.move_out_on,
    'notice_given_on', v_t.notice_given_on,
    'status', v_t.status,
    'cycle', v_t.cycle,
    'rent_paise', v_t.rent_paise,
    'food_paise', v_t.food_paise,
    'deposit_paise', v_t.deposit_paise,
    'deposit_held_paise', coalesce((
      select sum(least(d.amount_paise, d.paid_paise))
      from public.pg_rent_dues d where d.tenancy_id = v_t.id and d.kind = 'deposit'
    ), 0),
    'notice_days', v_t.notice_days,
    'held_until', v_t.held_until,
    'hold_warning', case when v_t.held_until is not null
      then 'This bed is reserved only until ' || to_char(v_t.held_until, 'DD Mon YYYY') || ' because another booking starts then.'
      else null end,
    'note', v_t.note,
    'settled', v_t.settled,
    'next_due_on', public._pg_next_due(v_t.id, v_today),
    'due_paise', coalesce((
      select sum(greatest(d.amount_paise - d.paid_paise, 0))
      from public.pg_rent_dues d where d.tenancy_id = v_t.id and d.due_on <= v_today
    ), 0),
    'overdue_paise', coalesce((
      select sum(greatest(d.amount_paise - d.paid_paise, 0))
      from public.pg_rent_dues d
      where d.tenancy_id = v_t.id and d.due_on < v_today - 5
    ), 0)
  )
  into v_result
  from public.guests g
  join public.beds b on b.id = v_t.bed_id
  join public.rooms r on r.id = b.room_id
  where g.id = v_t.guest_id;

  if p_details then
    v_result := v_result || jsonb_build_object(
      'property', (select jsonb_build_object('name', p.name, 'upi_id', p.upi_id, 'phone', p.phone)
                     from public.properties p where p.id = v_t.property_id),
      'dues', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', d.id, 'kind', d.kind, 'label', d.label, 'due_on', d.due_on,
          'period_start', d.period_start, 'period_end', d.period_end,
          'amount_paise', d.amount_paise, 'paid_paise', d.paid_paise,
          'credit_paise', greatest(d.paid_paise - d.amount_paise, 0),
          'edited', d.edited, 'note', d.note
        ) order by d.due_on desc, d.created_at desc)
        from public.pg_rent_dues d where d.tenancy_id = v_t.id
      ), '[]'::jsonb),
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.id, 'code', x.code, 'kind', x.kind, 'method', x.method,
          'amount_paise', x.amount_paise, 'reference', x.reference, 'note', x.note,
          'received_at', x.received_at, 'for', d.label
        ) order by x.received_at desc, x.created_at desc)
        from public.pg_rent_payments x
        left join public.pg_rent_dues d on d.id = x.due_id
        where x.tenancy_id = v_t.id
      ), '[]'::jsonb),
      'bookings', '[]'::jsonb
    );
  end if;

  return v_result;
end
$$;

create or replace function public.pg_tenants(p_property uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date;
  v_id uuid;
begin
  perform public._assert_role(
    p_property,
    array['owner', 'manager', 'front_desk', 'accountant']::public.member_role[]
  );
  if not coalesce((select is_pg from public.properties where id = p_property), false) then
    raise exception 'Tenants & rent is not enabled for this property.';
  end if;

  for v_id in select id from public.pg_tenancies where property_id = p_property and status <> 'moved_out'
  loop
    perform public._pg_sync(v_id);
  end loop;
  v_today := public._local_date(p_property, now());

  return jsonb_build_object(
    'today', v_today,
    'property', (select jsonb_build_object('name', name, 'upi_id', upi_id, 'phone', phone)
                   from public.properties where id = p_property),
    'tenants', coalesce((
      select jsonb_agg(public._pg_tenant_json(t.id, false)
                       order by (t.status = 'moved_out'), t.start_date desc)
      from public.pg_tenancies t where t.property_id = p_property
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'active', (select count(*) from public.pg_tenancies where property_id = p_property and status = 'active'),
      'notice', (select count(*) from public.pg_tenancies where property_id = p_property and status = 'notice'),
      'rent_roll_paise', coalesce((select sum(rent_paise + food_paise)
        from public.pg_tenancies where property_id = p_property and status <> 'moved_out'), 0),
      'collected_month_paise', coalesce((
        select sum(x.amount_paise)
        from public.pg_rent_payments x
        left join public.pg_rent_dues d on d.id = x.due_id
        where x.property_id = p_property and x.kind = 'payment'
          and x.received_at >= date_trunc('month', now()) and coalesce(d.kind, '') <> 'deposit'
      ), 0),
      'due_now_paise', coalesce((
        select sum(greatest(d.amount_paise - d.paid_paise, 0))
        from public.pg_rent_dues d
        join public.pg_tenancies t on t.id = d.tenancy_id
        where d.property_id = p_property and t.status <> 'moved_out' and d.due_on <= v_today
      ), 0),
      'tenants_due', (select count(distinct d.tenancy_id)
        from public.pg_rent_dues d
        join public.pg_tenancies t on t.id = d.tenancy_id
        where d.property_id = p_property and t.status <> 'moved_out'
          and d.due_on <= v_today and d.amount_paise > d.paid_paise),
      'deposits_held_paise', coalesce((
        select sum(least(d.amount_paise, d.paid_paise))
        from public.pg_rent_dues d
        join public.pg_tenancies t on t.id = d.tenancy_id
        where d.property_id = p_property and t.status <> 'moved_out' and d.kind = 'deposit'
      ), 0)
    )
  );
end
$$;

create or replace function public.pg_tenant(p_tenancy uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_property uuid;
begin
  select property_id into v_property from public.pg_tenancies where id = p_tenancy;
  if not found then raise exception 'Tenant not found.' using errcode = 'P0404'; end if;
  perform public._assert_role(
    v_property,
    array['owner', 'manager', 'front_desk', 'accountant']::public.member_role[]
  );
  perform public._pg_sync(p_tenancy);
  return public._pg_tenant_json(p_tenancy, true);
end
$$;

create or replace function public.pg_move_in(p_property uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start date := coalesce(nullif(p->>'start_date', '')::date, public._local_date(p_property, now()));
  v_bed public.beds%rowtype;
  v_guest uuid;
  v_t public.pg_tenancies%rowtype;
  v_block uuid;
  v_held date;
  v_block_end date;
  v_deposit int := coalesce(nullif(p->>'deposit_paise', '')::int, 0);
  v_deposit_paid int := coalesce(nullif(p->>'deposit_paid_paise', '')::int, 0);
begin
  perform public._assert_role(
    p_property,
    array['owner', 'manager', 'front_desk']::public.member_role[]
  );
  if not coalesce((select is_pg from public.properties where id = p_property), false) then
    raise exception 'Set the property type to PG / Co-living first.';
  end if;
  if v_start < public._local_date(p_property, now()) - 62 then
    raise exception 'The move-in date can be at most 2 months in the past.';
  end if;
  if coalesce((p->>'rent_paise')::int, 0) <= 0 then raise exception 'Enter the monthly rent.'; end if;
  if char_length(btrim(coalesce(p#>>'{guest,full_name}', ''))) < 2 then
    raise exception 'Enter the tenant''s full name.';
  end if;

  select * into v_bed from public.beds
   where id = (p->>'bed_id')::uuid and property_id = p_property and is_active;
  if not found then raise exception 'Choose an active bed.'; end if;
  if exists (select 1 from public.pg_tenancies where bed_id = v_bed.id and status <> 'moved_out') then
    raise exception 'Another tenant already lives in this bed.';
  end if;
  if exists (
    select 1 from public.bed_blocks
    where bed_id = v_bed.id and ends_at > public._day_start(public._tz(p_property), v_start)
  ) then
    raise exception 'This bed is blocked for maintenance.';
  end if;

  select min(public._local_date(p_property, check_in_at))
    into v_held
    from public.bookings
   where bed_id = v_bed.id
     and status in ('pending', 'confirmed', 'checked_in')
     and check_out_at > public._day_start(public._tz(p_property), v_start)
     and public._local_date(p_property, check_in_at) > v_start;
  if exists (
    select 1 from public.bookings
    where bed_id = v_bed.id
      and status in ('pending', 'confirmed', 'checked_in')
      and stay && tstzrange(
        public._day_start(public._tz(p_property), v_start),
        public._day_start(public._tz(p_property), coalesce(v_held, v_start + 3650)),
        '[)'
      )
      and public._local_date(p_property, check_in_at) <= v_start
  ) then
    raise exception 'This bed is already occupied on the move-in date.';
  end if;

  insert into public.guests
    (property_id, full_name, phone, nationality, id_type, id_number,
     id_doc_path, id_doc_back_path, consent_at)
  values
    (p_property, btrim(p#>>'{guest,full_name}'), public._clean_phone(p#>>'{guest,phone}'),
     nullif(btrim(p#>>'{guest,nationality}'), ''),
     nullif(p#>>'{guest,id_type}', '')::public.id_doc_type,
     public._mask_id(nullif(p#>>'{guest,id_type}', ''), p#>>'{guest,id_number}'),
     nullif(p#>>'{guest,id_doc_path}', ''), nullif(p#>>'{guest,id_doc_back_path}', ''), now())
  returning id into v_guest;

  v_block_end := coalesce(v_held, v_start + 3650);
  insert into public.bed_blocks (property_id, bed_id, starts_at, ends_at, reason)
  values (
    p_property, v_bed.id,
    public._day_start(public._tz(p_property), v_start),
    public._day_start(public._tz(p_property), v_block_end),
    'PG tenant · ' || btrim(p#>>'{guest,full_name}')
  )
  returning id into v_block;

  insert into public.pg_tenancies
    (property_id, guest_id, bed_id, block_id, start_date, cycle, rent_paise,
     food_paise, deposit_paise, notice_days, held_until, note)
  values
    (p_property, v_guest, v_bed.id, v_block, v_start,
     case when p->>'cycle' = 'calendar' then 'calendar' else 'movein' end,
     (p->>'rent_paise')::int, coalesce(nullif(p->>'food_paise', '')::int, 0),
     v_deposit, coalesce(nullif(p->>'notice_days', '')::int, 30), v_held,
     nullif(btrim(p->>'note'), ''))
  returning * into v_t;

  if v_deposit > 0 then
    insert into public.pg_rent_dues
      (property_id, tenancy_id, kind, label, due_on, amount_paise)
    values (p_property, v_t.id, 'deposit', 'Security deposit', v_start, v_deposit);
  end if;

  perform public._pg_sync(v_t.id);
  if v_deposit_paid > 0 then
    if v_deposit_paid > v_deposit then
      raise exception 'Deposit received cannot be more than the security deposit.';
    end if;
    update public.pg_rent_dues
       set paid_paise = v_deposit_paid
     where tenancy_id = v_t.id and kind = 'deposit';
    insert into public.pg_rent_payments
      (property_id, tenancy_id, due_id, code, kind, method, amount_paise, reference, note)
    select
      p_property, v_t.id, d.id, 'RC-' || nextval('public.pg_receipt_code_seq'),
      'payment', coalesce(nullif(p->>'method', ''), 'upi'), v_deposit_paid,
      nullif(btrim(p->>'reference'), ''), 'Security deposit'
    from public.pg_rent_dues d
    where d.tenancy_id = v_t.id and d.kind = 'deposit';
  end if;

  return jsonb_build_object('id', v_t.id, 'held_until', v_held);
exception
  when exclusion_violation then
    raise exception 'This bed is already occupied or blocked for those dates.' using errcode = '23P01';
end
$$;

create or replace function public.pg_update(p_tenancy uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.pg_tenancies%rowtype;
begin
  select * into v_t from public.pg_tenancies where id = p_tenancy for update;
  if not found then raise exception 'Tenant not found.' using errcode = 'P0404'; end if;
  perform public._assert_role(v_t.property_id, array['owner', 'manager']::public.member_role[]);
  if v_t.status = 'moved_out' then raise exception 'This tenant has moved out.'; end if;
  if coalesce((p->>'rent_paise')::int, 0) <= 0 then raise exception 'Enter the monthly rent.'; end if;
  update public.pg_tenancies set
    rent_paise = (p->>'rent_paise')::int,
    food_paise = coalesce(nullif(p->>'food_paise', '')::int, 0),
    deposit_paise = coalesce(nullif(p->>'deposit_paise', '')::int, 0),
    notice_days = coalesce(nullif(p->>'notice_days', '')::int, notice_days),
    note = nullif(btrim(p->>'note'), '')
  where id = p_tenancy;
end
$$;

create or replace function public.pg_add_charge(p_tenancy uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.pg_tenancies%rowtype;
  v_id uuid;
  v_kind text := coalesce(nullif(p->>'kind', ''), 'other');
begin
  select * into v_t from public.pg_tenancies where id = p_tenancy;
  if not found then raise exception 'Tenant not found.' using errcode = 'P0404'; end if;
  perform public._assert_role(
    v_t.property_id,
    array['owner', 'manager', 'front_desk']::public.member_role[]
  );
  if v_t.status = 'moved_out' then raise exception 'This tenant has moved out.'; end if;
  if v_kind not in ('electricity', 'maintenance', 'late_fee', 'other') then raise exception 'Invalid charge type.'; end if;
  if coalesce((p->>'amount_paise')::int, 0) <= 0 then raise exception 'Enter the amount.'; end if;
  insert into public.pg_rent_dues
    (property_id, tenancy_id, kind, label, due_on, amount_paise, note)
  values
    (v_t.property_id, v_t.id, v_kind,
     coalesce(nullif(btrim(p->>'label'), ''), initcap(replace(v_kind, '_', ' '))),
     coalesce(nullif(p->>'due_on', '')::date, public._local_date(v_t.property_id, now())),
     (p->>'amount_paise')::int, nullif(btrim(p->>'note'), ''))
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.pg_edit_due(p_due uuid, p_amount_paise int, p_note text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due public.pg_rent_dues%rowtype;
begin
  select * into v_due from public.pg_rent_dues where id = p_due for update;
  if not found then raise exception 'Charge not found.' using errcode = 'P0404'; end if;
  perform public._assert_role(v_due.property_id, array['owner', 'manager']::public.member_role[]);
  if p_amount_paise < v_due.paid_paise then
    raise exception 'The amount cannot be less than what is already paid.';
  end if;
  update public.pg_rent_dues
     set amount_paise = greatest(0, p_amount_paise), note = nullif(btrim(p_note), ''), edited = true
   where id = p_due;
end
$$;

create or replace function public.pg_pay(p_tenancy uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.pg_tenancies%rowtype;
  v_due public.pg_rent_dues%rowtype;
  v_amount int := coalesce((p->>'amount_paise')::int, 0);
  v_left int;
  v_apply int;
  v_open int;
  v_code text;
  v_method text := coalesce(nullif(p->>'method', ''), 'upi');
begin
  select * into v_t from public.pg_tenancies where id = p_tenancy;
  if not found then raise exception 'Tenant not found.' using errcode = 'P0404'; end if;
  perform public._assert_role(
    v_t.property_id,
    array['owner', 'manager', 'front_desk']::public.member_role[]
  );
  if v_method not in ('upi', 'cash', 'card', 'bank') then raise exception 'Invalid payment method.'; end if;
  if v_amount <= 0 then raise exception 'Enter the amount received.'; end if;
  perform public._pg_sync(v_t.id);
  select coalesce(sum(greatest(amount_paise - paid_paise, 0)), 0)
    into v_open from public.pg_rent_dues where tenancy_id = v_t.id;
  if v_amount > v_open then raise exception 'Payment is more than the outstanding amount.'; end if;

  v_left := v_amount;
  v_code := 'RC-' || nextval('public.pg_receipt_code_seq');
  for v_due in
    select * from public.pg_rent_dues
     where tenancy_id = v_t.id and amount_paise > paid_paise
     order by due_on, case when kind = 'deposit' then 1 else 0 end, created_at
     for update
  loop
    exit when v_left <= 0;
    v_apply := least(v_left, v_due.amount_paise - v_due.paid_paise);
    update public.pg_rent_dues set paid_paise = paid_paise + v_apply where id = v_due.id;
    insert into public.pg_rent_payments
      (property_id, tenancy_id, due_id, code, kind, method, amount_paise, reference, note)
    values
      (v_t.property_id, v_t.id, v_due.id, v_code, 'payment', v_method, v_apply,
       nullif(btrim(p->>'reference'), ''), null);
    v_left := v_left - v_apply;
  end loop;
  return jsonb_build_object('receipts', jsonb_build_array(v_code));
end
$$;

create or replace function public.pg_notice(p_tenancy uuid, p_move_out date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.pg_tenancies%rowtype;
begin
  select * into v_t from public.pg_tenancies where id = p_tenancy for update;
  if not found then raise exception 'Tenant not found.' using errcode = 'P0404'; end if;
  perform public._assert_role(
    v_t.property_id,
    array['owner', 'manager', 'front_desk']::public.member_role[]
  );
  if v_t.status = 'moved_out' then raise exception 'This tenant has moved out.'; end if;
  if p_move_out is not null and p_move_out < v_t.start_date then
    raise exception 'Move-out cannot be before move-in.';
  end if;
  update public.pg_tenancies set
    status = case when p_move_out is null then 'active' else 'notice' end,
    move_out_on = p_move_out,
    notice_given_on = case when p_move_out is null then null else public._local_date(v_t.property_id, now()) end
  where id = p_tenancy;
end
$$;

create or replace function public.pg_move_out(p_tenancy uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.pg_tenancies%rowtype;
  v_out date;
  v_due public.pg_rent_dues%rowtype;
  v_target int;
  v_open int;
  v_held int;
  v_use int;
  v_left int;
  v_apply int;
  v_refund int;
  v_still int;
  v_code text;
  v_settled jsonb;
begin
  select * into v_t from public.pg_tenancies where id = p_tenancy for update;
  if not found then raise exception 'Tenant not found.' using errcode = 'P0404'; end if;
  perform public._assert_role(v_t.property_id, array['owner', 'manager']::public.member_role[]);
  if v_t.status = 'moved_out' then raise exception 'This tenant has already moved out.'; end if;
  v_out := coalesce(nullif(p->>'move_out_on', '')::date, public._local_date(v_t.property_id, now()));
  if v_out < v_t.start_date then raise exception 'Move-out cannot be before move-in.'; end if;

  update public.pg_tenancies set move_out_on = v_out where id = v_t.id;
  perform public._pg_sync(v_t.id);

  for v_due in
    select * from public.pg_rent_dues
     where tenancy_id = v_t.id and kind in ('rent', 'food')
       and not edited and period_start < v_out and period_end > v_out
     for update
  loop
    v_target := round(v_due.amount_paise * (v_out - v_due.period_start)::numeric
                      / greatest(1, v_due.period_end - v_due.period_start))::int;
    update public.pg_rent_dues set amount_paise = greatest(v_due.paid_paise, v_target)
     where id = v_due.id;
  end loop;

  if coalesce((p->>'deductions_paise')::int, 0) > 0 then
    insert into public.pg_rent_dues
      (property_id, tenancy_id, kind, label, due_on, amount_paise, note, edited)
    values
      (v_t.property_id, v_t.id, 'damage', 'Move-out deduction', v_out,
       (p->>'deductions_paise')::int, nullif(btrim(p->>'deduction_note'), ''), true);
  end if;

  select coalesce(sum(greatest(amount_paise - paid_paise, 0)), 0)
    into v_open from public.pg_rent_dues
   where tenancy_id = v_t.id and kind <> 'deposit' and due_on <= v_out;
  select coalesce(sum(least(amount_paise, paid_paise)), 0)
    into v_held from public.pg_rent_dues
   where tenancy_id = v_t.id and kind = 'deposit';

  v_use := least(v_open, v_held);
  v_left := v_use;
  if v_use > 0 then
    v_code := 'RC-' || nextval('public.pg_receipt_code_seq');
    for v_due in
      select * from public.pg_rent_dues
       where tenancy_id = v_t.id and kind <> 'deposit'
         and due_on <= v_out and amount_paise > paid_paise
       order by due_on, created_at for update
    loop
      exit when v_left <= 0;
      v_apply := least(v_left, v_due.amount_paise - v_due.paid_paise);
      update public.pg_rent_dues set paid_paise = paid_paise + v_apply where id = v_due.id;
      insert into public.pg_rent_payments
        (property_id, tenancy_id, due_id, code, kind, method, amount_paise, note)
      values
        (v_t.property_id, v_t.id, v_due.id, v_code, 'deposit_adjust', 'deposit', v_apply,
         'Adjusted from security deposit at move-out');
      v_left := v_left - v_apply;
    end loop;
  end if;

  v_refund := greatest(v_held - v_open, 0);
  v_still := greatest(v_open - v_held, 0);
  if v_refund > 0 then
    insert into public.pg_rent_payments
      (property_id, tenancy_id, due_id, code, kind, method, amount_paise, reference, note)
    values
      (v_t.property_id, v_t.id, null, 'RC-' || nextval('public.pg_receipt_code_seq'),
       'refund', coalesce(nullif(p->>'refund_method', ''), 'upi'), v_refund,
       nullif(btrim(p->>'refund_reference'), ''), 'Security deposit refund');
  end if;

  v_settled := jsonb_build_object(
    'deposit_paid_paise', v_held,
    'advance_paise', 0,
    'used_for_dues_paise', v_use,
    'refund_paise', v_refund,
    'still_due_paise', v_still
  );
  update public.pg_tenancies
     set status = 'moved_out', move_out_on = v_out, settled = v_settled
   where id = v_t.id;
  if v_t.block_id is not null then
    update public.bed_blocks
       set ends_at = least(
         ends_at,
         greatest(starts_at + interval '1 hour',
                  public._day_start(public._tz(v_t.property_id), v_out + 1))
       )
     where id = v_t.block_id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'beds' and column_name = 'hk_status'
  ) then
    execute 'update public.beds set hk_status = ''dirty'' where id = $1' using v_t.bed_id;
  end if;

  return v_settled;
end
$$;

create or replace function public.pg_delete(p_tenancy uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t public.pg_tenancies%rowtype;
begin
  select * into v_t from public.pg_tenancies where id = p_tenancy for update;
  if not found then return; end if;
  perform public._assert_role(v_t.property_id, array['owner', 'manager']::public.member_role[]);
  if exists (select 1 from public.pg_rent_payments where tenancy_id = v_t.id) then
    raise exception 'This tenant has payments. Use Move out instead.';
  end if;
  delete from public.pg_tenancies where id = v_t.id;
  delete from public.bed_blocks where id = v_t.block_id;
  delete from public.guests g where g.id = v_t.guest_id
    and not exists (select 1 from public.bookings b where b.guest_id = g.id);
end
$$;

revoke execute on function public._pg_cycle_date(date, date) from public, anon, authenticated;
revoke execute on function public._pg_sync(uuid) from public, anon, authenticated;
revoke execute on function public._pg_next_due(uuid, date) from public, anon, authenticated;
revoke execute on function public._pg_tenant_json(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.pg_tenants(uuid) from public, anon;
revoke execute on function public.pg_tenant(uuid) from public, anon;
revoke execute on function public.pg_move_in(uuid, jsonb) from public, anon;
revoke execute on function public.pg_update(uuid, jsonb) from public, anon;
revoke execute on function public.pg_add_charge(uuid, jsonb) from public, anon;
revoke execute on function public.pg_edit_due(uuid, int, text) from public, anon;
revoke execute on function public.pg_pay(uuid, jsonb) from public, anon;
revoke execute on function public.pg_notice(uuid, date) from public, anon;
revoke execute on function public.pg_move_out(uuid, jsonb) from public, anon;
revoke execute on function public.pg_delete(uuid) from public, anon;

grant execute on function public.pg_tenants(uuid) to authenticated;
grant execute on function public.pg_tenant(uuid) to authenticated;
grant execute on function public.pg_move_in(uuid, jsonb) to authenticated;
grant execute on function public.pg_update(uuid, jsonb) to authenticated;
grant execute on function public.pg_add_charge(uuid, jsonb) to authenticated;
grant execute on function public.pg_edit_due(uuid, int, text) to authenticated;
grant execute on function public.pg_pay(uuid, jsonb) to authenticated;
grant execute on function public.pg_notice(uuid, date) to authenticated;
grant execute on function public.pg_move_out(uuid, jsonb) to authenticated;
grant execute on function public.pg_delete(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
