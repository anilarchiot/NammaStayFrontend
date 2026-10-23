-- Rollback for 040_storage_usage.sql — removes the read-only storage report function.
drop function if exists public.admin_storage_usage(numeric, int);
