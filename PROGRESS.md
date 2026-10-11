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

## Phase 1 approval items (owner, 2026-10-11)
- [x] a. CI fully green on GitHub, including web E2E (see the latest run in the Phase 1 review)
- [x] b. Root cause of the failed mobile test found and fixed at the cause (warm-up render, default timeouts restored; 25/25 randomised runs)
- [x] c. Moderation Policy: 48-hour review target, child-safety reports first
- [x] d. Emergency-contact key backup and rotation procedure + verify/rotate tooling (`docs/operations/EMERGENCY-CONTACT-KEY.md`)
- [x] e. PROGRESS.md and Phase 0 overview updated with the owner's answers
- [x] Phase 2 plan prepared (`docs/phase-2/PLAN.md`): Android dev build first, phone test script, accounts/keys list. **Not started.**

## Waiting on the owner
1. **Approve Phase 1.**
2. Operator details, child-safety contact, support email: your answer used placeholder text (`[MY FULL NAME]`, `[ADDRESS]`, `[NAME]`, `[EMAIL]`). You can enter the real values straight into staging `app_settings` (see `docs/phase-2/PLAN.md`, item 14) without sharing them here.
3. Accounts and keys for Phase 2 task 1, items 1–9 in `docs/phase-2/PLAN.md` (Expo, GitHub `staging` environment, Supabase secrets, emergency-contact key).
4. Google Cloud OAuth setup, items 10–13 (for Google sign-in testing).
5. Free web host choice: Cloudflare Workers (recommended) or Netlify. Vercel Hobby forbids commercial use.
6. Confirm the Supabase Free plan offers the "Before User Created" and "Custom Access Token" auth hooks and TOTP MFA.
7. Bank name / account name and VAT status — before Phase 7.
8. Domain — not yet; **remind the owner before Phase 8**. Nothing in Phases 2–7 depends on it.
9. Confirm "RunLime" availability (stores, domains, TT IPO/USPTO/WIPO) before store bundle IDs are fixed (Phase 8).
10. Attorney review of `docs/legal/` before launch.
11. Apple Developer account (paid) — deferred until budget allows; iOS testing and Sign in with Apple wait for it.

## Decided (owner, 2026-10-11)
- Operator: "RunLime, operated by <owner>" (individual); may transfer to RunLime Limited, so operator details stay in settings.
- Availability: Trinidad and Tobago only, both stores. Caribbean expansion later (BACKLOG lists what each country needs).
- Supabase staging: us-east-1, project `fmnmylqxrmxuzmdcvmhs`. The Privacy Policy states data is stored in the United States.
- Organiser payments: manual bank transfer only; no card gateway in v1.
- Budget: free tiers only; Android first; iOS/Apple deferred; no custom domain until Phase 8.
