# RunLime

The 5K race calendar and run tracker for Trinidad and Tobago.

- **Mobile app:** Expo (Android + iOS)
- **Web portal:** Next.js (organiser + admin portals, legal pages)
- **Backend:** Supabase

**Status:** Phase 1 (foundation) — see [PROGRESS.md](PROGRESS.md). Design docs: [docs/phase-0](docs/phase-0/00-OVERVIEW.md). Conventions and decisions: [CLAUDE.md](CLAUDE.md).

## Repository layout

```
apps/mobile      Expo SDK 57 app (expo-router)
apps/web         Next.js 16 portal: /sign-in, /account, /organiser, /admin, /legal/*, /support, /delete-account
packages/shared  Business rules (18+ age gate), zod schemas, legal rendering — unit tested
packages/ui-tokens  Brand Direction A colours/spacing (contrast-tested)
supabase/        migrations, pgTAP tests, Edge Functions, auth email template, config
scripts/         seed-dev, sync-legal, bootstrap-super-admin
e2e/             Playwright web tests
docs/            phase-0 design, legal drafts + store requirements
```

## Prerequisites
- Node 22 and pnpm 10 (`corepack enable`)
- Docker (for local Supabase)
- Supabase CLI 2.120 (`brew install supabase/tap/supabase`, or `npx supabase@2.120.0`)
- For mobile device builds: an Expo account and the EAS CLI (`npm i -g eas-cli`). No Mac is needed: iOS builds run on EAS.

## Local setup

```bash
pnpm install

# 1. Backend
printf 'EMERGENCY_CONTACT_KEY_VERSION=1\nEMERGENCY_CONTACT_KEY_V1=%s\nALLOWED_ORIGINS=http://localhost:3000\n' "$(openssl rand -base64 32)" > supabase/functions/.env
supabase start          # applies migrations; prints API URL + keys
supabase status -o env  # copy ANON_KEY / SERVICE_ROLE_KEY

# 2. Reference content and dev data (never runs against production)
export SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
pnpm legal:sync --publish
pnpm seed:dev           # prints the dev password and TOTP secrets for super@ and admin@

# 3. Web portal
cp apps/web/.env.example apps/web/.env.local   # fill in NEXT_PUBLIC_SUPABASE_ANON_KEY
pnpm --filter @runlime/web dev                  # http://localhost:3000

# 4. Mobile (development build; Google sign-in needs a dev client, not Expo Go)
cp apps/mobile/.env.example apps/mobile/.env    # Android emulator reaches the host at 10.0.2.2
pnpm --filter @runlime/mobile start
```

Sign-in emails go to Mailpit at http://127.0.0.1:54324 locally.

### Seeded accounts (local/staging only)
All are on the `runlime.test` domain. The password is printed by the seed script; production accounts never have passwords.

| Email | Role | Notes |
|---|---|---|
| super@runlime.test | super_admin | TOTP secret printed on the first seed run |
| admin@runlime.test | platform_admin | TOTP secret printed on the first seed run |
| organiser@runlime.test | organiser | verified sample organisation |
| organiser.pending@runlime.test | participant | application waiting for review |
| runner@runlime.test | participant | private account |
| runner.public@runlime.test | participant | public account |

The blocked under-18 path has **no** account by design. It's covered by tests (see below).

## Tests

| Command | What it runs |
|---|---|
| `pnpm test` | Vitest (shared rules, legal docs, encryption, contrast) + Jest (mobile) |
| `pnpm typecheck` / `pnpm lint` | All workspaces |
| `supabase test db` | pgTAP: 18+ rule at every layer, RLS, MFA-gated admin, organisers, audit log, clubs/settings, deletion, data export |
| `pnpm e2e` | Playwright against local Supabase + a production build of the web app (desktop + phone viewport) |

CI (`.github/workflows/ci.yml`) runs all of the above on every pull request and push to `main`.

## Environment variables
All are listed in [.env.example](.env.example). Secrets live only in Supabase secrets, Vercel, EAS and GitHub. Never commit them.

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` | Vercel | Web portal |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_URL` | EAS | Mobile app |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `GOOGLE_IOS_URL_SCHEME` | EAS | Google sign-in |
| `APP_ENV`, `APP_BUNDLE_ID`, `EAS_PROJECT_ID` | EAS | Build variant / IDs (store IDs are fixed in Phase 8) |
| `EMERGENCY_CONTACT_KEY_V1`, `EMERGENCY_CONTACT_KEY_VERSION` | Supabase function secrets | AES-256-GCM key for emergency contacts. **Back it up.** Losing it makes stored contacts unreadable |
| `ALLOWED_ORIGINS` | Supabase function secrets | CORS for Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Actions / your shell | Scripts only |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, var `SUPABASE_PROJECT_REF` | GitHub environments `staging`, `production` | Database deploy workflow |

## Deployment

### One-time setup per environment (staging, then production)
1. **Supabase project** (Pro plan for production; region per owner decision, recommended `us-east-1`).
2. **Auth settings** in the dashboard. These are *not* pushed from `config.toml`:
   - Email OTP length 6, expiry 600 s. Upload `supabase/templates/otp.html` as the Magic Link and Confirm signup templates.
   - Custom SMTP: Resend.
   - Providers: Google (web + iOS client IDs; "skip nonce check" off) and Apple (Services ID, key). Phone and anonymous sign-in: **off**.
   - MFA: TOTP enabled.
   - **Auth Hooks:** Before User Created → Postgres `public.hook_before_user_created`; Custom Access Token → Postgres `public.custom_access_token_hook`.
   - Site URL and redirect URLs: the portal domain plus `runlime://auth/callback`.
3. **Function secrets:** `supabase secrets set EMERGENCY_CONTACT_KEY_V1=... EMERGENCY_CONTACT_KEY_VERSION=1 ALLOWED_ORIGINS=https://<domain>`
4. **GitHub environments** `staging` and `production` (the latter with required reviewers), holding the secrets in the table above.
5. **Settings:** set `legal.operator_name`, `legal.operator_address`, `legal.support_email`, `legal.child_safety_contact_email`, `legal.website` and `legal.hosting_region` in `app_settings`. Until they're set, legal pages show a DRAFT banner.
6. **Super admin:** the owner signs up normally, then run `pnpm bootstrap:super-admin <owner email>` with production keys. The owner enrols two-factor authentication at `/admin/mfa`.

### Releasing
- **Database + functions + legal docs:**
  - staging deploys automatically after CI passes on `main`
  - production deploys through **Actions → Deploy database → production**, which requires approval
- **Web:** Vercel project rooted at `apps/web`. Preview deployments run against staging; production deploys from `main`.
- **Mobile:** `eas build --profile staging` (internal) or `--profile production`, then `eas submit`. The store submission checklist arrives in Phase 8.

### Backups
Supabase Pro takes daily backups (7-day retention). Point-in-time recovery is an optional add-on (see `docs/phase-0/05-COSTS.md`). The emergency-contact key must be backed up separately, in a password manager held by the owner.
