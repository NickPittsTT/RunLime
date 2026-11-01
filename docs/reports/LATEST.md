# Report: round-4 APK ready (31 Oct 2026, 21:30 Port of Spain)

**Round-4 APK (phase-3 only): https://expo.dev/artifacts/eas/0YUIc4AMHOdTMWVQLoVe4GSgBv0MqPzzPyqi0IY6HyI.apk**

Install it over the old app. Then do **RETEST round 4**: the full R2 retest plus the quick R9 recheck (`docs/phase-3/RETEST.md`).

**No phase is approved.** Phase 3 waits for your R2 result. Phases 4 and 5 are **not** on staging and stay off it until you say R2 passed.

## 1. What happened tonight (in order; each step only after the previous one passed)
| Step | Result | Evidence | Confidence |
|---|---|---|---|
| 1. Android build from `phase-3` (staging profile) | **Done.** EAS build `95784967-55c3-41db-838a-9caf4f4d1006`, commit `27e2a0c`. No Phase 4/5 code: that code exists only on `phase-4-5` | "Mobile build (Android)" run #17; build status FINISHED | High |
| 2. Exact-value secret scan of the APK | **Passed.** 1453 files scanned; checked against 7 patterns and 5 real secret values by name, including the project's service-role key: **none found** | "Mobile build logs" run #18 | High |
| 3. Android UI check (emulator, Android 14, Pixel 6), R2 keyboard | **Passed.** With the keyboard open (keyboard top at 1517 px), "Tell us what happened" ends at 1476 px and "Send report" ends at 1476 px: both fully visible. The throwaway test account was deleted afterwards | "Android UI check" run #6 (screenshots kept 14 days as a run artifact) | High (emulator); **your phone is the real test (R2)** |
| 4. Private-photo database update on staging | **Applied:** only `20261031000100_private_avatars` (no Phase 4/5 migrations). Functions were redeployed unchanged and legal documents re-published (unchanged versions). The hosted Security Advisor reports **no ERROR findings** (82 WARN/INFO, the same kinds as before) | "Deploy database" run #67 (manual, staging, from `phase-3`) | High |
| 5. Staging security baseline | **All 12 checks passed**, including "private photos: visible_avatar used by people lists, not callable by apps" and "row security on every public table" | "Staging diagnostics" run #20 | High |
| 6. APK link in RETEST round 4 and at the top of this report | Done | This file; RETEST.md | High |

**Note:** the database update is live, so **the old app now shows initials instead of photos**. Install the new APK before testing photos, as RETEST says.

## 2. Expo builds
- November so far: **1 of 15** used (this build).
- Phase 4+5 may use at most 3 more builds after your R2 result.

## 3. Credentials rule: every change and sync
- **Build sync of public values** (the documented exception): the build synced the four public values to the Expo "preview" environment:
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the public anon key; the build guard checks it isn't a secret key)
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_WEB_URL`
- **Nothing else** was created, changed or deleted: no credentials, keys, tokens or environment variables in GitHub, Supabase, Expo, Firebase, Google Cloud or Cloudflare.

## 4. Next
1. **You:** install the APK, then do R2 (full) and R9.1–R9.3. Report pass or fail per step.
2. **When you say R2 passed:**
   - deploy Phase 4/5 to staging (database and website together);
   - run the emulator mock-location check;
   - build the combined Phase 4+5 APK (counts toward the 3-build limit);
   - then your outdoor test (`docs/phase-4-5/TEST-SCRIPT.md`).
3. **Waiting on you:** the backup keys (§7.1 of the backup doc) and private-repo step 1, which you planned for after tonight's APK.

Earlier today: Phase 4+5 built, then your decisions applied (`2026-10-31-1630-owner-decisions-applied.md`).
