-- Hosting region token for the privacy policy, and an admin-only upsert for legal documents (used by scripts/sync-legal.ts via service role).
insert into public.app_settings (key, value, is_public, description) values
  ('legal.hosting_region', 'null', true, 'Where the database is hosted (e.g. "the United States (AWS us-east-1)"). Shown in the privacy policy.')
on conflict (key) do nothing;

grant select on public.legal_documents to anon, authenticated;
