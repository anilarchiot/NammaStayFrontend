-- Run only against an isolated test database.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create schema auth;
create type public.member_role as enum ('owner','manager','front_desk','accountant');
create table public.properties (id uuid primary key);
create table public.members (property_id uuid, user_id uuid, role public.member_role);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.user', true), '')::uuid
$$;
create function public._assert_role(p_property uuid, p_roles public.member_role[]) returns public.member_role
language plpgsql stable security definer as $$
declare r public.member_role;
begin
  select role into r from public.members where property_id = p_property and user_id = auth.uid();
  if r is null or not r = any(p_roles) then raise exception 'permission denied' using errcode = '42501'; end if;
  return r;
end $$;
\ir ../migrations/062_purni_name.sql
insert into public.properties values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.members values
 ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
 ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'front_desk');
select set_config('test.user', '10000000-0000-0000-0000-000000000001', false);
set role authenticated;
do $$ begin
  if public.property_assistant_name('00000000-0000-0000-0000-000000000001') <> 'Purni' then raise exception 'incorrect default'; end if;
  if public.set_property_assistant_name('00000000-0000-0000-0000-000000000001', '  Tara  ') <> 'Tara' then raise exception 'name not saved'; end if;
  begin perform public.set_property_assistant_name('00000000-0000-0000-0000-000000000001', '   '); raise exception 'empty name accepted';
  exception when raise_exception then if sqlerrm = 'empty name accepted' then raise; end if; end;
end $$;
reset role;
select set_config('test.user', '10000000-0000-0000-0000-000000000002', false);
set role authenticated;
do $$ begin
  if public.property_assistant_name('00000000-0000-0000-0000-000000000001') <> 'Tara' then raise exception 'staff cannot read name'; end if;
  begin perform public.set_property_assistant_name('00000000-0000-0000-0000-000000000001', 'Other'); raise exception 'staff edited name';
  exception when insufficient_privilege then null; end;
  begin perform public.property_assistant_name('00000000-0000-0000-0000-000000000002'); raise exception 'cross-property access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.properties where id = '00000000-0000-0000-0000-000000000001';
do $$ begin
  if exists (select 1 from public.property_assistant_settings) then raise exception 'orphaned settings'; end if;
end $$;
