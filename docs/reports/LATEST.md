# Report: owner decisions on Phase 4+5 applied (31 Oct 2026, 16:30 Port of Spain)

**Round-4 APK (phase-3 only):** _not built yet. It is scheduled for 00:45 UTC (20:45 Port of Spain tonight). The link goes here, at the top, when the build, the exact-value secret scan and the Android UI check have passed._

**No phase is approved.** Phase 3 is waiting for your R2 retest. Phases 4 and 5 are on branch `phase-4-5`: not deployed, not on a phone, not approved. Only you approve phases.

## 1. Your four decisions
| # | Decision | What I did | Evidence | Confidence |
|---|---|---|---|---|
| 1 | Satellite: option D + an "Open in Google Maps (satellite)" link | Built (details in §2) | Shared unit test of the exact URL; web E2E checks the link's address, new tab and no-referrer on the admin race page (passed locally); CI #160 passed | High (link built); Medium (Google terms, §2) |
| 2 | Deploy: option 1 | **Nothing from Phase 4/5 is on staging.** Rollout order recorded in PROGRESS.md: round-4 APK → your R2 result → deploy Phase 4/5 database + website together → emulator mock-location check → combined APK (max 3 builds) | PROGRESS.md; tonight's scheduled task updated to say "do not deploy Phase 4/5" | High |
| 3 | Tonight as scheduled; APK link at the top of LATEST.md | The scheduled task (00:45 UTC) now also puts the link at the top of this file, lists the `EXPO_PUBLIC_*` build sync, and merges phase-3 into `phase-4-5` | Scheduled task updated (prompt only; same time) | High |
| 4 | Swipe-away test clearly marked, with a fallback plan | B5.6 rewritten as a marked step-by-step test with the expected result and three possible outcomes (a/b/c); fallback in §3 | `docs/phase-4-5/TEST-SCRIPT.md` (branch `phase-4-5`) | High |

## 2. The Google Maps link
- **Where:**
  - next to the start-pin line on the race form, on the organiser create/edit page and the admin race page (same form);
  - inside the admin **Review** box, above the "Pin checked" tick.
- **What it opens:** `https://www.google.com/maps/@?api=1&map_action=map&center=<lat>,<lng>&zoom=19&basemap=satellite`.
  - This is Google's documented **Maps URLs** format: Google Maps centred on the pin, in satellite view.
  - It opens in a new tab, or in the Maps app on a phone.
- **What is sent, and when:**
  - Nothing until someone taps the link.
  - Then: only the pin's coordinates (the race start, which is public anyway) and the normal details of any website visit (IP address, browser).
  - The link has `rel="noopener noreferrer"`, so Google isn't told which RunLime page it came from.
  - No API key, no Google account of ours, no runner data.
- **Note:** the satellite view in this link shows no marker. The map is centred on the pin, so the start point is the middle of the screen. Google's keyless URLs can show either a marker or satellite view, not both.
- **Google's terms (your request):**
  - Google's Maps URLs guide says Maps URLs **need no API key**. They exist so that any website or app can open Google Maps with a link.
  - We only link out; nothing from Google is embedded, copied or downloaded. This is the use the guide describes.
  - **Limit of my check:** Google's developer site (developers.google.com) is blocked from this build session's network. So I confirmed the no-key statement and the `basemap=satellite` option through search results quoting the guide and through a published code library that builds the same URLs.
  - To confirm yourself, open the "Maps URLs" guide on developers.google.com and look for "doesn't require a Google API key" and the `basemap` parameter.
  - Confidence 0.85.
- **Register and Privacy Policy:**
  - THIRD-PARTY-SERVICES.md has a new **Google Maps (link only)** row.
  - The Privacy Policy (draft7) has one line in the providers list for organisers and admins.
  - Both are on `phase-4-5`. They go live with Phase 4/5, because the link only exists there.
- **Before public launch:** revisit option A (Esri) or B (Mapbox) if wrong pins turn up in the pilot. This is recorded in PROGRESS.md.

## 3. Swipe-away: what you should see, and the fallback
- **What I expect (a):** the recording notification stays, and the run keeps counting after the swipe.
  - The tracker's foreground service is set **not** to stop when the app is closed (`killServiceOnDestroy: false`).
  - Every GPS point is saved to the phone as it arrives.
  - Some makers' battery savers (often Samsung, Xiaomi, Huawei, Oppo) stop it anyway.
  - Confidence that your phone gives (a): 0.6.
- **If you see (b)** (the notification disappears; the run is still there but the part after the swipe is missing or a straight line):
  1. **Gap as a pause:** a gap of more than 30 s with no GPS points while not paused counts as a pause. No straight line, no false distance. The run screen will say "Recording stopped at HH:MM while the app was closed".
  2. **A one-time tip at the first run start:** "Locking the screen is fine; don't swipe RunLime away while recording." It comes with a button that opens Android's own battery-optimisation settings, where you can set RunLime to "Unrestricted".
     - It only opens the settings page.
     - We will **not** use the permission that asks to skip battery optimisation directly (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`), because Google Play restricts it.
  3. No new services, no new permissions, no cost. I check it in the emulator first, and it rides on the next planned build (inside the 3-build limit).
- **If you see (c)** (the run is gone): that's a bug, because the points are saved as they arrive. I find and fix it with an emulator test before any further build, and tell you the cause.

## 4. Things I did not do
- No deploy of Phase 4/5 (your decision 2).
- No new Expo builds today.
- **Credentials rule:** no credentials, keys, tokens or environment variables were created, changed or deleted, and no build sync has run since the last report. The scheduled task was changed: same time, prompt text only.

## 5. Tests run (exact)
- **Local, on `c70b8b6`:**
  - shared unit tests: **100 pass** (one new test of the link);
  - web typecheck and lint: clean;
  - web E2E, run against a freshly reset local database: `checkins`, `events` and `review-fixes`, **7 of 7 pass**.
- **CI:** `c70b8b6` **passed in full** (#160: unit tests, pgTAP, Security Advisor, scans, web E2E). Phase 4 #158 and Phase 5 #159 passed earlier.
- **Not tested:** whether the link opens the Maps app on your phone (I expect yes). Test-script step P0.2 is where to try it.
