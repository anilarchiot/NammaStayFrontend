-- Rollback for 20261101120000_housekeeping_addon.sql (removes Housekeeping add-on payments and access).
drop function if exists public.admin_review_housekeeping_addon_payment(uuid, boolean, text);
drop function if exists public.admin_housekeeping_addon_requests();
drop function if exists public.housekeeping_addon_submit(uuid, text);
drop function if exists public.housekeeping_addon_status(uuid);
drop table if exists public.housekeeping_addon_payments;
drop table if exists public.housekeeping_addon_access;