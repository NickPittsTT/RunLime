# Report: incident correction, credentials audit, prevention (31 Oct 2026, 07:32 Port of Spain)

Phase 3 is **not approved**. Only the owner approves it.

## 1. Summary
- **Correction: there was no leaked key.** The "secret key in the APK" alarm was a **false positive in our own build scanner**. My earlier diagnosis (that the GitHub variable had been changed and a key had leaked) was **wrong**, and I'm sorry it cost you time and an unnecessary key deletion.
  - **Proof:** I rebuilt the same commit's Android bundle locally with **no keys at all** in the environment, and the scanner raised the identical alarm. What followed `sb_secret_` in the bundle was supabase-js's own check text plus four library names packed together (`_disposeResources`, `creenEdgeGesture`, `adUint16LE`, `ExpoFontLoader`).
  - The corrected record is `docs/operations/incidents/2026-10-31-secret-key-in-test-apk.md`.
- **Deleting the "default" secret key broke nothing.** Nothing we run uses new-style secret keys. The key our workflows use is the legacy service_role key, and it still works.
- **Read-only audit: clean.**
  - No secret is stored as a variable.
  - Every Expo `EXPO_PUBLIC_` value is public, and the app's key is the legacy anon key.
  - One low-priority item: the Auth "Site URL" still says `http://localhost:3000`.
- **Prevention is in and tested (CI passed on `f7d90fd`):**
  - builds fail if an `EXPO_PUBLIC_` value looks secret;
  - the APK and web scans check the project's **real** secret keys by exact value;
  - the scanner no longer mistakes packed words for a key;
  - app code and the app build can't reach server credentials or test-account tooling;
  - the credentials rule is in CLAUDE.md.
- **New APK: not yet.** Expo's free plan has no Android builds left this month; it resets in about 12 hours (1 Nov).
  - I'll build, scan and emulator-check it then (scheduled for 00:45 UTC, i.e. 20:45 Port of Spain tonight).
  - The **database part of the private-photo update waits for that APK**, so your current app keeps showing photos in the meantime. The website part is deployed (web deploy on `f7d90fd`) and works either way.
- **C4:** your four decisions are recorded in `docs/plans/C4-RACE-PHOTOS.md` §9, PROGRESS.md and the CLAUDE.md decisions log (plan only; build after the pilot as Phase 6b).

