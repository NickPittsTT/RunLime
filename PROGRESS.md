# RunLime — Progress

**Last updated:** 2026-10-15

## Phases

| Phase | Scope | Status | % |
|---|---|---|---|
| 0 | Questions, architecture, data model, screens, brand, costs | Approved by owner (rev 2) | 100% |
| 1 | Setup, environments, auth + 18+ age gate, roles, RLS, seed, legal drafts | Approved by owner (2026-10-11) | 100% |
| 2 | Events: organiser portal, admin approval, onboarding, calendar, event page, public web | In progress | 10% |
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

## Phase 2 checklist (current)

**Task 1: Android development build on the owner's phone**
- [x] Expo project linked (`ca1a5ee2-b15a-488d-b123-8fd075db8be1`), `expo-dev-client`, EAS development profile (APK, debug key)
- [x] "Mobile dev build (Android)" workflow (EAS free tier; uses `EXPO_TOKEN` from GitHub secrets)
- [x] Owner: `EXPO_TOKEN` secret added
- [ ] Owner: `SUPABASE_PROJECT_REF` (staging environment variable) and `SUPABASE_ANON_KEY` (repository variable)
- [ ] Staging database deployed (needs the Supabase secrets, items 5–7 in `docs/phase-2/PLAN.md`)
- [ ] First build started; APK link sent; owner runs the phone test script

**Platform**
- [x] Workflows moved off Node 20 (checkout@v5, setup-node@v5, pnpm/action-setup@v5, upload-artifact@v6, supabase/setup-cli@v2)
- [x] Web host: Cloudflare Workers via OpenNext. Next.js pinned to 16.3.8 (adapter limit; 16.4 in BACKLOG). The full web E2E suite passes on Cloudflare's runtime locally; CI now runs E2E on that runtime
- [x] "Deploy database" skips cleanly until the staging secrets exist
- [x] Legal pages render Markdown tables; Privacy Policy names Cloudflare as the web host
- [ ] Cloudflare account + API token (free) for the staging web deploy — added to the setup table when we reach that step
- [ ] Phase 2 feature work (events, organiser portal, calendar, onboarding, public pages) — after Task 1

## Phase 1 approval items (owner, 2026-10-11)
- [x] a. CI fully green on GitHub, including web E2E (see the latest run in the Phase 1 review)
- [x] b. Root cause of the failed mobile test found and fixed at the cause (warm-up render, default timeouts restored; 25/25 randomised runs)
- [x] c. Moderation Policy: 48-hour review target, child-safety reports first
- [x] d. Emergency-contact key backup and rotation procedure + verify/rotate tooling (`docs/operations/EMERGENCY-CONTACT-KEY.md`)
- [x] e. PROGRESS.md and Phase 0 overview updated with the owner's answers
- [x] Phase 2 plan prepared (`docs/phase-2/PLAN.md`): Android dev build first, phone test script, accounts/keys list.
- [x] Final pre-approval checks: corrected PowerShell key command; exactly-18-today / 18-tomorrow tests on every layer + phone script; Terms: false DOB is a breach and grounds for closure; domain + email service recorded as required before closed testing with others.

## Waiting on the owner
2. Operator details, child-safety contact, support email: your answer used placeholder text (`[MY FULL NAME]`, `[ADDRESS]`, `[NAME]`, `[EMAIL]`). You can enter the real values straight into staging `app_settings` (see `docs/phase-2/PLAN.md`, item 14) without sharing them here.
3. Accounts and keys for Phase 2 task 1, items 1–9 in `docs/phase-2/PLAN.md` (Expo, GitHub `staging` environment, Supabase secrets, emergency-contact key).
4. Google Cloud OAuth setup, items 10–13 (for Google sign-in testing).
5. Free web host choice: Cloudflare Workers (recommended) or Netlify. Vercel Hobby forbids commercial use.
6. Confirm the Supabase Free plan offers the "Before User Created" and "Custom Access Token" auth hooks and TOTP MFA.
7. Bank name / account name and VAT status — before Phase 7.
8. Domain — not yet; **remind the owner before Phase 8**. Nothing in Phases 2–7 depends on it.
   - **A custom domain AND an email service (custom SMTP) are needed before any closed testing with other people**, including Google Play's closed test with 12+ testers. Supabase's free built-in mailer only sends to members of your Supabase organisation, with a very low hourly limit. Free email services (e.g. Resend's free tier) need a verified domain to send to anyone else. Until then, only you can test email sign-in.
9. Confirm "RunLime" availability (stores, domains, TT IPO/USPTO/WIPO) before store bundle IDs are fixed (Phase 8).
10. Attorney review of `docs/legal/` before launch.
11. Apple Developer account (paid) — deferred until budget allows; iOS testing and Sign in with Apple wait for it.

## Decided (owner, 2026-10-11)
- Operator: "RunLime, operated by <owner>" (individual); may transfer to RunLime Limited, so operator details stay in settings.
- Availability: Trinidad and Tobago only, both stores. Caribbean expansion later (BACKLOG lists what each country needs).
- Supabase staging: us-east-1, project `fmnmylqxrmxuzmdcvmhs`. The Privacy Policy states data is stored in the United States.
- Organiser payments: manual bank transfer only; no card gateway in v1.
- Budget: free tiers only; Android first; iOS/Apple deferred; no custom domain until Phase 8.
