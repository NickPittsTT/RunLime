# Phase 2 review: events, RunLime listings, admin + organiser portal, race calendar (web + app)

Date: 2026-10-15 · Branch: `phase-2` (fast-forwarded to `main`) · Staging web: https://runlime-web-staging.runlimett.workers.dev

Free tiers only: Supabase Free, Cloudflare Workers Free, EAS Free, OpenFreeMap tiles (no key, no card). Nothing in this phase needs a paid plan.

## What was built
| Area | Delivered |
|---|---|
| Database | RunLime listings (`listing_source = runlime`: no organisation, official link required, no flyers/photos/sponsors, enforced by constraints + trigger); start pin must be inside the country's bounding box; route as `[lng, lat]` points (2–2000); event distances; co-organisers; media + sponsors (organiser events only) with a public `event-media` bucket (5 MB, JPEG/PNG/WebP); change history (date, venue, pin, status, link); duplicate warnings (same area, ±1 day, name similarity setting); race suggestions with a daily rate limit; write RPCs for save/submit/review/postpone/cancel/duplicate; Phase 2 settings (`events.unaffiliated_notice`, `events.duplicate_similarity`, `ratelimit.race_suggestions_per_day`, `calendar.near_me_radius_km`). Operator address is non-public |
| Admin (web, MFA required) | Events queue with status filters and duplicate warnings; **create event** as a RunLime listing or for an organisation; edit, approve/reject (reason required), postpone/cancel (reason required), duplicate, change history; race suggestions (convert to a listing / dismiss); settings editor |
| Organiser portal (web) | Dashboard per verified organisation; event editor with map pin (tap or type latitude/longitude), route (tap points or GPX upload); submit for approval; postpone/cancel; duplicate; flyers/photos upload; sponsors; co-organiser invites (accept/remove); organisation settings + team |
| Public web | Landing with upcoming races; `/races` month calendar (swipe on phones) + filters + list; `/e/[slug]` race page with status banner, "not affiliated" notice on RunLime listings, minors notice, official link, add to calendar (`.ics`), share, map |
| App navigation | Ride-share style: Home = race calendar; top bar (menu, title, bell); large fixed **Start run** button; side menu (lime initials avatar, name, nickname, quick stat → full profile; My races, Leaderboards, Run history, Followers, Clubs show "Coming soon"); no tab bar |
| App calendar | Swipeable month view (January this year → December next year), race days marked, tap a day; upcoming list; search; filters (area, distance, free entry, for a cause, walkers welcome); **Near me** (asks for location when tapped; position stays on the phone; radius from settings); list/map toggle; pull to refresh; **offline copy** with a banner |
| App race page | Status banner, not-affiliated notice (listings), minors notice, "Register with the organiser" (opens the official link), add to calendar, share, start pin + route map, full-screen map, flyers, sponsors |
| App other | Onboarding (3-step walkthrough + areas/distances, saved on the phone as default filters; skippable); Suggest a race; age gate: Day→Month→Year auto-advance after 2 digits, Next/Next/Done keys (Done submits), backspace in an empty box goes back |
| Maps | MapLibre (web 6.11.2, app 11.4.0) + OpenFreeMap "liberty" style, OSM attribution shown |
| Ops | `Deploy web` workflow (Cloudflare, size check, smoke test, legal placeholder check); `Bootstrap super admin` workflow; webpack build for the Worker (1.78 MiB of the 3 MiB free limit) |

## Tests run
| Suite | Count | Result | Covers (Phase 2 additions) |
|---|---|---|---|
| pgTAP | 136 | pass (local, clean reset) | listing rules (no org, link required, no media/sponsors), bounding box, route shape, save/submit/review/status RPC permissions, co-organisers, change history, duplicates, suggestions + rate limit, organisation team, operator address private |
| Vitest (shared, ui-tokens) | 53 + 13 | pass | event schema, time-zone conversion, GPX parsing, calendar grid, filters, near-me distance, fee labels, calendar row parsing, blank optional text |
| Jest (mobile) | 42 | pass | DOB auto-advance/Next/Done/backspace; Home (top bar, no tabs, month view, list, search, Start run + bell "coming soon", side menu items + profile header, open race, onboarding redirect, offline copy + banner, error + retry); race page (listing notice, minors notice, official link, postponed banner, removed race); suggest a race (validation, RPC, rate limit); onboarding (saves areas/distances; skip) |
| Playwright (web) | 12 | pass on Cloudflare's runtime (local) | admin creates a RunLime listing → public page shows facts + notice + `.ics`; organiser draft → submit → admin approve → postpone; all Phase 1 flows |
| CI | — | green on `19c6642` (lint, typecheck, unit, pgTAP, E2E, Worker size); `a062a57` (mobile) running at time of writing | |
| Staging deploy | — | Deploy database (Phase 2 migrations) and Deploy web green on `19c6642` | |

