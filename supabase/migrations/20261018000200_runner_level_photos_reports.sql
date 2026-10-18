-- Phase 3, slice 1: runner level, profile photos, reports + admin moderation queue.

-- ---------------------------------------------------------------------------
-- Runner level: self-declared, optional, for the profile only. It never changes speed checks.
-- ---------------------------------------------------------------------------
create type public.runner_level as enum ('casual', 'club_runner', 'competitive');
alter table public.profiles add column runner_level public.runner_level;
grant update (runner_level) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Profile photos. Files live in the public "avatars" bucket under <user id>/<random id>.jpg.
-- Only the profile-photo Edge Function writes them (service role): it re-checks the JPEG, strips all metadata
-- (EXIF incl. GPS location, XMP, comments) and sets profiles.avatar_path. Users cannot write the bucket or the
-- column directly. Shown with the display name wherever the profile appears (no DOB, no email).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column avatar_path text check (avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f]{32}\.jpg$'),
  add column avatar_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Reports (Play UGC + Child Safety Standards: in-app reporting of users and content, and safety concerns).
-- One admin queue; child-safety reports first; reviewed within 48 h (Moderation Policy).
-- ---------------------------------------------------------------------------
create type public.report_category as enum ('child_safety', 'sexual_content', 'harassment', 'hate_or_violence', 'impersonation', 'spam', 'other');
create type public.report_target as enum ('profile_photo', 'profile', 'club', 'event', 'general');
create type public.report_status as enum ('open', 'actioned', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  category public.report_category not null,
  target_kind public.report_target not null,
  target_user_id uuid references public.profiles (id) on delete cascade,
  -- What was reported, captured at report time (e.g. the photo path, a club or event id).
  target_ref text check (char_length(target_ref) <= 200),
  details text not null default '' check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolution_note text check (char_length(resolution_note) <= 500),
  constraint target_user_for_people check (target_kind not in ('profile_photo', 'profile') or target_user_id is not null)
);
create index reports_open_idx on public.reports (status, category, created_at);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
create policy "admins read reports" on public.reports for select to authenticated using ((select public.is_admin()));
create policy "reporters read their own reports" on public.reports for select to authenticated using (reporter_id = (select auth.uid()));

-- Who reported whom never enters the audit log as a raw id: the reported person is aliased, the reporter omitted.
create trigger audit_reports after insert or update or delete on public.reports
  for each row execute function audit.capture('id', 'id,category,target_kind,status,resolved_at,resolution_note', 'target_user_id');

insert into public.app_settings (key, value, is_public, description) values
  ('moderation.reports_per_hour', '"10"', false, 'Maximum reports one person can send per hour (abuse protection).')
on conflict (key) do nothing;

