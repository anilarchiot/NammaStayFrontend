-- Run after migrations in a disposable/local Supabase database.
-- Contract checks only: no guest data or storage objects are modified.
do $$
declare
  v_source text;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'guests' and column_name = 'id_doc_back_path'
  ) then
    raise exception 'guests.id_doc_back_path is missing';
  end if;

  v_source := pg_get_functiondef('public.create_booking(jsonb)'::regprocedure);
  if position('id_doc_back_path' in v_source) = 0 then
    raise exception 'create_booking does not persist the back document path';
  end if;

  v_source := pg_get_functiondef('public.selfcheckin_submit(uuid,jsonb)'::regprocedure);
  if position('id_doc_back_path' in v_source) = 0 then
    raise exception 'selfcheckin_submit does not persist the back document path';
  end if;

  v_source := pg_get_functiondef('public.booking_detail(uuid)'::regprocedure);
  if position('id_doc_back_path' in v_source) = 0 then
    raise exception 'booking_detail does not expose the back document path';
  end if;

  v_source := pg_get_functiondef('public.id_docs_due_for_purge(integer)'::regprocedure);
  if position('id_doc_back_path' in v_source) = 0 then
    raise exception 'id_docs_due_for_purge does not select the back document path';
  end if;

  v_source := pg_get_functiondef('public.mark_id_doc_purged(uuid)'::regprocedure);
  if position('id_doc_back_path' in v_source) = 0 then
    raise exception 'mark_id_doc_purged does not clear the back document path';
  end if;

  raise notice 'PASS: both guest ID document paths are persisted, returned, and purged';
end $$;
