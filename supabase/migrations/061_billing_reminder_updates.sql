-- Use the existing scheduled billing-reminders job; no messages are sent by this migration.
alter table public.billing_reminders drop constraint if exists billing_reminders_kind_check;
alter table public.billing_reminders add constraint billing_reminders_kind_check
  check (kind in ('trial_3d','trial_1d','trial_ended','renew_7d','renew_3d','renew_1d','expired'));

create or replace function public._reminder_text(p_kind text, p_ends timestamptz) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'title', case p_kind
      when 'trial_3d' then 'Your free trial ends soon'
      when 'trial_1d' then 'Your free trial ends soon'
      when 'trial_ended' then 'Your free trial has ended'
      when 'renew_7d' then 'Your NammaStay plan ends soon'
      when 'renew_3d' then 'Your NammaStay plan ends soon'
      when 'renew_1d' then 'Your NammaStay plan ends soon'
      else 'Your NammaStay plan has ended' end,
    'body', case when p_kind in ('trial_ended','expired')
      then 'Review your plan in Settings → Billing. If the grace period has ended, new bookings are paused.'
      else 'Your plan ends on ' || to_char(p_ends at time zone 'Asia/Kolkata', 'DD Mon YYYY') ||
           '. Review and renew in Settings → Billing to keep managing bookings without interruption.' end)
$$;

create or replace function public.run_billing_reminders() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; v_kind text; v_days int; v_id uuid; n int := 0; v_txt jsonb;
begin
  if auth.uid() is not null then perform public._assert_platform_admin(); end if;
  for r in
    select s.property_id, s.trial_ends_at, s.paid_until,
           (s.paid_until is not null and s.paid_until >= s.trial_ends_at) as paid,
           greatest(s.trial_ends_at, coalesce(s.paid_until, s.trial_ends_at)) as ends_at
      from public.subscriptions s
     where not s.is_complimentary and not coalesce(s.is_suspended, false)
       and not exists (select 1 from public.subscription_payments sp where sp.property_id = s.property_id and sp.status = 'pending')
  loop
    v_days := (r.ends_at at time zone 'Asia/Kolkata')::date - (now() at time zone 'Asia/Kolkata')::date;
    v_kind := case
      when not r.paid and v_days between 2 and 3 then 'trial_3d'
      when not r.paid and v_days between 0 and 1 and r.ends_at > now() then 'trial_1d'
      when not r.paid and r.ends_at <= now() and v_days >= -6 then 'trial_ended'
      when r.paid and v_days between 4 and 7 then 'renew_7d'
      when r.paid and v_days between 2 and 3 then 'renew_3d'
      when r.paid and v_days between 0 and 1 and r.ends_at > now() then 'renew_1d'
      when r.paid and r.ends_at <= now() and v_days >= -6 then 'expired'
    end;
    continue when v_kind is null;
    insert into public.billing_reminders (property_id, kind, ends_at) values (r.property_id, v_kind, r.ends_at)
    on conflict (property_id, kind, ends_at) do nothing returning id into v_id;
    if v_id is not null then
      v_txt := public._reminder_text(v_kind, r.ends_at);
      insert into public.notifications (property_id, kind, title, body) values (r.property_id, 'subscription', v_txt->>'title', v_txt->>'body');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.reminders_to_email() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'kind', b.kind, 'ends_at', b.ends_at, 'property', p.name,
           'email', m.email, 'name', coalesce(m.display_name, 'there'), 'text', public._reminder_text(b.kind, b.ends_at))), '[]'::jsonb)
    from public.billing_reminders b join public.properties p on p.id = b.property_id
    join public.subscriptions s on s.property_id = p.id
    join lateral (select email, display_name from public.property_members where property_id = p.id and role = 'owner' and email is not null order by created_at limit 1) m on true
   where b.emailed_at is null and b.created_at > now() - interval '3 days'
     and not s.is_complimentary and not coalesce(s.is_suspended, false)
     and b.ends_at = greatest(s.trial_ends_at, coalesce(s.paid_until, s.trial_ends_at))
     and ((b.kind in ('trial_ended', 'expired') and b.ends_at <= now())
       or (b.kind not in ('trial_ended', 'expired') and b.ends_at > now()))
     and not exists (select 1 from public.subscription_payments sp where sp.property_id = p.id and sp.status = 'pending')
$$;

create or replace function public.admin_reminders(p_all boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public._assert_platform_admin();
  return (select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
    select jsonb_build_object('id', b.id, 'kind', b.kind, 'ends_at', b.ends_at, 'created_at', b.created_at, 'emailed_at', b.emailed_at,
             'whatsapp_done_at', b.whatsapp_done_at, 'property_id', p.id, 'property', p.name, 'city', p.city, 'phone', p.phone,
             'owner', (select coalesce(m.display_name, m.email) from public.property_members m where m.property_id = p.id and m.role = 'owner' order by m.created_at limit 1),
             'email', (select m.email from public.property_members m where m.property_id = p.id and m.role = 'owner' order by m.created_at limit 1),
             'text', public._reminder_text(b.kind, b.ends_at)) x
      from public.billing_reminders b join public.properties p on p.id = b.property_id
      join public.subscriptions s on s.property_id = p.id
     where p_all or (b.whatsapp_done_at is null and b.created_at > now() - interval '10 days'
       and not s.is_complimentary and not coalesce(s.is_suspended, false)
       and b.ends_at = greatest(s.trial_ends_at, coalesce(s.paid_until, s.trial_ends_at))
       and ((b.kind in ('trial_ended', 'expired') and b.ends_at <= now())
         or (b.kind not in ('trial_ended', 'expired') and b.ends_at > now()))
       and not exists (select 1 from public.subscription_payments sp where sp.property_id = p.id and sp.status = 'pending'))
     order by b.created_at desc limit 200) q);
end $$;
notify pgrst, 'reload schema';
