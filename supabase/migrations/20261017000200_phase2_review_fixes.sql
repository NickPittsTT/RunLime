-- Phase 2 owner review fixes (2026-10-17).

-- ---------------------------------------------------------------------------
-- 1. Status changes: "Publish" can no longer undo a postponement or cancellation.
--    Root cause of the owner's failed test: the admin "Publish" button (review_event) was offered on postponed and
--    cancelled races and set them straight back to published. Live-race status now changes only through
--    change_event_status, which also gains an explicit "back on" for cancelled races.
-- ---------------------------------------------------------------------------
create or replace function public.review_event(p_id uuid, p_decision public.event_status, p_reason text default null) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_status public.event_status;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_decision not in ('published', 'rejected', 'unpublished') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  select status into v_status from public.events where id = p_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if p_decision = 'published' and v_status not in ('draft', 'pending_approval', 'unpublished', 'rejected') then
    raise exception 'This race is already live (%). Use "Postpone or cancel" to change its status', v_status using errcode = '22023';
  end if;
  if p_decision = 'rejected' and v_status <> 'pending_approval' then
    raise exception 'Only races waiting for approval can be rejected' using errcode = '22023';
  end if;
  if p_decision = 'unpublished' and v_status not in ('published', 'postponed', 'cancelled') then
    raise exception 'Only live races can be unpublished' using errcode = '22023';
  end if;
  if p_decision in ('rejected', 'unpublished') and char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  update public.events
     set status = p_decision,
         status_reason = case when p_decision = 'published' then null else btrim(p_reason) end,
         published_at = case when p_decision = 'published' then coalesce(published_at, now()) else published_at end,
         approved_by = case when p_decision = 'published' then auth.uid() else approved_by end
   where id = p_id;
end;
$$;

