-- B1 (owner retest 2026-10-30, privacy): a signed-out phone still received an account's notifications. Staging showed
-- the token row survived a sign-out: the app's unregister call (Expo token fetch + RPC, errors swallowed) can fail.
-- Now the server enforces it:
--  - each phone token records the sign-in session that registered it (JWT session_id); notifications go only to
--    tokens whose session still exists — signing out deletes the session, so the phone stops at once even if the
--    phone never reaches us
--  - the phone can remove its own token by value, signed in or not (sign-out retry when offline)
--  - a token belongs to one account: registering it moves it (and its session) to the new account
-- Tokens without a live session are purged (hourly), including rows registered before this change.

alter table public.push_tokens add column session_id uuid; -- auth.sessions.id at registration (checked at send time)

create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if auth.uid() is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if v_session is null then
    raise exception 'No sign-in session' using errcode = '28000';
  end if;
  insert into public.push_tokens (token, user_id, platform, session_id) values (p_token, auth.uid(), p_platform, v_session)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, session_id = excluded.session_id, last_seen_at = now();
end;
$$;

-- Whoever holds the token (the phone) may remove it, with or without a session. Knowing a token only lets you stop
-- that phone's notifications.
create or replace function public.unregister_push_token(p_token text) returns void
language sql security definer
set search_path = ''
as $$ delete from public.push_tokens where token = p_token $$;
revoke execute on function public.unregister_push_token(text) from public;
grant execute on function public.unregister_push_token(text) to anon, authenticated;

-- What the dispatcher may send to: tokens of these people whose registering session is still signed in.
create function public.push_targets(p_users uuid[]) returns table (token text, user_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select t.token, t.user_id from public.push_tokens t
   where t.user_id = any (p_users)
     and exists (select 1 from auth.sessions s where s.id = t.session_id and s.user_id = t.user_id)
$$;
revoke execute on function public.push_targets(uuid[]) from public, anon, authenticated;
grant execute on function public.push_targets(uuid[]) to service_role;

create function public.purge_orphan_push_tokens() returns integer
language sql security definer
set search_path = ''
as $$
  with gone as (
    delete from public.push_tokens t
     where not exists (select 1 from auth.sessions s where s.id = t.session_id and s.user_id = t.user_id)
    returning 1)
  select count(*)::int from gone
$$;
revoke execute on function public.purge_orphan_push_tokens() from public, anon, authenticated;
select public.purge_orphan_push_tokens();
select cron.schedule('purge-orphan-push-tokens', '23 * * * *', $$select public.purge_orphan_push_tokens()$$);

-- The every-minute wake-up only counts live phones.
create or replace function public.dispatch_push() returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.notifications n join public.push_tokens t on t.user_id = n.user_id
                  where n.push_sent_at is null and n.created_at > now() - interval '1 hour'
                    and exists (select 1 from auth.sessions s where s.id = t.session_id and s.user_id = t.user_id))
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
