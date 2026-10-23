-- Rollback for 043_storage_hygiene.sql — removes the three read-only helper functions.
drop function if exists public.admin_expired_id_files(int, int);
drop function if exists public.admin_archivable_bookings(int, int, int);
drop function if exists public.admin_blob_columns();
