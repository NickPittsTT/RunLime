# Report: Phase 4 + 5 built and tested in CI; one decision needed (31 Oct 2026, 12:45 Port of Spain)

**No phase is approved.** Phase 3 is waiting for your round-4 retest. Phases 4 and 5 are built on branch `phase-4-5` but **not deployed, not on a phone yet, and not approved**. Only you approve phases.

Confidence scale: **High** = proven by automated tests or logs I read. **Medium** = built and unit-tested, but it needs a real phone. **Low** = not yet tested.

## 1. Summary
- **Phase 4 (GPS check-in): built.** Commit `bb02767`, **CI passed** (run #158).
- **Phase 5 (run tracker, history, totals): built.** Commit `d319099`, CI: see §8.
- They are in separate commits, as you asked.
- **One decision for you (§2): the satellite layer.** OpenFreeMap has no satellite images, so every option means a new third-party service. I have not built it. Everything else carried on.
- **No other conflicts** with the existing design, Google Play policy or the free tiers (§3).
- **Phase 3 items done:**
  - Auth Site URL set to the staging website (verified in the log, §9).
  - RETEST round 4 and PROGRESS updated.
  - Tonight's round-4 APK is still **phase-3 only**.
- **Expo builds:** the free plan gives **15 Android builds per month**, and **all 15 were used in October** (2 of them errored). November resets on 1 Nov. Plan: 1 build for tonight's round-4 APK, then at most 3 for Phase 4+5 (§7).
- **Question: may I deploy Phase 4/5 to staging (database and website)?** See §6. Until you answer, nothing from Phase 4/5 is on staging.

## 2. Decision needed (only this point waits for you)
**"Satellite layer on the create-event map"** (Phase 4 notes). OpenFreeMap provides street maps only, with no aerial imagery. The options:

| Option | Cost / account | Quality for spotting a start line | Notes |
|---|---|---|---|
| A. Esri World Imagery | Free tier, but needs an ArcGIS account + API key | Good (high-resolution in cities; to be confirmed for Trinidad) | New service, new key (credentials rule: you create it) |
| B. Mapbox Satellite | Free tier, needs an account + key; whether a card is required must be checked before choosing it | Good | New service, new key |
| C. EOX Sentinel-2 cloudless | Free, no key (CC BY) | **Poor**: 10 m pixels, a start line isn't visible | Least effort, little value |
| D. No satellite layer | None | n/a | Rely on the other safeguards (below) |

**My recommendation: D for the pilot, then A or B before public launch** if wrong pins turn up. Confidence 0.7.

Reasoning: the safeguards already built cover the main risk.
- Two ticks are required: "on the start line" and "Pin checked".
- A warning appears when the pin is more than 1 km from the address.
- A town-only result forces manual placement.
- Saved venues are reused.
- Pin corrections re-test failed attempts.
- The help queue catches the rest.

Whichever option you pick, I'll add it to the register and the Privacy Policy first (it sees only the map view of the admin who is editing, no runner data).

## 3. Conflict check (your request: tell me before building)
| Decision | Conflict? | Detail |
|---|---|---|
| Check-in location only while the app is open | **No** | Uses foreground permission only. |
| Run tracker keeps recording with the screen locked | **No**, with a store note | Done with an Android **foreground service** started from the open app (visible notification "RunLime is recording your run"). This needs only "while using the app" location. `ACCESS_BACKGROUND_LOCATION` stays **removed** from the manifest (checked in the generated config). Play needs a **foreground-service location declaration + demo video** at submission: added to STORE-REQUIREMENTS.md row 19 (Phase 8). |
| Steps | **No** | Android "Physical activity" permission, asked at the first run start; the run works without it. STORE-REQUIREMENTS row 20: check at Phase 8 whether Play's health-apps declaration applies. |
| Nominatim | **No** (pilot scale) | Usage policy rechecked: max 1 request/second, a real User-Agent, attribution, caching, no type-ahead, no bulk use. All are enforced (§4). For heavy use after launch, plan a paid or self-hosted geocoder (note only). |
| Free tiers | **No** | Nothing new costs money. New libraries are open-source Expo modules (expo-task-manager, expo-sqlite, expo-sensors); `pnpm audit` is clean. |
| Satellite layer | **Yes** | See §2. |

## 4. Phase 4: GPS check-in
| Item | Built | Evidence | Confidence |
|---|---|---|---|
| `check_in(event_id, lat, lng, accuracy_m)`, once per runner per race | Yes | pgTAP 028 | High |
| Radius 500 m (`checkin.radius_m`), per-race override by admins | Yes | pgTAP 028, web E2E | High |
| Phone accuracy allowance (capped at 100 m, setting) | Yes | pgTAP 028 (556 m with 80 m accuracy passes; 778 m with 400 m doesn't) | High |
| Window 1 h before to 3 h after (settings); follows a postponed race's new date; closed when postponed without a date or cancelled | Yes | pgTAP 028 | High |
| Location only while the app is open | Yes | App config + code (one reading on tap) | High (config), Medium (on phone) |
| Failed attempts: rounded to 3 dp, accuracy, time, race; deleted after 30 days (setting; nightly job) | Yes | pgTAP 028 | High |
| Daily attempt limit (20, setting) | Yes | pgTAP 028 | High |
| "I'm here but can't check in" → admin queue; approve with a reason (audited, runner notified) or decline | Yes | pgTAP 028, web E2E | High |
| Pin or radius correction re-tests failed attempts → "approved after correction", audited | Yes | pgTAP 028 | High |
| Optional finish pin | Yes | pgTAP 028 | High |
| "Pin is on the start line" needed to submit/publish; admin "Pin checked" needed to publish; both cleared when the pin moves | Yes | pgTAP 028; earlier tests updated; web E2E | High |
| Saved venues (from checked pins) offered first in search | Yes | pgTAP 028 | High |
| Venue search: Nominatim, Search button only, 1 request/second for the whole app (DB slot), 30-day cache, OSM credit, precision label, town-only forces manual placement, >1 km warning (setting), "Use my current location" | Yes | pgTAP 028 (slot, cache, access); shared unit tests (parsing, precision, distance) | High (logic); **Low** (live Nominatim call not yet made from staging) |
| Check-ins count toward "races attended" | Yes | `my_run_totals.races_attended`; Phase 6 boards will use it | High |
| Check-ins and attempts in the data export | Yes | pgTAP 028 | High |
| Cluster alert (3+ failed attempts in one area) | **No**: after the pilot, as you noted | n/a | n/a |
| Satellite layer | **No**: waits on §2 | n/a | n/a |

Legal and register:
- Privacy Policy draft6 adds failed attempts (30 days), help requests and Nominatim.
- The third-party register has a Nominatim row.
- Privacy Policy changes are in `docs/legal`, so CI ran on them (it passed on `bb02767`).

## 5. Phase 5: run tracker, history, totals
| Item | Built | Evidence | Confidence |
|---|---|---|---|
| Start / pause / resume / stop; live time, distance, pace and map | Yes | App tests (RunTracker) | Medium |
| Keeps recording with the screen locked (foreground service + notification) | Yes | Config check; app tests mock the service | **Medium–Low until the phone test (A5.3)** |
| Works offline; uploads later (SQLite run + outbox; upload is idempotent so retries are safe) | Yes | App tests (RunSync), pgTAP 029 | Medium |
| History list + detail (map, splits, steps, calories) | Yes | App tests | Medium |
| Totals: runs, km, time; per-race totals (a run is linked to a race when it starts in that race's check-in window and you checked in) | Yes | pgTAP 029 | High (server), Medium (screen) |
| Routes private by default (owner-only RLS; even admins can't read them) | Yes | pgTAP 029 | High |
| Privacy zone 200 m (setting `runs.privacy_zone_m`), used if a route is ever shown to others | Function built and unit-tested | Shared tests | High (function). **Not used anywhere yet, because no route is shown to others.** |
| Calories: optional weight **on the phone only**; without it, "general estimate" (70 kg) | Yes | Shared + app tests | High |
| Steps: permission at the first run start; run works if refused | Yes | App tests | Medium |
| Tracker free until Phase 7 behind `feature.tracker` (`my_entitlements`) | Yes | pgTAP 029 | High |
| Auto-pause on by default, switch to turn off | Yes | Shared + app tests | Medium |
| GPX export per run | Yes | Shared tests (GPX 1.1 output); share sheet needs the phone (B5.4) | Medium |
| Runs in the data export; deleted with the account; owner can delete one | Yes | pgTAP 029 | High |
| Sign-out uploads waiting runs, then clears local runs, weight and run settings from the phone | Yes | Code; app tests cover the pieces | Medium |
| Privacy Policy + data model docs | Yes | Privacy Policy draft6 (weight on phone only, steps, routes private, GPX, privacy zone, retention); `02-DATA-MODEL.md` | High |

**Battery and sampling settings (my choice, as you asked):**
- GPS accuracy "High", with a fix every **2 s or 5 m**, whichever comes later. The foreground service runs only while a run is recording.
- **Why:** this is a common running-app trade-off. 1 s fixes add little accuracy at running speed and cost more battery. Expected battery use is about **1–2% per 10 minutes** on a typical phone (estimate; measured in B5.7).

**Bad-point rule (my choice):** a GPS point is dropped when any of the following holds:
- its accuracy is worse than **30 m** (setting `runs.max_accuracy_m`);
- its time doesn't move forward;
- reaching it from the last kept point would mean faster than **12 m/s** (43 km/h: no runner, but a GPS jump).

The server also refuses impossible runs:
- longer than **300 km** (setting);
- end before start;
- moving time longer than elapsed time;
- in the future.

**Auto-pause:** pauses below 0.5 m/s for 10 s and resumes above 1.0 m/s.

**Known unknown:** if you **swipe the app away** mid-run, I don't know for certain whether Android keeps the foreground service alive on your phone. It depends on the maker's battery rules. Recorded points are already saved to the phone, so at worst the run stops at that point and can be saved when you reopen the app. Test B5.6 checks it. Confidence: Low.

## 6. Deploying Phase 4/5 to staging: your call
Fast-forwarding `main` to `phase-4-5` would deploy the Phase 4/5 database changes and website to staging. I have **not** done this, because:
- Phase 3 isn't approved and tonight's round-4 APK is phase-3 only.
- The new database is designed to work with the round-4 app. But the `submit_event`/`review_event` signatures change: the organiser and admin pages need the new pin ticks, so the website and database must go together.

Options:
1. **Deploy after your round-4 retest passes** (recommended). It keeps the R2 retest clean. Confidence 0.8.
2. Deploy now. The round-4 app keeps working: its check-in/run screens don't exist, and the other calls are unchanged. But publishing a race on the website then needs the two pin ticks.

The phone test (and the emulator mock-location check below) needs staging to have Phase 4/5.

## 7. Expo builds and the emulator check
- **Allowance:** 15 Android builds per month on the free plan. Source: Expo's published free-plan limits, read via secondary sources; the count of 15 used in October comes from our own build history. Confidence 0.8.
- **October:** 15 used (2 errored). **November (resets 1 Nov):**
  - 1 build tonight (round 4, phase-3 only);
  - **at most 3 for Phase 4+5**, as you set: 1 combined APK plus 2 held back for fixes. I'll ask before a 4th.
- **Emulator mock locations:** once Phase 4/5 is on staging, the free GitHub Android UI check (no Expo build) will run the combined APK in an emulator. It will:
  1. set a location next to a test race's pin and tap **Check in**;
  2. set one 2 km away (expect "too far");
  3. replay a 1 km route with Maestro's `travel` command and check the live distance (within 10%).

  This catches broken wiring before your outing. It can't test the locked screen, battery or real GPS noise.

## 8. Tests run (exact)
- **Local, on the Phase 5 commit:**
  - typecheck and lint across all packages: clean. One web lint run failed once while typecheck ran at the same time; it passed on re-runs, alone and together, with no code change. I'm noting it in case it recurs in CI.
  - shared unit tests: **99 pass**;
  - app tests: **160 pass** (24 suites);
  - pgTAP on a freshly reset database: **525 pass** (29 files);
  - secret-scanner self-test: pass;
  - app boundary check: pass (80 app files).
- **CI:**
  - Phase 4 `bb02767`: **passed** (#158; includes web E2E, Security Advisor, gitleaks and audit).
  - Phase 5 `d319099`: secret scan, audit, lint, typecheck, unit tests, pgTAP (incl. security baseline), Security Advisor, web build + build secret scan: **passed** (#159); web E2E was **still running** when this was written (the next report confirms it).
- **Not tested yet:** anything on a real phone, live Nominatim from staging, the emulator mock-location run, battery, distance accuracy, the swipe-away case.

Test script: `docs/phase-4-5/TEST-SCRIPT.md` on branch `phase-4-5`. It has one outdoor outing (check in at a test race pinned near you, then a 10–15 minute run) plus indoor checks.

## 9. Credentials rule: every change and sync
- **Supabase Auth Site URL** (staging): changed from `http://localhost:3000` to the staging website URL, **with your approval**. Done by the "Configure auth" workflow (run 11, 31 Oct 12:10 UTC). The log shows `OK site_url = "https://runlime-web-staging.runlimett.workers.dev"`. Not a credential, but listed as you asked.
- **No** credentials, keys, tokens or environment variables were created, changed or deleted.
- **No** public-value build sync has run since the last report. Tonight's round-4 build will do the documented `EXPO_PUBLIC_*` sync, and the next report will list it.

## 10. Next
- **Tonight (scheduled, 00:45 UTC):**
  1. build the round-4 APK from `phase-3`;
  2. run the exact-value secret scan and the Android UI check;
  3. only then deploy the private-photo database migration and run the security baseline;
  4. put the APK link in RETEST round 4.
- **After your answers:**
  - §2 (satellite layer);
  - §6 (when to deploy Phase 4/5);
  - then the emulator mock-location check;
  - then the combined Phase 4+5 APK and your outing.
- Waiting on you: the backup keys (§7.1 of the backup doc) and private-repo step 1 (after tonight's APK).
