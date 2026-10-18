-- Phase 3 retest fixes (owner, 2026-10-18):
--  1. Push: Expo receipts are checked ~15 min after sending (errors logged, uninstalled phones dropped).
--  4. Admin alerts for new reports: in-app + phone notification to every admin at once; email to the support
--     address (setting legal.support_email): "A child may be at risk" immediately, other categories in a daily summary.
--  5. Club leadership: a new-club request names who will lead it; the admin sees the proposed leader; the leader is
--     notified when appointed ("You now lead <club>").

-- ---------------------------------------------------------------------------
-- 1. Push receipts (service role only: written and read by the push-dispatch Edge Function)
-- ---------------------------------------------------------------------------
create table public.push_receipts (
  ticket_id text primary key check (char_length(ticket_id) <= 100),
  token text not null check (char_length(token) <= 200),
  created_at timestamptz not null default now()
);
create index push_receipts_created_idx on public.push_receipts (created_at);
alter table public.push_receipts enable row level security;
revoke all on public.push_receipts from anon, authenticated;

-- Wake the dispatcher for new notifications to registered phones, or for receipts that are due.
create or replace function public.dispatch_push() returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.notifications n join public.push_tokens t on t.user_id = n.user_id
                  where n.push_sent_at is null and n.created_at > now() - interval '1 hour')
     and not exists (select 1 from public.push_receipts where created_at < now() - interval '15 minutes') then
    return false;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  if v_url is null or v_secret is null then
    return false;
  end if;
  perform net.http_post(url := v_url, headers := jsonb_build_object('content-type', 'application/json', 'x-dispatch-secret', v_secret), body := '{}'::jsonb);
  return true;
end;
$$;
revoke execute on function public.dispatch_push from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admin alerts for new reports
-- ---------------------------------------------------------------------------
alter table public.reports
  add column alert_emailed_at timestamptz,   -- child-safety reports: emailed immediately
  add column summary_emailed_at timestamptz; -- other categories: included in a daily summary email

create function public.report_category_label(p public.report_category) returns text
language sql immutable
set search_path = ''
as $$
  select case p
    when 'child_safety' then 'A child may be at risk'
    when 'sexual_content' then 'Nudity or sexual content'
    when 'harassment' then 'Bullying or harassment'
    when 'hate_or_violence' then 'Hate or violence'
    when 'impersonation' then 'Pretending to be someone else'
    when 'spam' then 'Spam or scam'
    else 'Something else' end
$$;

