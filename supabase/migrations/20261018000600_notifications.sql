-- Phase 3, slice 6 (part 1): in-app notifications (inbox), per-type preferences, organiser messages with a weekly
-- limit, day-before reminders. Everything works without push; push delivery is added on top (part 2).
-- Notifications are only about the app's own features (Play policy): no ads.

create type public.notification_kind as enum (
  'follow_request', 'new_follower', 'follow_accepted',
  'club_join_request', 'club_approved', 'club_request_reviewed',
  'race_postponed', 'race_cancelled', 'race_back_on', 'race_reminder',
  'organiser_message', 'photo_removed'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) <= 140),
  body text not null default '' check (char_length(body) <= 600),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_sent_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_push_idx on public.notifications (created_at) where push_sent_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "delete own notifications" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- Which types a person wants (all on by default). Removed-photo notices are always sent.
create table public.notification_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  follows boolean not null default true,
  clubs boolean not null default true,
  race_changes boolean not null default true,
  reminders boolean not null default true,
  organiser_messages boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notification_settings_updated_at before update on public.notification_settings for each row execute function public.set_updated_at();
alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon, authenticated;
grant select, insert, update on public.notification_settings to authenticated;
create policy "own settings" on public.notification_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into public.app_settings (key, value, is_public, description) values
  ('messages.per_race_per_week', '"2"', true, 'Most messages an organiser can send to people going to one race in any 7 days.'),
  ('notifications.reminder_hours_before', '"24"', true, 'How many hours before a race the day-before reminder is sent (about).'),
  ('notifications.keep_days', '"90"', false, 'In-app notifications older than this are deleted.')
on conflict (key) do nothing;

-- Internal: insert a notification if the person wants that type.
create function public.notify(p_user uuid, p_kind public.notification_kind, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_s public.notification_settings; v_wanted boolean := true;
begin
  if p_user is null then
    return;
  end if;
  select * into v_s from public.notification_settings where user_id = p_user;
  if found then
    v_wanted := case
      when p_kind in ('follow_request', 'new_follower', 'follow_accepted') then v_s.follows
      when p_kind in ('club_join_request', 'club_approved', 'club_request_reviewed') then v_s.clubs
      when p_kind in ('race_postponed', 'race_cancelled', 'race_back_on') then v_s.race_changes
      when p_kind = 'race_reminder' then v_s.reminders
      when p_kind = 'organiser_message' then v_s.organiser_messages
      else true end;
  end if;
  if not v_wanted then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, data) values (p_user, p_kind, left(p_title, 140), left(coalesce(p_body, ''), 600), coalesce(p_data, '{}'::jsonb));
end;
$$;
revoke execute on function public.notify from public, anon, authenticated;

create function public.fmt_event_time(p_at timestamptz, p_tz text) returns text
language sql immutable
set search_path = ''
as $$ select to_char(p_at at time zone p_tz, 'Dy DD Mon YYYY, FMHH12:MI') || ' ' || lower(to_char(p_at at time zone p_tz, 'am')) $$;

create function public.display_name_of(p_user uuid) returns text
language sql stable security definer
set search_path = ''
as $$ select coalesce((select display_name from public.profiles where id = p_user), 'Someone') $$;
revoke execute on function public.display_name_of from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Followers
-- ---------------------------------------------------------------------------
create function public.notify_follows() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify(new.followee_id, 'follow_request', public.display_name_of(new.follower_id) || ' asked to follow you',
                          'Approve or decline in Followers → Requests.', jsonb_build_object('person_id', new.follower_id));
  elsif tg_op = 'INSERT' and new.status = 'accepted' then
    perform public.notify(new.followee_id, 'new_follower', public.display_name_of(new.follower_id) || ' started following you', '',
                          jsonb_build_object('person_id', new.follower_id));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.notify(new.follower_id, 'follow_accepted', public.display_name_of(new.followee_id) || ' approved your follow request',
                          'You can now see their race passport and the races they''re going to.', jsonb_build_object('person_id', new.followee_id));
  end if;
  return null;
