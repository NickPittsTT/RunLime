# Phase 6 plan: community times, boards, verified runners, sharing → real-race pilot

**Status: plan only. Nothing is built until the owner approves this plan and answers §6.** Phase 4+5 must pass its phone test first.

## 1. Pilot target
- **Target: a real race on Saturday 28 or Sunday 29 November 2026** (the owner picks the race; decision D1).
- **Fallback:** the first race in December if the phone tests or Phase 6 slip.
- **Pilot group:** about 10 friends who run 5Ks, on **Android only**. iPhone comes in December (`docs/plans/IPHONE-PLAN.md`). They install a staging APK from a link.
- **Terms:** the draft legal documents plus a plain-language **pilot notice** and a recorded `pilot_terms` consent (owner decision, 15 Oct). Attorney review stays required before public launch, not before the pilot.
- **Working days:** Mon 2 Nov to Fri 27 Nov is about 19 working days. The must-haves in §2 add up to about 14–18 days, plus the Phase 4+5 phone test. That is tight but possible. Confidence 0.6 for 28/29 Nov.

## 2. Must exist for the pilot vs can wait
| Slice | What | Pilot? | Estimate |
|---|---|---|---|
| **6.0 Pilot readiness** | Pilot notice + `pilot_terms` consent at sign-up (setting `pilot.enabled`, text in settings), a pilot test script, an "on race day" admin checklist (the race entered as a RunLime listing with a checked pin, check-in queue watched, review queue watched), a feedback link | **Must** | 1.5–2 days |
| **6.1 Speed checks + one review queue (A15) + verified runners** | `runs.leaderboard_status` set by trigger: every 1 km split and the average ≥ 3:00/km → counted; 2:35–3:00 → admin review; < 2:35 → not counted (the run stays in private history). Admin queue shows pace and split numbers only, never routes. Approve/exclude with a note; "mark runner as verified" (audited); verified runners skip the review tier only. All thresholds are settings | **Must** (community times depend on it) | 3–4 days |
| **6.2 Community times** | After checking in, a runner can share their time to that race's community board: tracked (from a linked run) or typed in, labelled **Tracked / Typed in**. Same speed tiers (flagged times hidden until approved). Withdraw at any time (gone at once). Report a time; block a person (existing Phase 3 tools). Disclaimer always shown; no prizes. Organisers see nothing extra. Display name or nickname (runner's choice) | **Must**: the core of the pilot | 4–5 days |
| **6.3 Activity leaderboards (M37a)** | Kilometres (tracked, counted runs only) and Races attended (GPS check-ins); Weekly / Monthly / Year; Everyone / People I follow; top 20 + own rank; opt-in (off by default, consent recorded); read only through an RPC; no prizes; impossible speeds excluded | **Should**: small group, but it tests opt-in and privacy | 3–4 days |
| **6.4 Club leaderboards (M37b)** | Km, races attended, average members per race; total and per member; only opted-in, approved members of their **primary** club; hidden below the minimum club size (setting) | **Can wait**: ~10 pilot runners rarely reach a club's minimum size, so the boards would be empty | 2–3 days |
| **6.5 Finisher card + sharing (M37)** | After a race: a card with race name, date, distance, the runner's time (only if they choose), RunLime branding. **Never a route or map.** Shared as an image through the phone's share sheet. Needs `react-native-view-shot` (open source, runs on the phone, no service, no data leaves except what the user shares) | **Should**: a cheap way to get pilot feedback; a text-only share link is the fallback if time runs short | 2–3 days |
| **6.6 Reporting/blocking for new content** | The existing report categories and admin queue extended to community times and leaderboard names; blocked people disappear from each other's boards | **Must** (store UGC rules; already mostly built in Phase 3) | 1 day |
| **6b Race photos (C4)** | Already decided (owner, 31 Oct): **after the pilot**. Only runners with a GPS check-in can post; consent tick on each photo; visibility follows the uploader's privacy; "photo of me" reports hide the photo at once until reviewed; deleted after 12 months (setting); EXIF stripped; Supabase Pro storage at launch. Plan: `docs/plans/C4-RACE-PHOTOS.md` | **After the pilot** | 6–9 days |

