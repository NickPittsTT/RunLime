# Report: Retest round 3 follow-up (R2, R9, private photos, backups, private repo, C4) and a security incident (30 Oct 2026, 22:45 Port of Spain; updated from 22:30)

Phase 3 is **not approved**. Only the owner approves it.

## 1. Summary
- **Security incident (S1, staging), action needed from you now.**
  - The GitHub variable `SUPABASE_ANON_KEY` now holds a Supabase **secret** key (`sb_secret_…`), not the public anon key. It changed after yesterday's clean build; I didn't change it, and no session tool can.
  - A test build I made for the emulator check copied it into the app. The APK secret scan caught it.
  - The key was visible in one public Actions log for about 35 minutes. I deleted that log and the log with the APK link.
  - **Please rotate the key (Owner actions 1–3).** Record: `docs/operations/incidents/2026-10-31-secret-key-in-test-apk.md`.
  - Guards now stop any app build or website deploy that uses a secret key in place of the public key.
- **R2 keyboard: cause found and fixed, verified on an Android emulator.**
  - **Cause:** React Native's KeyboardAvoidingView compares the keyboard's top edge (measured from the top of the screen) with its own position measured from the top of its container, which begins below the navigation header. So on Android (edge-to-edge, where the window no longer resizes for the keyboard) it reserved too little space, short by the height of the header. The bottom of the box and "Send report" stayed under the keyboard and couldn't be scrolled to.
  - **Evidence:**
    - The old APK on an Android 14 emulator: "Send report" was **233 px under the keyboard** and scrolling to it failed with the keyboard open.
    - The fixed build: box and button fully above the keyboard (screenshot: `docs/reports/assets/2026-10-31-r2-keyboard-fixed-emulator.png`).
  - **Fix:** the shared Screen component now measures its own position on the screen and reserves exactly the part the keyboard covers. This applies to every screen with text boxes.
- **R9 Public photo: server proven correct; the cause on your phone is not proven; three fixes.**
  - Staging diagnostics: every current viewer/account pair is served correctly. A local test switches Private → Public → Private and the other account gets the photo at once.
  - Most likely cause (0.5): **the switch wasn't saved.** Privacy was only saved by "Save" at the bottom of Edit profile, and privacy changes aren't recorded, so I can't confirm it.
  - Fixes:
    - privacy now saves the moment you tap it, with a clear confirmation;
    - other people's profiles re-check every time you return to them;
    - photos load through fresh signed links.
- **Private photo storage (decision 4): built and tested, not on staging yet.**
  - The photos bucket is private. Photos are served only through 10-minute signed links that storage signs only for people allowed to see them (the person, approved followers, everyone for a Public account, MFA admins; never a blocked account).
  - **Held back from staging** until the key is fixed: your current app would show initials instead of photos until the new APK is installed, and the new APK can't be built safely until the variable is corrected.
- **Backups (decision 1): built and proven against staging.**
  - The nightly encrypted export and the monthly restore test with row-count checks are in place.
  - Backup database run 41160640010 dumped staging, encrypted it, restored it into a brand-new database and found **68 tables, 641 rows, every row count matching the live project**.
  - Real backups (kept 30 days) start once you add the two keys (Owner action 5); until then it runs as a self-test and keeps nothing.
- **Private repo (decision 2):** exact steps in `SECURITY-PLAN.md` §7.2; step 1 is yours (Owner action 6).
- **C4 race photos: planned only, nothing built.** I recommend building it right after the pilot (Phase 6b). Plan: `docs/plans/C4-RACE-PHOTOS.md`.
- **New APK: not yet.** It's blocked by the incident; I'll build, scan and emulator-check it as soon as the variable holds the public key again.

## 2. What changed
Commits on `phase-3`:

| Commit | Change | CI |
|---|---|---|
| `0f1da7f` | R2 keyboard fix + Android emulator UI check (Maestro; signs in with a throwaway staging account, deleted afterwards) | Passed; `main` fast-forwarded (app-only change, no deploy) |
| `e8e93e8` | Read-only photo visibility diagnostic | Failed: new `node-forge` advisories (fixed in `e67662f`) |
| `e67662f` | Private photo storage + signed links, privacy saves at once, profile re-checks; `node-forge` → 1.4.2 (5 new high advisories, Expo CLI only) | Passed |
| `2da9fc2` | Nightly encrypted backup + restore test | Passed |
| `369ec28` | Emulator check diagnostics; docs (C4 plan, backup and private-repo steps, retest round 4) | Superseded |
| `e741f58` | Guard against secret keys in builds; incident record | Passed on re-run (the first run had one failing website test; no website code changed since the last pass, so treated as flaky) |
| `2e7c772` | Backup check: ignore empty tables that only exist in the newer local version; emulator check prints its result | Running |

Runs:
- Android UI check:
  - old APK `c14d742a`: failed as expected (reproduces R2);
  - fixed build `dc8e29ea`: **passed**. This build contains the leaked key; it was never shared and was installed only on throwaway CI emulators.
- Staging diagnostics (photos): all pairs OK.
- Deleted logs: Mobile build run 41156724494 and Mobile build logs run 41159202485 (incident).

