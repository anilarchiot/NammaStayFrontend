-- Rollback for 20261101130000_ota_addon.sql (removes OTA sync add-on payments and access, restores ota_overview).
do $$ begin
  if to_regprocedure('public._ota_overview_unchecked(uuid)') is not null then
    drop function if exists public.ota_overview(uuid);
    alter function public._ota_overview_unchecked(uuid) rename to ota_overview;
    grant execute on function public.ota_overview(uuid) to authenticated;
  end if;
end $$;
drop function if exists public._ota_require_addon(uuid);
drop function if exists public.admin_review_ota_addon_payment(uuid, boolean, text);
drop function if exists public.admin_ota_addon_requests();
drop function if exists public.ota_addon_submit(uuid, text);
drop function if exists public.ota_addon_status(uuid);
drop table if exists public.ota_addon_payments;
drop table if exists public.ota_addon_access;
