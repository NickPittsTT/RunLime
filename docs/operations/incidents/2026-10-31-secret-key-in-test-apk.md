# Incident 2026-10-31: false "secret key in APK" alarm, wrong diagnosis, unnecessary key deletion (S3, closed)

**Status:** closed (31 Oct 2026). **No key or secret was ever in an app build, a log or the repository.** The alarm was a false positive in our own build secret scanner. Claude's first diagnosis was wrong, and on that basis the owner deleted Supabase's auto-created secret key "default". That deletion broke nothing. This record replaces the version of 31 Oct 02:19 UTC, which wrongly said the GitHub variable `SUPABASE_ANON_KEY` had been changed.

## Cause (proven)
- **The scanner was wrong.** supabase-js contains the text `'sb_secret_'`: it checks whether a key is a secret key so it can refuse it in apps. In the compiled app bundle (Hermes), text constants are stored back to back. In build `dc8e29ea` (commit `0f1da7f`, the keyboard fix), the strings after `'sb_secret_'` happened to be library names:
  - `_disposeResources`
  - `creenEdgeGesture`
  - `adUint16LE`
  - `ExpoFontLoader`

  Together they are 58 characters with upper case, lower case and digits. Our scanner's "looks random" test (one upper, one lower, one digit) called that a key.
- **Proof:** Claude rebuilt the same commit's Android bundle locally with **no keys at all** in the environment (fake public values only). The scanner reported the identical "sb_secret_ + 58 random-looking characters". Inspecting the bytes shows the library names above. The previous build (`c14d742a`) passed only because its strings were packed in a different order.
- **The build used only the documented values.** It was started by the "Mobile build (Android)" workflow, which synced `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the variable `SUPABASE_ANON_KEY`. The owner confirmed (31 Oct) that this is the legacy **anon** key, unchanged for 2 weeks, and the Expo value matches it. Nothing came from Claude's session: no local `eas build`, no local `.env`, no Supabase CLI local keys, no `eas env:set` outside the workflow, and no override in the Android UI check (which only installs an already-built APK).

## Timeline (UTC)
| When | What |
|---|---|
| 30 Oct 21:47 | Build `c14d742a` (commit `51d0154`): scanner "none found" |
| 31 Oct 01:43 | Build `dc8e29ea` (commit `0f1da7f`) started by the Mobile build workflow; the sync step set the four public `EXPO_PUBLIC_` values (anon key, URL, Google web client ID, web URL) |
| 02:16 | "Mobile build logs" scanned `dc8e29ea`: **false positive** "Supabase secret key (sb_secret_ + 58 random-looking characters)" |
| 02:17–02:18 | Claude deleted the logs of the build run and the build-logs run (believing a value was exposed). The logs contained no secret; deleting them only lost history |
| 02:19 | Claude published a **wrong diagnosis**: the variable had been changed to a secret key, and the key should be revoked |
| 31 Oct (owner) | The owner deleted the Supabase secret key "default" (auto-created by Supabase with the project) and checked GitHub, Supabase and Expo: the variable and Expo values were the anon key, unchanged |
| 31 Oct ~11:00 | Claude reproduced the false positive locally; the read-only credentials audit confirmed nothing broke |

## Impact
- **No exposure:** no secret was in any APK, log, commit or the public website.
- **Deleting the "default" secret key broke nothing** (audit, 31 Oct):
  - no workflow, Edge Function or app uses the new-style secret keys;
  - the GitHub secret `SUPABASE_SERVICE_ROLE_KEY` is the legacy service_role JWT and still works (REST and Auth admin reads both HTTP 200);
  - the Edge Functions read the legacy `SUPABASE_SERVICE_ROLE_KEY`.
- **Cost:** owner time; two deleted Actions logs; a wrong alarm in the 30 Oct 22:30 and 22:45 reports (both stay as written; this record and LATEST.md correct them).
- **Testers:** no action needed. Their data was never exposed; a plain-language note is in LATEST.md if the owner wants to send one.

## Fixes
1. **Scanner** (`scripts/scan-build-secrets.mjs`):
   - It now checks the build against the project's **real** secret keys by exact value. `scripts/fetch-secret-values.mjs` reads them from the Management API, masks them, and reports only the key's name. This is what proves a real key is absent.
   - The pattern check ignores `sb_secret_` followed by joined words (long lowercase runs).
   - A self-test with fake values runs in CI (`scripts/scan-build-secrets.test.mjs`), including this exact false positive.
2. **Build guard** (`apps/mobile/build-guards/publicEnv.js`, called from `app.config.ts`): any build, local or EAS, fails if an `EXPO_PUBLIC_` value is a secret key, a service_role JWT, a private key or a service-account key. It names the variable and never prints the value.
3. **Boundary check** (`scripts/check-app-boundaries.mjs`, in CI): app code never reads a non-public environment variable, a service key, or anything in `scripts/` or `e2e/`. The app build workflow has no server credentials or test-account tooling. In the Android UI check, the service key is visible only to the two throwaway-account steps.
4. **Public-key guard** (`scripts/check-public-key.sh`, added 31 Oct): kept. The app build and web deploy refuse a "public" key that isn't an anon JWT or publishable key.
5. **Process rule** (CLAUDE.md, owner 31 Oct): Claude never creates, changes or deletes credentials, keys or environment variables in GitHub, Supabase, Expo, Firebase, Google Cloud or Cloudflare without asking first, except the documented build sync of public values. Every such change is listed in the report. Before calling something a leak, Claude reproduces it or checks the actual value source, and says how sure it is.

## Lessons
- A scanner hit is a claim to verify, not a fact. Reproduce before advising a rotation.
- "The value must have come from X" needs evidence (last-updated dates, the value's kind); the owner's checks found the truth in minutes.
- Deleting logs destroys evidence; next time, verify first.
