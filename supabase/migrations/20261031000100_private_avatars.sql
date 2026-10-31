-- Owner decision 4 (2026-10-31): profile photos are no longer publicly readable. The "avatars" bucket becomes
-- private; a photo file can be read (or given a short-lived signed URL) only by someone allowed to see it: the
-- person, their approved followers, everyone signed in when the account is Public, and MFA admins. Blocked pairs
-- never see each other's photo. One rule (can_view_avatar) serves both the people lists and the files.

create function public.can_view_avatar(p_owner uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case
    when p_owner is null or auth.uid() is null then false
    when p_owner = auth.uid() or public.is_admin() then true
    when public.is_blocked_between(auth.uid(), p_owner) then false
    when exists (select 1 from public.profiles where id = p_owner and account_privacy = 'public') then true
    else exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p_owner and f.status = 'accepted')
  end
$$;
revoke execute on function public.can_view_avatar(uuid) from public, anon;
-- Storage checks this as the signed-in caller when it reads or signs a file.
grant execute on function public.can_view_avatar(uuid) to authenticated;

-- Files live at <owner id>/<random>.jpg. The CASE keeps a malformed folder name from ever reaching the uuid cast.
create function public.can_view_avatar_file(p_name text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_view_avatar(split_part(p_name, '/', 1)::uuid)
    else false
  end
$$;
revoke execute on function public.can_view_avatar_file(text) from public, anon;
grant execute on function public.can_view_avatar_file(text) to authenticated;

create or replace function public.visible_avatar(p_owner uuid, p_path text) returns text
language sql stable security definer
set search_path = ''
as $$
  select case when p_path is not null and public.can_view_avatar(p_owner) then p_path end
$$;
revoke execute on function public.visible_avatar(uuid, text) from public, anon, authenticated;

update storage.buckets set public = false where id = 'avatars';

create policy "avatars: read when allowed to see the photo" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_view_avatar_file(name));
