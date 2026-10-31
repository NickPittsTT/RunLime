# Incident 2026-10-31: Supabase secret key built into a test APK (S1, staging)

**Status:** contained by Claude (logs deleted, guards added). **Waiting on the owner to rotate the key.** No secret values appear in this record.

## What happened
| Time (UTC, 31 Oct) | Event |
|---|---|
| 30 Oct 21:47 | Last clean build (EAS `c14d742a`): APK secret scan "none found" |
| between 30 Oct 21:47 and 31 Oct 01:43 | The GitHub variable `SUPABASE_ANON_KEY` (staging environment) was changed to a value starting `sb_secret_`, a Supabase **secret** key. Not changed by Claude (no session tool can edit variables) |
| 01:43 | Claude started a test build ("Mobile build (Android)" run 41156724494) for the emulator keyboard check. The workflow copies that variable into the app (`EXPO_PUBLIC_SUPABASE_ANON_KEY`). GitHub does not mask variables, so **the value was visible in that run's public log** |
| 02:16 | "Mobile build logs" (run 41159202485) scanned the APK (EAS `dc8e29ea`): **secret found** in `index.android.bundle`, and the run printed the APK's download link |
| 02:17–02:18 | Claude deleted the logs of both runs. The APK was never given to anyone; it was installed only on throwaway CI emulators |

Exposure: the key was readable in a public Actions log for about 35 minutes, and in an unlisted APK on expo.dev whose link was public for about 2 minutes. **Treat it as compromised:** it bypasses all row security on staging (test data: the owner's and testers' accounts, emails, profiles, RSVPs, follows, reports).

## Contain (owner, now)
1. **Supabase → staging project → Project settings → API keys → Secret keys:** delete (revoke) the exposed secret key. If anything needs a secret key, create a new one and store it **only as a GitHub secret**, never a variable.
2. **GitHub → Settings → Environments → staging → Variables → `SUPABASE_ANON_KEY`:** put back the **anon** key (legacy "anon" JWT) or the **publishable** key (`sb_publishable_…`). Better: also add it as a repository **secret** named `SUPABASE_ANON_KEY`; workflows now prefer the secret, which GitHub masks in logs.
3. **expo.dev → runlime → Builds → `dc8e29ea`:** delete the build if the page offers it (removes the APK download).
4. If you're unsure whether the leaked key is the one in the `SUPABASE_SERVICE_ROLE_KEY` secret: rotate that too (runbook table), then tell Claude to re-run Configure push / admin alerts.

## Assess (Claude, after rotation)
- Staging diagnostics: look for activity not explained by our own runs between 01:43 and the rotation (auth audit log, new rows by unknown actors, storage changes).
- Confirm the hosted Security Advisor and the staging security baseline still pass.

## Root cause and fixes (done, commit after this record)
- **Cause:** a secret value was put in a variable that the builds treat as public, and nothing checked what kind of key it was before building.
- **Fixes:**
  - `scripts/check-public-key.sh` refuses to build the app or deploy the website unless the key is a publishable key or an anon JWT (it checks the JWT role), and never prints it;
  - every workflow reads `secrets.SUPABASE_ANON_KEY` first, so the key can be masked;
  - the existing APK secret scan caught the leak.
- **Gap:** the scan only runs when "Mobile build logs" is run. The test build had already been uploaded to EAS by then. The new guard closes this before the build starts.

## Notify
- Staging only, test accounts of the owner and two testers; no outside users. The owner decides whether testers are told (recommendation: yes, a short note once the key is rotated).
