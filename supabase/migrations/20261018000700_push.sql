-- Phase 3, slice 6 (part 2): phone notifications. Each new in-app notification is also delivered to the person's
-- phones through Expo Push (Firebase Cloud Messaging on Android) by the push-dispatch Edge Function.
-- Off until configured: the cron job does nothing until the dispatch URL and secret are in Vault
-- ("Configure push" workflow). The inbox works either way.

create extension if not exists pg_net with schema extensions;

create table public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' and char_length(token) <= 200),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;
create policy "own tokens" on public.push_tokens for select to authenticated using (user_id = (select auth.uid()));

-- A phone belongs to whoever signed in last on it.
create function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  insert into public.push_tokens (token, user_id, platform) values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end;
$$;

create function public.unregister_push_token(p_token text) returns void
language sql security definer
set search_path = ''
as $$ delete from public.push_tokens where token = p_token and user_id = auth.uid() $$;

revoke execute on function public.register_push_token from public, anon;
grant execute on function public.register_push_token to authenticated;
revoke execute on function public.unregister_push_token from public, anon;
grant execute on function public.unregister_push_token to authenticated;

-- Dispatch configuration lives in Vault (never in the repo). Only the service role can set it.
create function public.set_push_config(p_url text, p_secret text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_url !~ '^https?://' or char_length(coalesce(p_secret, '')) < 32 then
    raise exception 'A URL and a secret of at least 32 characters are required' using errcode = '22023';
  end if;
  select id into v_id from vault.secrets where name = 'push_dispatch_url';
  if v_id is null then perform vault.create_secret(p_url, 'push_dispatch_url'); else perform vault.update_secret(v_id, p_url); end if;
  select id into v_id from vault.secrets where name = 'push_dispatch_secret';
  if v_id is null then perform vault.create_secret(p_secret, 'push_dispatch_secret'); else perform vault.update_secret(v_id, p_secret); end if;
end;
$$;
revoke execute on function public.set_push_config from public, anon, authenticated;
grant execute on function public.set_push_config to service_role;

-- Every minute: if there is anything to send and push is configured, wake the Edge Function.
create function public.dispatch_push() returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.notifications n join public.push_tokens t on t.user_id = n.user_id
                  where n.push_sent_at is null and n.created_at > now() - interval '1 hour') then
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

select cron.schedule('push-dispatch', '* * * * *', $$select public.dispatch_push()$$);

-- ---------------------------------------------------------------------------
-- Data export: notifications (last 90 days), notification settings, registered phones (platform and dates only).
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
                  from public.blocks b join public.profiles p on p.id = b.blocked_id where b.blocker_id = v_uid),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('type', n.kind, 'title', n.title, 'body', n.body, 'sent_at', n.created_at, 'read_at', n.read_at)
                                               order by n.created_at), '[]'::jsonb) from public.notifications n where n.user_id = v_uid),
    'notification_settings', (select to_jsonb(s) - 'user_id' from public.notification_settings s where s.user_id = v_uid),
    'push_devices', (select coalesce(jsonb_agg(jsonb_build_object('platform', t.platform, 'registered_at', t.created_at, 'last_seen_at', t.last_seen_at)), '[]'::jsonb)
                       from public.push_tokens t where t.user_id = v_uid)
  );
end;
$$;
