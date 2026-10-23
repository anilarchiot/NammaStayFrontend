-- =====================================================================
-- NammaStay · 043_storage_hygiene.sql — ID-photo retention check, booking archive export, blob check
--
-- Three read-only, platform-admin-only functions that back the "Storage" card on the admin page:
--   1. admin_expired_id_files(limit)   ID photos stored longer than every property's retention setting
--                                       (the app deletes them through the Storage API — deleting rows in
--                                        SQL would leave the files behind in the storage backend).
--   2. admin_archivable_bookings(...)  old bookings, one page at a time, for a CSV export.
--   3. admin_blob_columns()            table columns that can hold large binary data (should be none).
--
-- ADD-ON ONLY — new functions, no tables, columns or data change.
-- Safe to run more than once. Rollback: supabase/rollbacks/043_storage_hygiene.sql
-- =====================================================================

-- 1. ID photos kept longer than the longest retention period configured on any property (+ grace days).
create or replace function public.admin_expired_id_files(p_limit int default 200, p_grace_days int default 7)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days    int;
  v_cutoff  timestamptz;
  v_total   bigint := 0;
  v_paths   jsonb  := '[]'::jsonb;
begin
  if not coalesce(public.is_platform_admin(), false) then
    raise exception 'Only NammaStay admins can view storage usage.' using errcode = '42501';
  end if;

  select coalesce(max(id_doc_retention_days), 180) into v_days from public.properties;
  v_cutoff := now() - make_interval(days => v_days + greatest(p_grace_days, 0));

  select count(*) into v_total
  from storage.objects o
  where o.bucket_id = 'guest-ids' and o.created_at < v_cutoff;

  select coalesce(jsonb_agg(x.name), '[]'::jsonb) into v_paths
  from (
    select o.name from storage.objects o
    where o.bucket_id = 'guest-ids' and o.created_at < v_cutoff
    order by o.created_at
    limit least(greatest(p_limit, 1), 500)
  ) x;

  return jsonb_build_object('retention_days', v_days, 'grace_days', greatest(p_grace_days, 0),
                            'expired_count', v_total, 'paths', v_paths);
exception when undefined_table or insufficient_privilege then
  return jsonb_build_object('retention_days', null, 'expired_count', 0, 'paths', '[]'::jsonb);
end;
$$;

-- 2. Old bookings for CSV export (whole rows, so the export stays correct when columns are added).
create or replace function public.admin_archivable_bookings(
  p_years int default 3, p_limit int default 1000, p_offset int default 0
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_platform_admin(), false) then
    raise exception 'Only NammaStay admins can export bookings.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(x))
    from (
      select b.*
      from public.bookings b
      where b.check_out_at < now() - make_interval(years => greatest(p_years, 1))
      order by b.check_out_at, b.id
      limit least(greatest(p_limit, 1), 5000) offset greatest(p_offset, 0)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- 3. Columns that can hold large binary data; files belong in Storage, tables should keep paths only.
create or replace function public.admin_blob_columns()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_platform_admin(), false) then
    raise exception 'Only NammaStay admins can view storage usage.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('table', c.table_name, 'column', c.column_name))
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type = 'bytea'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_expired_id_files(int, int) from public, anon;
revoke all on function public.admin_archivable_bookings(int, int, int) from public, anon;
revoke all on function public.admin_blob_columns() from public, anon;
grant execute on function public.admin_expired_id_files(int, int) to authenticated;
grant execute on function public.admin_archivable_bookings(int, int, int) to authenticated;
grant execute on function public.admin_blob_columns() to authenticated;