create or replace function public.change_event_status(p_id uuid, p_status public.event_status, p_reason text, p_new_starts_at timestamptz default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_e public.events;
begin
  select * into v_e from public.events where id = p_id;
  if not found or not public.can_edit_event(p_id) then
    raise exception 'You cannot change this event' using errcode = '42501';
  end if;
  if p_status not in ('postponed', 'cancelled', 'published') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  -- Allowed: published -> postponed/cancelled; postponed -> cancelled/published; cancelled -> published ("back on").
  if not (
       (v_e.status = 'published' and p_status in ('postponed', 'cancelled'))
    or (v_e.status = 'postponed' and p_status in ('cancelled', 'published'))
    or (v_e.status = 'cancelled' and p_status = 'published')
  ) then
    raise exception 'This status change is not possible from %', v_e.status using errcode = '22023';
  end if;
  if p_status in ('postponed', 'cancelled') and char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Tell runners why (at least a few words)' using errcode = '22023';
  end if;
  update public.events
     set status = p_status,
         status_reason = case when p_status = 'published' then null else btrim(p_reason) end,
         starts_at = coalesce(p_new_starts_at, starts_at)
   where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RunLime listings: flyer / route map images and sponsors (incl. logos) only after an admin records the
--    organiser's permission. Who ticked it and when is in the audit log (actor alias + media_permission_at).
--    Gallery photos stay organiser-only.
-- ---------------------------------------------------------------------------
alter table public.events
  add column media_permission_at timestamptz,
  add column media_permission_by uuid references auth.users (id) on delete set null;

drop trigger audit_events on public.events;
create trigger audit_events after insert or update or delete on public.events
  for each row execute function audit.capture('id',
    'id,organisation_id,listing_source,slug,name,starts_at,region_id,corporation_id,venue_name,status,status_reason,featured_until,fee_min,fee_max,walk_friendly,checkin_radius_m,published_at,duplicated_from_id,media_permission_at', '');

create or replace function public.reject_media_on_listings() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare v_e public.events;
begin
  select * into v_e from public.events e where e.id = new.event_id;
  if v_e.listing_source <> 'runlime' then
    return new;
  end if;
  if v_e.media_permission_at is null then
    raise exception 'RunLime listings carry facts only. Record the organiser''s permission first to add a flyer, logo or sponsor' using errcode = '23514';
  end if;
  -- (to_jsonb: event_sponsors rows have no "kind" column)
  if tg_table_name = 'event_media' and to_jsonb(new) ->> 'kind' = 'gallery' then
    raise exception 'Photos are for organiser events only. RunLime listings may show a flyer or route map with permission' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.set_listing_media_permission(p_event uuid, p_granted boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_e public.events;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into v_e from public.events where id = p_event for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if v_e.listing_source <> 'runlime' then
    raise exception 'Only RunLime listings need this permission' using errcode = '22023';
  end if;
  if not p_granted and (exists (select 1 from public.event_media where event_id = p_event)
                        or exists (select 1 from public.event_sponsors where event_id = p_event)) then
    raise exception 'Remove the images and sponsors first, then withdraw the permission' using errcode = '22023';
  end if;
  update public.events
     set media_permission_at = case when p_granted then now() else null end,
         media_permission_by = case when p_granted then auth.uid() else null end
   where id = p_event;
end;
$$;
revoke execute on function public.set_listing_media_permission from public, anon;
grant execute on function public.set_listing_media_permission to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admin creates a verified organisation directly (for organisers the owner signs up personally).
--    Audited through the organisations / organisation_members / user_roles audit triggers.
-- ---------------------------------------------------------------------------
create function public.admin_create_organisation(
  p_name text, p_contact_email text, p_contact_phone text, p_website text, p_about text, p_is_charity boolean,
  p_owner_email text default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_slug text;
  v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Enter the organisation name' using errcode = '22023';
  end if;
  if coalesce(p_contact_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid contact email' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_contact_phone, ''))) < 7 then
    raise exception 'Enter a contact phone number' using errcode = '22023';
  end if;
  if nullif(btrim(p_website), '') is not null and btrim(p_website) !~* '^https?://\S+$' then
    raise exception 'Enter a full website link starting with https://' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_about, ''))) < 20 then
    raise exception 'Tell us a little more about the organisation (at least 20 characters)' using errcode = '22023';
  end if;
  if nullif(btrim(p_owner_email), '') is not null then
    select u.id into v_owner from auth.users u
      join public.profiles p on p.id = u.id
     where lower(u.email) = lower(btrim(p_owner_email));
    if v_owner is null then
      raise exception 'No RunLime account uses that email. Ask the organiser to sign up first, or leave it blank' using errcode = '22023';
    end if;
  end if;
  v_slug := public.slugify(p_name);
  if v_slug = '' then
    raise exception 'Invalid organisation name' using errcode = '22023';
  end if;
  if exists (select 1 from public.organisations where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;
  insert into public.organisations (name, slug, contact_email, contact_phone, website, about, is_charity, status, reviewed_at)
  values (btrim(p_name), v_slug, btrim(p_contact_email), btrim(p_contact_phone), nullif(btrim(p_website), ''), btrim(p_about),
          coalesce(p_is_charity, false), 'verified', now())
  returning id into v_org;
  if v_owner is not null then
    insert into public.organisation_members (organisation_id, user_id, role) values (v_org, v_owner, 'owner');
    insert into public.user_roles (user_id, role) values (v_owner, 'organiser') on conflict do nothing;
  end if;
  return v_org;
end;
$$;
revoke execute on function public.admin_create_organisation from public, anon;
grant execute on function public.admin_create_organisation to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Onboarding answers saved to the account (areas + distances; 0 km = "Fun walk / under 5K").
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  region_ids uuid[] not null default '{}' check (cardinality(region_ids) <= 50),
  distance_km numeric[] not null default '{}' check (cardinality(distance_km) <= 10 and 0 <= all (distance_km) and 100 >= all (distance_km)),
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy "own preferences: read" on public.user_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy "own preferences: insert" on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_profile()));
create policy "own preferences: update" on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own preferences: delete" on public.user_preferences for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.user_preferences to authenticated;
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

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
                        from public.organisation_members m join public.organisations o on o.id = m.organisation_id where m.user_id = v_uid)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Refund Policy: share of the listing fee refunded when an organiser cancels after the listing has been live.
-- 100 = option A (full refund, current default); 50 = option B. Owner to confirm.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, is_public, description) values
  ('payments.cancel_refund_after_live_percent', '"100"', true,
   'Percent of the listing fee refunded when an organiser cancels after the listing has been live (100 = full, 50 = half). Before it is published: always full.')
on conflict (key) do nothing;
