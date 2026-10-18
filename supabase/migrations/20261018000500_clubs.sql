-- Phase 3, slice 4: clubs with leaders. Joining is a request a club leader approves; only approved memberships
-- count. Runners can ask for a new club (admin approves). One primary club per person (leaderboards, Phase 6).
-- Club turnout on race pages: counts only, from approved members who opted in (profiles.show_attendance_to_clubs),
-- hidden below clubs.turnout_min (setting, 5).

create type public.club_member_status as enum ('pending', 'approved');
create type public.club_role as enum ('member', 'leader');

alter table public.club_members
  add column status public.club_member_status not null default 'pending',
  add column role public.club_role not null default 'member',
  add column is_primary boolean not null default false,
  add column requested_at timestamptz not null default now(),
  add column approved_at timestamptz,
  add constraint primary_needs_approval check (not is_primary or status = 'approved'),
  add constraint leader_needs_approval check (role = 'member' or status = 'approved');
-- Memberships made before leaders existed (admin-managed clubs) count as approved.
update public.club_members set status = 'approved', approved_at = joined_at;
create unique index club_members_one_primary on public.club_members (user_id) where is_primary;
create index club_members_club_idx on public.club_members (club_id, status);

-- All changes go through the functions below (no direct inserts any more; leaving is still a plain delete).
drop policy "join active clubs" on public.club_members;
revoke insert on public.club_members from authenticated;
drop policy "read own memberships" on public.club_members;
create policy "read own memberships" on public.club_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Who approved whom is audited (person aliased, never raw ids).
create trigger audit_club_members after insert or update or delete on public.club_members
  for each row execute function audit.capture('', 'club_id,status,role,is_primary,approved_at', 'user_id');

insert into public.app_settings (key, value, is_public, description) values
  ('clubs.turnout_min', '"5"', true, 'Club turnout on race pages is hidden when fewer than this many opted-in members are going.'),
  ('clubs.requests_per_week', '"3"', false, 'Most new-club requests one person can send per week.')
on conflict (key) do nothing;

create function public.is_club_leader(p_club uuid, p_user uuid default null) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.club_members where club_id = p_club and user_id = coalesce(p_user, auth.uid())
                  and role = 'leader' and status = 'approved')
$$;
revoke execute on function public.is_club_leader from public, anon;
grant execute on function public.is_club_leader to authenticated;

-- ---------------------------------------------------------------------------
-- Joining, leaving, leaders approving, primary club
-- ---------------------------------------------------------------------------
create function public.request_join_club(p_club uuid) returns public.club_member_status
language plpgsql security definer
set search_path = ''
as $$
declare v_status public.club_member_status;
begin
  if auth.uid() is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if not exists (select 1 from public.clubs where id = p_club and archived_at is null) then
    raise exception 'Club not found' using errcode = 'P0002';
  end if;
  select status into v_status from public.club_members where club_id = p_club and user_id = auth.uid();
  if found then
    return v_status;
  end if;
  insert into public.club_members (club_id, user_id, status) values (p_club, auth.uid(), 'pending');
  return 'pending';
end;
$$;

-- Leave a club or cancel a request (also plain DELETE on your own row).
create function public.leave_club(p_club uuid) returns void
language sql security definer
set search_path = ''
as $$ delete from public.club_members where club_id = p_club and user_id = auth.uid() $$;