create function public.submit_report(
  p_category public.report_category,
  p_target_kind public.report_target,
  p_target_user uuid default null,
  p_target_ref text default null,
  p_details text default ''
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ref text := nullif(btrim(coalesce(p_target_ref, '')), '');
  v_details text := btrim(coalesce(p_details, ''));
  v_id uuid;
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  perform public.check_rate_limit('report', public.setting_int('moderation.reports_per_hour', 10), interval '1 hour');
  if char_length(v_details) > 1000 then
    raise exception 'Please keep the details under 1,000 characters' using errcode = '22023';
  end if;
  if p_target_kind in ('profile_photo', 'profile') then
    if p_target_user is null or not exists (select 1 from public.profiles where id = p_target_user) then
      raise exception 'That person was not found' using errcode = 'P0002';
    end if;
    if p_target_user = v_uid then
      raise exception 'You cannot report yourself' using errcode = '22023';
    end if;
  end if;
  if p_target_kind = 'profile_photo' then
    select avatar_path into v_ref from public.profiles where id = p_target_user;
    if v_ref is null then
      raise exception 'This person has no profile photo' using errcode = '22023';
    end if;
  end if;
  if p_target_kind = 'general' and char_length(v_details) < 10 then
    raise exception 'Please describe the concern in at least 10 characters' using errcode = '22023';
  end if;
  insert into public.reports (reporter_id, category, target_kind, target_user_id, target_ref, details)
  values (v_uid, p_category, p_target_kind, case when p_target_kind in ('profile_photo', 'profile') then p_target_user end, v_ref, v_details)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.submit_report from public, anon;
grant execute on function public.submit_report to authenticated;

-- Admin queue: open reports first, child safety at the top; includes the reported person's name and photo path.
create function public.admin_reports(p_status public.report_status default 'open') returns table (
  id uuid, category public.report_category, target_kind public.report_target, target_user_id uuid, target_name text,
  target_ref text, current_avatar_path text, details text, status public.report_status, created_at timestamptz,
  resolved_at timestamptz, resolution_note text, reports_against_user bigint
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select r.id, r.category, r.target_kind, r.target_user_id, p.display_name, r.target_ref, p.avatar_path, r.details, r.status,
           r.created_at, r.resolved_at, r.resolution_note,
           (select count(*) from public.reports r2 where r2.target_user_id = r.target_user_id and r.target_user_id is not null)
      from public.reports r left join public.profiles p on p.id = r.target_user_id
     where r.status = p_status
     order by (r.category = 'child_safety') desc, r.created_at
     limit 200;
end;
$$;
revoke execute on function public.admin_reports from public, anon;
grant execute on function public.admin_reports to authenticated;

create function public.admin_resolve_report(p_report uuid, p_status public.report_status, p_note text default null) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_status not in ('actioned', 'dismissed') then
    raise exception 'Choose actioned or dismissed' using errcode = '22023';
  end if;
  update public.reports
     set status = p_status, resolved_at = now(), resolved_by = auth.uid(), resolution_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_report and status = 'open';
  if not found then
    raise exception 'Report not found or already resolved' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.admin_resolve_report from public, anon;
grant execute on function public.admin_resolve_report to authenticated;

-- Removes a person's photo from their profile (the Edge Function then deletes the file) and closes every open
-- photo report about them. Without a report, one is recorded so each removal is in the queue history and audit log.
create function public.admin_remove_avatar(p_user uuid, p_report uuid default null, p_note text default null) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_path text;
  v_note text := coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Photo removed');
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select avatar_path into v_path from public.profiles where id = p_user for update;
  if not found then
    raise exception 'That person was not found' using errcode = 'P0002';
  end if;
  update public.profiles set avatar_path = null, avatar_updated_at = now() where id = p_user;
  if p_report is null then
    insert into public.reports (reporter_id, category, target_kind, target_user_id, target_ref, details)
    values (null, 'other', 'profile_photo', p_user, v_path, 'Removed by an admin');
  end if;
  update public.reports
     set status = 'actioned', resolved_at = now(), resolved_by = auth.uid(), resolution_note = v_note
   where status = 'open' and target_user_id = p_user and (id = p_report or target_kind = 'profile_photo');
  return v_path;
end;
$$;
revoke execute on function public.admin_remove_avatar from public, anon;
grant execute on function public.admin_remove_avatar to authenticated;

-- ---------------------------------------------------------------------------
-- Data export: runner level and photo are in "profile" (to_jsonb); reports the person sent are added.
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
                                          'sign_in_methods', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb))
                  from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = v_uid),
    'home_area', (select r.name from public.profiles p join public.regions r on r.id = p.home_region_id where p.id = v_uid),
    'preferences', (select jsonb_build_object(
                      'areas', (select coalesce(jsonb_agg(r.name order by r.name), '[]'::jsonb) from public.regions r where r.id = any (up.region_ids)),
                      'distances_km', to_jsonb(up.distance_km), 'onboarded_at', up.onboarded_at, 'updated_at', up.updated_at)
                      from public.user_preferences up where up.user_id = v_uid),
    'roles', (select coalesce(jsonb_agg(r.role), '[]'::jsonb) from public.user_roles r where r.user_id = v_uid),
    'consents', (select coalesce(jsonb_agg(jsonb_build_object('kind', c.kind, 'version', c.version, 'granted_at', c.granted_at, 'revoked_at', c.revoked_at)
                                           order by c.granted_at), '[]'::jsonb) from public.consents c where c.user_id = v_uid),
    'clubs', (select coalesce(jsonb_agg(jsonb_build_object('club', cl.name, 'joined_at', m.joined_at)), '[]'::jsonb)
                from public.club_members m join public.clubs cl on cl.id = m.club_id where m.user_id = v_uid),
    'organisations', (select coalesce(jsonb_agg(jsonb_build_object('name', o.name, 'role', m.role, 'status', o.status)), '[]'::jsonb)
                        from public.organisation_members m join public.organisations o on o.id = m.organisation_id where m.user_id = v_uid),
    'reports_sent', (select coalesce(jsonb_agg(jsonb_build_object('category', r.category, 'about', r.target_kind, 'details', r.details,
                                                                  'sent_at', r.created_at, 'status', r.status) order by r.created_at), '[]'::jsonb)
                       from public.reports r where r.reporter_id = v_uid)
  );
end;
$$;