end;
$$;
create trigger follows_notify after insert or update on public.follows for each row execute function public.notify_follows();

-- ---------------------------------------------------------------------------
-- Clubs
-- ---------------------------------------------------------------------------
create function public.notify_club_members() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare v_club text; r record;
begin
  select name into v_club from public.clubs where id = new.club_id;
  if tg_op = 'INSERT' and new.status = 'pending' then
    for r in select user_id from public.club_members where club_id = new.club_id and role = 'leader' and status = 'approved' loop
      perform public.notify(r.user_id, 'club_join_request', public.display_name_of(new.user_id) || ' asked to join ' || v_club,
                            'Approve or decline on the club page.', jsonb_build_object('club_id', new.club_id, 'person_id', new.user_id));
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    perform public.notify(new.user_id, 'club_approved', 'You''re now a member of ' || v_club, '', jsonb_build_object('club_id', new.club_id));
  end if;
  return null;
end;
$$;
create trigger club_members_notify after insert or update on public.club_members for each row execute function public.notify_club_members();

create function public.notify_club_request() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status <> 'pending' then
    perform public.notify(new.requester_id, 'club_request_reviewed',
      case when new.status = 'approved' then new.name || ' is now listed' else 'Your request for ' || new.name || ' was not approved' end,
      case when new.status = 'approved' then 'Find it in Clubs.' else coalesce('Reason: ' || new.review_note, '') end,
      jsonb_build_object('club_id', new.club_id));
  end if;
  return null;
end;
$$;
create trigger club_requests_notify after update on public.club_requests for each row execute function public.notify_club_request();

-- ---------------------------------------------------------------------------
-- Race changes for people going (or maybe): postponed (with the new date), cancelled, back on
-- ---------------------------------------------------------------------------
create function public.notify_event_change() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare v_kind public.notification_kind; v_title text; v_body text; r record;
begin
  if new.status = 'postponed' and (old.status <> 'postponed' or new.starts_at is distinct from old.starts_at) then
    v_kind := 'race_postponed';
    v_title := new.name || case when new.original_starts_at is not null then ' is postponed to ' || public.fmt_event_time(new.starts_at, new.timezone)
                                else ' is postponed' end;
    v_body := case when new.original_starts_at is null then 'New date to be confirmed. ' else '' end || coalesce(new.status_reason, '');
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    v_kind := 'race_cancelled';
    v_title := new.name || ' is cancelled';
    v_body := coalesce(new.status_reason, '');
  elsif new.status = 'published' and old.status in ('postponed', 'cancelled') then
    v_kind := 'race_back_on';
    v_title := new.name || ' is back on: ' || public.fmt_event_time(new.starts_at, new.timezone);
    v_body := '';
  else
    return null;
  end if;
  for r in select user_id from public.rsvps where event_id = new.id and status in ('going', 'maybe') loop
    perform public.notify(r.user_id, v_kind, v_title, v_body, jsonb_build_object('event_id', new.id));
  end loop;
  return null;
end;
$$;
create trigger events_notify_change after update of status, starts_at on public.events for each row execute function public.notify_event_change();

-- ---------------------------------------------------------------------------
-- Removed profile photo (always sent)
-- ---------------------------------------------------------------------------
create function public.notify_report_outcome() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.status = 'open' and new.status = 'actioned' and new.target_kind = 'profile_photo' and new.target_user_id is not null
     and not exists (select 1 from public.notifications where user_id = new.target_user_id and kind = 'photo_removed' and created_at > now() - interval '1 minute') then
    perform public.notify(new.target_user_id, 'photo_removed', 'Your profile photo was removed',
                          'It didn''t follow our photo rules (see the Moderation Policy). You can add a different photo in Edit profile.', '{}'::jsonb);
  end if;
  return null;
end;
$$;
create trigger reports_notify_outcome after update on public.reports for each row execute function public.notify_report_outcome();

