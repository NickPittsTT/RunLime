-- Phase 3, slice 3: followers (Private by default: requests need approval; Public: instant), blocks, people
-- search, profile cards and the race passport. Other people's profiles are only ever read through these
-- SECURITY DEFINER functions, which return safe fields (never DOB, email, home area or emergency contact).

create type public.follow_status as enum ('pending', 'accepted');

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status public.follow_status not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id, status);
alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select on public.follows to authenticated;
create policy "own follows" on public.follows for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;
create policy "own blocks" on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));

insert into public.app_settings (key, value, is_public, description) values
  ('social.follow_requests_per_day', '"100"', false, 'Most follow requests one person can send per day (abuse protection).'),
  ('social.search_min_chars', '"2"', true, 'Characters needed before people search runs.')
on conflict (key) do nothing;

create function public.is_blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.blocks where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a))
$$;
revoke execute on function public.is_blocked_between from public, anon, authenticated;

-- May the caller see this person's passport and races attending? Yourself; public accounts; accepted followers.
create function public.can_see_details(p_user uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    p_user = auth.uid()
    or (not public.is_blocked_between(auth.uid(), p_user)
        and (exists (select 1 from public.profiles where id = p_user and account_privacy = 'public')
             or exists (select 1 from public.follows where follower_id = auth.uid() and followee_id = p_user and status = 'accepted')))
  )
$$;
revoke execute on function public.can_see_details from public, anon;
grant execute on function public.can_see_details to authenticated;

-- ---------------------------------------------------------------------------
-- Follow / unfollow / requests / remove follower
-- ---------------------------------------------------------------------------
create function public.follow_user(p_user uuid) returns public.follow_status
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_privacy public.account_privacy;
  v_status public.follow_status;
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_user = v_uid then
    raise exception 'You cannot follow yourself' using errcode = '22023';
  end if;
  select account_privacy into v_privacy from public.profiles where id = p_user;
  if not found or public.is_blocked_between(v_uid, p_user) then
    raise exception 'That person was not found' using errcode = 'P0002';
  end if;
  select status into v_status from public.follows where follower_id = v_uid and followee_id = p_user;
  if found then
    return v_status;
  end if;
  perform public.check_rate_limit('follow', public.setting_int('social.follow_requests_per_day', 100), interval '1 day');
  v_status := case when v_privacy = 'public' then 'accepted' else 'pending' end;
  insert into public.follows (follower_id, followee_id, status, accepted_at)
  values (v_uid, p_user, v_status, case when v_status = 'accepted' then now() end);
  return v_status;
end;
$$;

-- Unfollow, or cancel a request you sent.
create function public.unfollow_user(p_user uuid) returns void
language sql security definer
set search_path = ''
as $$ delete from public.follows where follower_id = auth.uid() and followee_id = p_user $$;

-- Approve or decline a request someone sent you.
create function public.respond_follow_request(p_follower uuid, p_accept boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.follows set status = 'accepted', accepted_at = now()
     where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
  else
    delete from public.follows where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
  end if;
  if not found then
    raise exception 'That request is no longer there' using errcode = 'P0002';
  end if;
end;
$$;

create function public.remove_follower(p_follower uuid) returns void
language sql security definer
set search_path = ''
as $$ delete from public.follows where follower_id = p_follower and followee_id = auth.uid() $$;

-- Block: removes follows both ways and stops new requests; each disappears from the other's search and lists.
create function public.block_user(p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_user = v_uid or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'That person was not found' using errcode = 'P0002';
  end if;
  delete from public.follows where (follower_id = v_uid and followee_id = p_user) or (follower_id = p_user and followee_id = v_uid);
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user) on conflict do nothing;
end;
$$;

create function public.unblock_user(p_user uuid) returns void
language sql security definer
set search_path = ''
as $$ delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user $$;

-- Switching to Public approves waiting requests (anyone can follow a public account).
create function public.accept_requests_when_public() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.account_privacy = 'public' and old.account_privacy = 'private' then
    update public.follows set status = 'accepted', accepted_at = now() where followee_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
create trigger profiles_accept_requests_when_public after update of account_privacy on public.profiles
  for each row execute function public.accept_requests_when_public();

-- ---------------------------------------------------------------------------
-- Reading other people: search, profile card, passport, follower lists
-- ---------------------------------------------------------------------------
create function public.search_people(p_query text) returns table (id uuid, display_name text, nickname text, avatar_path text, runner_level public.runner_level)
language plpgsql stable security definer
set search_path = ''
as $$
declare v_q text := btrim(coalesce(p_query, ''));
begin
  if auth.uid() is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if char_length(v_q) < public.setting_int('social.search_min_chars', 2) then
    return;
  end if;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select p.id, p.display_name, p.nickname, p.avatar_path, p.runner_level
      from public.profiles p
     where p.id <> auth.uid()
       and (p.display_name ilike '%' || v_q || '%' or p.nickname ilike '%' || v_q || '%')
       and not public.is_blocked_between(auth.uid(), p.id)
     order by (p.nickname ilike v_q || '%' or p.display_name ilike v_q || '%') desc, p.display_name
     limit 20;
end;
$$;

create function public.profile_card(p_user uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles;
  v_out public.follow_status;
  v_in public.follow_status;
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select * into v_p from public.profiles where id = p_user;
  if not found or public.is_blocked_between(v_uid, p_user) then
    raise exception 'That person was not found' using errcode = 'P0002';
  end if;
  select status into v_out from public.follows where follower_id = v_uid and followee_id = p_user;
  select status into v_in from public.follows where follower_id = p_user and followee_id = v_uid;
  return jsonb_build_object(
    'id', v_p.id, 'display_name', v_p.display_name, 'nickname', v_p.nickname, 'avatar_path', v_p.avatar_path,
    'runner_level', v_p.runner_level, 'account_privacy', v_p.account_privacy, 'is_me', p_user = v_uid,
    'following', v_out, 'follows_you', v_in,
    'followers', (select count(*) from public.follows where followee_id = p_user and status = 'accepted'),
    'following_count', (select count(*) from public.follows where follower_id = p_user and status = 'accepted'),
    'can_see_details', public.can_see_details(p_user)
  );
end;
$$;

-- Race passport + races attending, only for those allowed (yourself, public accounts, accepted followers).
-- Races attended and km fill in with GPS check-ins (Phase 4) and run tracking (Phase 5).
create function public.profile_passport(p_user uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.can_see_details(p_user) then
    raise exception 'This account is private' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'races_attended', 0,
    'total_km', 0,
    'attending', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'starts_at', e.starts_at, 'timezone', e.timezone,
                                                               'status', e.status, 'venue_name', e.venue_name) order by e.starts_at), '[]'::jsonb)
                    from public.rsvps r join public.events e on e.id = r.event_id
                   where r.user_id = p_user and r.status = 'going' and e.status in ('published', 'postponed')
                     and e.starts_at > now() - interval '6 hours')
  );
