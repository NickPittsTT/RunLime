-- Audit log (F3): pseudonymous actors/subjects + per-table column allowlists, append-only, no IPs.
--
-- * audit_log never stores a user id. Actors and person-subjects are stored as aliases.
-- * audit_actor_aliases maps user -> alias and is deleted (cascade) with the account,
--   so entries about a deleted person can no longer be linked to them.
-- * Only allowlisted columns (trigger arguments) are written to before/after.
--   Personal fields are never on an allowlist.

create schema if not exists audit;
revoke all on schema audit from public, anon, authenticated;

create table audit.actor_aliases (
  user_id uuid primary key references auth.users (id) on delete cascade,
  alias uuid not null unique default gen_random_uuid()
);

create table audit.log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_alias uuid,                  -- null = system / service process
  actor_roles text[] not null default '{}',
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  row_id text,                       -- non-person rows (organisations, events, clubs, settings ...)
  subject_alias uuid,                -- person-keyed rows (user_roles, memberships)
  before jsonb,
  after jsonb,
  changed_fields text[] not null default '{}'
);
create index audit_log_at_idx on audit.log (at desc);
create index audit_log_table_row_idx on audit.log (table_name, row_id);

create function audit.alias_for(p_user uuid) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_alias uuid;
begin
  if p_user is null then
    return null;
  end if;
  -- Users that no longer exist (deleted in the same transaction) get no alias.
  if not exists (select 1 from auth.users where id = p_user) then
    return null;
  end if;
  insert into audit.actor_aliases (user_id) values (p_user) on conflict (user_id) do nothing;
  select alias into v_alias from audit.actor_aliases where user_id = p_user;
  return v_alias;
end;
$$;

create function audit.pick(p_row jsonb, p_columns text[]) returns jsonb
language sql immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k, p_row -> k), '{}'::jsonb)
    from unnest(p_columns) as k
   where p_row ? k
$$;

-- Trigger args: (row id column or '', comma-separated allowlist, person column or '')
create function audit.capture() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id_col text := tg_argv[0];
  v_allow text[] := string_to_array(tg_argv[1], ',');
  v_person_col text := nullif(tg_argv[2], '');
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changed text[] := '{}';
  v_actor uuid := auth.uid();
  v_roles text[];
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into v_changed
      from jsonb_object_keys(v_new) as k
     where v_new -> k is distinct from v_old -> k and k <> 'updated_at';
    if cardinality(v_changed) = 0 then
      return null;
    end if;
    -- Only record which non-allowlisted fields changed by count, never their names or values.
    v_changed := array(select unnest(v_changed) intersect select unnest(v_allow))
                 || case when exists (select 1 from unnest(v_changed) c where not (c = any (v_allow)))
                         then array['(other fields)'] else '{}' end;
  end if;

  select coalesce(array_agg(r.role::text order by r.role), case when v_actor is null then array['system'] else '{}' end)
    into v_roles from public.user_roles r where r.user_id = v_actor;

  insert into audit.log (actor_alias, actor_roles, action, table_name, row_id, subject_alias, before, after, changed_fields)
  values (
    audit.alias_for(v_actor),
    v_roles,
    lower(tg_op),
    tg_table_name,
    case when v_person_col is null and v_id_col <> '' then v_row ->> v_id_col end,
    case when v_person_col is not null then audit.alias_for((v_row ->> v_person_col)::uuid) end,
    case when v_old is not null then audit.pick(v_old, v_allow) end,
    case when v_new is not null then audit.pick(v_new, v_allow) end,
    v_changed
  );
  return null;
end;
$$;

-- Append-only: block UPDATE/DELETE for everyone (including table owner). TRUNCATE is not granted to any app role.
create function audit.block_mutation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit log is append-only' using errcode = '42501';
end;
$$;
create trigger audit_log_append_only before update or delete on audit.log
  for each row execute function audit.block_mutation();

-- Attach to admin/organiser-writable tables with explicit allowlists (no personal fields).
create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function audit.capture('', 'role,granted_at', 'user_id');
create trigger audit_organisations after insert or update or delete on public.organisations
  for each row execute function audit.capture('id', 'id,name,slug,status,rejection_reason,is_charity,reviewed_at,country_code', '');
create trigger audit_organisation_members after insert or update or delete on public.organisation_members
  for each row execute function audit.capture('', 'organisation_id,role', 'user_id');
create trigger audit_events after insert or update or delete on public.events
  for each row execute function audit.capture('id',
    'id,organisation_id,slug,name,starts_at,region_id,corporation_id,venue_name,status,status_reason,featured_until,fee_min,fee_max,walk_friendly,checkin_radius_m,published_at', '');
create trigger audit_clubs after insert or update or delete on public.clubs
  for each row execute function audit.capture('id', 'id,name,description,region_id,archived_at', '');
create trigger audit_app_settings after insert or update or delete on public.app_settings
  for each row execute function audit.capture('key', 'key,value,is_public', '');
create trigger audit_legal_documents after insert or update or delete on public.legal_documents
  for each row execute function audit.capture('id', 'id,slug,version,title,published_at', '');

-- Read access for admins (MFA) through a SECURITY DEFINER function; the schema itself is not exposed.
create function public.admin_audit_log(p_table text default null, p_limit integer default 100, p_before_id bigint default null)
returns table (id bigint, at timestamptz, actor_alias uuid, actor_roles text[], action text, table_name text,
               row_id text, subject_alias uuid, before jsonb, after jsonb, changed_fields text[])
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access requires MFA' using errcode = '42501';
  end if;
  return query
    select l.id, l.at, l.actor_alias, l.actor_roles, l.action, l.table_name, l.row_id, l.subject_alias, l.before, l.after, l.changed_fields
      from audit.log l
     where (p_table is null or l.table_name = p_table)
       and (p_before_id is null or l.id < p_before_id)
     order by l.id desc
     limit least(greatest(p_limit, 1), 500);
end;
$$;
revoke execute on function public.admin_audit_log from public, anon;
grant execute on function public.admin_audit_log to authenticated;

-- Lets an admin see their own alias (to recognise their own actions); never reveals others'.
create function public.my_audit_alias() returns uuid
language sql stable security definer
set search_path = ''
as $$ select alias from audit.actor_aliases where user_id = auth.uid() $$;
revoke execute on function public.my_audit_alias from public, anon;
grant execute on function public.my_audit_alias to authenticated;
