-- Housekeeping is a separate monthly add-on. Owners submit UPI UTRs; platform admins confirm payment.
do $$ begin
  if to_regclass('public.properties') is null then raise exception 'The properties table is missing.'; end if;
  if to_regclass('public.property_members') is null then raise exception 'The property_members table is missing.'; end if;
  if to_regprocedure('public.is_platform_admin()') is null then raise exception 'is_platform_admin() is missing.'; end if;
end $$;

create table if not exists public.housekeeping_addon_access (
  property_id uuid primary key references public.properties(id) on delete cascade,
  active_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.housekeeping_addon_payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  submitted_by uuid not null references auth.users(id),
  amount_paise int not null default 88000 check (amount_paise = 88000), -- US$10 collected as its INR equivalent (see assets/js/housekeeping-price.js)
  utr text not null unique check (utr ~ '^[A-Z0-9]{6,35}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 300),
  period_start timestamptz,
  period_end timestamptz
);
create index if not exists housekeeping_addon_payments_property_idx
  on public.housekeeping_addon_payments(property_id, submitted_at desc);
create unique index if not exists housekeeping_addon_one_pending_payment
  on public.housekeeping_addon_payments(property_id) where status = 'pending';

alter table public.housekeeping_addon_access enable row level security;
alter table public.housekeeping_addon_payments enable row level security;
revoke all on public.housekeeping_addon_access, public.housekeeping_addon_payments from anon, authenticated;

create or replace function public.housekeeping_addon_status(p_property uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_active_until timestamptz;
  v_pending boolean;
  v_last_status text;
  v_review_note text;
begin
  if auth.uid() is null then raise exception 'Sign in to view Housekeeping access.' using errcode = '42501'; end if;
  select role into v_role from public.property_members where property_id = p_property and user_id = auth.uid();
  if v_role is null then raise exception 'You do not have access to this property.' using errcode = '42501'; end if;

  select active_until into v_active_until from public.housekeeping_addon_access where property_id = p_property;
  select exists(select 1 from public.housekeeping_addon_payments where property_id = p_property and status = 'pending') into v_pending;
  select status, review_note into v_last_status, v_review_note
    from public.housekeeping_addon_payments where property_id = p_property order by submitted_at desc limit 1;

  return jsonb_build_object(
    'active', coalesce(v_active_until > now(), false),
    'active_until', v_active_until,
    'pending', v_pending,
    'last_status', v_last_status,
    'review_note', case when v_role = 'owner' then v_review_note else null end
  );
end $$;

create or replace function public.housekeeping_addon_submit(p_property uuid, p_utr text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_utr text := upper(regexp_replace(coalesce(p_utr, ''), '\s', '', 'g'));
  v_role text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to submit a payment.' using errcode = '42501'; end if;
  select role into v_role from public.property_members where property_id = p_property and user_id = auth.uid();
  if v_role is distinct from 'owner' then raise exception 'Only the property owner can enable this add-on.' using errcode = '42501'; end if;
  if v_utr !~ '^[A-Z0-9]{6,35}$' then raise exception 'Enter a valid UPI transaction ID (UTR).'; end if;
  if exists(select 1 from public.housekeeping_addon_payments where utr = v_utr) then raise exception 'This UTR has already been submitted.'; end if;
  if exists(select 1 from public.housekeeping_addon_payments where property_id = p_property and status = 'pending') then
    raise exception 'A Housekeeping payment is already waiting for confirmation.';
  end if;

  insert into public.housekeeping_addon_payments (property_id, submitted_by, utr)
  values (p_property, auth.uid(), v_utr) returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;

create or replace function public.admin_housekeeping_addon_requests() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_requests jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_platform_admin(), false) then
    raise exception 'Only NammaStay admins can review add-on payments.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'property_id', a.property_id, 'property', p.name, 'owner_email', u.email,
    'amount_paise', a.amount_paise, 'utr', a.utr, 'submitted_at', a.submitted_at
  ) order by a.submitted_at), '[]'::jsonb)
  into v_requests
  from public.housekeeping_addon_payments a
  join public.properties p on p.id = a.property_id
  left join public.property_members m on m.property_id = a.property_id and m.role = 'owner'
  left join auth.users u on u.id = m.user_id
  where a.status = 'pending';
  return v_requests;
end $$;

