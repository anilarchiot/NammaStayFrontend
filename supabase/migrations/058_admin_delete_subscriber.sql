-- Permanently remove a subscriber property from the NammaStay platform.
-- Property-dependent records follow their foreign-key delete behavior; auth.users are not deleted.
do $$
begin
  if to_regclass('public.properties') is null then
    raise exception 'The properties table is missing.';
  end if;
  if to_regprocedure('public.is_platform_admin()') is null then
    raise exception 'is_platform_admin() is missing.';
  end if;
end $$;

create or replace function public.admin_delete_subscriber(p_property uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_admin(), false) then
    raise exception 'Only NammaStay admins can delete a property.' using errcode = '42501';
  end if;
  if p_property is null then
    raise exception 'Choose a property to delete.';
  end if;

  delete from public.properties where id = p_property;
  if not found then
    raise exception 'Property not found.';
  end if;
end $$;

revoke all on function public.admin_delete_subscriber(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_subscriber(uuid) to authenticated;

notify pgrst, 'reload schema';
