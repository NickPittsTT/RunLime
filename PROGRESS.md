# RunLime — Progress

**Last updated:** 2026-10-11

## Phases

| Phase | Scope | Status | % |
|---|---|---|---|
| 0 | Questions, architecture, data model, screens, brand, costs | Approved by owner (rev 2) | 100% |
| 1 | Setup, environments, auth + 18+ age gate, roles, RLS, seed, legal drafts | Complete (awaiting owner approval) | 100% |
| 2 | Events: organiser portal, admin approval, onboarding, calendar, event page, public web | Not started | 0% |
| 3 | RSVP, followers & clubs, notifications/broadcasts, attendance dashboard | Not started | 0% |
| 4 | GPS check-in | Not started | 0% |
| 5 | Run tracker, history, totals | Not started | 0% |
| 6 | Community times, sharing, reporting/blocking, finisher card | Not started | 0% |
| 7 | Plans/entitlements, store subscriptions, organiser payments, settings, support inbox, audit UI | Not started | 0% |
| 8 | Hardening, store readiness, TestFlight + Play closed test | Not started | 0% |

## Phase 1 checklist

- [x] Phase 0 rev 2 docs + CLAUDE.md + BACKLOG.md in the dedicated repo
- [x] Monorepo (pnpm + Turborepo), shared rules package, Direction A tokens
- [x] Age rule (18+) as a shared rule + unit tests
- [x] Database: foundation, identity, organisations/events/clubs, audit, data export, legal settings migrations
- [x] Auth hooks: before-user-created (18+), custom access token (roles)
- [x] RLS + MFA-gated admin helpers; pgTAP suite (age, RLS, roles/MFA, organisations, audit, clubs/settings, deletion, RLS coverage, export)
- [x] Edge Functions: emergency-contact (AES-256-GCM), export-user-data
- [x] Dev seed (all roles, TOTP for admins, 20 sample events), refuses production
- [x] Legal drafts (8 documents) + store requirements checklist + sync script
- [x] Web portal: sign-in (age gate first), complete profile, account (export/delete), organiser application, admin MFA, organisers queue, users, clubs, legal/support/delete pages
- [x] Web E2E (Playwright) all green — 10 tests, desktop + phone viewport
- [x] Mobile app: age gate first, email/Google/Apple sign-in, profile & privacy, emergency contact, export, delete (bundles for Android + iOS)
- [x] Mobile unit tests (Jest) — 13 tests
- [x] CI (GitHub Actions) green on GitHub (run #3): lint, typecheck, unit, pgTAP, web E2E; database deploy workflow (staging auto, production manual)
- [x] README (setup, env vars, deployment), .env.example, bootstrap-super-admin script
- [x] Phase 1 review report (`docs/phase-1/REVIEW.md`)

## Waiting on the owner

1. Legal entity (individual or company name) — answer came through as template text.
2. Bank name / account name and VAT status — needed by Phase 7.
3. Domain — needed before Phase 2.
4. Confirm "RunLime" availability (App Store, Google Play, domains, TT IPO/USPTO/WIPO) before store bundle IDs are fixed.
5. Store distribution: TT only (recommended)?
6. Name a child-safety (CSAE) contact person for Google Play.
7. Supabase hosting region (recommended: us-east-1).
8. Google OAuth client IDs and Apple Sign in credentials (Services ID, key) for staging/production.
9. Attorney review of `docs/legal/` before launch.
