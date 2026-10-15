# RunLime — Phase 0: Discovery & Design (rev 2)

Status: **Approved by owner 2026-10-11 with the changes recorded below.** Rev 1 questions and options are superseded by this record.

| Doc | Contents |
|---|---|
| `00-OVERVIEW.md` (this file) | Owner answers, hard rules, scope changes, design fixes, open items |
| `01-ARCHITECTURE.md` | Stack, repo layout, environments, auth & age gate, security design |
| `02-DATA-MODEL.md` | ERD, tables, RLS matrix |
| `03-SCREENS.md` | Screen list by surface and phase |
| `04-BRAND.md` | Chosen direction (A) |
| `05-COSTS.md` | Running cost estimate |
| `../legal/` | Legal drafts + store-requirements checklist (Phase 1) |

---

## 1. Owner answers

| # | Topic | Answer |
|---|---|---|
| 1 | Repo | Dedicated repo `nickpittstt/runlime` — done |
| 2 | Legal entity | Individual. Legal pages read "RunLime, operated by <owner's full name>". May transfer to RunLime Limited later, so operator name and address live only in `app_settings` (values still to be entered by the owner) |
| 3 | Bank / VAT | Owner provides before Phase 7. Payments stay manual bank transfer; no card gateway in v1 |
| 4 | Domain | None yet. Use provider-issued URLs. **Needed before public launch, not before the pilot** (owner, 2026-10-15). Remind the owner before Phase 8 |
| 5 | Legal text | I draft; owner's attorney reviews before launch |
| 6 | Sign-in | Email (one-time code) + Google + Apple. Phone → BACKLOG |
| 7 | Premium | Free/Premium split and pricing (US$2.99/mo, US$19.99/yr) accepted as seed values |
| 8 | Organiser prices | Basic TT$100, Featured TT$400 per event. Free Basic for charities, controlled by the admin setting `listing.charity_free_basic` |
| 9 | Approval | Always admin approval; settings toggle `events.auto_publish_verified` (default false) |
| 10 | Social | **Followers (S1) + clubs** |
| 11 | Areas | Friendly running areas for filters; regional corporation stored for analytics |
| 12 | Minors on board | Superseded: 18+ only |
| 13 | Maps | Native maps approved |
| 14 | Background location | Foreground-service approach approved; fall back to the original design if Phase 5 device tests fail |
| 15 | Hosting | Vercel Pro — **on hold** (free tiers only). Free host to be chosen in Phase 2 (Cloudflare Workers recommended) |
| Brand | | **Direction A — Fresh Lime** |
| D1–D14 | | Approved |
| A1–A10 | | Accepted, except A9 (group counting, changed below) and A10 (now 18+) |
| Retention | | Payment records kept 7 years (tax) — confirmed |
| Availability | | Trinidad and Tobago only, both stores. Caribbean expansion planned (see BACKLOG) |
| Child-safety contact | | Owner to enter in `legal.child_safety_contact_email` (the answer used placeholder text) |
| Supabase | | Staging project `fmnmylqxrmxuzmdcvmhs`, us-east-1. Privacy Policy: data stored in the United States |
| Moderation | | Reports reviewed within 48 hours; child-safety reports first |
| Budget | | Free tiers only until the owner says otherwise; flag anything paid first. Android first; iOS and Apple sign-in deferred |

## 2. Hard rule: AGE POLICY (18+)

Enforced in the database **and** in code, never an admin setting. Each rule has a pgTAP test.

| Rule | Where enforced |
|---|---|
| Minimum account age 18 for every role | Device age gate (first screen) → Auth `before_user_created` hook (email sign-ups) → `profiles` trigger (all sign-ups) → `complete_signup` RPC |
| Under-18s: store nothing | The gate runs on the device before any sign-in call. Nothing is sent and no auth user is created. The only trace is a local device flag (no PII) |
| No 13–17 logic | Removed: `is_minor`, minor privacy locks, nickname forcing, `runner.teen` seed. Replaced by a blocked-under-18 test path |
| Children attend only in an adult's group | RSVP has `group_size` (adults incl. the user) **and** `children_count` (under-18s). Organisers see children only as an aggregate |
| Minors must be accompanied | Stated in the Terms of Use and on every event page (rendered from the legal setting, not per-event text) |

A9 revised: the public "attending" count = sum of (`group_size` + `children_count`) for Attending. The organiser dashboard shows accounts, adults and children separately.

## 3. Scope changes

- **S1 Followers.** `account_privacy` = `private` (default) | `public`.
  - Private accounts: follow requests need approval. Public accounts: anyone can follow instantly.
  - Either side can remove a follower; either side can block (blocking removes the follow both ways).
  - Followers (or anyone, for public accounts) can see the person's **race passport** (races attended, total km) and **races they're attending**.
  - Runs, routes, times and history stay private unless the user shares a result to community times.
  - Built in Phase 3, with RSVP.
- **S2 QR check-in removed from v1.** No scanner, no QR poster, no QR landing page, no `qr_secret`. Check-in is GPS only. QR → BACKLOG.
- **S3 Race photo sharing** → BACKLOG.
- **S4 Parental consent features:** not added.

## 4. Design fixes (all applied in rev 2)

