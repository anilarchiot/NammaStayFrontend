-- Platform admins use the existing MFA-aware is_platform_admin() check.
create or replace function public.my_property_ids(p_roles public.member_role[] default null)
returns setof uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.id from public.properties p
  where auth.uid() is not null and (
    public.is_platform_admin() or exists (
      select 1 from public.property_members m
      where m.property_id = p.id and m.user_id = auth.uid()
        and (p_roles is null or m.role = any(p_roles))
    )
  )
$$;

create or replace function public._assert_role(p_property uuid, p_roles public.member_role[])
returns public.member_role language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.member_role;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '42501'; end if;
  if public.is_platform_admin() and exists (select 1 from public.properties where id = p_property) then
    return 'owner'::public.member_role;
  end if;
  select role into r from public.property_members where property_id = p_property and user_id = auth.uid();
  if r is null or not (r = any(p_roles)) then
    raise exception 'You don''t have permission to do this.' using errcode = '42501';
  end if;
  return r;
end $$;

create or replace function public._allowed(p_property uuid, p_perm text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_role public.member_role; v_set jsonb;
begin
  if auth.uid() is null then return true; end if;
  if public.is_platform_admin() and exists (select 1 from public.properties where id = p_property) then return true; end if;
  select role into v_role from public.property_members where property_id = p_property and user_id = auth.uid();
  if v_role is null then return false; end if;
  if v_role = 'owner' then return true; end if;
  select role_permissions -> (v_role::text) -> p_perm into v_set from public.properties where id = p_property;
  if v_set is not null and jsonb_typeof(v_set) = 'boolean' then return v_set::text::boolean; end if;
  return public._perm_default(v_role, p_perm);
end $$;

create or replace function public.my_memberships()
returns table (property_id uuid, property_name text, role public.member_role, display_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.name,
    case when public.is_platform_admin() then 'owner'::public.member_role else m.role end,
    m.display_name
  from public.properties p
  left join public.property_members m on m.property_id = p.id and m.user_id = auth.uid()
  where auth.uid() is not null and (m.user_id is not null or public.is_platform_admin())
  order by p.name
$$;

-- PG and resort modes use their own membership checks rather than the shared
-- role helpers. Preserve optional installations and their existing mode state.
do $migration$
begin
  if to_regprocedure('public.pg_mode(uuid)') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'pg_properties' and column_name = 'enabled') then
    execute $function$
      create or replace function public.pg_mode(p_property uuid) returns boolean
      language sql stable security definer set search_path = public, pg_temp as $body$
        select exists (select 1 from public.pg_properties where property_id = p_property and enabled)
           and p_property in (select public.my_property_ids())
      $body$
    $function$;
  end if;
  if to_regprocedure('public.resort_mode(uuid)') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'resort_properties' and column_name = 'enabled') then
    execute $function$
      create or replace function public.resort_mode(p_property uuid) returns boolean
      language sql stable security definer set search_path = public, pg_temp as $body$
        select exists (select 1 from public.resort_properties where property_id = p_property and enabled)
           and p_property in (select public.my_property_ids())
      $body$
    $function$;
  end if;
  if to_regprocedure('public._st_can_salary(uuid)') is not null then
    execute $function$
      create or replace function public._st_can_salary(p_property uuid) returns boolean
      language sql stable security definer set search_path = public, pg_temp as $body$
        select (public.is_platform_admin() and exists (select 1 from public.properties where id = p_property))
            or exists (select 1 from public.property_members m where m.property_id = p_property and m.user_id = auth.uid()
              and (m.role = 'owner' or (m.role = 'manager' and coalesce((select managers_see_salary from public.staff_settings s where s.property_id = p_property), false))))
      $body$
    $function$;
  end if;
end
$migration$;

-- Storage is removed through the Storage API, never by deleting storage.objects.
create or replace function public.admin_subscriber_files(p_property uuid)
returns table (bucket text, path text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public._assert_platform_admin();
  if not exists (select 1 from public.properties where id = p_property) then raise exception 'Property not found.'; end if;
  return query select o.bucket_id::text, o.name::text from storage.objects o
    where o.bucket_id in ('guest-ids', 'owner-docs', 'staff-docs', 'stay-photos')
      and split_part(o.name, '/', 1) = p_property::text
    order by o.bucket_id, o.name limit 200;
end $$;
revoke all on function public.admin_subscriber_files(uuid) from public, anon, authenticated;
grant execute on function public.admin_subscriber_files(uuid) to authenticated;

drop policy if exists subscriber_admin_storage_select on storage.objects;
create policy subscriber_admin_storage_select on storage.objects for select to authenticated
  using (bucket_id in ('guest-ids', 'owner-docs', 'staff-docs', 'stay-photos') and public.is_platform_admin()
    and exists (select 1 from public.properties p where p.id::text = split_part(storage.objects.name, '/', 1)));
drop policy if exists subscriber_admin_storage_delete on storage.objects;
create policy subscriber_admin_storage_delete on storage.objects for delete to authenticated
  using (bucket_id in ('guest-ids', 'owner-docs', 'staff-docs', 'stay-photos') and public.is_platform_admin()
    and exists (select 1 from public.properties p where p.id::text = split_part(storage.objects.name, '/', 1)));

create or replace function public._admin_delete_subscriber_data(p_property uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._assert_platform_admin();
  if p_property is null then raise exception 'Choose a property to delete.'; end if;
  perform 1 from public.properties where id = p_property for update;
  if not found then raise exception 'Property not found.'; end if;

  perform set_config('nammastay.deleting_booking', 'on', true);
  if to_regclass('public.tenancies') is not null then
    execute 'delete from public.tenancies where property_id = $1' using p_property;
  end if;
  delete from public.payments where property_id = p_property;
  delete from public.bookings where property_id = p_property;
  delete from public.beds where property_id = p_property;
  delete from public.guests where property_id = p_property;
  delete from public.audit_log where property_id = p_property;
  delete from public.properties where id = p_property;
  perform set_config('nammastay.deleting_booking', 'off', true);
end $$;
revoke all on function public._admin_delete_subscriber_data(uuid) from public, anon, authenticated;

-- Check the database deletion in a rolled-back subtransaction before removing files.
create or replace function public.admin_validate_subscriber_delete(p_property uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._assert_platform_admin();
  begin
    perform public._admin_delete_subscriber_data(p_property);
    raise exception 'Rollback deletion validation' using errcode = 'P0D01';
  exception when sqlstate 'P0D01' then
    null;
  end;
end $$;
revoke all on function public.admin_validate_subscriber_delete(uuid) from public, anon, authenticated;
grant execute on function public.admin_validate_subscriber_delete(uuid) to authenticated;

create or replace function public.admin_delete_subscriber(p_property uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._assert_platform_admin();
  if p_property is null then raise exception 'Choose a property to delete.'; end if;
  perform 1 from public.properties where id = p_property for update;
  if not found then raise exception 'Property not found.'; end if;
  if exists (select 1 from storage.objects o
      where o.bucket_id in ('guest-ids', 'owner-docs', 'staff-docs', 'stay-photos')
        and split_part(o.name, '/', 1) = p_property::text) then
    raise exception 'Property files must be removed before deleting the subscriber. Retry from the Subscribers page.';
  end if;
  perform public._admin_delete_subscriber_data(p_property);
end $$;
revoke all on function public.admin_delete_subscriber(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_subscriber(uuid) to authenticated;
notify pgrst, 'reload schema';