## 2. Root cause (your question 1)
- **How the alarm happened:**
  - Build `dc8e29ea` was started by the **"Mobile build (Android)" workflow** (31 Oct 01:43 UTC, commit `0f1da7f`), not from my session. There was no local `eas build`, no local `.env`, no Supabase CLI local keys, no `eas env:set` outside the workflow's documented sync, and no override in the Android UI check (it only installs an already-built APK).
  - The only key compiled in was `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The workflow synced it from the variable `SUPABASE_ANON_KEY`, which is the legacy **anon** key, as you confirmed and the audit shows ("legacy JWT, role anon").
  - **No key, staging or local, was in the build.** The "key" the scanner reported was supabase-js's text `'sb_secret_'` followed by library names.
- **Was anything else exposed?** No.
  - The two logs I deleted contained only the APK link and the public build settings.
  - The repository history has no real `sb_secret_` value (I searched all commits; only the scanner's own patterns and report text appear).
- **Why I got it wrong:**
  - I treated a scanner hit as fact.
  - I assumed the value came from the variable without checking its kind or last-updated date.
  - I deleted logs (evidence) before verifying.

  The new rule and the scanner changes address all three.

## 3. Read-only audit (your question 2): names, types, dates and states only
Source: "Staging diagnostics → credentials-audit", runs 41194952273 and 41195569030 (`scripts/credentials-audit.mjs`). GitHub's API doesn't let workflows list secrets or their dates, so the GitHub table combines the workflow files (which names are used where) with what you reported.

### GitHub
| Name | Stored as | Used by | Status |
|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | staging env secret | deploy-database, deploy-web (scan), staging-diagnostics, backup, mobile-build-logs (scan) | OK (replaced by you 30 Oct) |
| `SUPABASE_DB_PASSWORD` | staging env secret | deploy-database, backup, mobile-build-logs (scan only) | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | staging env secret | deploy-database, configure-*, diagnostics, android-ui-check (throwaway-account steps only), scans (by value) | **Legacy service_role JWT; works** (REST and Auth admin both HTTP 200) |
| `CLOUDFLARE_API_TOKEN` | staging env secret | deploy-web | OK |
| `EXPO_TOKEN` | secret (repository level; not among the staging env secrets you listed) | mobile builds, build logs, UI check, diagnostics | OK |
| `SUPABASE_ANON_KEY` | **repository variable** | mobile-dev-build (sync), deploy-web build, configure-auth, correct-event-date, diagnostics | Public anon key, unchanged 2 weeks (owner). Correct as a variable |
| `SUPABASE_PROJECT_REF`, `CLOUDFLARE_ACCOUNT_ID`, `STAGING_WEB_URL`, `GOOGLE_WEB_CLIENT_ID` | variables | various | Public values; correct as variables |
| `SMTP_PASSWORD`, `FCM_SERVICE_ACCOUNT_JSON` | (not present) | configure-admin-alerts, upload-fcm-key | Expected absent: the FCM key was deleted after upload; SMTP lives in Supabase |
| `BACKUP_AGE_RECIPIENTS`, `BACKUP_RESTORE_KEY` | (not yet) | backup-database | Your §7.1 step |

Flags:
- **Public key stored as a secret:** none.
- **Secret stored as a variable:** none.

### Supabase (project RunLime-Staging, the only project visible to the token)
| Item | State |
|---|---|
| API keys | `anon` (legacy, public); `service_role` (legacy, secret, used by workflows and functions); `default` publishable key (created 11 Oct). The secret key `default` is **deleted** (by you). No other secret keys exist |
| Who uses which | Workflows: legacy service_role (GitHub secret). Edge Functions: legacy `SUPABASE_SERVICE_ROLE_KEY` (auto-provided). App and website: legacy anon. Nothing uses new secret keys |
| Edge Function secrets (names) | ALLOWED_ORIGINS, EMERGENCY_CONTACT_KEY_V1, EMERGENCY_CONTACT_KEY_VERSION, PUSH_DISPATCH_SECRET, and Supabase's built-ins (SUPABASE_URL, _ANON_KEY, _SERVICE_ROLE_KEY, _DB_URL, _JWKS, _PUBLISHABLE_KEYS, _SECRET_KEYS) |
| Functions | emergency-contact, export-user-data, emergency-contact-keys, profile-photo (sign-in required); push-dispatch, admin-alerts (no sign-in; protected by their own secrets) |
| Vault (names) | push_dispatch_secret, push_dispatch_url (18 Oct) |
| Storage | `avatars`: **public** until the private-photo migration is deployed (with the APK). `event-media`: public by design (published race flyers) |
| Auth | Email + Google sign-in; TOTP MFA on; redirect allow list `runlime://auth/callback`; SMTP via Gmail, sender name "RunLime", 30 emails/hour; before-user-created hook (18+) and access-token hook on; **Site URL `http://localhost:3000`** (see actions) |
| Security Advisor | Last hosted run (deploy 30 Oct): 0 errors |

### Expo
- **Variables:**
  - preview environment: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (legacy anon JWT), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_WEB_URL`, all PUBLIC, set 31 Oct 01:44 by the build workflow's sync. `GOOGLE_SERVICES_JSON` is SENSITIVE (18 Oct).
  - development and production: none.
  - **No variable looks secret.**
- **Builds:** 15 recent Android builds, all staging; `dc8e29ea` is the false alarm. No build used a non-public key (all were built from the same synced values).
- **Credentials** (FCM key record, keystore): the CLI can't list these without an interactive session; please glance at expo.dev → Credentials if you want them confirmed.

### Other questions
- **Use of the deleted key in staging logs:** I can't query Supabase's logs API from here (it has been unavailable to this session since 24 Oct). Because the key was never exposed, there was nothing outside Supabase that could have used it. If you want to look anyway: Supabase → Logs → API Gateway, last 7 days, filter on the `apikey` field starting with `sb_secret`.
- **What broke when "default" was deleted:** nothing (evidence above). Re-create a secret key only when we migrate to new keys (Phase 8).

### Things to change, most urgent first
1. **None urgent.**
2. Low: Supabase → Authentication → URL Configuration → **Site URL** = the staging website URL (it says `http://localhost:3000`). Our email codes don't use links, so nothing is broken; it matters for any future email link. **I won't change it without your OK.**
3. Optional: glance at expo.dev → Credentials (FCM V1 key record present; one Android keystore).
4. Phase 8: least-privilege production token; move to new API keys (publishable + secret) together.

## 4. Prevention (your question 3), all in CI and passing on `f7d90fd`
- **Build guard** (`apps/mobile/build-guards/publicEnv.js`, run by `app.config.ts`): every build, local or EAS, fails if any `EXPO_PUBLIC_` value is a secret key, a service_role JWT, a private key or a service-account key. It names the variable and never prints the value. Unit tests: BuildGuard (4).
- **Scanner** (`scripts/scan-build-secrets.mjs`):
  - It checks the build against the project's **real** secret keys by exact value. `scripts/fetch-secret-values.mjs` reads them from the Management API, masks them, and reports only the key's name. Used by Mobile build logs and Deploy web.
  - Packed words no longer count.
  - A self-test with fake values runs in CI (5 cases, including this exact false positive).
  - The rebuilt bundle that raised the alarm now scans clean.