create function public.respond_club_request(p_club uuid, p_user uuid, p_accept boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (public.is_club_leader(p_club) or public.is_admin()) then
    raise exception 'Only this club''s leaders can approve members' using errcode = '42501';
  end if;
  if p_accept then
    update public.club_members set status = 'approved', approved_at = now() where club_id = p_club and user_id = p_user and status = 'pending';
  else
    delete from public.club_members where club_id = p_club and user_id = p_user and status = 'pending';
  end if;
  if not found then
    raise exception 'That request is no longer there' using errcode = 'P0002';
  end if;
end;
$$;

create function public.remove_club_member(p_club uuid, p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (public.is_club_leader(p_club) or public.is_admin()) then
    raise exception 'Only this club''s leaders can remove members' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'Use Leave club to leave' using errcode = '22023';
  end if;
  if public.is_club_leader(p_club, p_user) and not public.is_admin() then
    raise exception 'Only an admin can remove a club leader' using errcode = '42501';
  end if;
  delete from public.club_members where club_id = p_club and user_id = p_user;
end;
$$;

-- Admins appoint or remove leaders (the person must be an approved member, or becomes one).
create function public.admin_set_club_leader(p_club uuid, p_user uuid, p_leader boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) or not exists (select 1 from public.clubs where id = p_club) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  insert into public.club_members (club_id, user_id, status, role, approved_at)
  values (p_club, p_user, 'approved', case when p_leader then 'leader' else 'member' end::public.club_role, now())
  on conflict (club_id, user_id) do update
    set role = case when p_leader then 'leader' else 'member' end::public.club_role, status = 'approved',
        approved_at = coalesce(public.club_members.approved_at, now());
end;
$$;

create function public.set_primary_club(p_club uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_club is not null and not exists (select 1 from public.club_members where club_id = p_club and user_id = auth.uid() and status = 'approved') then
    raise exception 'Choose a club you are an approved member of' using errcode = '22023';
  end if;
  update public.club_members set is_primary = false where user_id = auth.uid() and is_primary;
  if p_club is not null then
    update public.club_members set is_primary = true where club_id = p_club and user_id = auth.uid();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- New-club requests (admin approves)
-- ---------------------------------------------------------------------------
create type public.club_request_status as enum ('pending', 'approved', 'rejected');
create table public.club_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 500),
  region_id uuid references public.regions (id),
  status public.club_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  review_note text check (char_length(review_note) <= 500),
  club_id uuid references public.clubs (id) on delete set null
);
alter table public.club_requests enable row level security;
revoke all on public.club_requests from anon, authenticated;
grant select on public.club_requests to authenticated;
create policy "own or admin" on public.club_requests for select to authenticated
  using (requester_id = (select auth.uid()) or (select public.is_admin()));
create trigger audit_club_requests after insert or update or delete on public.club_requests
  for each row execute function audit.capture('id', 'id,name,status,reviewed_at,review_note,club_id', '');

create function public.request_new_club(p_name text, p_description text default null, p_region uuid default null) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid; v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  perform public.check_rate_limit('club_request', public.setting_int('clubs.requests_per_week', 3), interval '7 days');
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Club name: 2 to 80 characters' using errcode = '22023';
  end if;
  if exists (select 1 from public.clubs where lower(name) = lower(v_name) and archived_at is null) then
    raise exception 'That club is already listed. Ask to join it instead' using errcode = '22023';
  end if;
  insert into public.club_requests (requester_id, name, description, region_id)
  values (auth.uid(), v_name, nullif(btrim(coalesce(p_description, '')), ''), p_region)
  returning id into v_id;
  return v_id;
end;
$$;

-- Approve: creates the club; the requester joins as an approved member and, if chosen, its first leader.
create function public.admin_review_club_request(p_request uuid, p_approve boolean, p_make_leader boolean default true, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_r public.club_requests; v_club uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into v_r from public.club_requests where id = p_request and status = 'pending' for update;
  if not found then
    raise exception 'Request not found or already reviewed' using errcode = 'P0002';
  end if;
  if p_approve then
    insert into public.clubs (name, description, region_id) values (v_r.name, v_r.description, v_r.region_id) returning id into v_club;
    if v_r.requester_id is not null then
      insert into public.club_members (club_id, user_id, status, role, approved_at)
      values (v_club, v_r.requester_id, 'approved', case when p_make_leader then 'leader' else 'member' end::public.club_role, now());
    end if;
  elsif char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Tell the runner why (at least a few words)' using errcode = '22023';
  end if;
  update public.club_requests
     set status = case when p_approve then 'approved' else 'rejected' end::public.club_request_status,
         reviewed_at = now(), reviewed_by = auth.uid(), review_note = nullif(btrim(coalesce(p_note, '')), ''), club_id = v_club
   where id = p_request;
  return v_club;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading: directory, club page (leaders see requests and members), my clubs, turnout
-- ---------------------------------------------------------------------------
create function public.club_directory(p_query text default null) returns table (
  id uuid, name text, description text, area text, members integer, my_status public.club_member_status, my_role public.club_role, is_primary boolean
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, c.description, r.name,
         (select count(*)::int from public.club_members m where m.club_id = c.id and m.status = 'approved'),
         me.status, me.role, coalesce(me.is_primary, false)
    from public.clubs c
    left join public.regions r on r.id = c.region_id
    left join public.club_members me on me.club_id = c.id and me.user_id = auth.uid()
   where c.archived_at is null
     and (coalesce(btrim(p_query), '') = '' or c.name ilike '%' || btrim(p_query) || '%')
   order by (me.status is not null) desc, c.name
   limit 200
$$;

create function public.club_page(p_club uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_c public.clubs; v_lead boolean;
begin
  if auth.uid() is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select * into v_c from public.clubs where id = p_club and archived_at is null;
  if not found then
    raise exception 'Club not found' using errcode = 'P0002';
  end if;
  v_lead := public.is_club_leader(p_club) or public.is_admin();
  return jsonb_build_object(
    'id', v_c.id, 'name', v_c.name, 'description', v_c.description,
    'area', (select name from public.regions where id = v_c.region_id),
    'members', (select count(*) from public.club_members where club_id = p_club and status = 'approved'),
    'leaders', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'avatar_path', p.avatar_path) order by p.display_name), '[]'::jsonb)
                  from public.club_members m join public.profiles p on p.id = m.user_id
                 where m.club_id = p_club and m.role = 'leader' and m.status = 'approved'),
    'me', (select jsonb_build_object('status', status, 'role', role, 'is_primary', is_primary) from public.club_members where club_id = p_club and user_id = auth.uid()),
    'is_leader', v_lead,
    'requests', case when v_lead then (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'nickname', p.nickname, 'avatar_path', p.avatar_path) order by m.requested_at), '[]'::jsonb)
                                         from public.club_members m join public.profiles p on p.id = m.user_id where m.club_id = p_club and m.status = 'pending') end,
    'member_list', case when v_lead then (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'nickname', p.nickname, 'avatar_path', p.avatar_path, 'role', m.role) order by m.role desc, p.display_name), '[]'::jsonb)
                                            from public.club_members m join public.profiles p on p.id = m.user_id where m.club_id = p_club and m.status = 'approved') end
  );