-- Every admin (super/platform) gets a bell + phone notification at once. No reporter or reported names in it.
create function public.notify_admins_of_report() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare r record; v_site text := (select value #>> '{}' from public.app_settings where key = 'legal.website');
begin
  for r in select distinct user_id from public.user_roles where role in ('super_admin', 'platform_admin') loop
    perform public.notify(r.user_id, 'report_received',
      case when new.category = 'child_safety' then 'Urgent report: a child may be at risk'
           else 'New report: ' || public.report_category_label(new.category) end,
      case when new.category = 'child_safety' then 'Review it in the admin console now. Child-safety reports come first.'
           else 'Review it in the admin console within 48 hours.' end,
      jsonb_build_object('report_id', new.id, 'url', case when v_site is not null then rtrim(v_site, '/') || '/admin/reports' end));
  end loop;
  return null;
end;
$$;
create trigger reports_notify_admins after insert on public.reports for each row execute function public.notify_admins_of_report();

-- Emails go through the admin-alerts Edge Function (SMTP). Off until configured ("Configure admin alerts").
create function public.set_admin_alerts_config(p_url text, p_secret text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_url !~ '^https?://' or char_length(coalesce(p_secret, '')) < 32 then
    raise exception 'A URL and a secret of at least 32 characters are required' using errcode = '22023';
  end if;
  select id into v_id from vault.secrets where name = 'admin_alerts_url';
  if v_id is null then perform vault.create_secret(p_url, 'admin_alerts_url'); else perform vault.update_secret(v_id, p_url); end if;
  select id into v_id from vault.secrets where name = 'admin_alerts_secret';
  if v_id is null then perform vault.create_secret(p_secret, 'admin_alerts_secret'); else perform vault.update_secret(v_id, p_secret); end if;
end;
$$;
revoke execute on function public.set_admin_alerts_config from public, anon, authenticated;
grant execute on function public.set_admin_alerts_config to service_role;

-- Urgent (every minute): child-safety reports not yet emailed. Daily: other open reports not yet in a summary.
create function public.dispatch_admin_alerts(p_daily boolean default false) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_url text; v_secret text;
begin
  if p_daily then
    if not exists (select 1 from public.reports where category <> 'child_safety' and status = 'open' and summary_emailed_at is null) then
      return false;
    end if;
  elsif not exists (select 1 from public.reports where category = 'child_safety' and alert_emailed_at is null and created_at > now() - interval '2 days') then
    return false;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'admin_alerts_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'admin_alerts_secret';
  if v_url is null or v_secret is null then
    return false;
  end if;
  perform net.http_post(url := v_url, headers := jsonb_build_object('content-type', 'application/json', 'x-dispatch-secret', v_secret),
                        body := jsonb_build_object('mode', case when p_daily then 'daily' else 'urgent' end));
  return true;
end;
$$;
revoke execute on function public.dispatch_admin_alerts from public, anon, authenticated;

select cron.schedule('admin-alerts-urgent', '* * * * *', $$select public.dispatch_admin_alerts(false)$$);
-- 07:50 Port of Spain (11:50 UTC): a report waits at most a day for the summary email, leaving a day of the 48 h.
select cron.schedule('admin-alerts-daily', '50 11 * * *', $$select public.dispatch_admin_alerts(true)$$);

-- ---------------------------------------------------------------------------
-- 5. Club leadership
-- ---------------------------------------------------------------------------
alter table public.club_requests add column proposed_leader_id uuid references public.profiles (id) on delete set null;
update public.club_requests set proposed_leader_id = requester_id where status = 'pending';

-- Who will lead it: the requester (no email), or another RunLime account found by its sign-in email.
drop function public.request_new_club(text, text, uuid);
create function public.request_new_club(p_name text, p_description text default null, p_region uuid default null, p_leader_email text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid; v_name text := btrim(coalesce(p_name, '')); v_email text := lower(btrim(coalesce(p_leader_email, ''))); v_leader uuid := auth.uid();
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
  if v_email <> '' then
    select p.id into v_leader from auth.users u join public.profiles p on p.id = u.id where lower(u.email) = v_email;
    if v_leader is null or public.is_blocked_between(auth.uid(), v_leader) then
      raise exception 'We couldn''t find a RunLime account with that email. Ask them to sign up first, or choose yourself' using errcode = '22023';
    end if;
  end if;
  insert into public.club_requests (requester_id, name, description, region_id, proposed_leader_id)
  values (auth.uid(), v_name, nullif(btrim(coalesce(p_description, '')), ''), p_region, v_leader)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.request_new_club(text, text, uuid, text) from public, anon;
grant execute on function public.request_new_club(text, text, uuid, text) to authenticated;

-- Approve: creates the club; the requester joins as an approved member; the proposed leader (if chosen) leads it.
create or replace function public.admin_review_club_request(p_request uuid, p_approve boolean, p_make_leader boolean default true, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_r public.club_requests; v_club uuid; v_leader uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into v_r from public.club_requests where id = p_request and status = 'pending' for update;
  if not found then
    raise exception 'Request not found or already reviewed' using errcode = 'P0002';
  end if;
  v_leader := case when p_make_leader then coalesce(v_r.proposed_leader_id, v_r.requester_id) end;
  if p_approve then
    insert into public.clubs (name, description, region_id) values (v_r.name, v_r.description, v_r.region_id) returning id into v_club;
    if v_r.requester_id is not null then
      insert into public.club_members (club_id, user_id, status, role, approved_at)
      values (v_club, v_r.requester_id, 'approved', case when v_leader = v_r.requester_id then 'leader' else 'member' end::public.club_role, now());
    end if;
    if v_leader is not null and v_leader is distinct from v_r.requester_id then
      insert into public.club_members (club_id, user_id, status, role, approved_at) values (v_club, v_leader, 'approved', 'leader', now())
      on conflict (club_id, user_id) do update set role = 'leader', status = 'approved';
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

drop function public.admin_club_requests();
create function public.admin_club_requests() returns table (
  id uuid, name text, description text, area text, requester text, created_at timestamptz, proposed_leader text, leader_is_requester boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select q.id, q.name, q.description, r.name, p.display_name, q.created_at, l.display_name,
           coalesce(q.proposed_leader_id, q.requester_id) = q.requester_id
      from public.club_requests q
      left join public.regions r on r.id = q.region_id
      left join public.profiles p on p.id = q.requester_id
      left join public.profiles l on l.id = coalesce(q.proposed_leader_id, q.requester_id)
     where q.status = 'pending' order by q.created_at;
end;
$$;
revoke execute on function public.admin_club_requests() from public, anon;
grant execute on function public.admin_club_requests() to authenticated;

-- Notify a new leader (club approval or admin appointment), in addition to the existing join notices.
create or replace function public.notify_club_members() returns trigger
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
  elsif new.status = 'approved' and new.role = 'leader' and (tg_op = 'INSERT' or old.role <> 'leader' or old.status <> 'approved') then
    perform public.notify(new.user_id, 'club_leader_assigned', 'You now lead ' || v_club || '.', 'You''ll approve join requests.', jsonb_build_object('club_id', new.club_id));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    perform public.notify(new.user_id, 'club_approved', 'You''re now a member of ' || v_club, '', jsonb_build_object('club_id', new.club_id));
  end if;
  return null;
end;
$$;