create or replace function public.admin_review_housekeeping_addon_payment(p_id uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_payment public.housekeeping_addon_payments;
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null or not coalesce(public.is_platform_admin(), false) then
    raise exception 'Only NammaStay admins can review add-on payments.' using errcode = '42501';
  end if;
  select * into v_payment from public.housekeeping_addon_payments where id = p_id for update;
  if not found or v_payment.status <> 'pending' then raise exception 'This add-on payment was already reviewed.'; end if;

  if p_approve then
    select greatest(coalesce(active_until, now()), now()) into v_start
      from public.housekeeping_addon_access where property_id = v_payment.property_id;
    v_start := coalesce(v_start, now());
    v_end := v_start + interval '1 month';
    insert into public.housekeeping_addon_access (property_id, active_until, updated_at)
    values (v_payment.property_id, v_end, now())
    on conflict (property_id) do update set active_until = excluded.active_until, updated_at = now();
    update public.housekeeping_addon_payments set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = null, period_start = v_start, period_end = v_end where id = p_id;
    return jsonb_build_object('status', 'approved', 'active_until', v_end);
  end if;

  update public.housekeeping_addon_payments set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
    review_note = left(nullif(btrim(p_note), ''), 300) where id = p_id;
  return jsonb_build_object('status', 'rejected');
end $$;

revoke all on function public.housekeeping_addon_status(uuid) from public, anon, authenticated;
revoke all on function public.housekeeping_addon_submit(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_housekeeping_addon_requests() from public, anon, authenticated;
revoke all on function public.admin_review_housekeeping_addon_payment(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.housekeeping_addon_status(uuid) to authenticated;
grant execute on function public.housekeeping_addon_submit(uuid, text) to authenticated;
grant execute on function public.admin_housekeeping_addon_requests() to authenticated;
grant execute on function public.admin_review_housekeeping_addon_payment(uuid, boolean, text) to authenticated;

create or replace function public._hk_require_addon(p_property uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.property_members where property_id = p_property and user_id = auth.uid()
  ) then raise exception 'You do not have access to this property.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.housekeeping_addon_access where property_id = p_property and active_until > now()
  ) then raise exception 'Housekeeping is not enabled for this property.' using errcode = '42501'; end if;
end $$;

create or replace function public._hk_require_addon_for_bed(p_bed uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_property uuid;
begin
  select property_id into v_property from public.beds where id = p_bed;
  if v_property is null then raise exception 'Bed not found.'; end if;
  perform public._hk_require_addon(v_property);
end $$;

do $$
declare
  v_board_result text;
  v_board_set boolean;
  v_set_result text;
  v_set_is_set boolean;
  v_counts_result text;
  v_counts_set boolean;
  v_set_body text;
begin
  if to_regprocedure('public.hk_board(uuid)') is null
    or to_regprocedure('public.hk_set(uuid,text,text)') is null
    or to_regprocedure('public.hk_counts(uuid)') is null then
    raise exception 'Expected hk_board(uuid), hk_set(uuid,text,text), and hk_counts(uuid) RPCs before enabling the add-on.';
  end if;

  select pg_get_function_result('public.hk_board(uuid)'::regprocedure), p.proretset
    into v_board_result, v_board_set from pg_proc p where p.oid = 'public.hk_board(uuid)'::regprocedure;
  select pg_get_function_result('public.hk_set(uuid,text,text)'::regprocedure), p.proretset
    into v_set_result, v_set_is_set from pg_proc p where p.oid = 'public.hk_set(uuid,text,text)'::regprocedure;
  select pg_get_function_result('public.hk_counts(uuid)'::regprocedure), p.proretset
    into v_counts_result, v_counts_set from pg_proc p where p.oid = 'public.hk_counts(uuid)'::regprocedure;

  execute 'alter function public.hk_board(uuid) rename to _hk_board_unchecked';
  execute 'alter function public.hk_set(uuid, text, text) rename to _hk_set_unchecked';
  execute 'alter function public.hk_counts(uuid) rename to _hk_counts_unchecked';

  execute format('create function public.hk_board(p_property uuid) returns %s language plpgsql security definer set search_path = public, pg_temp as $body$ begin perform public._hk_require_addon(p_property); %s end $body$',
    v_board_result, case when v_board_set then 'return query select * from public._hk_board_unchecked(p_property); return;' else 'return public._hk_board_unchecked(p_property);' end);
  v_set_body := 'perform public._hk_require_addon_for_bed(p_bed); ' || case
    when v_set_result = 'void' then 'perform public._hk_set_unchecked(p_bed, p_status, p_note); return;'
    when v_set_is_set then 'return query select * from public._hk_set_unchecked(p_bed, p_status, p_note); return;'
    else 'return public._hk_set_unchecked(p_bed, p_status, p_note);' end;
  execute format('create function public.hk_set(p_bed uuid, p_status text, p_note text) returns %s language plpgsql security definer set search_path = public, pg_temp as $body$ begin %s end $body$', v_set_result, v_set_body);
  execute format('create function public.hk_counts(p_property uuid) returns %s language plpgsql security definer set search_path = public, pg_temp as $body$ begin perform public._hk_require_addon(p_property); %s end $body$',
    v_counts_result, case when v_counts_set then 'return query select * from public._hk_counts_unchecked(p_property); return;' else 'return public._hk_counts_unchecked(p_property);' end);

  revoke all on function public._hk_board_unchecked(uuid), public._hk_set_unchecked(uuid, text, text), public._hk_counts_unchecked(uuid) from public, anon, authenticated;
  revoke all on function public.hk_board(uuid), public.hk_set(uuid, text, text), public.hk_counts(uuid) from public, anon, authenticated;
  grant execute on function public.hk_board(uuid), public.hk_set(uuid, text, text), public.hk_counts(uuid) to authenticated;
end $$;

revoke all on function public._hk_require_addon(uuid), public._hk_require_addon_for_bed(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';