end;
$$;

-- Race page: "Club X: 25 going" from approved members who opted in; hidden below the minimum. Counts only.
create function public.club_turnout(p_event uuid) returns table (club_id uuid, club_name text, going integer)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, count(*)::int
    from public.rsvps r
    join public.profiles p on p.id = r.user_id and p.show_attendance_to_clubs
    join public.club_members m on m.user_id = r.user_id and m.status = 'approved'
    join public.clubs c on c.id = m.club_id and c.archived_at is null
    join public.events e on e.id = r.event_id and e.status in ('published', 'postponed', 'cancelled')
   where r.event_id = p_event and r.status = 'going'
   group by c.id, c.name
  having count(*) >= public.setting_int('clubs.turnout_min', 5)
   order by count(*) desc, c.name
$$;

-- Admin: pending new-club requests (with requester name).
create function public.admin_club_requests() returns table (id uuid, name text, description text, area text, requester text, created_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select q.id, q.name, q.description, r.name, p.display_name, q.created_at
      from public.club_requests q left join public.regions r on r.id = q.region_id left join public.profiles p on p.id = q.requester_id
     where q.status = 'pending' order by q.created_at;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['request_join_club(uuid)', 'leave_club(uuid)', 'respond_club_request(uuid, uuid, boolean)', 'remove_club_member(uuid, uuid)',
                           'admin_set_club_leader(uuid, uuid, boolean)', 'set_primary_club(uuid)', 'request_new_club(text, text, uuid)',
                           'admin_review_club_request(uuid, boolean, boolean, text)', 'club_directory(text)', 'club_page(uuid)', 'admin_club_requests()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.club_turnout from public;
grant execute on function public.club_turnout to anon, authenticated;

-- Member counts count approved members only.
create or replace view public.club_member_counts with (security_invoker = false) as
  select c.id as club_id, (count(m.user_id) filter (where m.status = 'approved'))::integer as member_count
    from public.clubs c left join public.club_members m on m.club_id = c.id
   where c.archived_at is null
   group by c.id;

-- ---------------------------------------------------------------------------
-- Data export: club memberships with status/role/primary, and new-club requests.
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
    'clubs', (select coalesce(jsonb_agg(jsonb_build_object('club', cl.name, 'status', m.status, 'role', m.role, 'primary', m.is_primary,
                                                           'requested_at', m.requested_at, 'approved_at', m.approved_at)), '[]'::jsonb)
                from public.club_members m join public.clubs cl on cl.id = m.club_id where m.user_id = v_uid),
    'club_requests', (select coalesce(jsonb_agg(jsonb_build_object('name', q.name, 'status', q.status, 'sent_at', q.created_at, 'note', q.review_note)), '[]'::jsonb)
                        from public.club_requests q where q.requester_id = v_uid),
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
