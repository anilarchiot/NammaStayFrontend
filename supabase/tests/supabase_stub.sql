-- Minimal Supabase services for a disposable PostgreSQL integration database.
create schema extensions;
create schema auth;
create schema storage;
create publication supabase_realtime;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create table auth.mfa_factors (user_id uuid references auth.users, status text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.user', true), '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('aal', coalesce(nullif(current_setting('test.aal', true), ''), 'aal1'))
$$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema auth, storage to authenticated;
grant select, delete on storage.objects to authenticated;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1, '/')
$$;
