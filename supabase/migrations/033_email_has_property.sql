-- =====================================================================
-- NammaStay · "Talk to us" form: tell visitors when an email already has a property
-- Run after 032_pg_tenants.sql.
-- =====================================================================

begin;

create or replace function public.email_has_property(p_email text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.property_members m
     where lower(m.email) = lower(btrim(p_email))
    union all
    select 1 from public.property_members m
      join auth.users u on u.id = m.user_id
     where lower(u.email) = lower(btrim(p_email))
  )
$$;

revoke all on function public.email_has_property(text) from public;
grant execute on function public.email_has_property(text) to anon, authenticated;

commit;