-- ---------------------------------------------------------------------------
-- Organiser messages to people going (race updates only; limit per race per 7 days, setting)
-- ---------------------------------------------------------------------------
create table public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 5 and 500),
  recipients integer not null default 0,
  created_at timestamptz not null default now()
);
create index event_messages_event_idx on public.event_messages (event_id, created_at);
alter table public.event_messages enable row level security;
revoke all on public.event_messages from anon, authenticated;
grant select on public.event_messages to authenticated;
create policy "event editors and admins read messages" on public.event_messages for select to authenticated
  using ((select public.is_admin()) or public.can_edit_event(event_id));
create trigger audit_event_messages after insert or update or delete on public.event_messages
  for each row execute function audit.capture('id', 'id,event_id,recipients,created_at', '');

create function public.send_event_message(p_event uuid, p_body text) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare v_e public.events; v_body text := btrim(coalesce(p_body, '')); v_n int := 0; v_limit int; r record;
begin
  select * into v_e from public.events where id = p_event;
  if not found or not (public.is_admin() or public.can_edit_event(p_event)) then
    raise exception 'You cannot message runners for this race' using errcode = '42501';
  end if;
  if v_e.status not in ('published', 'postponed') then
    raise exception 'Messages can only be sent for live races' using errcode = '22023';
  end if;
  if char_length(v_body) < 5 or char_length(v_body) > 500 then
    raise exception 'Message: 5 to 500 characters' using errcode = '22023';
  end if;
  v_limit := public.setting_int('messages.per_race_per_week', 2);
  if (select count(*) from public.event_messages where event_id = p_event and created_at > now() - interval '7 days') >= v_limit then
    raise exception 'You can send up to % messages per race in any 7 days', v_limit using errcode = '22023';
  end if;
  for r in select user_id from public.rsvps where event_id = p_event and status in ('going', 'maybe') loop
    perform public.notify(r.user_id, 'organiser_message', v_e.name || ': update from the organiser', v_body, jsonb_build_object('event_id', p_event));
    v_n := v_n + 1;
  end loop;
  insert into public.event_messages (event_id, sender_id, body, recipients) values (p_event, auth.uid(), v_body, v_n);
  return v_n;
end;
$$;
revoke execute on function public.send_event_message from public, anon;
grant execute on function public.send_event_message to authenticated;

-- ---------------------------------------------------------------------------
-- Day-before reminders (hourly) and 90-day retention (daily)
-- ---------------------------------------------------------------------------
create function public.send_race_reminders() returns integer
language plpgsql security definer
set search_path = ''
as $$
declare v_h int := public.setting_int('notifications.reminder_hours_before', 24); v_n int := 0; r record;
begin
  for r in
    select rv.user_id, e.id, e.name, e.starts_at, e.timezone, e.venue_name
      from public.events e join public.rsvps rv on rv.event_id = e.id and rv.status in ('going', 'maybe')
     where e.status in ('published', 'postponed') and e.starts_at between now() + make_interval(hours => v_h - 4) and now() + make_interval(hours => v_h + 4)
       and not exists (select 1 from public.notifications n where n.user_id = rv.user_id and n.kind = 'race_reminder' and n.data ->> 'event_id' = e.id::text)
  loop
    perform public.notify(r.user_id, 'race_reminder', r.name || ' is tomorrow', public.fmt_event_time(r.starts_at, r.timezone) || ' at ' || r.venue_name || '. Good luck!',
                          jsonb_build_object('event_id', r.id));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.send_race_reminders from public, anon, authenticated;

create function public.purge_old_notifications() returns integer
language plpgsql security definer
set search_path = ''
as $$
declare v_n int;
begin
  delete from public.notifications where created_at < now() - make_interval(days => public.setting_int('notifications.keep_days', 90));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.purge_old_notifications from public, anon, authenticated;

select cron.schedule('race-reminders', '7 * * * *', $$select public.send_race_reminders()$$);
select cron.schedule('purge-old-notifications', '17 3 * * *', $$select public.purge_old_notifications()$$);

-- Read state: mark some or all as read.
create function public.mark_notifications_read(p_ids uuid[] default null) returns void
language sql security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
$$;
revoke execute on function public.mark_notifications_read from public, anon;
grant execute on function public.mark_notifications_read to authenticated;