- **Boundaries** (`scripts/check-app-boundaries.mjs`, in CI):
  - app code never reads a non-public environment variable, a service key, or `scripts/` or `e2e/`;
  - the app build workflow has no server credentials or test-account tooling;
  - in the Android UI check, the service key is visible only to the two throwaway-account steps.
- **Public-key guard** (`scripts/check-public-key.sh`, kept): the app build and web deploy refuse a "public" key that isn't an anon JWT or publishable key.
- **Credentials rule:** added to CLAUDE.md (security conventions + decisions log) and SECURITY-PLAN §4a: I ask before creating, changing or deleting any credential, key or environment variable in GitHub, Supabase, Expo, Firebase, Google Cloud or Cloudflare (except the documented public build sync), and list every such change here.
- **Gitleaks:** my first self-test commit used a realistic fake key, which our repository scan rightly flagged. The test now builds a low-entropy fake at runtime, and `.gitleaks.toml` allowlists only that fake value from the two earlier commits.

### Every credential or environment change in this session (credentials rule)
| When (UTC) | What | By |
|---|---|---|
| 30 Oct 21:47, 31 Oct 01:43, 31 Oct 11:21 | Expo preview: the 4 public `EXPO_PUBLIC_` values re-synced (same values) by "Mobile build (Android)" | Documented build sync |
| 31 Oct 01:43–02:22 | Staging: 4 throwaway test accounts (`ui-check-…@example.com`) created and deleted by "Android UI check"; one-time sign-in codes from the admin API | Workflow (no credentials changed) |
| 31 Oct 02:17–02:18 | Deleted the logs of 2 Actions runs (no secrets were in them; done in error) | Claude |
| 31 Oct (you) | Deleted the Supabase secret key "default" | Owner, on my wrong advice |

Nothing else: I created, changed or deleted no keys, tokens, secrets or variables in GitHub, Supabase, Expo, Firebase, Google Cloud or Cloudflare.

### Note for your testers (plain language; send if you wish)
> Hi! A quick note about the RunLime test app. On 31 October our automatic safety check raised an alarm that a private password-like key might have ended up inside a test version of the app. We checked carefully: it was a false alarm, and no key or personal information was exposed. As an extra precaution we switched off the key in question. Everything you see in the test app is test data on a test system. You don't need to do anything. Thank you for helping us test!

## 5. What changed
| Commit | Change | CI |
|---|---|---|
| `aa51ed5` | Read-only credentials audit | n/a (diagnostic) |
| `3702234` | Incident correction + prevention (guards, scanner, boundaries, rule, docs, C4 decisions) | Failed: gitleaks flagged my realistic fake test key |
| `06c66e1` | Fake built at runtime + allowlist | Failed: generic-key rule on the array form |
| `f7d90fd` | Low-entropy fake; allowlist covers both earlier commits | **Passed**; `main` fast-forwarded; Deploy web passed (new exact-value scan) |

Runs:
- Mobile build (Android) on `f7d90fd`: refused, Expo free monthly build allowance used up (resets about 1 Nov 00:00 UTC).
- Deploy database: **not run** (held for the APK; see Summary).

## 6. What to test
**Nothing new yet.** The round-4 APK comes after the Expo allowance resets; its link will go into `docs/phase-3/RETEST.md` "Retest round 4" and this report. Steps: R2.1–R2.2 (keyboard), R9.1–R9.7 (Private → Public → Private, private photo storage).

## 7. Not tested / known issues
- APK not built (Expo free allowance).
- The private-photo database change is not on staging yet (waits for the APK).
- Expo credentials records not listed (CLI limitation).
- Supabase logs not queryable from here.
- GitHub secret and variable dates come from you, not from the audit.
- The emulator check remains occasionally flaky at app start.

## 8. Confidence per item
| Item | Confidence | Evidence |
|---|---|---|
| No key was ever in a build, log or commit | 0.97 | Local reproduction with no keys; byte inspection; history search; audit of value kinds |
| Deleting "default" broke nothing | 0.95 | Audit: legacy service_role in use and working; no code reads new secret keys |
| Guards stop a real secret reaching an app build | 0.9 | Unit tests + CI self-tests (fake values); exact-value scan wired into build logs and web deploy (web deploy passed with it) |
| Audit completeness | 0.8 | GitHub dates and Expo credentials not readable from here |
| R2 / R9 / private photos | unchanged from the 22:45 report | APK pending |

## 9. Decisions needed
1. OK to set the Supabase Auth **Site URL** to the staging website URL (low priority)? I'll only change it if you say yes.
2. Backups and the private repo: ready when you are. §7.1 (backup keys) can be done any time. For §7.2 step 1, please wait until after tonight's APK build, so the switch doesn't overlap it; then say "step 1 done".
