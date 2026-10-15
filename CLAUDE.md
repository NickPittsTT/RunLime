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
- Social: followers, with account privacy Private (default, approval needed) or Public. Followers see the race passport and races attending. Runs, routes, times and history stay private unless shared to community times. Clubs are admin-managed.
- Check-in is GPS only in v1 (no QR).
- Participant Premium sold ONLY via Apple IAP / Google Play Billing (RevenueCat).
- Organiser payments ONLY via web portal bank transfer. The mobile app has no payment links or wording for them.
- Community times: opt-in, check-in required, Tracked/Typed in label, pace limit (setting), withdrawable, report/block, no prizes, disclaimer always shown.
- Activity leaderboards (Phase 6): km from tracked runs + races from GPS check-ins; Weekly/Monthly/Year; Everyone/People I follow; top N (setting) + own rank; opt-in; verified data only (typed-in never counts); impossible speeds excluded (setting); no prizes; read only via RPC.
- RunLime listings (admin-entered races): facts only + official registration link, "not affiliated, check with the organiser" notice (setting), no organiser flyers or logos without permission.
- Testing: no outside testers before Phase 6; the first outside test is a real-race pilot after Phase 6.
- All limits, prices, radii, windows and legal text live in DB settings, never hardcoded. Exception: the 18+ rule, which is hardcoded by design.
- New ideas go to BACKLOG.md, not into the build.
- Work in phases; stop for owner approval after each phase.

## Budget rules (owner, 2026-10-11)
- **Free tiers only** until the owner says otherwise. Say so BEFORE any step that needs a paid plan or a card on file.
- **Android first.** Keep the iOS and Sign in with Apple code, but defer anything needing the paid Apple Developer account.
- **No custom domain until needed:** before any closed testing with other people, and at the latest Phase 8. Use provider-issued URLs until then; owner-only testing must not depend on a custom domain. Remind the owner before closed testing or Phase 8, whichever comes first.
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
- Emergency contact: AES-256-GCM in the `emergency-contact` Edge Function; the key lives in function secrets. Do NOT use pgsodium (Supabase: pending deprecation).
- `SECURITY DEFINER` functions always `set search_path = ''` and use schema-qualified names.
- Every new table: `enable row level security` + at least one pgTAP test in `supabase/tests/`.

## Decisions log
| Date | Decision | Status |
|---|---|---|
| 2026-10-11 | Stack: Expo SDK 57, Next.js 16, Supabase, pnpm + Turborepo (D1–D14) | Approved |
| 2026-10-11 | Run tracking: Android foreground service + iOS When-In-Use background mode; fallback to the original design if Phase 5 device tests fail | Approved |
| 2026-10-11 | Native maps (Apple/Google), no offline tiles in v1 | Approved |
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
| 2026-10-11 | Seed prices: Premium US$2.99/mo, US$19.99/yr; Basic TT$100; Featured TT$400; charity free Basic via setting | Owner |

## Conventions
- Package manager: pnpm workspaces; tasks via Turborepo (`pnpm test`, `pnpm typecheck`, `pnpm lint`).
- Code: TypeScript strict; zod at every boundary; no `any`.
- DB: snake_case; forward-only migrations named `YYYYMMDDHHMMSS_name.sql`; pgTAP tests in `supabase/tests/*.test.sql` (run `supabase test db`).
- Time: store `timestamptz` UTC plus an IANA tz; format in the event's tz.
- Money: `numeric(12,2)` plus currency.
- Commits: conventional commits.
- Local Supabase in this cloud environment: start `dockerd`, then `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io supabase start -x realtime,imgproxy,postgres-meta,supavisor,vector,logflare,studio` (the ECR registry hits a data limit here).
