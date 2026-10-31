-- Rollback for 058_admin_delete_subscriber.sql (removes the admin RPC; deleted properties are not restored)
drop function if exists public.admin_delete_subscriber(uuid);