## 3. Owner actions (most urgent first)
1. **Rotate the leaked key:** Supabase → staging project → Project settings → API keys → Secret keys → delete the exposed `sb_secret_…` key. If you need a secret key, make a new one and keep it only in a GitHub **secret**.
2. **Fix the variable:** GitHub → Settings → Environments → staging → Variables → `SUPABASE_ANON_KEY` = the **anon** key (legacy anon JWT) or the **publishable** key (`sb_publishable_…`). Also add the same value as a repository **secret** named `SUPABASE_ANON_KEY`: workflows prefer it, and GitHub masks secrets in logs.
3. expo.dev → runlime → Builds → `dc8e29ea` → delete the build if the page allows it. Then tell me "key fixed": I'll deploy the private-photo update, build the APK, scan it and run the emulator check.
4. Tell me whether you changed `SUPABASE_ANON_KEY` (e.g. while moving to Supabase's new keys). It helps confirm the cause; no values please.
5. **Backup keys (10 min):** `SECURITY-PLAN.md` §7.1 steps A–C.
   - Make your own age key and keep it offline.
   - Make a restore-test key and save it as secret `BACKUP_RESTORE_KEY`.
   - Save both public keys as variable `BACKUP_AGE_RECIPIENTS`.
6. **Private repo, step 1:** `SECURITY-PLAN.md` §7.2. Copy the listed secrets and variables to repository level, then say "step 1 done".
7. C4: answer the 4 decisions in `docs/plans/C4-RACE-PHOTOS.md` §9 when convenient (no rush; nothing is built).

## 4. What to test
On the **new APK**, once it's built (link will be added here and in `docs/phase-3/RETEST.md`). Only the changed items: `RETEST.md` → "Retest round 4".
1. [App] R2.1: report box: type 6+ lines; the whole box stays visible and you can scroll to **Send report** with the keyboard open.
2. [App] R2.2: same on Edit profile, Suggest a race, Ask for a new club, Delete account, Sign in.
3. [App] R9.1–R9.4: Private → initials for a non-follower; tap **Public** (saves at once, green message); the other account sees the photo on returning to the profile; back to Private → initials.
4. [App] R9.5: an approved follower sees a Private account's photo.
5. [App + Website] R9.6: your own photo shows; Admin → Reports shows a reported photo.
6. [Website] R9.7 (optional): an old photo link no longer opens.

## 5. Not tested / known issues
- **Nothing tested on your phone yet.**
  - R2 is verified on an Android 14 emulator (Pixel 6 profile, Gboard), not on your phone's keyboard or Android version.
  - Only the report screen was checked on the emulator. The other screens use the same component and are covered by unit tests only.
- **R9 cause not proven** (see the summary). Privacy changes still aren't written to the audit log (profiles aren't audited; adding that would store personal data, so it's not done).
- **Private photo storage is not deployed to staging** (held for the incident); it passed CI (database tests, website end-to-end tests).
- **Backups:** proven against staging as a self-test (throwaway key). Not yet tested with your real keys; the first real nightly run will show "real" in its summary. Restore uses the local superuser (a real restore follows Supabase's guide). Storage files (photos) are not included.
- **One flaky website end-to-end test** on `e741f58` (passed on the single allowed re-run). I couldn't see which test: the log tool only returns the end of the log.
- **Emulator check:** two runs failed at app start (date-of-birth screen not shown within 60 s) and a third identical run passed. I can't tell whether the cause was slow emulator start-up or the leaked-key build. Treat the check as useful but occasionally flaky.
- **Google Play's policy pages are blocked in this cloud session**, so the C4 recheck used the Phase 3 sources plus secondary summaries. Apple 1.2 was read in full today.
- Photo signed links last 10 minutes and are reused for up to 8 minutes. A photo whose access is removed can stay visible on a phone for up to that long.

## 6. Confidence per item
| Item | Confidence | Evidence |
|---|---|---|
| R2 cause | 0.9 | React Native source + emulator: old build 233 px under the keyboard, fixed build clear |
| R2 fixed on your phone | 0.8 | Emulator + unit tests; phone keyboards differ |
| R9 fixed (photo shows after switching to Public) | 0.85 | Database test 027 (Private → Public → Private), app tests (instant save, signed links), live staging pairs |
| R9 root cause | 0.5 | Not provable from staging data |
| Private photo storage | 0.9 | Database test 027 (23 checks), website end-to-end test (signed link loads; stranger refused; old public link fails) |
| Backup + restore | 0.9 | Staging dump restored with all 68 tables' row counts matching (run 41160640010); local restore also passed |
| Incident contained | 0.7 | Logs deleted; guards added; **key not rotated yet** |
| Private-repo steps | 0.85 | Secrets/variables inventoried from all 16 workflows |
| C4 plan | 0.75 | See the plan's caveats |

## 7. Decisions needed
1. Rotate the key now (yes, please; see actions 1–3).
2. C4: when to build (after the pilot, recommended), plus the 4 decisions in the plan's §9.
3. After the incident: do you want testers told? I recommend a short note once the key is rotated.
