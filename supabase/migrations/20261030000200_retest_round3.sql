-- Owner retest round 3 (2026-10-30): C1 message limits, C2 photos on Private accounts, B3 clear sign-up error.

-- ---------------------------------------------------------------------------
-- C2: a Private account's photo is shown only to the person, their approved followers and (MFA) admins. Public
-- accounts show it to everyone signed in. Everyone else sees initials (the apps fall back to initials when the path
-- is null). The admin Reports queue (admin_reports) keeps the photo for moderation.
-- ---------------------------------------------------------------------------
create function public.visible_avatar(p_owner uuid, p_path text) returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when p_path is null then null
    when p_owner = auth.uid() or public.is_admin() then p_path
    when (select account_privacy from public.profiles where id = p_owner) = 'public' then p_path
    when exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p_owner and f.status = 'accepted') then p_path
    else null end
$$;
revoke execute on function public.visible_avatar(uuid, text) from public, anon, authenticated;

-- Every reader that shows other people's photos goes through visible_avatar. (Rewritten in place: each of these
-- selects the photo as <alias>.avatar_path next to <alias>.id; the check below fails the migration if one is missed.)
do $$
declare f text; def text;
begin
  foreach f in array array['club_page', 'following_going', 'my_connections', 'profile_card', 'search_people'] loop
    def := pg_get_functiondef(('public.' || f)::regproc);
    def := regexp_replace(def, '(?<![A-Za-z_])(v_p|p)\.avatar_path', 'public.visible_avatar(\1.id, \1.avatar_path)', 'g');
    if position('public.visible_avatar(' in def) = 0 then
      raise exception 'visible_avatar not applied to %', f;
    end if;
    execute def;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- C1: organiser updates — 3 per race in any 7 days (setting), 10 in the 7 days before the race (setting; the race
-- date is the postponed date when postponed, i.e. starts_at). Admins are exempt (recorded and audit-logged).
-- Automatic status notices (postponed / cancelled / back on) are separate and never counted.
-- ---------------------------------------------------------------------------
update public.app_settings set value = '3' where key = 'messages.per_race_per_week';
insert into public.app_settings (key, value, is_public, description) values
  ('messages.race_week_limit', '10', false, 'Organiser updates allowed per race in the 7 days before the race (instead of messages.per_race_per_week).')
on conflict (key) do update set value = excluded.value;

alter table public.event_messages add column by_admin boolean not null default false;
drop trigger if exists audit_event_messages on public.event_messages;
create trigger audit_event_messages after insert or update or delete on public.event_messages
  for each row execute function audit.capture('id', 'id,event_id,recipients,by_admin,created_at', '');

-- What the sender may still send: used in the last 7 days (admin messages not counted), the limit that applies now.
create function public.event_message_allowance(p_event uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_e public.events; v_race_week boolean; v_limit int; v_used int;
begin
  select * into v_e from public.events where id = p_event;
  if not found or not (public.is_admin() or public.can_edit_event(p_event)) then
    raise exception 'You cannot message runners for this race' using errcode = '42501';
  end if;
  v_race_week := v_e.starts_at > now() and v_e.starts_at <= now() + interval '7 days';
  v_limit := case when v_race_week then public.setting_int('messages.race_week_limit', 10) else public.setting_int('messages.per_race_per_week', 3) end;
  select count(*)::int into v_used from public.event_messages
   where event_id = p_event and created_at > now() - interval '7 days' and not by_admin;
  return jsonb_build_object(
    'used', v_used, 'limit', v_limit, 'remaining', greatest(v_limit - v_used, 0), 'race_week', v_race_week,
    'normal_limit', public.setting_int('messages.per_race_per_week', 3), 'race_week_limit', public.setting_int('messages.race_week_limit', 10),
    'admin_exempt', public.is_admin());
end;
$$;
revoke execute on function public.event_message_allowance(uuid) from public, anon;
grant execute on function public.event_message_allowance(uuid) to authenticated;

create or replace function public.send_event_message(p_event uuid, p_body text) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare v_e public.events; v_body text := btrim(coalesce(p_body, '')); v_n int := 0; v_allow jsonb; v_admin boolean := public.is_admin(); r record;
begin
  select * into v_e from public.events where id = p_event;
  if not found or not (v_admin or public.can_edit_event(p_event)) then
    raise exception 'You cannot message runners for this race' using errcode = '42501';
  end if;
  if v_e.status not in ('published', 'postponed') then
    raise exception 'Messages can only be sent for live races' using errcode = '22023';
  end if;
  if char_length(v_body) < 5 or char_length(v_body) > 500 then
    raise exception 'Message: 5 to 500 characters' using errcode = '22023';
  end if;
  if not v_admin then
    v_allow := public.event_message_allowance(p_event);
    if (v_allow ->> 'remaining')::int <= 0 then
      raise exception 'You have used all % updates for this race in the last 7 days%', v_allow ->> 'limit',
        case when (v_allow ->> 'race_week')::boolean then ' (race-week allowance)' else '. In the 7 days before the race you can send up to ' || (v_allow ->> 'race_week_limit') end
        using errcode = '22023';
    end if;
  end if;
  for r in select user_id from public.rsvps where event_id = p_event and status in ('going', 'maybe') loop
    perform public.notify(r.user_id, 'organiser_message', v_e.name || ': update from the organiser', v_body, jsonb_build_object('event_id', p_event));
    v_n := v_n + 1;
  end loop;
  insert into public.event_messages (event_id, sender_id, body, recipients, by_admin) values (p_event, auth.uid(), v_body, v_n, v_admin);
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- B3: "Finish setting up" said "Something went wrong" — most likely a nickname already in use (unique, case-
-- insensitive). Say so plainly. (Unchanged otherwise.)
-- ---------------------------------------------------------------------------
create or replace function public.complete_signup(p_date_of_birth date, p_display_name text, p_nickname text, p_home_region_id uuid, p_terms_version text, p_privacy_version text)
returns jsonb
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
  if nullif(btrim(p_nickname), '') is not null and exists (select 1 from public.profiles where lower(nickname) = lower(btrim(p_nickname))) then
    raise exception 'That nickname is already taken. Choose another, or leave it empty.' using errcode = '22023';
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