## Not tested (and why)
- **The new app screens on a real phone.** Unit tests cover the logic and screens, but maps, location permission, the month swipe and the side menu animation only show on a device. That is what your test script below is for.
- **MapLibre on Android.** It's a native module, so only the EAS build compiles it. If the build fails here, I fix it before you test.
- **Organiser portal on staging.** It needs a second, verified organiser account, and you asked for no test accounts on staging. It is covered by the local E2E test (draft → submit → approve → postpone). You can try it later with a real organiser.
- **Add to calendar on Android.** The app opens the race's `.ics` link in the browser; what happens next depends on your phone's calendar app. Please report what you see.
- **Screen readers.** Labels and roles are set and tested; TalkBack has not been tried.
- **iOS.** Deferred (paid Apple account).

## Assumptions to confirm
1. **Month view range:** January this year to December next year (24 months), so late-year races in the next January show. Say if you want more or less.
2. **Distance filter choices:** 5K, 10K, Half marathon, Marathon (matches ±0.5 km).
3. **Side-menu quick stat** shows "0 races · 0 km" until check-ins (Phase 4) and runs (Phase 5) exist.
4. **Onboarding choices** are stored on the phone only (not on the server). They are lost if the app is reinstalled.
5. **Near me** uses Android's normal location permission (precise or approximate is your choice in the dialog). The position is never sent to the server.
6. **"Suggest a race"** is in the side menu and at the bottom of the race list.

## Owner test script

Time needed: about 30 minutes. Use real race facts only. Do not create test accounts on staging.

### A. Admin two-step login (once)
1. On your computer, open the staging site → **Sign in** → `runlimett@gmail.com` → enter the 6-digit email code.
2. Go to `/admin`. You are sent to **Set up two-step login** (`/admin/mfa`).
3. In an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or 1Password), add an account, choose **Enter a setup key**, and type the key shown on the page (or scan the QR code). Account name: RunLime staging. Type: time-based.
4. Type the 6-digit code from the app → **Verify**. Expected: the admin console opens. Next time you go to `/admin` you only need the 6-digit code.
5. Keep the authenticator app. Losing it means I reset two-step login with the bootstrap workflow.

### B. Enter a real race as a RunLime listing (web)
6. Admin → **Events** → **New RunLime listing**.
7. Enter the facts of a real upcoming race: name, date and start time, area, venue, start pin (tap the map or type latitude/longitude), distance(s), entry fee if known, official registration link. Optional: draw the route (tap points) or upload a GPX file.
8. Save. Expected: the race shows as **Scheduled**. Leave out the link and save → expected: "RunLime listings need the official registration link".
9. Open **Races** on the public site → the race is on its day in the month view and in the list. Open it → expected: the "not affiliated" notice, the children notice, **Register with the organiser** opens the official page, **Add to calendar** downloads a calendar file, the map shows the start pin (and route).
10. Admin → Events → open the race → **Change: Postpone**, reason "Test, back on shortly" → save. Expected: the public page shows "Postponed" and the reason. Then **Change: Back on (no longer postponed)** → the banner goes. Both changes appear in the race's history. (Duplicate and Cancel are covered by the automated tests; skipping them here keeps made-up races off staging.)

### C. The app (install the new staging APK from the link I send)
11. Fresh install, open the app. Age gate: type the day (2 digits) → the cursor jumps to Month; type 2 digits → jumps to Year. Backspace in the empty Year box → back to Month. Press **Done** on Year → continues. Expected: no typing in the wrong box.
12. Sign in (email code or Google). First time: the **welcome walkthrough** (3 screens) → choose areas and distances → **Show races**.
13. Home: top bar with menu (left), "Races", bell (right). Bell → "Coming soon". Big **Start run** button at the bottom → "Coming soon". No tab bar.
14. Month view: swipe left/right through the months; arrows do the same. The race day from step 7 is marked lime. Tap it → only that day's races; **Show all upcoming races** goes back.
15. Search a word from the race name → the list narrows. **Filters** → pick an area / distance / Free entry → **Show races**; the button shows the count. **Clear all** resets.
16. **Near me** → explanation → Continue → Android permission dialog → allow. Expected: races within 25 km, nearest first, with "x km away". Tap Near me again to turn it off. Try once with **Don't allow** → expected: a message, no crash.
17. **Map** → pins for the listed races; tap a pin → the race page. **List** returns.
18. Race page: notices, **Register with the organiser** opens the official page, **Share**, **Add to calendar** (tell me what your phone does), map, **Full-screen map**.
19. Menu (top-left): your initials in a lime circle, name, nickname, "0 races · 0 km". Tap the header → full profile. My races / Leaderboards / Run history / Followers / Clubs show "Coming soon". Edit profile, Emergency contact, Your data, Help & legal still work.
20. Menu → **Suggest a race** → enter a name → Send → "Thanks!". In the web admin → **Suggestions** → it is listed; **Dismiss** it (or convert it if it's real).
21. Offline: turn on Airplane mode, close and reopen the app. Expected: the saved races with "Offline. Showing races saved …". Pull down after turning Airplane mode off → the banner goes.
22. Sign out from the menu → back to the age gate.

Report each step as pass/fail, with a screenshot for any failure.
