# 01 — Architecture (rev 2)

## 1. Stack (versions checked on npm, 2026-10-11)

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Mobile | Expo (managed, CNG) + expo-router | SDK 57 | EAS cloud builds (no Mac needed) |
| Language | TypeScript | the version pinned by SDK 57 (5.x) | TS 7.0 deferred (D12) |
| Web | Next.js App Router | 16.x | Landing, public event pages, legal pages, organiser + admin portals |
| UI (web) | Tailwind CSS | v4 | Accessible primitives as needed |
| UI (mobile) | Own small kit on RN primitives, tokens from `packages/ui-tokens` | — | |
| Backend | Supabase: Postgres 17, Auth, Storage, Edge Functions, pg_cron | CLI 2.120 | |
| Validation | zod | v4 | Shared schemas |
| Data fetching | TanStack Query | v5 | Persisted cache on mobile (Phase 2) |
| Local DB (mobile) | expo-sqlite | SDK 57 | Runs + outbox (Phase 5) |
| Maps | **MapLibre + OpenFreeMap tiles** (`@maplibre/maplibre-react-native` on mobile, `maplibre-gl` on web). Free, no API key, no card (owner, 2026-10-15; replaces Apple/Google native maps, which need a Google billing account with a card) | — | Decided |
| Location | expo-location + expo-task-manager, foreground service | SDK 57 | Approved (D6) |
| Subscriptions | RevenueCat | — | Phase 7 |
| Push | expo-notifications + Expo Push API | SDK 57 | Phase 3 |
| Errors / analytics | Sentry / PostHog | — | Wired in Phase 8 (DSNs via env) |
| Email | Resend as Supabase custom SMTP | — | Local dev uses the bundled Mailpit |
| Hosting | Vercel Pro | — | Approved |
| CI | GitHub Actions + EAS | — | |

## 2. Repository layout

```
runlime/
├─ apps/
│  ├─ mobile/          Expo app (participants)
│  └─ web/             Next.js: /, /legal/*, /support, /delete-account, /organiser/*, /admin/*, (Phase 2: /e/[slug], /races)
├─ packages/
│  ├─ shared/          rules/ (pure functions), schemas/ (zod), db.types.ts (generated), legal rendering
│  ├─ ui-tokens/       Direction A colour/spacing/type tokens
│  └─ config/          tsconfig base
├─ supabase/
│  ├─ migrations/      forward-only SQL
│  ├─ functions/       Edge Functions (Deno)
│  ├─ tests/           pgTAP
│  └─ seed.sql         reference data (regions, settings, plans)
├─ scripts/            seed-dev.ts (test accounts + sample events; refuses to run against production)
├─ docs/               phase-0/, legal/
├─ e2e/                Playwright (web)
├─ CLAUDE.md  BACKLOG.md  README.md
```

Business rules are pure TypeScript in `packages/shared/rules`, unit-tested with Vitest. The critical ones are re-enforced in SQL (constraints, triggers, `SECURITY DEFINER` RPCs). The server always decides.

## 3. Environments

| Env | Supabase | Web | Mobile | Data |
|---|---|---|---|---|
| local | `supabase start` (Docker) | `next dev` | Expo dev client | `seed.sql` + `scripts/seed-dev.ts` |
| staging | project `runlime-staging` | Vercel preview / `staging.<domain>` | EAS channel `staging` | seed + test accounts |
| production | project `runlime-prod` (Pro, daily backups) | `<domain>` | EAS channel `production` | real; dev seed script refuses to run |

Secrets live only in env vars, Supabase secrets, Vercel, EAS and GitHub secrets. `.env.example` lists every variable.

## 4. Auth, age gate, roles

### 4.1 Sign-in methods
Email one-time code, Google, Apple. No phone (BACKLOG). No passwords, which means fewer support issues and no password storage.

### 4.2 Age gate flow (F1 + F2)
```
Device: DOB screen (first) ──<18──► "Sorry" screen. No network call. Local flag only (no DOB stored).
                │ ≥18
                ▼
        Choose method ──► Email code ──► Auth API signInWithOtp(data:{date_of_birth})
                │                         └► before_user_created hook (Postgres): rejects if DOB missing or <18
                ├──► Google / Apple (native ID token) ──► user created (hook can't see DOB, see 4.3)
                ▼
        complete_signup(dob, display_name, nickname, home_area, terms_version, privacy_version) RPC
                └► profiles trigger: age ≥ 18 or raise; consents recorded
        Until a profile exists: every RLS policy denies (has_profile() check); account purged after 1 hour
```

### 4.3 Limitation (honest)
Supabase's ID-token sign-in (`signInWithIdToken`) has **no field for custom data**. I verified this in the Supabase Auth source (`IdTokenGrantParams`). So for Google/Apple, the server hook can't check DOB before the auth user row is created.

Mitigations:
- (a) The device gate runs first, so honest under-18s never reach sign-in.
- (b) A modified client that skips the gate gets an auth row with **no profile**, which can do nothing. The profile trigger refuses under-18 DOBs.
- (c) Profile-less auth users are deleted after 1 hour by pg_cron.
- (d) `complete_signup` with an under-18 DOB deletes the auth user immediately and stores nothing.

