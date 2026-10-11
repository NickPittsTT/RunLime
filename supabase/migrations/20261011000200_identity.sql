-- Identity: profiles (18+ hard rule), private profile data, roles, consents, auth hooks, MFA-gated admin helpers.

-- ---------------------------------------------------------------------------
-- AGE RULE (hard, not configurable). Mirrors packages/shared/src/rules/age.ts:
-- adult  <=>  dob <= (today in America/Port_of_Spain) - 18 years
-- ---------------------------------------------------------------------------
create function public.age_reference_date() returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'America/Port_of_Spain')::date $$;

create function public.is_adult(p_dob date, p_today date default null) returns boolean
language sql stable
set search_path = ''
as $$
  select p_dob is not null
     and p_dob <= (coalesce(p_today, public.age_reference_date()) - interval '18 years')::date
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  nickname text check (nickname ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{1,28}[A-Za-z0-9]$'),
  date_of_birth date not null,
  home_region_id uuid not null references public.regions (id),
  account_privacy public.account_privacy not null default 'private',
  show_attendance_to_clubs boolean not null default false,
  weight_kg numeric(5, 1) check (weight_kg is null or weight_kg between 25 and 300),
  health_consent_at timestamptz,
  country_code char(2) not null default 'TT' references public.countries (code),
  timezone text not null default 'America/Port_of_Spain',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- weight is health data: only with explicit consent
  constraint weight_requires_consent check (weight_kg is null or health_consent_at is not null)
);
create unique index profiles_nickname_key on public.profiles (lower(nickname)) where nickname is not null;

create function public.enforce_adult() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_adult(new.date_of_birth) then
    raise exception 'RunLime accounts are for adults aged 18 and over.'
      using errcode = 'check_violation', hint = 'age_rule';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_adult
  before insert or update of date_of_birth on public.profiles
  for each row execute function public.enforce_adult();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Column-level privileges: users may edit only these fields; DOB is fixed after sign-up (support can correct it).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, nickname, home_region_id, account_privacy, show_attendance_to_clubs, weight_kg, health_consent_at)
  on public.profiles to authenticated;

create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Private profile data (emergency contact ciphertext). Owner-only; no admin access by design.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  emergency_contact_ciphertext text,
  key_version smallint,
  updated_at timestamptz not null default now(),
  constraint ciphertext_has_version check ((emergency_contact_ciphertext is null) = (key_version is null))
);
create trigger profile_private_updated_at before update on public.profile_private
  for each row execute function public.set_updated_at();
alter table public.profile_private enable row level security;
revoke all on public.profile_private from anon, authenticated;
grant select, insert, update, delete on public.profile_private to authenticated;
create policy "owner only" on public.profile_private for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

create function public.has_role(p_role public.app_role, p_user uuid default null) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = coalesce(p_user, auth.uid()) and r.role = p_role
  )
$$;

create function public.has_profile() returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid()) $$;

-- MFA: admin rights apply only when the session is at assurance level 2 (TOTP verified).
create function public.mfa_verified() returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' $$;

create function public.is_super_admin() returns boolean
language sql stable
set search_path = ''
as $$ select public.mfa_verified() and public.has_role('super_admin') $$;

create function public.is_admin() returns boolean
language sql stable
set search_path = ''
as $$ select public.mfa_verified() and (public.has_role('platform_admin') or public.has_role('super_admin')) $$;

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Settings policies (need is_admin)
grant select on public.app_settings to anon, authenticated;
grant update (value) on public.app_settings to authenticated;
create policy "public settings are readable" on public.app_settings for select
  using (is_public or (select public.is_admin()));
create policy "admins update settings" on public.app_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Consents (evidence of terms/privacy acceptance and opt-ins)
-- ---------------------------------------------------------------------------
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.consent_kind not null,
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index consents_user_idx on public.consents (user_id, kind);
alter table public.consents enable row level security;
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;
create policy "read own consents" on public.consents for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Sign-up completion. The ONLY way a profile is created by a user.
-- Under-18: the auth user is deleted immediately and nothing is stored.
-- ---------------------------------------------------------------------------
create function public.complete_signup(
  p_date_of_birth date,
  p_display_name text,
  p_nickname text,
  p_home_region_id uuid,
  p_terms_version text,
  p_privacy_version text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    return jsonb_build_object('status', 'exists');
  end if;
  if not public.is_adult(p_date_of_birth) then
    delete from auth.users where id = v_uid;
    return jsonb_build_object('status', 'blocked');
  end if;
  if not exists (select 1 from public.regions where id = p_home_region_id and kind = 'area') then
    raise exception 'Unknown home area' using errcode = '22023';
  end if;
  if coalesce(p_terms_version, '') = '' or coalesce(p_privacy_version, '') = '' then
    raise exception 'Terms and privacy policy must be accepted' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name, nickname, date_of_birth, home_region_id)
  values (v_uid, btrim(p_display_name), nullif(btrim(p_nickname), ''), p_date_of_birth, p_home_region_id);

  insert into public.user_roles (user_id, role) values (v_uid, 'participant');
  insert into public.consents (user_id, kind, version) values
    (v_uid, 'terms', p_terms_version),
    (v_uid, 'privacy', p_privacy_version);

  -- Data minimisation: DOB now lives only in profiles.
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'date_of_birth'
   where id = v_uid;

  return jsonb_build_object('status', 'ok');
