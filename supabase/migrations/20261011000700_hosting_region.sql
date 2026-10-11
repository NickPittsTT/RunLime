-- Owner decision 2026-10-11: Supabase region us-east-1. The privacy policy states data is stored in the United States.
-- Operator details stay as settings (operator may change from an individual to RunLime Limited later).
update public.app_settings
   set value = to_jsonb('the United States (Amazon Web Services, us-east-1 region)'::text)
 where key = 'legal.hosting_region';

update public.app_settings
   set description = 'Operator as it should read after "RunLime, operated by" — e.g. the owner''s full name today, "RunLime Limited" if transferred later.'
 where key = 'legal.operator_name';
