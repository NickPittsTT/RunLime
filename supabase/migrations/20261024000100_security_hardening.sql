-- Security hardening (owner, 2026-10-24). Findings from Supabase's Security Advisor (splinter) and the new
-- grant/policy allowlist test (supabase/tests/024_security_baseline.test.sql):
--  1. club_member_counts ran with its owner's rights (SECURITY DEFINER view, Advisor ERROR). It now runs with the
--     caller's rights; its only user is the admin clubs page, and admins can read every membership.
--  2. Supabase's default grants were never trimmed on some tables: anon/authenticated held every privilege
--     (including TRUNCATE, which row security does not cover). Not reachable through the API today, but more than
--     intended. Trimmed to exactly what the policies use; new tables and functions now start with no API access.
--  3. Trigger functions were executable through /rest/v1/rpc (Postgres refuses to run them, but it is noise).
--  4. has_role(role, user) answered for any user id (who is an admin?); it now answers only about the caller,
--     except for server code with no user token (service role, cron).
--  5. setting_int(key) let anyone read any integer setting, including private ones; server functions only now.

-- 1 ---------------------------------------------------------------------------
alter view public.club_member_counts set (security_invoker = true);

-- 2 ---------------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on public.rate_limits, public.user_preferences from anon;
revoke insert, update, delete on public.app_settings, public.countries, public.legal_documents, public.regions from anon;
revoke insert, update, delete on public.countries, public.legal_documents, public.regions, public.rate_limits from authenticated;
revoke insert, delete on public.app_settings from authenticated;          -- admins update settings (policy); never insert/delete
revoke insert, update, delete on public.club_member_counts from authenticated;

-- Fail closed for future migrations: new tables/functions get no anon/authenticated access until granted on purpose.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- 3 ---------------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype loop
    -- Triggers still fire: EXECUTE is checked when a trigger is created, not when it runs.
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- 4 ---------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role, p_user uuid default null) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = coalesce(p_user, auth.uid()) and r.role = p_role
      and (p_user is null or p_user = auth.uid() or coalesce(auth.role(), 'server') not in ('anon', 'authenticated'))
  )
$$;

-- 5 ---------------------------------------------------------------------------
revoke execute on function public.setting_int(text, integer) from public, anon, authenticated;
