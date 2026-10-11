# Phase 1 review — Setup, auth with 18+ age gate, roles, RLS, seed, legal drafts

Date: 2026-10-11 · Branch: `phase-1` · Progress: see `PROGRESS.md`

## What was built
| Area | Delivered |
|---|---|
| Repo | pnpm + Turborepo monorepo; `apps/mobile`, `apps/web`, `packages/shared`, `packages/ui-tokens`, `supabase/`, `scripts/`, `e2e/` |
| Age rule (18+, hard) | Shared rule (TS, Port of Spain date, leap-day safe) · device gate first on web and mobile · Auth hook rejects email sign-ups without an 18+ DOB · profile trigger · `complete_signup` deletes under-18 auth users · profile-less users purged after 1 h · no setting can hold an age rule (DB check constraint) |
| Roles & MFA | `user_roles` table; `is_admin()` requires role **and** `aal2`; only the super admin (aal2) can grant/revoke platform admin; super admin set only by the bootstrap script |
| RLS | Enabled on every public table (a test enforces it); column-level grants (DOB not user-editable); admins can't read emergency contacts |
| Audit log (F3) | Aliased actors/subjects, column allowlists, no IPs, append-only even for the owner; aliases cascade-delete with the account |
| Emergency contact (F5) | AES-256-GCM in an Edge Function; DB stores ciphertext only; owner-only RLS; key versioning |
| Data rights | `export_my_data()` + `export-user-data` function (JSON download, web & mobile); `delete_my_account()` (web & mobile) |
| Organisers | Apply → admin verify/reject (reason)/suspend → organiser role granted/removed; rate-limited |
| Clubs (F4) | Admin create/edit/archive (A14); join/leave policies |
| Reference data | TT, 6 friendly running areas, 14 corporations + THA; all settings incl. owner prices |
| Seed | 6 accounts (all roles, TOTP for admins), 2 orgs, 3 clubs, 20 sample events (future, past, postponed, cancelled, pending, draft); refuses production |
| Web | Landing, sign-in (DOB → email → code), complete profile, account (export, delete, sign out), organiser application/status, admin MFA enrol/challenge, admin overview/organisers/users/clubs, legal pages with DRAFT banner, support, web account deletion |
| Mobile | DOB gate (first screen) → blocked screen or sign-in (Apple on iOS, Google when configured, email code) → complete profile (re-asks DOB after OAuth restarts) → profile, edit profile & privacy, emergency contact, your data, help & legal, delete account |
| Legal | 8 drafts in `docs/legal/` + `STORE-REQUIREMENTS.md` (age-rating answers for an 18+ app, Google CSAE, health declaration, API 36, etc.) |
| CI/CD | `ci.yml` (lint, typecheck, unit, pgTAP, Playwright) · `deploy-database.yml` (staging auto, production with approval) |

## Tests run (all passing on 2026-10-11, from a clean `supabase db reset`)
| Suite | Count | Covers |
|---|---|---|
| pgTAP | 88 | age rule at hook/trigger/RPC level incl. leap days; RLS isolation; DOB immutability; MFA gating; super-admin-only role grants; organiser flow + rate limit; audit redaction/unlinkability/append-only; clubs & settings permissions; account deletion cascade; incomplete sign-up purge; RLS coverage; data export isolation |
| Vitest | 35 | age gate, schemas, AES-GCM (round trip, wrong key, AAD binding), legal docs (all present, known tokens, 18+ wording), Direction A contrast ≥ 4.5:1 |
| Jest (mobile) | 13 | age gate screen (DOB first, no sign-in options; under-18 → no network call; persisted block), device flag stores no DOB, chunked SecureStore |
| Playwright (web) | 10 | under-18 blocked before sign-in (desktop + phone); server rejects under-18 bypass with no user created; adult sign-up → export → delete; organiser apply → admin MFA enrol → reject-needs-reason → approve → verified; club creation; platform admin can't grant roles; participant can't reach admin; legal pages + 404; protected-route redirect |
| Manual (API) | — | Auth hook via real GoTrue (no-DOB/under-18 → 403, adult → 200); Edge Functions PUT/GET/DELETE/export, 400 on bad input, 401 without session; DB holds only ciphertext |
| Build | — | `next build`; `expo export` bundles for Android and iOS |

## Not tested (and why)
- **Mobile app on a device/emulator.** No Android emulator or iOS simulator in this environment. Screens are typechecked, linted, unit-tested and bundle successfully, but have not been run end to end. Maestro flows will run in Phase 2 once an EAS development build exists.
- **Google and Apple sign-in.** These need your OAuth credentials and a device build. The code paths are written but not executed.
- **Hosted Supabase / Vercel / EAS.** No accounts or credentials yet. `deploy-database.yml` has never been run.
- **Real email delivery** (Resend). Locally, emails go to Mailpit.
- **Screen readers.** Labels, roles and contrast are set and tested, but TalkBack/VoiceOver have not been tried on a device.

## Open issues / risks
1. OAuth sign-ups can't send DOB to the auth hook (Supabase limitation, verified in the Auth source code). Mitigated by the profile trigger, `complete_signup` and the 1-hour purge, but a brief auth row can exist for someone who bypasses the device gate.
2. Email OTP rate limits in production must be set in the dashboard (`config.toml` applies to local only).
3. `club_member_counts` is a security-definer view (aggregate counts only). The Supabase linter will flag it. Acceptable, or convert it to a function in Phase 3.
4. Environment-specific workarounds used only in this cloud session: Edge Functions use direct REST calls instead of supabase-js (lighter anyway), and Expo versions were pinned from SDK 57's `bundledNativeModules.json` because `expo install` couldn't reach Expo's API.

## Decisions needed from the owner
See "Waiting on the owner" in `PROGRESS.md`.
