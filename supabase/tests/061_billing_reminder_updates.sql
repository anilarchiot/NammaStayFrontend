-- Run only against an isolated test database.
create schema auth;
create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create function public._assert_platform_admin() returns void language sql as $$ select $$;
create table public.properties (id uuid primary key, name text, city text, phone text);
create table public.property_members (property_id uuid, role text, email text, display_name text, created_at timestamptz default now());
create table public.subscriptions (property_id uuid, trial_ends_at timestamptz, paid_until timestamptz, is_complimentary boolean default false, is_suspended boolean default false);
create table public.subscription_payments (property_id uuid, status text);
create table public.billing_reminders (id uuid primary key default gen_random_uuid(), property_id uuid, kind text,
  ends_at timestamptz, created_at timestamptz default now(), emailed_at timestamptz, whatsapp_done_at timestamptz,
  constraint billing_reminders_kind_check check (kind in ('trial_3d','trial_1d','trial_ended','renew_7d','renew_1d','expired')),
  unique (property_id, kind, ends_at));
create table public.notifications (property_id uuid, kind text, title text, body text);
\ir ../migrations/061_billing_reminder_updates.sql

insert into public.properties (id, name) values
 ('00000000-0000-0000-0000-000000000001', 'Due'),
 ('00000000-0000-0000-0000-000000000002', 'Pending');
insert into public.property_members (property_id, role, email) select id, 'owner', 'owner@example.invalid' from public.properties;
insert into public.subscriptions (property_id, trial_ends_at, paid_until)
  select id, now() - interval '30 days', now() + interval '3 days' from public.properties;
insert into public.subscription_payments values ('00000000-0000-0000-0000-000000000002', 'pending');
do $$ begin
  if public.run_billing_reminders() <> 1 then raise exception 'expected one reminder'; end if;
  if not exists (select 1 from public.billing_reminders where kind = 'renew_3d') then raise exception 'missing three-day reminder'; end if;
  if public.run_billing_reminders() <> 0 then raise exception 'duplicate reminder'; end if;
  if jsonb_array_length(public.reminders_to_email()) <> 1 then raise exception 'wrong email queue'; end if;
end $$;
insert into public.subscription_payments values ('00000000-0000-0000-0000-000000000001', 'pending');
do $$ begin
  if jsonb_array_length(public.reminders_to_email()) <> 0 then raise exception 'pending payment sent email'; end if;
  if jsonb_array_length(public.admin_reminders(false)) <> 0 then raise exception 'pending payment displayed for follow-up'; end if;
end $$;
delete from public.subscription_payments where property_id = '00000000-0000-0000-0000-000000000001';
update public.subscriptions set paid_until = now() + interval '30 days' where property_id = '00000000-0000-0000-0000-000000000001';
do $$ begin
  if jsonb_array_length(public.reminders_to_email()) <> 0 then raise exception 'renewed property sent stale email'; end if;
  if jsonb_array_length(public.admin_reminders(false)) <> 0 then raise exception 'renewed property displayed for follow-up'; end if;
end $$;