| Fix | Resolution | Detail |
|---|---|---|
| **F1** Age gate first | Date of birth is the first screen, before any sign-in method. Under-18 → block screen; no network call | `03-SCREENS.md` M2/M4 reordered |
| **F2** Server-side 18+ | Postgres `before_user_created` hook rejects email sign-ups without an 18+ DOB. Profile trigger + `complete_signup` RPC enforce 18+ for every account. Accounts without a completed profile have no data access and are purged after 1 hour | `01-ARCHITECTURE.md §4` (incl. one limitation that can't be avoided) |
| **F3** Audit log without personal data | Pseudonymous actor aliases (deleted with the account) + per-table column allowlists, so personal fields never enter `before`/`after` | `01-ARCHITECTURE.md §10.1` |
| **F4** Admin MFA + clubs admin | TOTP MFA required for `super_admin` / `platform_admin`. RLS admin checks require `aal2` in the JWT. New screen A14 Clubs | `01-ARCHITECTURE.md §4.4`, `03-SCREENS.md` |
| **F5** Encryption method | Confirmed: Supabase **does not recommend new use of pgsodium** (pending deprecation) and does not recommend its column encryption. **Decision:** emergency contact is encrypted in the application layer (AES-256-GCM in an Edge Function; key held in Edge Function secrets, never in the database). It's stored in an owner-only table | `01-ARCHITECTURE.md §10.2` |

## 4a. Owner decisions, 2026-10-15

**S5 Activity leaderboards (Phase 6, with community times).** Two boards: kilometres from tracked runs, and races attended from GPS check-ins. Weekly / Monthly / Year tabs; Everyone / People I follow. Top 20 + the viewer's own rank. Opt-in, verified data only (tracked runs, GPS check-ins; typed-in times never count), impossible speeds excluded by an admin setting, no prizes. Design: `02-DATA-MODEL.md` → "Activity leaderboards"; screens M37a, M40, A7, A10.

**Testing plan: real-race pilot, no early tester link.**
- No outside testers before Phase 6. The first outside test is a **real-race pilot after Phase 6** with friends who run 5Ks.
- Until then the owner is the admin and enters real upcoming races with the admin "create event" screen (A4) as **RunLime listings**: facts only (name, date, start time, distance, official registration link, plus venue and start pin, which GPS check-in needs), a visible "not affiliated, check with the organiser" notice, and **no organiser flyers or logos without permission**.
- Before the pilot: no custom domain needed (Gmail SMTP + Google basic sign-in cover ~10 testers; APK shared by link). Google Play's closed-test rules apply only if the pilot uses the Play Store (STORE-REQUIREMENTS C14). The domain is needed before public launch.

**S6 Runner level, clubs with leaders, club turnout, club leaderboards.**
- *Runner level* (Phase 3): optional Casual / Club runner / Competitive, asked in onboarding, editable. Self-declared; it never bypasses speed checks. Only admin "verified runner" status changes the limit (Phase 6).
- *Clubs* (Phase 3): pick from the admin-approved list in onboarding or later; joining needs a club leader's approval; users can request a new club, which the admin approves. New per-club **leader** role. Only approved memberships count.
- *Club turnout* (Phase 3): "Club X: 25 attending" on race pages and organiser dashboards, from approved members who opted in; small counts hidden.
- *Club leaderboards* (Phase 6): km, races attended, average members per race; each as a total and per member; opted-in approved members only. Each person picks one **primary club**; their leaderboard activity counts only there (other memberships still show and count in turnout). Club assumptions accepted by the owner, 2026-10-15.

**Speed checks (owner, 2026-10-15), Phase 6.** Two tiers, thresholds as admin settings: runs with average pace and every 1 km split slower than 3:00 /km count automatically; 2:35–3:00 /km is flagged for admin review and excluded from leaderboards until approved; faster than 2:35 /km is rejected for leaderboards. Admins can mark a reviewed runner as verified so their 2:35–3:00 runs aren't flagged again. RunLime listings include the venue and start pin (confirmed). Leaderboard periods are calendar periods (confirmed).

**Community times use the same speed tiers** (owner, 2026-10-15): accept slower than 3:00 /km; 2:35–3:00 flagged and hidden from the board until approved; faster than 2:35 not shown (kept in private history). Verified runners skip review, as on leaderboards. One review queue for both.

**Pilot legal terms** (owner, 2026-10-15): the pilot runs under the **draft** legal documents without attorney review first. Before friends sign up they see a short plain-language notice (test version, draft terms, data may be wiped when the test ends, they take part on that basis) and agree; the agreement is stored in `consents` (`pilot_terms`). **Attorney review remains required before public launch.**

## 5. Open items (owner)

1. Items 2, 3, 4 above came through as unfilled template text. Legal drafts use the tokens `{{operator_name}}`, `{{support_email}}`, `{{website}}`. (The operator address is not a token: owner decision 2026-10-15, kept non-public for official records only.) They are filled from settings at render time, and the web portal shows a visible "DRAFT — operator details missing" banner until they're set.
2. **Name check reminder.** Confirm "RunLime" is available on the App Store, Google Play, domains, and the TT IPO/USPTO/WIPO trademark registers. Phase 1 uses **development** bundle IDs only (`tt.runlime.app.dev`). Store bundle IDs are fixed in Phase 8 after you confirm.
3. **Store availability:** decided — **Trinidad and Tobago only** at launch in both stores. Expansion steps per country are in BACKLOG.md.
4. Google Play child safety (CSAE) standards apply because followers make the app "social". **You must name a child-safety point of contact** (a person) in Play Console. See `docs/legal/STORE-REQUIREMENTS.md`.

## 6. Policy findings carried forward (from rev 1)
- Background location: foreground-service design (approved). Google still requires a foreground-service-type declaration.
- Google Play 12-tester / 14-day closed test applies to personal accounts (decision depends on item 2).
- Sign in with Apple is required because Google sign-in is offered.
- In-app account deletion is required, plus a web deletion URL for Google.
- Anti-steering: no organiser payment wording anywhere in the mobile app.
