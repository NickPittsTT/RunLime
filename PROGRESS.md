# RunLime — Progress

**Last updated:** 2026-10-15

## Phases

| Phase | Scope | Status | % |
|---|---|---|---|
| 0 | Questions, architecture, data model, screens, brand, costs | Approved by owner (rev 2) | 100% |
| 1 | Setup, environments, auth + 18+ age gate, roles, RLS, seed, legal drafts | Approved by owner (2026-10-11) | 100% |
| 2 | Events: organiser portal, admin approval, onboarding, calendar, event page, public web | In progress | 15% |
| 3 | RSVP, followers, clubs (leaders, approvals, requests, turnout), runner level, notifications/broadcasts, attendance dashboard | Not started | 0% |
| 4 | GPS check-in | Not started | 0% |
| 5 | Run tracker, history, totals | Not started | 0% |
| 6 | Community times, activity + club leaderboards, verified runners, sharing, reporting/blocking, finisher card → then the real-race pilot | Not started | 0% |
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
- [x] CI (GitHub Actions) green on GitHub: lint, typecheck, unit, pgTAP, web E2E; database deploy workflow (staging auto, production manual)
- [x] **Approval run:** CI run #6 on commit `0d61553` (all jobs green): https://github.com/NickPittsTT/RunLime/actions/runs/38162201374
- [x] README (setup, env vars, deployment), .env.example, bootstrap-super-admin script
- [x] Phase 1 review report (`docs/phase-1/REVIEW.md`)

## Phase 2 checklist (current)

