-- Phase 2 final re-test fix (2026-10-18): postponing to a new date.
-- Root cause: change_event_status overwrote starts_at with the new date and kept nothing else, so the original date
-- was lost and nothing could say "Postponed to <date>". Staging history for the PSCU listing shows exactly that
-- (starts_at 30 Oct -> 17 Nov on postponement, then -> 18 Nov when it was put back on).
-- Now: original_starts_at keeps the date before the first postponement; starts_at is the date the race will run
-- (calendar, sorting, check-in window). "Back on" undoes the postponement and restores the original date.

alter table public.events add column original_starts_at timestamptz;
comment on column public.events.original_starts_at is
  'Start before the race was postponed to a new date (shown struck through). Null when the date has not moved.';

drop trigger audit_events on public.events;
create trigger audit_events after insert or update or delete on public.events
  for each row execute function audit.capture('id',
    'id,organisation_id,listing_source,slug,name,starts_at,original_starts_at,region_id,corporation_id,venue_name,status,status_reason,featured_until,fee_min,fee_max,walk_friendly,checkin_radius_m,published_at,duplicated_from_id,media_permission_at', '');

create or replace function public.change_event_status(p_id uuid, p_status public.event_status, p_reason text, p_new_starts_at timestamptz default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_e public.events;
begin
  select * into v_e from public.events where id = p_id for update;
  if not found or not public.can_edit_event(p_id) then
    raise exception 'You cannot change this event' using errcode = '42501';
  end if;
  if p_status not in ('postponed', 'cancelled', 'published') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  -- Allowed: published -> postponed/cancelled; postponed -> postponed (set or change the new date)/cancelled/published;
  -- cancelled -> published ("back on").
  if not (
       (v_e.status = 'published' and p_status in ('postponed', 'cancelled'))
    or (v_e.status = 'postponed' and p_status in ('postponed', 'cancelled', 'published'))
    or (v_e.status = 'cancelled' and p_status = 'published')
  ) then
    raise exception 'This status change is not possible from %', v_e.status using errcode = '22023';
  end if;
  if p_status <> 'postponed' and p_new_starts_at is not null then
    raise exception 'A new date only applies when postponing' using errcode = '22023';
  end if;
  if v_e.status = 'postponed' and p_status = 'postponed' and p_new_starts_at is null then
    raise exception 'Choose the new date and time' using errcode = '22023';
  end if;
  if p_new_starts_at is not null and p_new_starts_at <= now() then
    raise exception 'The new date must be in the future' using errcode = '22023';
  end if;
  if p_new_starts_at is not null and p_new_starts_at = coalesce(v_e.original_starts_at, v_e.starts_at) then
    raise exception 'The new date is the same as the original date' using errcode = '22023';
  end if;
  if p_status in ('postponed', 'cancelled') and char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Tell runners why (at least a few words)' using errcode = '22023';
  end if;
  update public.events
     set status = p_status,
         status_reason = case when p_status = 'published' then null else btrim(p_reason) end,
         starts_at = case
           when p_new_starts_at is not null then p_new_starts_at
           when p_status = 'published' then coalesce(v_e.original_starts_at, v_e.starts_at)
           else v_e.starts_at end,
         original_starts_at = case
           when p_new_starts_at is not null then coalesce(v_e.original_starts_at, v_e.starts_at)
           when p_status = 'published' then null
           else v_e.original_starts_at end
   where id = p_id;
end;
$$;

-- Duplicates (next year's edition) start fresh: no postponement carried over.
-- duplicate_event lists its columns explicitly, so original_starts_at stays null there.
