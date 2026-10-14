-- Public, anon-callable count of live properties (login / sign-up stats).
create or replace function public.public_property_count() returns integer
language sql security definer set search_path = public stable as $$
  select count(*)::int from public.properties;
$$;
grant execute on function public.public_property_count() to anon, authenticated;