end;
$$;

-- Your followers, who you follow, requests waiting for you, requests you sent, people you blocked.
create function public.my_connections() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'followers', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'nickname', p.nickname, 'avatar_path', p.avatar_path) order by p.display_name), '[]'::jsonb)
                    from public.follows f join public.profiles p on p.id = f.follower_id where f.followee_id = v_uid and f.status = 'accepted'),
    'following', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'nickname', p.nickname, 'avatar_path', p.avatar_path) order by p.display_name), '[]'::jsonb)
                    from public.follows f join public.profiles p on p.id = f.followee_id where f.follower_id = v_uid and f.status = 'accepted'),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'nickname', p.nickname, 'avatar_path', p.avatar_path) order by f.created_at), '[]'::jsonb)
                   from public.follows f join public.profiles p on p.id = f.follower_id where f.followee_id = v_uid and f.status = 'pending'),
    'sent', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'nickname', p.nickname, 'avatar_path', p.avatar_path) order by f.created_at), '[]'::jsonb)
               from public.follows f join public.profiles p on p.id = f.followee_id where f.follower_id = v_uid and f.status = 'pending'),
    'blocked', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name) order by p.display_name), '[]'::jsonb)
                  from public.blocks b join public.profiles p on p.id = b.blocked_id where b.blocker_id = v_uid)
  );
end;
$$;

-- M19: people you follow (approved) who said Going to a race.
create function public.following_going(p_event uuid) returns table (id uuid, display_name text, avatar_path text)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_path
    from public.follows f
    join public.rsvps r on r.user_id = f.followee_id and r.event_id = p_event and r.status = 'going'
    join public.profiles p on p.id = f.followee_id
   where f.follower_id = auth.uid() and f.status = 'accepted' and not public.is_blocked_between(auth.uid(), p.id)
   order by p.display_name
   limit 50
$$;

do $$
declare f text;
begin
  foreach f in array array['follow_user(uuid)', 'unfollow_user(uuid)', 'respond_follow_request(uuid, boolean)', 'remove_follower(uuid)',
                           'block_user(uuid)', 'unblock_user(uuid)', 'search_people(text)', 'profile_card(uuid)', 'profile_passport(uuid)', 'my_connections()', 'following_going(uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Data export: followers, following, requests, blocks.
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
                       from public.reports r where r.reporter_id = v_uid),
    'rsvps', (select coalesce(jsonb_agg(jsonb_build_object('race', e.name, 'starts_at', e.starts_at, 'status', r.status, 'adults', r.adults,
                                                           'children', r.children, 'updated_at', r.updated_at) order by e.starts_at), '[]'::jsonb)
                from public.rsvps r join public.events e on e.id = r.event_id where r.user_id = v_uid),
    'following', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'status', f.status, 'since', f.created_at)), '[]'::jsonb)
                    from public.follows f join public.profiles p on p.id = f.followee_id where f.follower_id = v_uid),
    'followers', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'status', f.status, 'since', f.created_at)), '[]'::jsonb)
                    from public.follows f join public.profiles p on p.id = f.follower_id where f.followee_id = v_uid),
    'blocked', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'since', b.created_at)), '[]'::jsonb)
                  from public.blocks b join public.profiles p on p.id = b.blocked_id where b.blocker_id = v_uid)
  );
end;
$$;
