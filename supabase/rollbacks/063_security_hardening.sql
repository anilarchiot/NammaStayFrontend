-- Rollback for 063_security_hardening.sql.
-- Restores the 055 listing policies and the open table-level grants. This re-exposes owner PII to anon.
-- For mk2_rewards, re-apply supabase/migrations/057_guest_rewards.sql (it uses create or replace).
drop policy if exists mk_listings_read on public.mk_listings;
create policy mk_listings_read on public.mk_listings for select using (status = 'published' or host_id = auth.uid());

drop policy if exists mk_rooms_read on public.mk_rooms;
create policy mk_rooms_read on public.mk_rooms for select
  using (exists (select 1 from public.mk_listings l where l.id = listing_id and (l.status = 'published' or l.host_id = auth.uid())));

grant select on public.mk_listings to anon, authenticated;
grant insert, update, delete, truncate, references, trigger on public.mk_listings to anon;

drop function if exists public.mk_listing_visible(uuid);
