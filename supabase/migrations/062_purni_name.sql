create table if not exists public.property_assistant_settings (
  property_id uuid primary key references public.properties(id) on delete cascade,
  assistant_name text not null default 'Purni' check (char_length(btrim(assistant_name)) between 1 and 40)
);

alter table public.property_assistant_settings enable row level security;
revoke all on public.property_assistant_settings from public, anon, authenticated;

create or replace function public.property_assistant_name(p_property uuid) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public._assert_role(p_property, array['owner','manager','front_desk','accountant']::public.member_role[]);
  return coalesce((select assistant_name from public.property_assistant_settings where property_id = p_property), 'Purni');
end $$;

create or replace function public.set_property_assistant_name(p_property uuid, p_name text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_name text := btrim(p_name);
begin
  perform public._assert_role(p_property, array['owner']::public.member_role[]);
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'Enter a chatbot name between 1 and 40 characters.';
  end if;
  insert into public.property_assistant_settings (property_id, assistant_name) values (p_property, v_name)
  on conflict (property_id) do update set assistant_name = excluded.assistant_name;
  return v_name;
end $$;

revoke all on function public.property_assistant_name(uuid), public.set_property_assistant_name(uuid, text) from public, anon, authenticated;
grant execute on function public.property_assistant_name(uuid), public.set_property_assistant_name(uuid, text) to authenticated;
notify pgrst, 'reload schema';