**Task 1: Android development build on the owner's phone**
- [x] Expo project linked (`ca1a5ee2-b15a-488d-b123-8fd075db8be1`), `expo-dev-client`, EAS development profile (APK, debug key)
- [x] "Mobile dev build (Android)" workflow (EAS free tier; uses `EXPO_TOKEN` from GitHub secrets)
- [x] Owner: `EXPO_TOKEN` secret added
- [x] Owner: staging variables and secrets, plus emergency-contact key v1 in Supabase secrets
- [x] Staging deployed: 7 migrations, 3 Edge Functions, 8 legal drafts (no seed data, no test accounts)
- [x] Auth configured on the Free plan: Before User Created hook (probe: no DOB → 403, 17-year-old → 403), Custom Access Token hook, TOTP MFA on, 6-digit OTP valid 10 min, app redirect URL
- [x] Emergency-contact key verify on staging: `currentKey: ok`, 0 undecryptable
- [x] 6-digit code email template applied on staging (after the owner set up Gmail SMTP, Option A)
- [x] Staging `legal.support_email` = runlimett@gmail.com (placeholder until there's a domain)
- [x] Email delivery via Gmail SMTP: **owner-confirmed 2026-10-15** — "Your RunLime sign-in code" with 6 digits arrived in the runlimett@gmail.com inbox (Supabase accepted it with HTTP 200 at 16:24 UTC). Earlier failures were because the new app password hadn't been saved
- [x] First Android staging APK built (EAS build c1e4f42a, commit 290f8b3, 2026-10-15). Earlier failures fixed at the cause: babel-preset-expo not declared; splash image missing; workflow step syntax error
- [x] **Phone test PASSED (owner, 2026-10-15)** on the staging APK: every step in sections A, B, C and E. Confirmed: 18-tomorrow blocked (step 3) and still blocked after force-close (step 4); code email → "Hi" + Private (7–9); emergency contact reloads (11); data export contains the profile (12); both test accounts deleted, staging clean (16–18). Only the legal links failed, as expected until the staging website is deployed
- [ ] Section D (Google sign-in) + legal links: build started 2026-10-15 with Google sign-in and `STAGING_WEB_URL`; owner tests when the APK is ready

**Platform**
- [x] Workflows moved off Node 20 (checkout@v5, setup-node@v5, pnpm/action-setup@v5, upload-artifact@v6, supabase/setup-cli@v2)
- [x] Web host: Cloudflare Workers via OpenNext. Next.js pinned to 16.3.8 (adapter limit; 16.4 in BACKLOG). The full web E2E suite passes on Cloudflare's runtime locally; CI now runs E2E on that runtime
- [x] "Deploy database" skips cleanly until the staging secrets exist
- [x] Legal pages render Markdown tables; Privacy Policy names Cloudflare as the web host
- [x] "Deploy web" workflow (Cloudflare Workers Free): skips until configured; free-plan size check; smoke test; points Edge Function CORS (`ALLOWED_ORIGINS`) at the site
- [x] Worker minified: 2.85 → 2.52 MiB compressed (82% of the free 3 MiB limit); CI fails above the limit. Web E2E 10/10 on the minified build on Cloudflare's runtime (local)
- [x] Owner: Cloudflare account (Free), subdomain `runlimett`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (token rolled once after exposure; the new one works)
- [x] **Staging web live (2026-10-15):** https://runlime-web-staging.runlimett.workers.dev — Deploy web run #3 green: 2.52 MiB, smoke test `/`, `/legal/terms`, `/legal/privacy` → 200, Edge Function `ALLOWED_ORIGINS` set to the site
- [x] Owner: `STAGING_WEB_URL` saved (2026-10-15); owner confirmed the site works on their phone and Terms shows the operator name + support email, no address
- [ ] Phase 2 feature work (events, organiser portal, calendar, onboarding, public pages) — after Task 1
- [ ] RunLime listings (owner's pilot plan): events without an organiser (`listing_source = runlime`, official link required, no media/sponsors), admin create-event A4, `events.unaffiliated_notice` setting shown on app + web event pages; pgTAP for the constraints

## Phase 1 approval items (owner, 2026-10-11)
- [x] a. CI fully green on GitHub, including web E2E (see the latest run in the Phase 1 review)
- [x] b. Root cause of the failed mobile test found and fixed at the cause (warm-up render, default timeouts restored; 25/25 randomised runs)
- [x] c. Moderation Policy: 48-hour review target, child-safety reports first
- [x] d. Emergency-contact key backup and rotation procedure + verify/rotate tooling (`docs/operations/EMERGENCY-CONTACT-KEY.md`)
- [x] e. PROGRESS.md and Phase 0 overview updated with the owner's answers
- [x] Phase 2 plan prepared (`docs/phase-2/PLAN.md`): Android dev build first, phone test script, accounts/keys list.
- [x] Final pre-approval checks: corrected PowerShell key command; exactly-18-today / 18-tomorrow tests on every layer + phone script; Terms: false DOB is a breach and grounds for closure; domain + email service recorded as required before closed testing with others.

## Waiting on the owner
1. Legal details still open: operator name, child-safety contact name and email. (Operator address: optional, non-public, for official records only.) (Support email is set on staging: runlimett@gmail.com, until there's a domain.) You can enter them straight into staging `app_settings` (see `docs/phase-2/PLAN.md`, item 14) without sharing them here.
1a. Cloudflare: items 15–18 done (2026-10-15).
2. Google Android OAuth client (item 13): **done by the owner on 2026-10-15** (`GOOGLE_ANDROID_CLIENT_ID` set). Section D to be tested on the next build.
3. Bank name / account name and VAT status — before Phase 7.
4. **Pilot timing (owner, 2026-10-15): after Phase 6, or when most of the app is complete.** Can ~10 friends sign in **without a custom domain**? **Yes** (checked 2026-10-15):
   - **Email codes via Gmail SMTP:** custom SMTP removes the free mailer's "organisation members only" limit, so codes reach any address. Personal Gmail allows about 500 emails per rolling 24 h, and our Supabase limit is 30 emails per hour (a setting), plenty for 10 people. Codes may land in spam the first time; tell friends to check.
   - **Google sign-in:** RunLime asks Google only for name and email (basic scopes). Google exempts these from the Testing-mode rules (no 100-test-user list, no warning screen, no 7-day expiry). Adding the friends as test users does no harm.
   - **Install:** share the staging APK link (sideload, free). Google Play internal testing would need the US$25 Play Console account (paid, so not without your OK).
   - **Website/legal links:** the workers.dev site works.
   - Still needed before the pilot: legal drafts reviewed (friends' real data under DRAFT terms), every friend 18+, a staging data clean-up plan. A custom domain + domain email remain required **before store submission (Phase 8)**, and are better for deliverability; your budget rule still says "before closed testing with other people", so it's your call whether to relax that for a sideloaded friends pilot.
5. Confirm "RunLime" availability (stores, domains, TT IPO/USPTO/WIPO) before store bundle IDs are fixed (Phase 8).
6. Attorney review of `docs/legal/` before launch.
6a. **Final logo (owner designs it in Canva), before store submission.** Direction: a running shoe with lime wedges as a motion trail. Staging keeps the current lime-wedge icon. When the files are ready, I'll give the exact sizes and formats needed (app icon, Android adaptive icon layers, splash, store listing, web).
7. Apple Developer account (paid) — deferred until budget allows; iOS testing and Sign in with Apple wait for it.

## Decided (owner, 2026-10-11)
- Operator: "RunLime, operated by <owner>" (individual); may transfer to RunLime Limited, so operator details stay in settings.
- Availability: Trinidad and Tobago only, both stores. Caribbean expansion later (BACKLOG lists what each country needs).
- Supabase staging: us-east-1, project `fmnmylqxrmxuzmdcvmhs`. The Privacy Policy states data is stored in the United States.
- Organiser payments: manual bank transfer only; no card gateway in v1.
- **Operator address is private (owner, 2026-10-15, Option A):** RunLime's legal pages and app identify the operator by name and contact email only. `legal.operator_address` is non-public (admins with MFA only), kept for official records, and can't be set through a workflow (inputs and logs would expose it). The attorney must confirm no address is legally required on the legal pages (flagged in the Privacy Policy and Terms). Accepted: once the business is registered, the address is public on the Companies Registry. Before Phase 7, check whether Google Play shows a developer address for personal accounts with in-app purchases (STORE-REQUIREMENTS C17); options then are launching without Premium at first, or incorporating RunLime Limited with an accountant's office as the registered address.
- **Activity leaderboards (owner, 2026-10-15) — Phase 6, with community times.** Kilometres (tracked runs) and Races attended (GPS check-ins); Weekly / Monthly / Year; Everyone / People I follow; top 20 + your own rank; opt-in; verified data only; impossible speeds excluded (admin setting); no prizes. Design added to `02-DATA-MODEL.md`, `03-SCREENS.md` (M37a), `00-OVERVIEW.md` §4a, CLAUDE.md.
- **Testing plan (owner, 2026-10-15) — replaces the earlier "share with 5 to 15 testers in Phase 2" plan.** No early tester link. The first outside test is a **real-race pilot after Phase 6** with friends who run 5Ks. Until then the owner acts as admin and enters real upcoming races with the admin "create event" screen as **RunLime listings**: facts only (name, date, start, distance, official registration link; venue + start pin for GPS check-in), a visible "not affiliated, check with the organiser" notice, no organiser flyers or logos without permission. Needs in Phase 2: events without an organiser (`listing_source = runlime`), admin create-event (A4), notice setting.
- **Speed checks (owner, 2026-10-15), Phase 6:** ≥ 3:00 /km average and every 1 km split → counted; 2:35–3:00 → admin review queue (A15), excluded from leaderboards until approved; < 2:35 → rejected for leaderboards (run stays in private history). Admins can mark a reviewed runner as verified so their fast runs aren't flagged again. Thresholds are settings.
- **RunLime listings include venue + start pin** (owner, 2026-10-15). **Leaderboard periods: calendar periods** (confirmed). **Calendar:** month view swipes month to month (January–December and beyond) plus a list view (M11/M12, Phase 2).
- **Runner level + clubs (owner, 2026-10-15).** Phase 3: optional runner level (Casual / Club runner / Competitive) in onboarding and profile, never bypassing speed checks; clubs picked from the approved list, joining needs a club leader's approval, users can request new clubs (owner approves), new per-club leader role; club turnout ("Club X: 25 attending") on race pages and organiser dashboards from opted-in approved members. Phase 6: club leaderboards (km, races, avg members per race; total and per member) and admin "verified runner" status. Design in `02-DATA-MODEL.md`, `03-SCREENS.md` (M9a, M19, M37b, M45, M45a, A6, A14, O10, W2), `00-OVERVIEW.md` S6, CLAUDE.md. Not built yet.
- Budget: free tiers only; Android first; iOS/Apple deferred; no custom domain until needed: before any closed testing with other people, and at the latest Phase 8.
