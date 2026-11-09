-- Run only against an isolated test database, never a production project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create schema auth;
create schema storage;
create type public.member_role as enum ('owner', 'manager', 'front_desk', 'accountant');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.user', true), '')::uuid
$$;
create table public.properties (id uuid primary key, name text, role_permissions jsonb default '{}');
create table public.property_members (property_id uuid references public.properties on delete cascade, user_id uuid, role public.member_role, display_name text);
create table public.platform_admins (user_id uuid primary key);
create function public.is_platform_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
    and current_setting('test.aal', true) = 'aal2'
$$;
create function public._assert_platform_admin() returns void language plpgsql as $$
begin if not coalesce(public.is_platform_admin(), false) then raise exception 'not admin' using errcode = '42501'; end if; end $$;
create function public._perm_default(public.member_role, text) returns boolean language sql as $$ select false $$;
create table storage.objects (bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to authenticated;
grant select, delete on storage.objects to authenticated;
grant select on public.properties to authenticated;
create table public.guests (id uuid primary key, property_id uuid references public.properties on delete cascade);
create table public.rooms (id uuid primary key, property_id uuid references public.properties on delete cascade, unique (id, property_id));
create table public.beds (id uuid primary key, property_id uuid, room_id uuid,
  foreign key (room_id, property_id) references public.rooms(id, property_id) on delete restrict);
create table public.bookings (id uuid primary key, property_id uuid references public.properties on delete cascade,
  guest_id uuid references public.guests(id) on delete restrict, bed_id uuid references public.beds(id) on delete restrict);
create table public.payments (id uuid primary key, property_id uuid, booking_id uuid references public.bookings(id) on delete restrict);
create table public.tenancies (id uuid primary key, property_id uuid, guest_id uuid references public.guests(id) on delete restrict,
  bed_id uuid references public.beds(id) on delete restrict);
create table public.audit_log (property_id uuid);
create table public.deletion_blocker (property_id uuid references public.properties on delete restrict);
create function public.test_permission() returns trigger language plpgsql as $$
begin
  if not public._allowed(old.property_id, 'delete_guests') then raise exception 'permission denied'; end if;
  return old;
end $$;
create function public.test_payment() returns trigger language plpgsql as $$
begin
  if current_setting('nammastay.deleting_booking', true) <> 'on' then raise exception 'payment immutable'; end if;
  return old;
end $$;
create trigger guest_guard before delete on public.guests for each row execute function public.test_permission();
create trigger payment_guard before delete on public.payments for each row execute function public.test_payment();
\ir ../migrations/060_platform_admin_access.sql

insert into public.properties (id, name) values
 ('00000000-0000-0000-0000-000000000001', 'One'),
 ('00000000-0000-0000-0000-000000000002', 'Two');
insert into public.platform_admins values ('10000000-0000-0000-0000-000000000001');
insert into public.property_members values ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'front_desk', 'Staff');
insert into public.rooms values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
insert into public.beds values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
insert into public.guests values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
insert into public.bookings values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');
insert into public.payments values ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001');
insert into public.tenancies values ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');
insert into storage.objects values ('guest-ids', '00000000-0000-0000-0000-000000000001/staff/id.jpg');

select set_config('test.user', '10000000-0000-0000-0000-000000000002', false);
select set_config('test.aal', 'aal2', false);
do $$ begin
  if (select count(*) from public.my_property_ids()) <> 1 then raise exception 'staff property access'; end if;
  begin perform public.admin_delete_subscriber('00000000-0000-0000-0000-000000000001'); raise exception 'staff deleted property';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('test.user', '10000000-0000-0000-0000-000000000001', false);
select set_config('test.aal', 'aal1', false);
do $$ begin
  if (select count(*) from public.my_property_ids()) <> 0 then raise exception 'MFA bypass'; end if;
  begin perform public.admin_delete_subscriber('00000000-0000-0000-0000-000000000001'); raise exception 'MFA bypass';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('test.aal', 'aal2', false);
insert into public.deletion_blocker values ('00000000-0000-0000-0000-000000000001');
do $$ begin
  begin perform public.admin_validate_subscriber_delete('00000000-0000-0000-0000-000000000001'); raise exception 'expected validation to fail';
  exception when foreign_key_violation then null; end;
  if not exists (select 1 from public.bookings) or not exists (select 1 from public.payments) then
    raise exception 'failed validation deleted data';
  end if;
end $$;
delete from public.deletion_blocker;
do $$ begin
  if (select count(*) from public.my_property_ids()) <> 2 then raise exception 'admin property access'; end if;
  if (select count(*) from public.my_memberships() where role = 'owner') <> 2 then raise exception 'admin memberships'; end if;
  if not public._allowed('00000000-0000-0000-0000-000000000001', 'delete_guests') then raise exception 'admin permissions'; end if;
  perform public.admin_validate_subscriber_delete('00000000-0000-0000-0000-000000000001');
  if not exists (select 1 from public.bookings) or not exists (select 1 from storage.objects) then
    raise exception 'validation deleted data';
  end if;
  begin perform public.admin_delete_subscriber('00000000-0000-0000-0000-000000000001'); raise exception 'files not checked';
  exception when raise_exception then if sqlerrm = 'files not checked' then raise; end if; end;
  if not exists (select 1 from public.bookings) then raise exception 'failed deletion changed data'; end if;
end $$;
set role authenticated;
delete from storage.objects where bucket_id = 'guest-ids';
reset role;
select public.admin_delete_subscriber('00000000-0000-0000-0000-000000000001');
do $$ begin
  if exists (select 1 from public.properties where id = '00000000-0000-0000-0000-000000000001')
     or exists (select 1 from public.payments) or exists (select 1 from public.bookings)
     or exists (select 1 from public.guests) or exists (select 1 from public.beds)
     or exists (select 1 from public.tenancies) then raise exception 'dependent records remain'; end if;
  if not exists (select 1 from public.properties where id = '00000000-0000-0000-0000-000000000002') then raise exception 'other property deleted'; end if;
end $$;
