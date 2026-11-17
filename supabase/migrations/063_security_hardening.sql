-- =====================================================================
-- NammaStay · 063_security_hardening.sql — tightens marketplace data access.
--
-- 1. mk_listings holds owner PII (owner_name, owner_phone, proof, ical_url) and admin-only fields
--    (admin_note, checklist). Anon and any signed-in user could read them through PostgREST for every
--    published listing. Now only public listing fields are granted as columns. Owners read their own
--    full record through the mk2_* RPCs, which are SECURITY DEFINER and unchanged.
-- 2. mk2_rewards returns only the booking whose reference was entered, not every stay on the phone number.
--
-- Needs 055, 056 and 057. Rollback: supabase/rollbacks/063_security_hardening.sql
-- =====================================================================

-- Visibility check for RLS policies. It runs as the function owner, so policies never read
-- a column that the calling role cannot select.
create or replace function public.mk_listing_visible(p_listing uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.mk_listings l
                 where l.id = p_listing and (l.status = 'published' or l.host_id = auth.uid())) $$;
revoke all on function public.mk_listing_visible(uuid) from public, anon, authenticated;
grant execute on function public.mk_listing_visible(uuid) to anon, authenticated;

drop policy if exists mk_listings_read on public.mk_listings;
create policy mk_listings_read on public.mk_listings for select using (public.mk_listing_visible(id));

drop policy if exists mk_rooms_read on public.mk_rooms;
create policy mk_rooms_read on public.mk_rooms for select using (public.mk_listing_visible(listing_id));

-- Column-level read access. Writes are unchanged (guarded by the 055 write policies and the 056 trigger).
revoke select on public.mk_listings from anon, authenticated;
grant select (id, title, description, property_type, city, state, address, amenities, photos)
  on public.mk_listings to anon;
grant select (id, code, host_id, title, description, property_type, city, state, address, amenities, photos, status, created_at)
  on public.mk_listings to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.mk_listings from anon;

-- ---------------------------------------------------------------- rewards: one booking at a time
create or replace function public.mk2_rewards(p_ref text, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_ref text := upper(trim(p_ref));
  v_phone text := public._mk2_digits(p_phone);
  v_points int;
  v_completed int;
  v_next int;
  v_tier text;
  v_bookings jsonb;
begin
  if nullif(v_phone, '') is null or not exists (
    select 1 from public.mk_requests
    where ref = v_ref and public._mk2_digits(guest_phone) = v_phone
  ) then
    raise exception 'We could not find that request. Check the reference and phone number.';
  end if;

  select
    coalesce(sum(case
      when q.stay_status = 'stayed' and q.check_out <= current_date
        then floor(q.amount_paise / 10000.0)::int
      else 0
    end), 0)::int,
    count(*) filter (where q.stay_status = 'stayed' and q.check_out <= current_date)::int
  into v_points, v_completed
  from public.mk_requests q
  where public._mk2_digits(q.guest_phone) = v_phone
    and q.type = 'stay'
    and q.status = 'accepted';

  v_tier := case
    when v_points >= 1000 then 'Legend'
    when v_points >= 500 then 'Trailblazer'
    when v_points >= 100 then 'Explorer'
    else 'New traveller'
  end;
  v_next := case
    when v_points < 100 then 100
    when v_points < 500 then 500
    when v_points < 1000 then 1000
    else null
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'ref', q.ref,
    'title', l.title,
    'check_in', q.check_in,
    'check_out', q.check_out,
    'amount_paise', q.amount_paise,
    'points', case when q.stay_status = 'stayed' and q.check_out <= current_date
      then floor(q.amount_paise / 10000.0)::int else 0 end,
    'status', case
      when q.stay_status = 'stayed' and q.check_out <= current_date then 'earned'
      when q.check_out <= current_date then 'awaiting confirmation'
      else 'upcoming'
    end
  ) order by q.check_out desc), '[]'::jsonb)
  into v_bookings
  from public.mk_requests q
  join public.mk_listings l on l.id = q.listing_id
  where q.ref = v_ref
    and public._mk2_digits(q.guest_phone) = v_phone
    and q.type = 'stay'
    and q.status = 'accepted'
    and q.stay_status <> 'no_show';

  return jsonb_build_object(
    'points', v_points,
    'completed_stays', v_completed,
    'tier', v_tier,
    'next_tier_points', v_next,
    'points_to_next', case when v_next is null then 0 else v_next - v_points end,
    'bookings', v_bookings
  );
end $$;

revoke all on function public.mk2_rewards(text, text) from public, anon, authenticated;
grant execute on function public.mk2_rewards(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
