-- Guest rewards for completed NammaStay Search bookings.
-- Earn 1 point per ₹100 of the booking total after checkout and host confirmation.

create or replace function public.mk2_rewards(p_ref text, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_phone text := public._mk2_digits(p_phone);
  v_points int;
  v_completed int;
  v_next int;
  v_tier text;
  v_bookings jsonb;
begin
  if nullif(v_phone, '') is null or not exists (
    select 1 from public.mk_requests
    where ref = upper(trim(p_ref)) and public._mk2_digits(guest_phone) = v_phone
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
  where public._mk2_digits(q.guest_phone) = v_phone
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
