# RunLime — Progress

**Last updated:** 2026-10-18 (Phase 2 approved by the owner; Phase 3 in progress)

## Phases

| Phase | Scope | Status | % |
|---|---|---|---|
| 0 | Questions, architecture, data model, screens, brand, costs | Approved by owner (rev 2) | 100% |
| 1 | Setup, environments, auth + 18+ age gate, roles, RLS, seed, legal drafts | Approved by owner (2026-10-11) | 100% |
| 2 | Events: organiser portal, admin approval, onboarding, calendar, event page, public web | **Approved by the owner (17 Oct 2026)** after phone checks C1–C5 | 100% |
| 3 | RSVP, followers, clubs (leaders, approvals, requests, turnout), runner level, profile photos, notifications/broadcasts, attendance dashboard | **Scope approved by the owner (2026-10-18)**; in progress, slice by slice (`docs/phase-3/PLAN.md`) | 0% |
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

## Phase 2 checklist (approved 2026-10-18)

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
- [x] Second staging APK built (2026-10-15, 18 min): Google sign-in + `STAGING_WEB_URL`. APK signing SHA-1 printed from the real APK = `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (matches the Google Android client)
- [x] **Task 1 COMPLETE (owner, 2026-10-15):** Section D (Google sign-in) and all Help & legal links passed on the second APK (greeting shows the owner's name; legal pages show name + support email, no address)
- [x] Staging super admin: runlimett@gmail.com (created with Google sign-in), granted by the new "Bootstrap super admin" workflow (run #1 green). Owner sets up TOTP at `/admin/mfa`
- [x] Decisions: maps = MapLibre + OpenFreeMap (free, no card); ride-share navigation + age gate auto-advance (Phase 2); uploaded profile photos (Phase 3)

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

**Phase 2 feature work**
- [x] Database: RunLime listings, distances, co-organisers, media + sponsors, change history, duplicates, race suggestions, write RPCs, Phase 2 settings; pgTAP 136 passing. Deployed to staging (Deploy database green on `19c6642`)
- [x] Admin (web): events queue, create event (RunLime listing or organisation), review, postpone/cancel, duplicate, history, suggestions, settings editor
- [x] Organiser portal (web): dashboard, editor with map pin + route (tap or GPX), submit, postpone/cancel, duplicate, flyers/photos, sponsors, co-organisers, organisation settings + team
- [x] Public web: landing, `/races` month calendar + filters, `/e/[slug]` with not-affiliated + minors notices, `.ics`, share. Deployed (Deploy web green on `19c6642`; Worker 1.78 MiB after switching to webpack)
- [x] App: ride-share navigation (top bar, side menu, Start run, no tabs), age gate auto-advance, month view + list, search, filters, near me, map, race page + full-screen map, onboarding, suggest a race, offline copy. Jest 42 passing
- [x] Web E2E 12/12 on Cloudflare's runtime (local)
- [x] Phase 2 review + owner test script: `docs/phase-2/REVIEW.md`
- [x] Staging APK with the Phase 2 app (EAS build 8d7c4e0d, commit `a062a57`): https://expo.dev/artifacts/eas/FPu2CbE7olEam07BXsIEFCKFPayn05KoGi7kUUhUHp0.apk
- [x] CI bug fixed: web "Download my data" ignored a tap made before the page was ready (failed runs 82 and 95). Button now disabled until ready; 24/24 repeated runs pass
- [x] **Compliance additions (owner, 2026-10-17):** Refund Policy (`/legal/refunds`, setting `payments.refund_processing_days` = 10); Privacy Policy cookies section + corrected provider list (Gmail, OpenFreeMap; planned services marked); visible map credit with links on every web and app map; third-party services register (`docs/operations/THIRD-PARTY-SERVICES.md`); rules in CLAUDE.md: Premium cancel as easy as subscribing with no confirm-shaming (Phase 7), unsubscribe link on all marketing email, strictly necessary cookies only, register before any new service. Attorney flags added (cookie banner; refund on organiser cancellation; consumer-rights wording)
- [x] **Owner Phase 2 test (2026-10-17):** A, B and most of C passed. Failed: status changes not reaching the app
- [x] Root cause found from staging's change history: the admin **Publish** button undid each postponement/cancellation (57 s and 7 s later). Fixed in the database (review_event) and the admin page; app status banners, refresh and offline labels added; tests on every layer
- [x] Review fixes 2–8 (list/map switch, filter summary, admin events page, Add organisation, listing flyer permission, select/clear all, account-saved preferences, fun walk) + refund-after-live setting. "Test 1" not found on staging (no event with that name or containing "test"); nothing deleted
- [x] Re-test build: staging APK https://expo.dev/artifacts/eas/XMsbXyhkSdIU9TLQG4f8F78XaKFVjtGaHmGiM-gU58Q.apk (EAS build 2a28da77, commit `c59d427`). CI, Deploy database (migration 20261017000200) and Deploy web green on `c59d427`
- [x] **Owner re-test (2026-10-17):** items 1, 2, 4, 5, 6, 8 passed; 7 deferred; refund option A (100%) kept. Failed: website map blank on a phone browser
- [x] Website map fixed (root cause: maplibre-gl.css `position: relative` beat Tailwind's layered `absolute` utilities, map box 0 px); phone-viewport E2E added. Reason boxes: minimum shown, live count, clear error
- [x] Audit before going private: no secrets or personal data in the repo or history (one first-name mention removed from PROGRESS); logs print no secrets; gitleaks blocks secret-like values in CI; Actions minutes cut (CI once per commit, docs-only skipped, deploys path-filtered and CI-gated, Android builds don't wait). Report: `docs/operations/SECURITY-AND-ACTIONS-AUDIT.md`
- [x] **Owner final re-test (2026-10-18):** everything passed except postponing to a new date (the new date wasn't shown)
- [x] Root cause from staging's history: the new date overwrote the race's date and the original was discarded, so nothing could say "Postponed to". Fixed: `events.original_starts_at` keeps the original; app list cards, race page and month view show "Postponed to <date, time>" with the original struck through; "Back on" restores the original date. pgTAP 015, Jest, Playwright end-to-end. CI run #113 green on `9495f05`: https://github.com/NickPittsTT/RunLime/actions/runs/39077821831
- [x] Earlier fixes confirmed deployed: reason box + website map (`c5604be`, CI run #110 https://github.com/NickPittsTT/RunLime/actions/runs/39072081100, Deploy web run 39072404213)
- [x] Final build: EAS build 5d8970b0, https://expo.dev/artifacts/eas/j3POv-qs8USo_a0i1yR-7ChnPAuGXaYxaJ4m2nsGNOA.apk; Deploy web run 31 and Deploy database run 54 green on `9495f05`
- [x] **Phase 2 approved by the owner (17 Oct 2026)** after phone checks C1–C5 passed on that APK (new date shown, original struck through, banner and calendar correct, "Back on" restores the original date). Item 7 (saved preferences after reinstall) moves to the start of Phase 3 (slice 0)
- [ ] **Owner:** re-enter the PSCU race date as 31 Oct 2026, 6:00 AM in the admin form (staging still shows 18 Nov 2:34 pm from the earlier test). Claude does not change it
- [x] Owner: refund option A (100% after the listing has been live) kept

## Phase 3 checklist (current; scope approved 2026-10-18)
Owner decisions: push = Expo Push + Firebase Cloud Messaging (inbox first, then push); organiser messages 2 per race per week (setting); club turnout hidden below 5 (setting); RSVP Going / Maybe / Not going. One slice at a time, CI green before the next; APK after slices 2, 4 and 6. Only the owner approves the phase.
- [x] Google Play policy recheck (UGC, profile photos, social, notifications), with sources: `docs/phase-3/POLICY-CHECK.md`
- [x] Slice 0: item 7, saved welcome preferences survive uninstall/reinstall (test; CI #114 on `23279f6`)
- [x] Slice 1: runner level + profile photos (location data stripped, report, admin removal queue, audit) — CI #115 on `9a67519`; deployed (web #32, database #55)
- [x] Slice 2: RSVPs (adults/children counts) + My races — CI #116 on `227ae53`; deployed (web #33, database #56); APK EAS build d9d2ae89
- [x] Slice 3: followers (private by default, requests, block, report; passport + races attending) — CI #117 on `99c242d`; deploying
- [ ] Slice 4: clubs (leader approval, new-club requests, primary club, turnout below 5 hidden) → APK
- [ ] Slice 5: organiser attendance page
- [ ] Slice 6: notifications (inbox, then push; postponed-to, cancelled, day-before, organiser messages with limit) → APK
- [ ] Privacy Policy + Moderation Policy drafts updated; attorney flags
- [ ] `docs/phase-3/RETEST.md` phone checks per slice

## Phase 1 approval items (owner, 2026-10-11)
- [x] a. CI fully green on GitHub, including web E2E (see the latest run in the Phase 1 review)
- [x] b. Root cause of the failed mobile test found and fixed at the cause (warm-up render, default timeouts restored; 25/25 randomised runs)
- [x] c. Moderation Policy: 48-hour review target, child-safety reports first
- [x] d. Emergency-contact key backup and rotation procedure + verify/rotate tooling (`docs/operations/EMERGENCY-CONTACT-KEY.md`)
- [x] e. PROGRESS.md and Phase 0 overview updated with the owner's answers
- [x] Phase 2 plan prepared (`docs/phase-2/PLAN.md`): Android dev build first, phone test script, accounts/keys list.
- [x] Final pre-approval checks: corrected PowerShell key command; exactly-18-today / 18-tomorrow tests on every layer + phone script; Terms: false DOB is a breach and grounds for closure; domain + email service recorded as required before closed testing with others.

## Waiting on the owner
1. Legal details on staging: **done (2026-10-15).** Operator name and child-safety contact email entered by the owner; support email = runlimett@gmail.com; `legal.website` = the staging site URL (set by Claude). Deploy web now checks the live legal pages for any "not yet set" placeholder. Still to do: the child-safety contact person's **name** goes in Play Console at store submission (Phase 8); the operator address stays optional and non-public.
1a. Cloudflare: items 15–18 done (2026-10-15).
2. Google Android OAuth client (item 13): **done by the owner on 2026-10-15** (`GOOGLE_ANDROID_CLIENT_ID` set). Section D to be tested on the next build.
3. Bank name / account name and VAT status — before Phase 7.
4. **Pilot timing (owner, 2026-10-15): after Phase 6, or when most of the app is complete.** Can ~10 friends sign in **without a custom domain**? **Yes** (checked 2026-10-15):
   - **Email codes via Gmail SMTP:** custom SMTP removes the free mailer's "organisation members only" limit, so codes reach any address. Personal Gmail allows about 500 emails per rolling 24 h, and our Supabase limit is 30 emails per hour (a setting), plenty for 10 people. Codes may land in spam the first time; tell friends to check.
   - **Google sign-in:** RunLime asks Google only for name and email (basic scopes). Google exempts these from the Testing-mode rules (no 100-test-user list, no warning screen, no 7-day expiry). Adding the friends as test users does no harm.
   - **Install:** share the staging APK link (sideload, free). Google Play internal testing would need the US$25 Play Console account (paid, so not without your OK).
   - **Website/legal links:** the workers.dev site works.
   - **Owner decision (2026-10-15): the custom domain is needed before public launch, not before the pilot.**
   - **Owner decision (2026-10-15): the pilot runs under the draft legal documents, without attorney review first.** Before friends sign up they see a short plain-language notice: this is a test version under draft terms, their data may be wiped when the test ends, and they take part on that basis. Their agreement is recorded in `consents` (kind `pilot_terms`). **Attorney review stays required before public launch.**
   - Still needed before the pilot: the pilot notice screen (M7a) + consent, every friend 18+ (enforced by the app), and a plan for wiping pilot data when the test ends.
5. Confirm "RunLime" availability (stores, domains, TT IPO/USPTO/WIPO) before store bundle IDs are fixed (Phase 8).
6. Attorney review of `docs/legal/` before launch. Specific questions flagged in the drafts: no postal address on legal pages; no cookie banner for strictly necessary cookies (TT law and EU visitors); full refund when an organiser cancels; consumer-rights sentence in the Refund Policy.
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
- **Community times use the same three speed tiers as leaderboards (owner, 2026-10-15):** slower than 3:00 /km shown; 2:35–3:00 flagged and hidden until an admin approves; faster than 2:35 not shown (kept in the runner's private history). Verified runners skip review, as on leaderboards. One review queue (A15) for both.
- **Club assumptions accepted (owner, 2026-10-15)**, with one change: each person picks **one primary club**; leaderboard activity counts only for it, while other memberships still show and count in turnout. **Timeline impact accepted:** about +4–6 working days in Phase 3 and +5–8 in Phase 6 (clubs + speed checks).
- **Runner level + clubs (owner, 2026-10-15).** Phase 3: optional runner level (Casual / Club runner / Competitive) in onboarding and profile, never bypassing speed checks; clubs picked from the approved list, joining needs a club leader's approval, users can request new clubs (owner approves), new per-club leader role; club turnout ("Club X: 25 attending") on race pages and organiser dashboards from opted-in approved members. Phase 6: club leaderboards (km, races, avg members per race; total and per member) and admin "verified runner" status. Design in `02-DATA-MODEL.md`, `03-SCREENS.md` (M9a, M19, M37b, M45, M45a, A6, A14, O10, W2), `00-OVERVIEW.md` S6, CLAUDE.md. Not built yet.
- Budget: free tiers only; Android first; iOS/Apple deferred; no custom domain until public launch (not needed for the pilot; owner, 2026-10-15).
