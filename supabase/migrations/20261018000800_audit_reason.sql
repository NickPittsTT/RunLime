-- Audit entries can carry a reason (owner, 2026-10-18: "audit-logged with the reason"). A function that wants its
-- change explained sets the transaction-local setting runlime.audit_reason; audit.capture copies it into the row.
-- Everything else is unchanged (allowlists, aliases, append-only).
alter table audit.log add column reason text check (reason is null or char_length(reason) <= 300);

create or replace function audit.capture() returns trigger
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

  insert into audit.log (actor_alias, actor_roles, action, table_name, row_id, subject_alias, before, after, changed_fields, reason)
  values (
    audit.alias_for(v_actor),
    v_roles,
    lower(tg_op),
    tg_table_name,
    case when v_person_col is null and v_id_col <> '' then v_row ->> v_id_col end,
    case when v_person_col is not null then audit.alias_for((v_row ->> v_person_col)::uuid) end,
    case when v_old is not null then audit.pick(v_old, v_allow) end,
    case when v_new is not null then audit.pick(v_new, v_allow) end,
    v_changed,
    nullif(current_setting('runlime.audit_reason', true), '')
  );
  return null;
end;
$$;

-- Staging maintenance: correct a published race's date with a recorded reason, run by the operator through the
-- "Correct event date" workflow (service role only; never callable from the apps). Clears any postponement, keeps
-- the status (status changes stay with change_event_status), sends no notifications (published -> published).
create function public.ops_correct_event_start(p_id uuid, p_starts_at timestamptz, p_reason text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 300 then
    raise exception 'A reason of 10 to 300 characters is required' using errcode = '22023';
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'The date must be in the future' using errcode = '22023';
  end if;
  perform set_config('runlime.audit_reason', btrim(p_reason), true);
  update public.events
     set starts_at = p_starts_at, original_starts_at = null, status_reason = null
   where id = p_id and status = 'published';
  if not found then
    raise exception 'Only a published event can be corrected this way' using errcode = '22023';
  end if;
  perform set_config('runlime.audit_reason', '', true);
end;
$$;
revoke execute on function public.ops_correct_event_start from public, anon, authenticated;
grant execute on function public.ops_correct_event_start to service_role;
