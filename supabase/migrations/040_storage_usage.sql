-- =====================================================================
-- NammaStay · 040_storage_usage.sql — database & file storage size report (platform admin only)
--
-- Adds one read-only function, admin_storage_usage(), used by the "Storage" card on the admin page:
--   • total database size, the plan limit and the percentage used
--   • the largest tables
--   • private file storage (ID photos) size and file count
--   • how many bookings are old enough to archive (report only — nothing is changed or deleted)
--
-- ADD-ON ONLY — one new function. No tables, columns or data change.
-- Safe to run more than once. Rollback: supabase/rollbacks/040_storage_usage.sql
-- =====================================================================

create or replace function public.admin_storage_usage(
  p_limit_gb      numeric default 8,    -- database size included in your Supabase plan (Pro = 8)
  p_archive_years int     default 3     -- bookings checked out longer ago than this count as archivable
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_db_bytes      bigint;
  v_tables        jsonb;
  v_files_bytes   bigint := 0;
  v_files_count   bigint := 0;
  v_old_bookings  bigint := 0;
begin
  if not coalesce(public.is_platform_admin(), false) then
    raise exception 'Only NammaStay admins can view storage usage.' using errcode = '42501';
  end if;

  v_db_bytes := pg_database_size(current_database());

  select coalesce(jsonb_agg(t order by t.bytes desc), '[]'::jsonb) into v_tables
  from (
    select c.relname::text as name,
           pg_total_relation_size(c.oid)::bigint as bytes,
           c.reltuples::bigint as approx_rows
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by pg_total_relation_size(c.oid) desc
    limit 8
  ) t;

  -- File storage is optional: skip quietly if the storage schema is not readable.
  begin
    select coalesce(sum((o.metadata ->> 'size')::bigint), 0), count(*)
      into v_files_bytes, v_files_count
    from storage.objects o;
  exception when others then
    v_files_bytes := 0; v_files_count := 0;
  end;

  begin
    select count(*) into v_old_bookings
    from public.bookings b
    where b.check_out_at < now() - make_interval(years => greatest(p_archive_years, 1));
  exception when others then
    v_old_bookings := 0;
  end;

  return jsonb_build_object(
    'db_bytes',         v_db_bytes,
    'limit_bytes',      (p_limit_gb * 1024 * 1024 * 1024)::bigint,
    'used_pct',         round(v_db_bytes / nullif(p_limit_gb * 1024 * 1024 * 1024, 0) * 100, 1),
    'tables',           v_tables,
    'files_bytes',      v_files_bytes,
    'files_count',      v_files_count,
    'archive_years',    greatest(p_archive_years, 1),
    'archivable_bookings', v_old_bookings
  );
end;
$$;

revoke all on function public.admin_storage_usage(numeric, int) from public, anon;
grant execute on function public.admin_storage_usage(numeric, int) to authenticated;