end;
$$;
revoke execute on function public.complete_signup from public, anon;
grant execute on function public.complete_signup to authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion (in-app and web). Cascades to all personal rows.
-- ---------------------------------------------------------------------------
create function public.delete_my_account() returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if public.has_role('super_admin') then
    raise exception 'The super admin account cannot be self-deleted; transfer ownership first.' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account from public, anon;
grant execute on function public.delete_my_account to authenticated;

-- Profile-less auth users (e.g. OAuth sign-ups that never completed the age gate) are purged after 1 hour.
create function public.purge_incomplete_signups() returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from auth.users u
   where u.created_at < now() - interval '1 hour'
     and not exists (select 1 from public.profiles p where p.id = u.id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.purge_incomplete_signups from public, anon, authenticated;

select cron.schedule('purge-incomplete-signups', '*/10 * * * *', $$select public.purge_incomplete_signups()$$);

-- ---------------------------------------------------------------------------
-- Auth hooks (configured in supabase/config.toml and the hosted dashboard)
-- ---------------------------------------------------------------------------

-- Before User Created: reject email sign-ups without an 18+ date of birth.
-- Google/Apple ID-token sign-ups cannot carry custom data, so they are admitted here and
-- remain inert (no profile => no access) until complete_signup enforces the age rule.
create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
  v_dob_text text := event -> 'user' -> 'user_metadata' ->> 'date_of_birth';
  v_dob date;
  v_reject jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', 'RunLime accounts are for adults aged 18 and over.'));
begin
  if v_provider in ('google', 'apple') then
    return '{}'::jsonb;
  end if;
  if v_provider is distinct from 'email' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'This sign-in method is not supported.'));
  end if;
  begin
    v_dob := v_dob_text::date;
  exception when others then
    return v_reject;
  end;
  if not public.is_adult(v_dob) then
    return v_reject;
  end if;
  return '{}'::jsonb;
end;
$$;

-- Custom access token: expose roles to clients for UI only. RLS always re-checks the table.
create function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_roles jsonb;
begin
  select coalesce(jsonb_agg(r.role order by r.role), '[]'::jsonb) into v_roles
    from public.user_roles r where r.user_id = (event ->> 'user_id')::uuid;
  v_claims := jsonb_set(v_claims, '{app_roles}', v_roles);
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

revoke execute on function public.hook_before_user_created from public, anon, authenticated;
revoke execute on function public.custom_access_token_hook from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant execute on function public.is_adult to supabase_auth_admin;
grant execute on function public.age_reference_date to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Admin user management (MFA-gated). Returns no DOB or other sensitive fields.
-- ---------------------------------------------------------------------------
create function public.admin_list_users(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, email text, display_name text, nickname text, roles public.app_role[], created_at timestamptz, last_sign_in_at timestamptz, has_mfa boolean)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access requires MFA' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.display_name, p.nickname,
           coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}'),
           p.created_at, u.last_sign_in_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified')
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.user_roles r on r.user_id = p.id
     where p_search is null or p_search = ''
        or p.display_name ilike '%' || p_search || '%'
        or p.nickname ilike '%' || p_search || '%'
        or u.email ilike '%' || p_search || '%'
     group by p.id, u.email, u.last_sign_in_at
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;
revoke execute on function public.admin_list_users from public, anon;
grant execute on function public.admin_list_users to authenticated;

-- Only a super admin (with MFA) can grant or revoke platform_admin.
create function public.set_platform_admin(p_user uuid, p_grant boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only the super admin (with MFA) can change platform admins' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot change your own admin role' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Unknown user' using errcode = '22023';
  end if;
  if p_grant then
    insert into public.user_roles (user_id, role) values (p_user, 'platform_admin') on conflict do nothing;
  else
    delete from public.user_roles where user_id = p_user and role = 'platform_admin';
  end if;
end;
$$;
revoke execute on function public.set_platform_admin from public, anon;
grant execute on function public.set_platform_admin to authenticated;
