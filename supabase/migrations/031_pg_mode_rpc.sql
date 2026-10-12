-- PG / co-living mode used by settings, signup, and the shared app shell.
-- The property remains a bed-based "hostel" internally; this flag enables
-- PG-specific navigation and workflows without weakening property isolation.

alter table public.properties
  add column if not exists is_pg boolean not null default false;

drop function if exists public.pg_mode(uuid);
create or replace function public.pg_mode(p_property uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_pg boolean;
begin
  perform public._assert_role(
    p_property,
    array['owner', 'manager', 'front_desk', 'accountant']::public.member_role[]
  );

  select is_pg
    into v_is_pg
    from public.properties
   where id = p_property;

  if not found then
    raise exception 'Property not found.' using errcode = 'P0404';
  end if;

  return v_is_pg;
end
$$;

drop function if exists public.pg_set_mode(uuid, boolean);
create or replace function public.pg_set_mode(p_property uuid, p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text;
begin
  perform public._assert_role(
    p_property,
    array['owner', 'manager']::public.member_role[]
  );

  select kind
    into v_kind
    from public.properties
   where id = p_property
   for update;

  if not found then
    raise exception 'Property not found.' using errcode = 'P0404';
  end if;

  if p_on and v_kind <> 'hostel' then
    raise exception 'PG / co-living works with beds. Set the property type to PG / Co-living first.';
  end if;

  update public.properties
     set is_pg = p_on,
         updated_at = now()
   where id = p_property;

  return p_on;
end
$$;

revoke execute on function public.pg_mode(uuid) from public, anon;
revoke execute on function public.pg_set_mode(uuid, boolean) from public, anon;
grant execute on function public.pg_mode(uuid) to authenticated;
grant execute on function public.pg_set_mode(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