Server-side enforcement is therefore complete for **data and access**. The only thing that can exist briefly is an auth row (email + provider id) for someone who bypassed the device gate. Fully preventing that would mean dropping Google/Apple, or an email-first signup with providers linked afterwards (worse UX). Owner may choose either.

### 4.4 Roles and MFA (F4)
- `user_roles(user_id, role)`. A custom access-token hook (Postgres) adds `app_roles` to the JWT.
- `is_admin()` = has `platform_admin` or `super_admin` **and** `auth.jwt()->>'aal' = 'aal2'`. An admin who hasn't completed TOTP gets participant-level access only.
  - The web portal sends admins to enrol in MFA (A0) and then to the MFA challenge.
  - Granting an admin role requires the grantee to enrol before the role is effective in RLS.
- `super_admin` is set only by the CLI bootstrap script (`scripts/bootstrap-super-admin.ts`). Only `super_admin` (at aal2) can grant or revoke `platform_admin`, enforced in the RPC + RLS + pgTAP.
- Organiser = an `organiser` role row, added automatically when an admin verifies the organisation application.

## 5. Run tracker & background location
Unchanged from rev 1 (foreground service, When-In-Use on iOS). Built in Phase 5.

## 6. Notifications
Unchanged design. Phase 3 adds a "new follower / follow request" notification type.

## 7. Check-in (S2: GPS only)
RPC `check_in(event_id, lat, lng, accuracy_m)`:
- validates the window and radius from settings / event overrides
- unique per user per event
- records accuracy

There's no QR in v1.

## 8. Public web & deep links
Unchanged (Phase 2). Every public event page shows the "minors must be accompanied by an adult" notice from the legal settings.

## 9. Payments layer
Unchanged (Phase 7). Bank details come from settings, never hardcoded.

## 10. Security & privacy

### 10.1 Audit log without personal data of deleted users (F3)
Approach: **pseudonymise the "who", allowlist the "what"**.

1. **Actor aliases.**
   - `audit_actor_aliases(user_id PK → auth.users ON DELETE CASCADE, alias uuid)`.
   - `audit_log` stores only `actor_alias`, never `user_id`. The same applies to `subject_alias` when the audited row is about a person (profiles, roles, memberships).
   - When an account is deleted, the alias row cascades away. Audit entries remain but can no longer be linked to anyone. It's a one-way pseudonym, the database equivalent of crypto-shredding.
2. **Column allowlists.** The audit trigger is configured per table with the columns it may record (e.g. `events`: status, starts_at, venue_name…; `user_roles`: role; `organisations`: status, rejection_reason). Anything not on the list, which includes every personal field (DOB, names, emails, phone, emergency contact, weight), is never written to `before`/`after`. The diff shows only that "a non-audited field changed".
3. **No IP addresses** are stored in the audit log.
4. `audit_log` is append-only for every role, Super Admin included: no UPDATE/DELETE grants, and a trigger blocks them. pgTAP tests prove that (a) personal fields never appear and (b) aliases are unlinkable after deletion.

Trade-off: after deletion we can still see "an admin (alias X) suspended organisation Y on date Z", but not who X was. If you need named accountability for *admins* after they leave, keep admin accounts disabled rather than deleted. That's the recommended offboarding procedure.

### 10.2 Emergency contact encryption (F5)
- **Findings:**
  - Supabase docs mark **pgsodium as pending deprecation** and say not to use it for new work.
  - They also don't recommend Transparent Column Encryption.
  - Vault (secrets storage) remains supported.
  - Projects are encrypted at rest by default.
- **Decision:** application-layer envelope encryption.
  - Edge Function `emergency-contact` encrypts with AES-256-GCM via WebCrypto. The key is `EMERGENCY_CONTACT_KEY` in Edge Function secrets, never in the database, so DB dumps and backups hold only ciphertext.
  - Stored in `profile_private(user_id, emergency_contact_ciphertext, key_version)`, readable only by the owner (RLS). No admin policy.
  - `key_version` allows key rotation.
  - The crypto helper lives in `packages/shared/crypto` and is unit-tested.

### 10.3 Other controls
- RLS on every table. `has_profile()` is required for any authenticated access.
- Rate limits:
  - Auth built-in limits
  - `rate_limits` table + `check_rate_limit()` in RPCs
  - Turnstile on public web forms (Phase 2+)
- Storage buckets: `public-media`, `private-proofs`, `exports` (Phases 2/7).
- **Account deletion** (RPC `delete_my_account()`, `SECURITY DEFINER`, from mobile and web; storage cleanup arrives with Storage in Phase 2):
  - deletes the auth user, which cascades to personal rows
  - the audit alias is removed
  - RSVP aggregates are kept as counts only
  - payment records are kept 7 years with the person detached (`payer_alias`)
- **Data export** (Edge Function `export-user-data`): returns a JSON document of all the user's rows. Runs/GPX are added in Phase 5.
