-- Unfinished registrations are private to the signed-in staff member and property.
create table if not exists public.booking_drafts (
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  draft jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (property_id, user_id)
);

alter table public.booking_drafts enable row level security;
revoke all on public.booking_drafts from public, anon, authenticated;

create or replace function public.booking_draft_get(p_property uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public._assert_role(p_property, array['owner','manager','front_desk']::public.member_role[]);
  if auth.uid() is null then raise exception 'Sign in to access your draft.' using errcode = '42501'; end if;
  return (select d.draft from public.booking_drafts d
          where d.property_id = p_property and d.user_id = auth.uid());
end $$;

create or replace function public.booking_draft_set(p_property uuid, p_draft jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._assert_role(p_property, array['owner','manager','front_desk']::public.member_role[]);
  if auth.uid() is null then raise exception 'Sign in to save your draft.' using errcode = '42501'; end if;
  if p_draft is null then
    delete from public.booking_drafts where property_id = p_property and user_id = auth.uid();
    return;
  end if;
  if jsonb_typeof(p_draft) <> 'object' or pg_column_size(p_draft) > 16000
     or (p_draft - array['full_name','phone','email','nationality','check_in_at','check_out_at','source','send_confirmation','units','guest_id']) <> '{}'::jsonb then
    raise exception 'Invalid booking draft.';
  end if;
  if exists (select 1 from jsonb_each(p_draft) e
             where e.key in ('full_name','phone','email','nationality','check_in_at','check_out_at','source')
               and jsonb_typeof(e.value) <> 'string')
     or (p_draft ? 'guest_id' and jsonb_typeof(p_draft->'guest_id') not in ('string', 'null'))
     or (p_draft ? 'send_confirmation' and jsonb_typeof(p_draft->'send_confirmation') <> 'boolean')
     or (p_draft ? 'units' and jsonb_typeof(p_draft->'units') <> 'array') then
    raise exception 'Invalid booking draft fields.';
  end if;
  if p_draft ? 'units' then
    if jsonb_array_length(p_draft->'units') > 10 or exists (
      select 1 from jsonb_array_elements(p_draft->'units') u
      where jsonb_typeof(u) <> 'object'
         or (u - array['unit','adults','children']) <> '{}'::jsonb
         or exists (select 1 from jsonb_each(case when jsonb_typeof(u) = 'object' then u else '{}'::jsonb end) e
                    where jsonb_typeof(e.value) <> 'string')
    ) then raise exception 'Invalid booking draft rooms.'; end if;
  end if;
  insert into public.booking_drafts (property_id, user_id, draft, updated_at)
  values (p_property, auth.uid(), p_draft, now())
  on conflict (property_id, user_id) do update set draft = excluded.draft, updated_at = excluded.updated_at;
end $$;

revoke all on function public.booking_draft_get(uuid) from public, anon, authenticated;
revoke all on function public.booking_draft_set(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.booking_draft_get(uuid), public.booking_draft_set(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
