-- Run only against an isolated database with the project migrations applied.
insert into auth.users (id, email) values
 ('10000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
 ('10000000-0000-0000-0000-000000000002', 'owner@example.invalid'),
 ('10000000-0000-0000-0000-000000000003', 'other@example.invalid');
insert into auth.mfa_factors values ('10000000-0000-0000-0000-000000000001', 'verified');
insert into public.platform_admins (user_id) values ('10000000-0000-0000-0000-000000000001');
insert into public.properties (id, name) values
 ('00000000-0000-0000-0000-000000000001', 'Property One'),
 ('00000000-0000-0000-0000-000000000002', 'Property Two');
insert into public.property_members (property_id, user_id, role) values
 ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'owner');
insert into public.pg_properties (property_id, enabled) values ('00000000-0000-0000-0000-000000000001', true);
insert into public.rooms (id, property_id, name) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Room');
insert into public.beds (id, property_id, room_id, label, rate_paise) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Bed', 100);
insert into public.guests (id, property_id, full_name) values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Guest');
insert into public.bookings (id, property_id, guest_id, bed_id, check_in_at, check_out_at, nights, rate_paise, total_paise) values
 ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now(), now() + interval '1 day', 1, 100, 100);
insert into public.payments (id, property_id, booking_id, method, amount_paise) values
 ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'cash', 100);
insert into public.tenancies (id, property_id, guest_id, bed_id, start_date, rent_paise) values
 ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date, 100);
insert into storage.objects (bucket_id, name) values ('guest-ids', '00000000-0000-0000-0000-000000000001/guest/id.jpg');
select set_config('test.user', '10000000-0000-0000-0000-000000000003', false);
set role authenticated;
delete from storage.objects where bucket_id = 'guest-ids';
reset role;
do $$ begin
  if not exists (select 1 from storage.objects) then raise exception 'non-member deleted property file'; end if;
end $$;
select set_config('test.user', '10000000-0000-0000-0000-000000000001', false);
select set_config('test.aal', 'aal1', false);
do $$ begin
  if public.is_platform_admin() or public.pg_mode('00000000-0000-0000-0000-000000000001') then raise exception 'MFA bypass'; end if;
  begin perform public.admin_validate_subscriber_delete('00000000-0000-0000-0000-000000000001'); raise exception 'MFA bypass';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('test.aal', 'aal2', false);
do $$ begin
  if not public.pg_mode('00000000-0000-0000-0000-000000000001') then raise exception 'admin PG mode'; end if;
  if not public._st_can_salary('00000000-0000-0000-0000-000000000001') then raise exception 'admin salary access'; end if;
  perform public.admin_validate_subscriber_delete('00000000-0000-0000-0000-000000000001');
  if not exists (select 1 from public.payments) or not exists (select 1 from public.tenancies) then raise exception 'validation removed data'; end if;
end $$;
set role authenticated;
delete from storage.objects where bucket_id = 'guest-ids';
reset role;
select public.admin_delete_subscriber('00000000-0000-0000-0000-000000000001');
do $$ begin
  if exists (select 1 from public.properties where id = '00000000-0000-0000-0000-000000000001')
     or exists (select 1 from public.guests) or exists (select 1 from public.bookings)
     or exists (select 1 from public.payments) or exists (select 1 from public.tenancies)
     or exists (select 1 from public.audit_log where property_id = '00000000-0000-0000-0000-000000000001') then raise exception 'property data remains'; end if;
  if (select count(*) from auth.users) <> 3
     or not exists (select 1 from public.properties where id = '00000000-0000-0000-0000-000000000002') then raise exception 'unrelated records removed'; end if;
end $$;
