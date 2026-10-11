-- RunLime foundation: extensions, enums, reference data tables, settings, legal documents.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('super_admin', 'platform_admin', 'organiser', 'participant');
create type public.account_privacy as enum ('private', 'public');
create type public.organisation_status as enum ('applied', 'verified', 'rejected', 'suspended');
create type public.organisation_member_role as enum ('owner', 'manager');
create type public.region_kind as enum ('area', 'corporation');
create type public.event_status as enum (
  'draft', 'pending_approval', 'published', 'postponed', 'cancelled', 'unpublished', 'rejected'
);
create type public.consent_kind as enum ('terms', 'privacy', 'location', 'health_data', 'public_sharing', 'marketing_push');

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Countries & regions (expansion-ready; launch with TT only)
-- ---------------------------------------------------------------------------
create table public.countries (
  code char(2) primary key,
  name text not null,
  currency char(3) not null,
  default_timezone text not null,
  active boolean not null default false
);

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null references public.countries (code),
  name text not null,
  kind public.region_kind not null,
  parent_id uuid references public.regions (id),
  sort smallint not null default 0,
  unique (country_code, kind, name),
  -- corporations roll up to an area; areas have no parent
  constraint region_parent_by_kind check ((kind = 'area' and parent_id is null) or (kind = 'corporation' and parent_id is not null))
);

alter table public.countries enable row level security;
alter table public.regions enable row level security;
create policy "countries are public" on public.countries for select using (true);
create policy "regions are public" on public.regions for select using (true);

-- ---------------------------------------------------------------------------
-- App settings: every limit/price/text lives here (never hardcoded).
-- The 18+ age rule is intentionally NOT a setting.
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]*$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text not null default '',
  updated_at timestamptz not null default now(),
  constraint age_rule_is_not_a_setting check (key !~ '(^|\.)(min(imum)?_?age|age_?(limit|min|minimum))')
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Legal documents (served by the web portal; text is data, not code)
-- ---------------------------------------------------------------------------
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z][a-z0-9-]*$'),
  version text not null,
  title text not null,
  body_md text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (slug, version)
);
alter table public.legal_documents enable row level security;
create policy "published legal documents are public" on public.legal_documents
  for select using (published_at is not null and published_at <= now());

-- ---------------------------------------------------------------------------
-- Reference data that must exist in every environment (incl. production)
-- ---------------------------------------------------------------------------
insert into public.countries (code, name, currency, default_timezone, active)
values ('TT', 'Trinidad and Tobago', 'TTD', 'America/Port_of_Spain', true);

-- Friendly running areas (used for filters) ...
insert into public.regions (country_code, name, kind, sort) values
  ('TT', 'Port of Spain & North-West', 'area', 1),
  ('TT', 'East-West Corridor', 'area', 2),
  ('TT', 'North-East', 'area', 3),
  ('TT', 'Central', 'area', 4),
  ('TT', 'South', 'area', 5),
  ('TT', 'Tobago', 'area', 6);

-- ... and the 14 Trinidad municipal corporations + Tobago House of Assembly (stored for analytics).
insert into public.regions (country_code, name, kind, parent_id, sort)
select 'TT', c.name, 'corporation', a.id, c.sort
from (values
  ('Port of Spain City Corporation', 'Port of Spain & North-West', 1),
  ('Diego Martin Regional Corporation', 'Port of Spain & North-West', 2),
  ('San Juan–Laventille Regional Corporation', 'East-West Corridor', 3),
  ('Tunapuna–Piarco Regional Corporation', 'East-West Corridor', 4),
  ('Arima Borough Corporation', 'East-West Corridor', 5),
  ('Sangre Grande Regional Corporation', 'North-East', 6),
  ('Chaguanas Borough Corporation', 'Central', 7),
  ('Couva–Tabaquite–Talparo Regional Corporation', 'Central', 8),
  ('San Fernando City Corporation', 'South', 9),
  ('Princes Town Regional Corporation', 'South', 10),
  ('Penal–Debe Regional Corporation', 'South', 11),
  ('Siparia Regional Corporation', 'South', 12),
  ('Point Fortin Borough Corporation', 'South', 13),
  ('Mayaro–Rio Claro Regional Corporation', 'South', 14),
  ('Tobago House of Assembly', 'Tobago', 15)
) as c (name, area, sort)
join public.regions a on a.name = c.area and a.kind = 'area';

insert into public.app_settings (key, value, is_public, description) values
  ('legal.operator_name', 'null', true, 'Legal name of the app operator (individual or company). Shown in legal documents.'),
  ('legal.operator_address', 'null', true, 'Postal address of the operator for legal documents.'),
  ('legal.support_email', 'null', true, 'Support / privacy contact email.'),
  ('legal.child_safety_contact_email', 'null', true, 'Designated child-safety contact (Google Play CSAE requirement).'),
  ('legal.website', 'null', true, 'Public website URL.'),
  ('legal.minors_notice', '"All children and young people under 18 must be accompanied by a parent or guardian at every event. Children do not hold RunLime accounts; adults add them to their group."', true, 'Shown on every event page and RSVP.'),
  ('community.disclaimer', '"Community times are self-recorded by participants and are not verified. They may differ from official results. For official times and placings, contact the event organiser."', true, 'Always shown on community boards.'),
  ('checkin.radius_m', '500', true, 'Default GPS check-in radius in metres.'),
  ('checkin.window_before_min', '120', true, 'Check-in opens this many minutes before the start.'),
  ('checkin.window_after_min', '240', true, 'Check-in closes this many minutes after the start.'),
  ('community.pace_limit_sec_per_km', '155', true, 'Reject community times faster than this average pace (2:35 /km).'),
  ('events.auto_publish_verified', 'false', false, 'If true, events from verified organisers publish without admin approval.'),
  ('listing.charity_free_basic', 'true', false, 'Charity organisers get the Basic listing free.'),
  ('pricing.organiser_basic_ttd', '100', false, 'Seed: Basic listing price per event (TTD).'),
  ('pricing.organiser_featured_ttd', '400', false, 'Seed: Featured listing price per event (TTD).'),
  ('pricing.premium_monthly_usd', '2.99', false, 'Seed: Premium monthly store price reference (USD tier).'),
  ('pricing.premium_yearly_usd', '19.99', false, 'Seed: Premium yearly store price reference (USD tier).'),
  ('alerts.free_filter_limit', '3', true, 'Free tier: number of saved alert filters.'),
  ('ratelimit.organiser_applications_per_day', '3', false, 'Max organiser applications per user per day.');
