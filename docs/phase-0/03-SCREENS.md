# 03 — Screen List (rev 2)

Phase tag = the phase in which the screen is built.

## Mobile app (participants)

### Auth & onboarding
| # | Screen | Phase |
|---|---|---|
| M1 | Splash / boot (loads cached calendar) | 1 |
| M4 | **Date of birth: first screen for anyone not signed in** (neutral age gate: plain date entry, no hint of the threshold). **Phase 2 UX (owner):** Day → Month auto-advance after 2 digits, Month → Year after 2 digits; keyboard shows "Next" on Day and Month and "Done" on Year (Done submits); backspace in an empty box moves to the previous box; unit-tested | 1 / 2 |
| M5 | "Sorry, RunLime is for adults 18+" (no data stored; local flag only) | 1 |
| M2 | Sign in (Apple / Google / Email). Reached only after M4 passes | 1 |
| M3 | Email code entry | 1 |
| M6 | Profile basics (display name, nickname, home area) | 1 |
| M7 | Terms & Privacy acceptance | 1 |
| M7a | **Pilot notice** (only while `pilot.enabled`): plain-language "this is a test version under draft terms; your data may be wiped when the test ends; you take part on that basis" + "I agree" checkbox, shown with M7 before the account is created; agreement stored as a `pilot_terms` consent. Also on web sign-up | before the pilot (Phase 6) |
| M8 | Walkthrough (3 cards) | 2 |
| M9 | Pick areas & distances of interest | 2 |
| M9a | Onboarding: runner level (Casual / Club runner / Competitive, optional) and your club (pick from the approved list → request to join; or "request a new club") | 3 |
| M10 | Notification opt-in explainer → system prompt | 3 |

### Navigation (owner, 2026-10-15; ride-share style, **no bottom tab bar**) — Phase 2
| # | Element | Phase |
|---|---|---|
| N1 | **Home = race calendar**: month view (swipe January → December and on), race days marked; below it the upcoming races list with filters and "Near me" | 2 |
| N2 | **Top bar**: menu icon top-left, title, notifications bell top-right (bell opens M21; "coming soon" until Phase 3) | 2 |
| N3 | **"Start run" button**: large, fixed at the bottom of Home; opens the run tracker (M25); shows "coming soon" until Phase 5 | 2 |
| N4 | **Side menu** (from the top-left icon). Header: initials avatar in a lime circle, name, nickname, quick stat (races, km); tapping the header opens the full profile (M39). Items: My races, Leaderboards, Run history, Followers, Clubs, Edit profile & privacy, Emergency contact, Your data, Help & legal, Sign out. Items whose features aren't built yet show "coming soon" | 2 |

