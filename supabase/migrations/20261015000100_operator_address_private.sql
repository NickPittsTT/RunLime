-- Owner privacy decision (2026-10-15, Option A): the operator's address is kept for official records only.
-- It is never shown on RunLime's own pages or in the app; only admins (with MFA) can read it.
update public.app_settings
set is_public = false,
    description = 'Operator postal address. NON-PUBLIC: official records only, never rendered in legal pages or the app (owner decision 2026-10-15).'
where key = 'legal.operator_address';