**Pilot set (recommended):** 6.0, 6.1, 6.2, 6.6 are musts; 6.3 and 6.5 if on schedule. 6.4 and 6b come after the pilot.

## 3. Build order and builds
1. 6.1 → 6.2 → 6.6 → 6.0 → 6.3 → 6.5, each with CI green before the next. Each slice has pgTAP tests for every new table and RPC, plus app and web tests.
2. **Expo builds:** Phase 6 needs about 2–3 (one mid-phase APK after 6.2, one pilot APK, one spare). November plan: 1 used + up to 3 for Phase 4+5 + 3 for Phase 6 = **7 of 15**.
3. **Emulator checks on GitHub-built APKs** (free, no Expo build) before every Expo build, extending the Phase 4+5 check: share a time, see it on the board, withdraw it.
4. All new code is shared between Android and iPhone. Any Android-only API goes in PROGRESS.md and `IPHONE-PLAN.md` §2.

## 4. Privacy and policy checks before building
- **Community times and leaderboards are user-generated content and social features.** Recheck Google Play's UGC policy and Apple 1.2 (report, block, moderation within 48 h, already in place) at the start of Phase 6.
- **Privacy Policy and the third-party register:**
  - adding `react-native-view-shot` is a library, not a service, so no register row is needed;
  - the Privacy Policy gains community times, leaderboards (opt-in, what others see) and the finisher card.
- **Data export and account deletion** include community results, leaderboard opt-in and review notes, with pgTAP tests.
- **Admin review never sees routes:** enforced in the RPC and pgTAP-tested.

## 5. Risks
| Risk | Effect | Mitigation |
|---|---|---|
| Phase 4+5 phone test finds tracker problems (swipe-away, battery) | Delays Phase 6 | Fallback plan in the 31 Oct report §3; fixes ride on Phase 6 builds |
| GPS speed spikes push honest runs into review | Admin load on race day | Splits use filtered points (bad-point rule); verified runners skip review; the owner watches the queue on race day |
| Late-November race calendar | No suitable race on 28/29 Nov | Pick the race now (D1); fallback first December race |
| Expo free queue delays (90 min+ at peak) | Slow pilot APK | Build the pilot APK 2 days before the race |

## 6. Open decisions (answer in one go)
| # | Decision | My recommendation |
|---|---|---|
| D1 | **Which real race** for the pilot (28/29 Nov, or which fallback)? | The owner picks a 5K with a clear start area |
| D2 | **Pilot scope:** musts only (6.0, 6.1, 6.2, 6.6), or also 6.3 leaderboards and 6.5 finisher card? | Musts + 6.3 + 6.5 if on schedule; club boards (6.4) after the pilot |
| D3 | **Typed-in times** allowed in the pilot (they still need a check-in, are labelled "Typed in" and never count on leaderboards)? | Yes, it tests the label and review flow |
| D4 | **Who can see a race's community board:** everyone signed in, or only people who checked in at that race? | Everyone signed in (as designed); never signed-out visitors |
| D5 | **Default name on boards:** display name or nickname? | Nickname if set, else display name; the runner can change it |
| D6 | **Leaderboard weeks:** Monday to Sunday, Port of Spain time? | Yes |
| D7 | **When to offer leaderboard opt-in:** after the first saved run (one-time prompt), or only in Settings? | One-time prompt after the first saved run, plus Settings |
| D8 | **Verified runner:** admin judgement only, or proof required (e.g. an official race result link)? | Admin judgement, with a required note (audited) |
| D9 | **Club leaderboard minimum club size** (setting; default)? | 5, same as turnout |
| D10 | **Finisher card content:** time shown by default or off by default? | Off by default; the runner switches it on |
| D11 | **Pilot notice wording:** I draft it in plain language; you approve it before 6.0 ships? | Yes |
| D12 | **Pilot feedback channel:** a simple in-app "Send feedback" (existing support form), or WhatsApp/email outside the app? | In-app support form (no new service) |
| D13 | **Review-queue time on race day:** the owner checks the queue at least every 2 hours until midnight on race day? | Yes, plus the existing admin alerts |