### Screens
| # | Screen | Phase |
|---|---|---|
| M11 | Calendar: list view (sticky month headers, "N attending") | 2 |
| M12 | Calendar: month view: swipe left/right month by month (January to December and on into the next year), days with races marked, tap a day for its races; toggle with the list view | 2 |
| M13 | Filters sheet (date, area, distance, price, cause, walk-friendly) | 2 |
| M14 | Search | 2 |
| M15 | Near me (MapLibre map with event pins + list sorted by distance; foreground location only, asked when you tap "Near me") | 2 |
| M16 | Event detail (all fields from spec D, map, route, sponsors, status banner, add to calendar, share) | 2 |
| M17 | Route map full-screen (MapLibre) | 2 |
| M18 | RSVP sheet (Attending/Maybe/Not + adults stepper + children-under-18 stepper; "minors must be accompanied" note) | 3 |
| M19 | Who's going (count + people you follow + club turnout "Club X: 25 attending" from opted-in, approved members; hidden below the minimum) | 3 |
| M20 | My Races (upcoming RSVPs, past check-ins) | 3 |
| M21 | Notification inbox | 3 |
| M22 | Check-in (GPS check + result state) | 4 |
| M24 | Location disclosure (prominent, before the OS prompt; battery note) | 5 |
| M25 | Run: ready (GPS signal indicator, link to today's checked-in event) | 5 |
| M26 | Run: live (time, distance, pace, map, pause/stop; lock-screen-friendly) | 5 |
| M27 | Run: summary (map, splits, steps est., calories est., save/discard, link to event) | 5 |
| M28 | History list + totals header (km, steps, calories, time) | 5 |
| M29 | Run detail (Phase 6: leaderboard status: counted / under review / not counted) | 5 / 6 |
| M30 | Personal bests & pace trend | 5 |
| M31 | Same-race year-on-year | 5 |
| M32 | Add manual time ("Typed in") | 5 |
| M33 | Share to community board (consent, nickname choice, disclaimer) | 6 |
| M34 | Community board per event (disclaimer always shown; Tracked/Typed-in labels; report/block) | 6 |
| M35 | Report sheet | 6 |
| M36 | Race passport (own; others' when allowed by account privacy) | 3 (social view) / 6 |
| M37 | Finisher card builder + share | 6 |
| M37b | **Club leaderboards**: Kilometres / Races attended / Avg members per race; Total vs Per member; Weekly · Monthly · Year; your clubs highlighted | 6 |
| M37a | **Leaderboards**: Kilometres / Races attended; Weekly · Monthly · Year tabs; Everyone / People I follow; top 20 + your rank; disclaimer ("just for fun, no prizes"); opt-in prompt if you're not on the boards; tap a name → their profile (if allowed) or report | 6 |
| M38 | Premium paywall (store prices, restore, manage subscription, terms links). **Cancel as easy as subscribing:** "Manage or cancel subscription" opens the store page in one tap (also in Settings); no confirm-shaming, no retention screen | 7 |

### Profile & settings
| # | Screen | Phase |
|---|---|---|
| M39 | Profile view/edit. **Phase 3 (owner decision): uploaded profile photos**, with report and admin remove tools (A7); until a photo is set, the initials avatar is shown | 1 / 3 |
| M40 | Privacy settings (account Private/Public, show attendance to clubs; **Leaderboards on/off + name choice: Phase 6**) | 3 / 6 |
| M40a | Followers / Following lists (remove follower, unfollow) | 3 |
| M40b | Follow requests (approve / decline) | 3 |
| M40c | Other runner's profile (follow / request / block / report; passport + attending races if permitted) | 3 |
| M40d | Find runners (search by display name/nickname) | 3 |
| M41 | Notification preferences (areas, distances, types, quiet hours, muted organisers) | 3 |
| M42 | Health data (weight, consent, revoke) | 5 |
| M43 | Emergency contact | 1 |
| M44 | Blocked users | 3 |
| M45 | Clubs: browse the approved list, request to join (pending until a leader approves), leave; choose your **primary club** (counts for club leaderboards); "Request a new club" form; runner level edit in M39 | 3 |
| M45a | Club leader: pending join requests (approve / decline), member list, remove member | 3 |
| M46 | Data export request | 1 (Edge Function) / 8 (polish) |
| M47 | Delete account (two-step confirm) | 1 |
| M48 | Help: FAQ, contact support, send feedback, suggest a race | 7 (suggest a race: 2) |
| M49 | About / legal / health disclaimer / licences | 8 |
| M50 | Offline banner + sync status component (global) | 2/5 |

## Organiser portal (web, responsive) — `/organiser`
| # | Screen | Phase |
|---|---|---|
| O1 | Apply to be an organiser (org details, contact, about; 18+ already guaranteed by the account) | 1 |
| O2 | Application status | 1 |
| O3 | Dashboard (my events by status, alerts, plan status) | 2 |
| O4 | Event editor: multi-step (basics → location & route → details → media & sponsors → review/submit) | 2 |
| O5 | Start pin + route drawer (MapLibre: tap points on the map, or upload a GPX file; no road snapping) | 2 |
| O6 | Duplicate event (annual) | 2 |
| O7 | Postpone / cancel flow (requires reason; triggers follower notification) | 2/3 |
| O8 | Co-organisers (invite by email, accept, remove) | 2 |
| O9 | Broadcasts (compose, quota remaining, history) | 3 |
| O10 | Attendance dashboard (counts, trend chart, by area, club turnout, views, shares, calendar adds, check-ins, conversion, CSV export) | 3 |
| O12 | Community board (read-only, report) | 6 |
| O13 | Billing: choose plan → reference & bank details → upload proof → status | 7 |
| O14 | Invoices | 7 |
| O15 | Organisation settings & members | 2 |

## Admin portal (web) — `/admin`
| # | Screen | Phase |
|---|---|---|
| A0 | Admin MFA: enrol TOTP (QR + manual key) and challenge on each sign-in | 1 |
| A1 | Dashboard (users, actives, events by status, RSVPs, check-ins, runs, revenue, pending queues) | 3 (basic) / 7 (revenue) |
| A2 | Organiser verification queue (approve / reject with reason / suspend) | 1 |
| A3 | Event approval queue (+ duplicate warnings; edit, publish, reject, unpublish, feature) | 2 |
| A4 | Create event: on behalf of an organiser, **or as a RunLime listing** (facts only: name, date, start time, distance(s), venue + start pin, official registration link; flyer/logos/sponsors only after the organiser-permission tick; "not affiliated" notice shown). **Add organisation** (verified, audited) for organisers the owner signs up | 2 |
| A5 | Race suggestions queue (convert to event) | 2 |
| A6 | Users (search, view, suspend; grant/revoke Platform Admin: Super Admin only). **Phase 6:** mark / unmark "verified runner" (audited; also from A15) | 1 / 6 |
| A7 | Moderation queue (reports → remove/warn/suspend; exclude from leaderboards; remove profile photo from Phase 3) | 3 (photos) / 6 |
| A8 | Organiser payments (proof viewer, mark Paid/Rejected) | 7 |
| A9 | Plans & features matrix editor | 7 |
| A10 | Settings (check-in, pace, limits, regions, disclaimers, legal docs, "not affiliated" notice; leaderboard size/pace/max-run/disclaimer in Phase 6) | 2–7 incrementally |
| A11 | Announcements | 3 |
| A12 | Support inbox | 7 |
| A13 | Audit log (filterable, read-only, before/after diff of allowlisted fields) | 7 |
| A15 | Speed review queue (one queue for leaderboards **and** community times): flagged runs (2:35–3:00 /km band) showing distance, time, average and split paces only (no route); approve / exclude with note; "mark runner as verified" | 6 |
| A14 | Clubs: create, edit, archive; view member counts (Phase 1). **Phase 3:** club requests queue (approve / reject with reason), assign or remove club leaders, approve members on a leader's behalf | 1 / 3 |

## Public web
| # | Page | Phase |
|---|---|---|
| W1 | Landing (store badges, upcoming featured races) | 2 |
| W2 | Public event page `/e/[slug]` (OG image, open-in-app; club turnout from Phase 3; RunLime listings show the "not affiliated, check with the organiser" notice and the official registration link) | 2 |
| W3 | Public calendar `/races` (read-only, SEO) | 2 |
| W4 | Privacy Policy, Terms of Use (incl. subscriptions, 18+), Moderation Policy, Child Safety Policy, Health Disclaimer, Community Times notice | 1 (draft) / 8 (final) |
| W5 | Support & contact (FAQ grows in Phase 7) | 1 |
| W6 | Account deletion request (Google requirement) | 1 |
| W8 | Web sign-in for organisers/admins (DOB gate first, then email code) | 1 |


## Removed in rev 2
M23 QR scanner, O11 QR poster, W7 QR landing (S2 → BACKLOG). All 13–17 variants.
