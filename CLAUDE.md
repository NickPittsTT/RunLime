# CLAUDE.md — RunLime

Living record of conventions and decisions. Update at the end of every phase.

## Product guardrails (from the master prompt + owner decisions; do not drift)
- Market: Trinidad & Tobago only at launch (both stores: TT only, owner decision); tz America/Port_of_Spain; TTD; km. Caribbean expansion later, so keep country/currency/timezone per event and organiser.
- We do NOT handle registration, entry fees, or official timing. No timing-company integrations.
- Roles: super_admin, platform_admin, organiser, participant. Enforce in Postgres RLS, not only in UI.
- **AGE POLICY (hard rule, never a setting): every account is 18+.**
  - Under-18s are blocked on the device before any sign-in, with no data stored.
  - The server re-checks in the auth hook (email), the profile trigger and the `complete_signup` RPC.
  - Each layer has a pgTAP or unit test.
  - Children attend only as `children_count` in an adult's RSVP; organisers see children only as an aggregate.
  - Terms and event pages state that minors must be accompanied by an adult.
  - No teen/minor code paths exist; don't add any.
- Social: followers, with account privacy Private (default, approval needed) or Public. Followers see the race passport and races attending. Runs, routes, times and history stay private unless shared to community times.
- Clubs: admin-approved list; users can request a new club (admin approves); per-club leaders approve members; only approved memberships count. Club turnout shows counts only, from opted-in members, hidden below a minimum (setting).
- Runner level is self-declared and never bypasses speed checks.
- Speed checks (leaderboards **and** community times, one review queue, settings): ≥ 3:00 /km avg and every split → counted; 2:35–3:00 → admin review, excluded until approved; < 2:35 → rejected. Verified runners skip the review tier only. Admin review sees pace/split numbers, never routes.
- Check-in is GPS only in v1 (no QR).
- Participant Premium sold ONLY via Apple IAP / Google Play Billing (RevenueCat).
- **Cancelling Premium must be as easy as subscribing (Phase 7):** a clearly labelled "Manage or cancel subscription" link in the app (paywall/M38 and Settings) opens the store's subscription page in one tap; no more steps than buying; **no confirm-shaming** (no guilt wording such as "No thanks, I don't want to get faster"), no hidden or greyed-out cancel option, no retention screen standing between the user and the store page.
- **Refunds follow the Refund Policy** (`docs/legal/refund-policy.md`, `/legal/refunds`): organiser listing fees refunded in full when the listing is rejected or the organiser cancels before it is published, `payments.cancel_refund_after_live_percent` (default 100) when cancelled after it has been live, and duplicate payments returned, by bank transfer within `payments.refund_processing_days`; Premium refunds follow Apple/Google rules. Phase 7 builds the refund triggers to match.
- **Marketing email always carries an unsubscribe link:** every marketing or promotional email (newsletters, feature news, offers) needs opt-in, a working one-click unsubscribe link and a `List-Unsubscribe` header, and honours unsubscribes without sign-in. Sign-in codes and essential account/service emails are not marketing.
- **Website cookies: strictly necessary only** (the Supabase sign-in cookie; Cloudflare security cookie). Analytics must be cookieless. Any non-essential cookie needs an owner decision, a consent banner and a Privacy Policy update first.
- **Map attribution on every map:** visible "OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors" text with links (`MAP_ATTRIBUTION_LINKS` in `@runlime/shared/events`), never only behind an "i" button.
- **Third-party services register** (`docs/operations/THIRD-PARTY-SERVICES.md`): add a row before any new service receives data, and update the Privacy Policy in the same change. It feeds the Phase 8 store privacy forms.
- Organiser payments ONLY via web portal bank transfer. The mobile app has no payment links or wording for them.
- Community times: opt-in, check-in required, Tracked/Typed in label, same speed tiers as leaderboards (flagged times hidden until approved), withdrawable, report/block, no prizes, disclaimer always shown.
- Club leaderboards (Phase 6): km, races attended, avg members per race; total and per member (minimum club size, setting); opted-in approved members only.
- Activity leaderboards (Phase 6): km from tracked runs + races from GPS check-ins; Weekly/Monthly/Year; Everyone/People I follow; top N (setting) + own rank; opt-in; verified data only (typed-in never counts); impossible speeds excluded (setting); no prizes; read only via RPC.
- RunLime listings (admin-entered races): facts only + official registration link, "not affiliated, check with the organiser" notice (setting). A flyer/route-map image, logos and sponsors only after an admin ticks "I have the organiser's permission" (`events.media_permission_at/_by`, audit-logged; DB trigger enforces it; gallery photos never). Terms §6 "Races listed by RunLime".
- **Live-race status changes only through "Change status"** (`change_event_status`): Publish (`review_event`) never applies to postponed/cancelled races (owner's Phase 2 test failure, 2026-10-17). Postponing to a new date keeps the original date (`original_starts_at`); never overwrite it silently.
- Testing: no outside testers before Phase 6; the first outside test is a real-race pilot after Phase 6, under the draft legal documents with a plain-language pilot notice + recorded `pilot_terms` consent. Attorney review is required before public launch.
- All limits, prices, radii, windows and legal text live in DB settings, never hardcoded. Exception: the 18+ rule, which is hardcoded by design.
- New ideas go to BACKLOG.md, not into the build.
- Work in phases; stop for owner approval after each phase.

## Budget rules (owner, 2026-10-11)
- **Free tiers only** until the owner says otherwise. Say so BEFORE any step that needs a paid plan or a card on file.
- **Android first.** Keep the iOS and Sign in with Apple code, but defer anything needing the paid Apple Developer account.
- **No custom domain until public launch** (owner, 2026-10-15): not needed for the friends pilot (Gmail SMTP + Google basic sign-in + APK link). Use provider-issued URLs until then. Remind the owner before Phase 8.
- Never ask the owner to paste a password, token or service key into chat. Secrets go to GitHub environment secrets, Supabase secrets, or the cloud environment's settings.

## Process
- Before reporting a phase complete: run tests, then state exactly what was and was not tested.
- Flag every assumption. Offer options with trade-offs when the decision is the owner's.
- No placeholder screens or mock data in production code. Dev seed (`scripts/seed-dev.ts`) refuses to run against production.
- Recheck Apple/Google policy before each relevant phase.
- Never put model identifiers in commits, PRs or code.

## Security conventions
- Admin rights require MFA: `is_admin()` checks the role **and** `auth.jwt()->>'aal' = 'aal2'`.
- `super_admin` is granted only by `scripts/bootstrap-super-admin.ts`.
- Audit log: actors and person-subjects are stored as aliases (`audit_actor_aliases`, cascade-deleted with the account). Only allowlisted columns go into before/after. No IPs. Append-only.
- Audit reasons: a function that must explain a change sets `runlime.audit_reason` (transaction-local) and `audit.capture` stores it in `audit.log.reason`. Operator corrections on hosted data run through service-role-only functions (e.g. `ops_correct_event_start`) and only with the owner's permission for that specific change.
- Emergency contact: AES-256-GCM in the `emergency-contact` Edge Function; the key lives in function secrets. Do NOT use pgsodium (Supabase: pending deprecation).
- `SECURITY DEFINER` functions always `set search_path = ''` and use schema-qualified names.
- Every new table: `enable row level security` + at least one pgTAP test in `supabase/tests/`.

## Decisions log
| Date | Decision | Status |
|---|---|---|
| 2026-10-11 | Stack: Expo SDK 57, Next.js 16, Supabase, pnpm + Turborepo (D1–D14) | Approved |
| 2026-10-11 | Run tracking: Android foreground service + iOS When-In-Use background mode; fallback to the original design if Phase 5 device tests fail | Approved |
| 2026-10-11 | Native maps (Apple/Google), no offline tiles in v1 | **Replaced 2026-10-15** by MapLibre + OpenFreeMap (free, no card) |
| 2026-10-11 | Sign-in: email OTP + Google + Apple; no phone | Approved |
| 2026-10-11 | 18+ only for all accounts (hard rule) | Owner rule |
| 2026-10-11 | Followers (private/public) + clubs; QR check-in and photo sharing removed from v1 | Owner rule |
| 2026-10-11 | Brand Direction A, "Fresh Lime" | Approved |
| 2026-10-11 | Hosting: Vercel Pro | **On hold** (budget: free tiers only). Web host to be chosen in Phase 2 |
| 2026-10-11 | Emergency contact: app-layer encryption, not pgsodium (F5) | Decided — Phase 1 |
| 2026-10-11 | Audit log pseudonymisation via aliases + allowlists (F3) | Decided — Phase 1 |
| 2026-10-11 | OAuth sign-ups can't carry DOB to the auth hook; enforced via profile trigger + 1-hour purge of profile-less users | Decided — Phase 1, owner informed |
| 2026-10-11 | Operator: "RunLime, operated by <owner>" (individual), may move to RunLime Limited; operator details live in settings only | Owner |
| 2026-10-11 | Store availability: TT only at launch | Owner |
| 2026-10-11 | Supabase staging: us-east-1, project `fmnmylqxrmxuzmdcvmhs`; Privacy Policy says data is stored in the United States | Owner |
| 2026-10-11 | Organiser payments: manual bank transfer only; no card gateway in v1 | Owner |
| 2026-10-11 | Moderation: review within 48 h, child-safety reports first | Owner |
| 2026-10-11 | Emergency-contact key backup/rotation: docs/operations/EMERGENCY-CONTACT-KEY.md | Decided |
| 2026-10-11 | Jest: one warm-up render in beforeAll (RN lazy requires) instead of raising timeouts | Decided |
| 2026-10-15 | Operator address non-public: legal pages and app show operator name + contact email only; address kept for official records (admins only); attorney to confirm; Play developer-address rule checked before Phase 7 | Owner |
| 2026-10-15 | Activity leaderboards (km + races; weekly/monthly/year; everyone/following; top 20 + own rank; opt-in; verified only; no prizes) in Phase 6 | Owner |
| 2026-10-15 | Testing: no early tester link; real-race pilot after Phase 6; owner enters real races as fact-only RunLime listings | Owner |
| 2026-10-15 | Runner level (Phase 3), clubs with leader approval + club requests + turnout (Phase 3), club leaderboards (Phase 6) | Owner |
| 2026-10-15 | Two-tier speed checks (3:00 accept / 2:35–3:00 review / 2:35 reject); verified runners skip review; listings include venue + start pin; calendar periods confirmed | Owner |
| 2026-10-15 | Primary club: leaderboard activity counts for one chosen club; other memberships still show + count in turnout. Club assumptions accepted | Owner |
| 2026-10-15 | Custom domain needed before public launch, not before the pilot; timeline impact (+9–14 working days, Phases 3 and 6) accepted | Owner |
| 2026-10-15 | Community times use the same three speed tiers + one review queue; pilot under draft terms with a pilot notice + consent; attorney review before public launch | Owner |
| 2026-10-15 | Maps: MapLibre + OpenFreeMap tiles (no key, no card); route drawer = tap points or GPX upload | Owner |
| 2026-10-15 | Mobile navigation: ride-share style (home = calendar, top bar with menu + bell, fixed "Start run" button, side menu; no bottom tabs); age gate auto-advance | Owner |
| 2026-10-15 | Uploaded profile photos in Phase 3, with report + remove tools | Owner |
| 2026-10-15 | runlimett@gmail.com is the staging super admin (bootstrap workflow), TOTP required | Owner |
| 2026-10-17 | Compliance additions: Refund Policy (listing fees: rejected / organiser cancels / duplicate → bank transfer within a setting; Premium per store rules); Privacy Policy cookies section (essential only, no banner, attorney to confirm); visible map attribution everywhere; third-party services register; Premium cancel as easy as subscribing, no confirm-shaming (Phase 7); unsubscribe link on all marketing email | Owner |
| 2026-10-17 | Phase 2 review fixes: Publish can't undo postponed/cancelled (root cause of the failed status test); admin Add organisation (verified, audited); listing flyer/logos/sponsors with recorded permission; onboarding preferences saved to the account; Fun walk / under 5K; List/Map switch; refund-after-live share as a setting (`payments.cancel_refund_after_live_percent`, default 100, owner choosing 100 or 50) | Owner |
| 2026-10-18 | Postponing to a new date keeps the original (`events.original_starts_at`, shown struck through); `starts_at` is the new date; "Back on" restores the original date; a date is accepted only when postponing (owner's final Phase 2 re-test) | Owner |
| 2026-10-11 | Seed prices: Premium US$2.99/mo, US$19.99/yr; Basic TT$100; Featured TT$400; charity free Basic via setting | Owner |

## Conventions
- Package manager: pnpm workspaces; tasks via Turborepo (`pnpm test`, `pnpm typecheck`, `pnpm lint`).
- Code: TypeScript strict; zod at every boundary; no `any`.
- DB: snake_case; forward-only migrations named `YYYYMMDDHHMMSS_name.sql`; pgTAP tests in `supabase/tests/*.test.sql` (run `supabase test db`).
- Time: store `timestamptz` UTC plus an IANA tz; format in the event's tz.
- Money: `numeric(12,2)` plus currency.
- Commits: conventional commits.
- **Push flow (Actions minutes, 2026-10-17):** push to the phase branch; CI runs there once; only after CI passes, fast-forward `main` (`git push origin phase-N:main`). Deploys run on `main` pushes that touch their paths and refuse commits without a passing CI run. Batch commits; docs-only changes skip CI (except `docs/legal`). Android builds don't wait by default; get the APK from "Mobile build logs".
- **No secrets or personal data in the repo:** CI's gitleaks scan (`.gitleaks.toml`, whole history) blocks secret-like values; never commit the owner's address, bank details, personal email or phone; scripts never print secrets (CI logs are public while the repo is public).
- Local Supabase in this cloud environment: start `dockerd`, then `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io supabase start -x realtime,imgproxy,postgres-meta,supavisor,vector,logflare,studio` (the ECR registry hits a data limit here).
