-- Fix: "invalid regular expression: invalid repetition count(s)" (SQLSTATE 2201B) when saving a UPI ID
-- (Settings → Payments, Admin → Subscribers → Billing settings, Setup).
-- PostgreSQL allows at most 255 in a regex {m,n} count; the UPI pattern used {2,256}. Postgres only
-- compiles the pattern when a non-empty UPI ID is checked, so it slipped through until now.
-- This rewrites {2,256} → {2,255} in every check constraint and function in the public schema,
-- including ones created outside this repo (e.g. admin_save_billing_settings). Safe to run twice.
do $$
declare
  r record;
  def text;
begin
  -- Check constraints (e.g. properties.upi_id, billing settings upi_id)
  for r in
    select c.conname, c.conrelid::regclass as tbl, pg_get_constraintdef(c.oid) as condef
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%{2,256}%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, replace(r.condef, '{2,256}', '{2,255}'));
    raise notice 'Fixed constraint % on %', r.conname, r.tbl;
  end loop;

  -- Functions (e.g. admin_save_billing_settings). CREATE OR REPLACE keeps owner and grants.
  for r in
    select p.oid, p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosrc like '%{2,256}%'
  loop
    def := pg_get_functiondef(r.oid);
    execute replace(def, '{2,256}', '{2,255}');
    raise notice 'Fixed function %', r.sig;
  end loop;
end $$;

-- Check: should return no rows.
select 'constraint' as kind, conname::text as name from pg_constraint c join pg_namespace n on n.oid = c.connamespace
 where n.nspname = 'public' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%{2,256}%'
union all
select 'function', p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosrc like '%{2,256}%';
