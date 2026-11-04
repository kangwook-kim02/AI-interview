-- Only for a NEW, disposable vanilla PostgreSQL database, never a Supabase project.
-- Minimal Supabase Auth contract for executing the real migrations/RLS tests.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Reproduce legacy Supabase defaults so tests catch a missing REVOKE (TRUNCATE
-- and anonymous table access must not accidentally survive the migration).
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
