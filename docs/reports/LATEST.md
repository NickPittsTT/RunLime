# Report: Phase 3 approved; Phase 4+5 on staging; phone APK ready (1 Nov 2026, 05:00 Port of Spain)

**Phase 4+5 phone APK: https://expo.dev/artifacts/eas/o2feN0_gAu7V7TR0Ra7UC-aXbPkHKnfH_EJecTYYmMI.apk** (EAS build 4e591520)
**Test script:** `docs/phase-4-5/TEST-SCRIPT.md` (branch `phase-4-5`): one outdoor outing plus indoor checks.

Install the APK over the round-4 app (same signing key).

**Phase 3: approved by you (31 Oct 2026).** Phases 4 and 5 are **not approved**; only you approve them, after your phone test.

Confidence: **High** = proven by tests or logs I read. **Medium** = built and tested, but it needs your phone. **Low** = not tested yet.

## 1. Your six points
| # | What you asked | Status | Evidence | Confidence |
|---|---|---|---|---|
| 1 | Mark Phase 3 approved; keep owner tasks open | **Done.** PROGRESS.md says "approved by owner, 31 Oct 2026". Open owner tasks: Dependabot toggles, Firebase Android key restriction, backup keys (7.1), private repo (7.2), `SUPABASE_ACCESS_TOKEN` renewal by 21 Jan 2027. CLAUDE.md decisions log updated | PROGRESS.md, CLAUDE.md | High |
| 2 | Deploy Phase 4/5 to staging (database + website together), then baseline + Security Advisor; stop if anything fails | **Done, nothing failed.** `main` moved to commit `64f4d99`, which CI had passed (run #161). Deploy database #68 applied exactly `phase4_checkin` + `phase5_runs` and published Privacy Policy draft7. Deploy web #42 passed. Both deploys checked that CI had passed. Hosted Security Advisor: **0 ERROR** (more WARN/INFO than before, from the new functions and the locked-down tables, as expected). Staging security baseline: **12/12** | Workflow logs | High |
| 3 | Emulator mock-location check without spending an Expo build | **Passed on run 10** (details in §2). The APK was built on GitHub with Gradle; **no Expo build used** | Android UI check run #16 | High |
| 4 | Combined Phase 4+5 phone APK on Expo, after step 3; secret scan + UI check; link at the top | **Done, on the second build.** Build 1 (`ee523162`) passed the scan, but its emulator check found a **real bug** (§3), so I didn't give it to you. Build 2 (`4e591520`, commit `2cc5590`) has the fix. On this exact APK: secret scan **no secrets** (1457 files, exact-value check); keyboard check **passed**; check-in + run + save **passed** (staging: GPS check-in, `too_far` 2002 m, run 1000 m linked to the race). **Expo builds: 2 of 3 used for Phase 4+5; November 3 of 15** | Mobile build logs #20; Android UI check #21 (keyboard), #22 (check-in/run) | High |
| 5 | iPhone plan (plan only) | **Written:** `docs/plans/IPHONE-PLAN.md`. Android-only APIs are listed with their iPhone counterparts; the rule is that every new feature is shared. **Expo free iOS builds: 15 per month**, separate from Android's 15 (confidence 0.7; our Android builds stopped at exactly 15 in October, which matches "15 + 15"; expo.dev/pricing was not readable from here). Apple Developer Program (US$99/yr) waits for your approval. Nothing built for iPhone | The plan file | Medium |
| 6 | Phase 6 plan (plan only), pilot late November, open decisions together | **Written:** `docs/phase-6/PLAN.md`. Target: a real race on **Sat 28 / Sun 29 Nov** (confidence 0.6). Must-haves vs can-wait; C4 photos as Phase 6b after the pilot; **13 decisions (D1–D13) in one table** | The plan file | Medium |

## 2. The emulator check: what happened, honestly
It took 10 runs. **Every failure was in the test harness; the app code did not change.**

**What the passing run (#16) proved:**
- Check-in 2 km from the pin shows "too far", recorded on staging as `too_far (2002 m)`.
- Check-in next to the pin shows "You're checked in", recorded on staging as a `gps` check-in.
- A 1 km route at runner speed (250 fixes, 4 m apart, about one per second): the live screen showed **1.00 km**. Staging saved **1000 m** (88 points kept, moving 220 s), linked to the test race. The test account and race are deleted after every run.

**What failed along the way, and what each failure taught us:**
| Runs | Problem | Lesson for the app |
|---|---|---|
| 1 | Live distance read too early (0.06 km); the screen showed 1.00 km 3 s later, and staging saved 1000 m | **Real behaviour:** Android hands GPS points to the app in batches, so the live number can trail by a few seconds. Added to the test script (A5.2); the saved total is unaffected |
| 1, 4–5 | Maestro's "travel" command moved in 22 m jumps (10–12 m/s) | The app correctly treats >12 m/s as impossible running. **Edge case found:** at a *sustained* speed above 12 m/s (e.g. tracking while driving), distance stops counting until you slow down. A runner can't trigger this; I have not changed the app (decision D14 below) |
| 2–3 | The test waited for text that had scrolled off ("Checked in at…"), not the immediate "You're checked in" | None (test fix) |
| 6 | Android's own "Pixel Launcher isn't responding" dialog on a freshly booted emulator | None (the test now waits and dismisses it) |
| 7–8 | `adb emu geo fix` did not move the CI emulator | None (switched to Android's test location provider) |
| 9 | Maestro single location steps ran 0.18 s apart (22 m/s) | Same as runs 4–5 |

## 3. The bug the Expo APK found, and the fix
- **Bug:** after **Save run**, the app waited for the server's reply before leaving the summary screen. On the first Expo APK the reply took more than 30 s, though the run did reach staging. On race day with weak signal, "Save run" would have looked broken.
- **Fix** (commit `5f2d605`):
  - the run is saved on the phone, the app goes straight to the run page, and the upload happens in the background (what the design always said: works offline, uploads later);
  - the run page says "Saved on this phone…" until the upload is done, then "Saved.";
  - uploads stop waiting after 15 s and history after 10 s (the phone's copy is shown);
  - two uploads at once share one, so a run is never sent twice.
- **Evidence:** 4 new app tests (164 in total); CI #172 green; emulator check passed on a GitHub-built APK (run #19) and then on the Expo APK (run #22: "Saved." 27 s after stopping, including the stop dialog).
- **Still open, honestly:** on the Expo APK the upload itself took 10–40+ seconds. On the GitHub-built APK it was immediate. In run #20 it hadn't arrived within 44 s, and the 15 s limit kept the screen free. I don't know why the Expo build is slower; my guess is its push (Firebase) setup, but there's no evidence yet.
  - Thanks to the fix, it no longer blocks anything: the run is safe on the phone and uploads on the next try (opening the run or Run history, or signing out).
  - Your outdoor test (A5.6) will show how long it takes on a real phone; the test script asks you to note it.
  - If it's slow on your phone too, I'll raise the 15 s limit and look at the cause before the next build (1 build left for Phase 4+5).
  - Confidence that runs are never lost: 0.9. Confidence that "Saved." appears within a minute on your phone: 0.7.

## 3b. Earlier UI checks on this build
- The keyboard check (R2) **passed** on this APK (run #21).
- Run #18 (keyboard check, first Expo APK) stopped at sign-in because the emulator wasn't ready. The script now waits and dismisses the dialog, and it passed after that change.
- One emulator run hung for 23 min while shutting down; the emulator step now has a 25-minute limit.

## 4. Not tested yet (needs your phone; see the test script)
- Real GPS outdoors, the locked screen, the "recording" notification, steps, battery use, accuracy against a known route.
- **Swipe-away (B5.6)**, with the fallback already stated.
- The live venue search (Nominatim) from staging.
- The "Open in Google Maps (satellite)" link opening the Maps app.

## 5. Credentials rule: every change and sync
- **Build sync of public values** (the documented exception): the four `EXPO_PUBLIC_*` values were synced to Expo "preview" by the three Expo builds:
  - round 4, 1 Nov 00:48 UTC;
  - Phase 4+5 build 1, 06:03 UTC;
  - Phase 4+5 build 2, 07:43 UTC.
- **The GitHub-built emulator APKs used the same public values** from GitHub variables, checked as public by `check-public-key.sh`. They never leave the CI runner.
- **Throwaway staging test accounts and test races** were created and deleted by each emulator run. They are test data, not credentials.
- **Nothing else** was created, changed or deleted: no credentials, keys, tokens or environment variables in GitHub, Supabase, Expo, Firebase, Google Cloud or Cloudflare.

## 6. Decisions waiting for you
- **D1–D13:** in `docs/phase-6/PLAN.md` §6 (the pilot race first).
- **D14 (new, small):** should the run tracker stop and break the line when it sees a long stretch faster than 12 m/s (e.g. someone tracking in a car), instead of pausing distance until they slow down? Recommendation: leave as is for the pilot, and revisit with the Phase 6 speed checks. Confidence 0.7.
- **Apple Developer Program (US$99/yr):** only when you're ready for the December iPhone pilot; individual or organisation is your choice.

## 7. Next
1. **You:** install the APK and do the outing in `docs/phase-4-5/TEST-SCRIPT.md`, including **B5.6 swipe-away**. Report pass/fail per step.
2. **Me:**
   - fix whatever your test finds, using emulator checks first (1 Expo build left for Phase 4+5; I'll ask before a 4th);
   - start Phase 6 only after your answers to D1–D13 and your approval of Phases 4 and 5.
