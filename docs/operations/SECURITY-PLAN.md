# RunLime security plan

**Owner:** Nicholas (decisions, accounts, key rotation) · **Maintainer:** Claude (code, tests, docs)
**Last updated:** 2026-10-24 · **Status of this plan:** "Now" items built; later items are proposals waiting for owner decisions.
Free tools only. Anything that costs money is marked **(cost)**.

## 1. Plan at a glance
| # | Item | When | Status (evidence) |
|---|---|---|---|
| 1 | RLS/grant/policy baseline test + Supabase Security Advisor in CI | Now | **Built.** `supabase/tests/024_security_baseline.test.sql` (12 checks, mutation-tested); splinter step in `ci.yml`; hosted advisor after every DB deploy (`scripts/hosted-advisor.mjs`) |
| 2 | Secret scan of the built web bundle and APK | Now | **Built.** `scripts/scan-build-secrets.mjs` in `ci.yml`, `deploy-web.yml` (before deploy), `mobile-build-logs.yml` (every APK). Real staging APK a90e523c scanned clean (1,453 files; staging service-role key, DB password and Expo token checked by value) after fixing two false-positive rules found on its first scan |
| 3 | Dependabot + `pnpm audit` (high/critical fails) + patch policy | Now | **Built** (§5). Alerts/security updates need one owner click (§9) |
| 4 | This plan: controls, risks, MASVS/ASVS | Now | **Written** |
| 5 | Incident response | Now | **Written:** `docs/operations/INCIDENT-RESPONSE.md` |
| 6 | Backups | Before pilot | Proposal §7.1 (owner decision) |
| 7 | Repo going private | Before pilot | Proposal §7.2 (owner decision; do not flip visibility first) |
| 8 | Turnstile, rate limits, headers, WAF | Before public launch | Proposal §7.3 |
| 9 | Separate production project; maintenance workflows can't touch it | Before public launch | Proposal §7.4 |

**Findings fixed while building "Now" (2026-10-24):**
- **Critical:** Next.js 16.3.8 (the live website) had two unauthenticated remote-code-execution advisories (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr). Upgraded to 16.4.3 with the Cloudflare adapter 1.20.13; the full browser suite passes on Cloudflare's runtime.
- **Advisor ERROR:** `club_member_counts` view ran with its owner's rights → now the caller's.
- **Over-broad grants:** anon/authenticated held every privilege (including TRUNCATE, which row security ignores) on six tables → trimmed; new tables now start with no API access.
- `has_role(role, any_user)` told anyone who the admins are → answers only about the caller. `setting_int` let anyone read private integer settings → server-only. Trigger functions were callable via `/rpc` → revoked.

## 2. Control inventory (what exists, with evidence)
| Area | Control | Evidence |
|---|---|---|
| Access control | Row security on every table in exposed schemas; no SECURITY DEFINER views | pgTAP 008, 024 (checks 1–2); CI |
| Access control | Signed-out visitors can only read public tables; signed-in direct writes only where a policy exists; everything else via checked RPCs | pgTAP 024 (checks 3–7) + per-feature tests 002–023 |
| Access control | Privileged functions pin `search_path = ''`; the anon-callable set is pinned | pgTAP 024 (8–9); CLAUDE.md convention |
| Access control | Admin rights need the role **and** MFA (`aal2`) | `is_admin()`; pgTAP 003 |
| Access control | `super_admin` only via bootstrap script | `scripts/bootstrap-super-admin.ts`, workflow |
| Advisor | Supabase splinter (pinned commit + checksum) in CI; hosted advisor after deploys | `ci.yml`, `scripts/security-advisor.mjs`, `scripts/hosted-advisor.mjs` |
| Authentication | Email OTP, Google, Apple; no passwords; 18+ checked on device, in the auth hook, profile trigger and `complete_signup` | pgTAP 001; mobile + e2e age-gate tests |
| Sessions (app) | Supabase session in the OS keystore (expo-secure-store, chunked), not AsyncStorage | `apps/mobile/src/lib/supabase.ts` |
| Sessions (web) | Supabase SSR cookie only (strictly necessary) | Privacy Policy §cookies |
| Abuse | Per-user rate limits on reports, follows, club/organiser/co-organiser requests, suggestions, org members (settings) | `check_rate_limit` in migrations; pgTAP |
| Audit | Append-only audit log; actors/subjects as aliases; allowlisted columns; reasons | pgTAP 005, 022 |
| Crypto | Emergency contact AES-256-GCM in an Edge Function; key in function secrets; rotation procedure | `supabase/functions/_shared/aesgcm.ts` + tests; `EMERGENCY-CONTACT-KEY.md` |
| Privacy | Data export and account deletion (app + web) | pgTAP 007, 009; e2e `participant.spec.ts` |
| Privacy | Photos: location/EXIF stripped server-side, size limits, random names | `_shared/jpeg.ts` tests; e2e `profile-photos.spec.ts` |
| Privacy | Children only as a count; organisers see totals | pgTAP 017; CLAUDE.md age policy |
| Edge Functions | CORS limited to the site; server-to-server functions use a shared secret with constant-time compare | `ALLOWED_ORIGINS`; `push-dispatch`, `admin-alerts` |
| Secrets | gitleaks over the whole history on every CI run; scripts never print secrets; masked logs | `ci.yml`, `.gitleaks.toml` |
| Secrets | No secret in shipped code: build/APK scan | `scripts/scan-build-secrets.mjs` (tested with planted secrets) |
| Supply chain | `pnpm audit` high/critical fails CI; Dependabot config; lockfile `--frozen-lockfile`; gitleaks binary checksum-pinned | `ci.yml`, `.github/dependabot.yml` |
| Delivery | Deploys only from `main`, which only moves to commits that passed CI; deploys refuse commits without a passing run | `deploy-*.yml` |
| Web headers | HSTS (2 years, preload), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; no `X-Powered-By` | `apps/web/next.config.ts` |
| Mobile platform | No camera/media-library permissions (Android photo picker); foreground location only (planned Phase 5) | `apps/mobile/app.config.ts` `blockedPermissions` |
| Moderation | Report queue, child safety first; admins alerted at once (bell + phone; email when configured) | pgTAP 016, 023; `admin-alerts` |

## 3. Risk register
Likelihood (L/M/H) · Impact (Low/Med/High/Critical) · **Owner** = who acts · **Due** = phase gate.
| ID | Risk | L | Impact | Mitigation (status) | Owner | Due |
|---|---|---|---|---|---|---|
| R1 | Service-role key or DB password leaks (full database access) | L | Critical | Never in clients (build/APK scan); only in GitHub/Supabase secrets; rotation runbook (IR) | Claude / Nicholas | Done; rotate on suspicion |
| R2 | A migration grants more than intended / disables RLS | M | High | pgTAP 024 + splinter in CI; default privileges fail closed | Claude | Done |
| R3 | Framework/dependency vulnerability (e.g. RCE) | M | Critical | CI audit, Dependabot, patch policy §5; Next.js RCE fixed 2026-10-24 | Claude | Done; ongoing |
| R4 | Admin account takeover (phishing, stolen phone) | L–M | Critical | TOTP MFA required; admin identities no longer queryable; every admin action audited. Next: passkey/hardware key for the Google account | Nicholas | Before pilot (Google account MFA + recovery codes) |
| R5 | Data loss with no restorable backup | M | High | §7.1 built (31 Oct): nightly encrypted export, monthly restore test with row-count check; real backups start once the owner adds the two keys | Owner (keys); Claude (built) | Before pilot |
| R6 | Free Supabase project pauses after ~7 days of low activity (outage) | M | Med | Monitor; keep-alive via real use or Pro **(cost)** at launch | Nicholas | Before pilot |
| R7 | Going private breaks deploys or drops protections (env secrets ignored on Free) | M | Med | §7.2 migration order; gitleaks stays | Nicholas + Claude | Before pilot |
| R8 | Bot sign-ups / OTP email abuse (Gmail ~500/day cap → nobody can sign in) | M | Med | Supabase Auth email rate limit (30/h, setting); Turnstile §7.3 | Claude | Before launch |
| R9 | XSS on the website (no Content-Security-Policy yet) | L | High | React escaping; no `dangerouslySetInnerHTML` of user text; CSP §7.3 | Claude | Before launch |
| R10 | Staging maintenance workflow run against production | L (no prod yet) | High | §7.4 guards | Claude | Before launch |
| R11 | runlimett@gmail.com compromised (sign-in codes, alerts, recovery) | L | High | 2-Step Verification on; app passwords only for SMTP; recovery codes offline | Nicholas | Before pilot |
| R12 | Staging APK signed with the public debug keystore (anyone can sign a look-alike update) | M (sideload) | Med | Pilot users install only from the link we send; production key + new Google client in Phase 8 (STORE-REQUIREMENTS #18) | Claude / Nicholas | Phase 8 |
| R13 | Expo push without an access token: anyone holding a device token can send it notifications | L | Low–Med | Enable Expo "enhanced push security" (free) and give push-dispatch the token | Claude / Nicholas | Before launch |
| R14 | Child-safety report missed or slow | L | Critical | Urgent bell + phone alerts (done), email at once (needs owner setup), 48 h policy; CSAM route (attorney) | Nicholas | Before pilot (email setup) |
| R15 | Personal data or secrets in public CI logs | M | Med | Masking, name-only printing, gitleaks; repo private §7.2 | Claude | Ongoing |
| R16 | Compromised third-party GitHub Action (tags can move) | L–M | High | Pin actions to commit SHAs; Dependabot (actions) keeps them current | Claude | Before launch |
| R17 | Firebase Android API key in the APK is abused (it is public by design) | L | Low | Restrict the key to package `tt.runlime.app.dev` + signing SHA-1 in Google Cloud (free) | Nicholas | Before pilot |
| R18 | Edge Function abuse (expensive calls, spam uploads) | L | Med | JWT required except two secret-protected server functions; per-user upload limits (1 MB, size checks) | Claude | Before launch (add per-user rate limit to `profile-photo`) |
| R19 | A signed-out phone keeps getting an account's notifications (owner retest 6.11, 2026-10-30): the token row outlived a sign-out whose unregister call failed | M (was happening) | High (privacy) | **Fixed:** each token is tied to its sign-in session; the server sends only to tokens whose session is alive (`push_targets`), so ending a sign-in stops pushes even if the phone was offline; sign-out and account deletion delete the token, retried at next start; switching accounts moves the token; hourly purge of orphans. Evidence: pgTAP 025 (14 checks), app tests Push + SignOut | Claude | Done (owner retest R1 pending) |

## 4. Standards mapping
### OWASP MASVS v2 (mobile app)
| Category | What we do | Gaps / next |
|---|---|---|
| MASVS-STORAGE | Session in the OS keystore; no sensitive data in logs; emergency contact never stored on the phone in clear | Check backups exclude app data (Android `allowBackup`) — Phase 8 |
| MASVS-CRYPTO | No custom crypto in the app; TLS to Supabase; server-side AES-GCM for emergency contact | — |
| MASVS-AUTH | Server-side authorization (RLS/RPC); OTP/OAuth; admin MFA (web only) | Re-authentication before account deletion is by typed "DELETE" only — consider fresh OTP (Phase 7) |
| MASVS-NETWORK | HTTPS only (Supabase, Expo, OpenFreeMap) | Certificate pinning not planned (Supabase/CDN rotation risk); revisit Phase 8 |
| MASVS-PLATFORM | Minimal permissions (photo picker, no camera/media); deep links only to app screens; notification permission after explainer | Review intent filters before Phase 8 |
| MASVS-CODE | Dependency audit; build scan; TypeScript strict + zod at boundaries | Production build signing (R12) |
| MASVS-RESILIENCE | Not targeted (no paid content to protect in v1) | Revisit with Premium (Phase 7) |
| MASVS-PRIVACY | Data minimisation, export/deletion, 18+, children as counts, Privacy Policy, third-party register | Play Data safety form (Phase 8) |

### OWASP ASVS 4.0.3 (web + API) — chapter numbering of 4.0.3
| Chapter | What we do | Gaps / next |
|---|---|---|
| V1 Architecture | RLS-first design; RPC-only writes; documented data flows (Privacy Policy, register) | Threat model per new feature (Phase 4 location) |
| V2 Authentication | Passwordless OTP, OAuth; admin TOTP | Turnstile; passkeys for admins (later) |
| V3 Session | Supabase-managed JWT + refresh; SSR cookie | Review cookie flags on the custom domain (launch) |
| V4 Access Control | RLS + pgTAP per feature; 024 baseline; `has_role` fixed | — |
| V5 Validation | zod at every boundary; DB checks/constraints; length limits | CSP as defence in depth (§7.3) |
| V6 Cryptography | AES-256-GCM, keys in secrets, rotation doc | — |
| V7 Errors & Logging | Audit log (append-only, pseudonymised); no stack traces to users | Central alerting on function errors (later) |
| V8 Data Protection | Minimal collection; export/deletion; EXIF stripping; private settings | Backups encrypted (§7.1) |
| V9 Communications | HTTPS everywhere; HSTS preload | Custom domain + HSTS preload submission (launch) |
| V10 Malicious Code | Audit, Dependabot, lockfile, pinned gitleaks/splinter | Pin GitHub Actions to SHAs (R16) |
| V11 Business Logic | Rate limits; speed-check tiers (Phase 6); organiser message limits | Load/abuse tests before launch |
| V12 Files | JPEG-only, re-encoded, size limits, random names, public bucket without listing | — |
| V13 API | PostgREST RPCs with explicit grants; anon set pinned | Rate limiting at the edge (§7.3) |
| V14 Configuration | Security headers; secrets out of repo; build scan; advisor | CSP; production separation (§7.4) |

## 5. Patch policy
| Severity (GitHub/npm advisory) | Deadline to fix or mitigate in production | Who |
|---|---|---|
| Critical | **72 hours** from the alert | Claude fixes on the phase branch → CI → deploy; owner told within 24 h |
| High | 7 days | Claude |
| Moderate | 30 days or the next release | Claude |
| Low | When convenient | Claude |

- **Sources:** CI `pnpm audit --audit-level=high` (fails the build), Dependabot alerts and security-update PRs, Supabase advisor results.
- **Exceptions** only when no fix exists or the code never ships (developer tooling). Each needs a reason, a review date at most 30 days out, and an entry in `package.json` → `pnpm.auditConfig.ignoreGhsas`.
- A failing audit on an unrelated change is still work now: fix, or record an exception with a reason.

**Current exceptions** (review dates per row; the first two by **2026-11-23**):
| Advisory | Package | Why it's accepted for now |
|---|---|---|
| GHSA-86w9-cpqp-85rv (high) | node-forge 1.4.0 via `expo` → `@expo/cli` | No patched version exists. Used only by Expo's developer CLI on a developer machine/EAS builder (local HTTPS certs); not in the app or website |
| GHSA-mrhx-c7xc-m3w5 (high) | zod 3.25.76 via `@expo/cli` | Fix only in zod 4 (breaking for Expo's CLI). Memory exhaustion while the CLI validates its own config; not reachable by users. Our code uses zod 4.6.6 |
| GHSA-qr28-fpjm-wq7f (high, found by CI 2026-10-30) | decode-uri-component 0.2.2 via `expo-router` → `query-string` 7 | Ships in the app, but **no compatible fix exists for Expo SDK 57**: the only fixed version (0.5.1) is ESM-only, and overriding it made `query-string` crash at runtime (verified: "decodeComponent is not a function"; Jest and the Metro bundle did not catch it). Impact: a crafted RunLime deep link with a huge malformed `%` sequence could make the app slow to respond; no data exposure. Fixed by the Expo SDK 58 upgrade (`expo-router` 58 no longer uses `query-string`). **Review by 2026-11-29**; alternative if the owner prefers: a small vetted CommonJS replacement (shim) now |

## 6. CI security gates (all free)
1. gitleaks — whole history (checks job)
2. `pnpm audit --audit-level=high` (checks job)
3. pgTAP incl. 024 baseline (e2e-web job)
4. Supabase splinter, fail on ERROR (e2e-web job)
5. Build secret scan of the web bundle (e2e-web job), again before each staging web deploy with staging secrets, and on each APK
6. Hosted Security Advisor after each database deploy (fails the run as an alert)

## 7. Proposals for later items (owner decisions)
### 7.1 Backups (owner decision 1, 31 Oct 2026: free export for the pilot, Supabase Pro at public launch). **Built: "Backup database" workflow.**
Supabase Free keeps no backup we can restore, so:
- **Nightly at 03:17 Port of Spain:** dump staging (roles, schema, data) with the Supabase CLI.
- **Encrypted with age** to two public keys: the owner's (the private key stays only with the owner, never on GitHub) and a restore-test key (its private half is the GitHub secret `BACKUP_RESTORE_KEY`).
- **Kept 30 days** as an encrypted Actions artifact (about 2 min a night).
- **On the 1st of each month (or "Run workflow"):** decrypt with the restore-test key, restore into a brand-new local Supabase in Supabase's documented order, and compare every table's row count with the live project (Supabase's own version tables excluded). The result is in the run summary.
- **Until the keys exist** it runs a self-test with a throwaway key (proves dump → encrypt → restore against staging) and keeps nothing.
- **Not included:** storage files (profile photos). People can re-upload, and the photo rows are in the dump.
- **Trade-off:** the restore-test key can decrypt backups, so it is as sensitive as the database password; rotate it in the incident runbook.
- **Owner key setup (once, ~10 min).** Install age: age-encryption.org, Windows/macOS/Linux builds, free.
  - **A. Your own key:** run `age-keygen -o runlime-backup-owner.key`. Keep that file in your password manager plus one offline copy, never in GitHub or chat. The command prints a public key (`age1…`).
  - **B. Restore-test key:** run `age-keygen -o restore-test.key`. Put the whole file content into the repository secret `BACKUP_RESTORE_KEY`, then delete the file.
  - **C.** Create the repository variable `BACKUP_AGE_RECIPIENTS` = the two public keys separated by a space (your `age1…` from A, then the one `age-keygen -y restore-test.key` prints, run before deleting the file). Public keys are not secret.
  - **To restore a backup yourself:** download the artifact, run `age -d -i runlime-backup-owner.key -o backup.tar.gz <file>.age`, then follow Supabase's restore guide (roles.sql, schema.sql, then data.sql).
- **At public launch: Supabase Pro (cost, about US$25/month):** 7 days of daily backups with dashboard restore, and no inactivity pausing (R6). Keep this export too.

### 7.2 Repo going private (owner decision 2, 31 Oct 2026): do these in order
On GitHub Free, **environments and environment secrets don't work in private repos**. Repository-level secrets and variables do. So the values move from the "staging" environment to the repository first, while the repo is still public and everything can be checked.

**Step 1 (owner, ~15 min), now.** GitHub → RunLime → Settings → Secrets and variables → Actions.
- On the **Secrets** tab, choose **New repository secret** for each name below. Copy each value from its source (GitHub never shows saved values). No values in chat.

  | Repository secret | Where the value comes from |
  |---|---|
  | `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access tokens (the staging-only token, or a new one) |
  | `SUPABASE_DB_PASSWORD` | Supabase → staging project → Settings → Database (reset it if unknown, then update both places) |
  | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → staging project → Settings → API keys (service_role / secret key) |
  | `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens (the Workers deploy token, or roll a new one) |
  | `EXPO_TOKEN` | expo.dev → Account settings → Access tokens (skip if it's already a repository secret) |
  | `SMTP_PASSWORD` | The Gmail app password used for admin alert emails (skip if you never set it) |
  | `BACKUP_RESTORE_KEY` | New: the restore-test private key from §7.1 step B (straight to repository level) |

- On the **Variables** tab, choose **New repository variable** for each name below. Copy the values from Settings → Environments → staging; these values are not secret.

  | Repository variable |
  |---|
  | `SUPABASE_PROJECT_REF` |
  | `SUPABASE_ANON_KEY` |
  | `CLOUDFLARE_ACCOUNT_ID` |
  | `STAGING_WEB_URL` |
  | `GOOGLE_WEB_CLIENT_ID` |
  | `BACKUP_AGE_RECIPIENTS` (new, from §7.1) |

- Then tell Claude "step 1 done". Not needed: `FCM_SERVICE_ACCOUNT_JSON` (it was deleted after the one-time upload).

**Step 2 (Claude, same day).**
- Remove `environment:` from the 16 workflows.
- Add a guard step to each: it refuses to run unless `SUPABASE_PROJECT_REF` is the staging project, and refuses `target: production` until production exists (§7.4).
- Then verify, while the repo is still public: CI, Deploy database, Deploy web, an APK build plus Mobile build logs, Backup database (self-test or real), Android UI check, and Staging diagnostics. All must be green.

**Step 3 (owner, 5 min), after Claude reports step 2 green.** Settings → Environments → staging → delete each secret and variable listed above, so the values exist in one place only.

**Step 4 (owner), straight after step 3.** Settings → General → Danger Zone → **Change repository visibility** → Private. Then Claude re-runs CI and one deploy to confirm. What changes:
- 2,000 free Actions minutes a month (current use is about 1,000; the nightly backup adds about 60, and the emulator check about 15 per run).
- No GitHub secret scanning or push protection; gitleaks in CI stays the guard.
- No environment protection rules; production protection moves to workflow guards (§7.4).

**Step 5 (later, Phase 8).** Production secrets get a `PROD_` prefix and are read only by the production deploy workflows (§7.4).

### 7.3 Before public launch: abuse and browser hardening (free)
- **Cloudflare Turnstile** on sign-in/sign-up (web and app via Supabase Auth's built-in CAPTCHA support): free.
- **Rate limits:**
  - Supabase Auth limits: OTP sends per hour per IP and per email (settings).
  - Per-user limits on `profile-photo` uploads.
  - Cloudflare rate-limiting rule (free plan includes one rule) on `/auth`-type paths.
- **Headers:** add a strict **Content-Security-Policy** with per-request nonces (Next.js proxy), `frame-ancestors 'none'` (X-Frame-Options already DENY), `connect-src` limited to Supabase, Expo and OpenFreeMap, `worker-src blob:` for MapLibre. HSTS is already set. Tested with the Playwright suite in report-only mode first.
- **Cloudflare free WAF** managed rules + custom rules **need a zone (the custom domain)**; `*.workers.dev` can't have WAF rules. The domain is already planned before launch **(cost: domain registration, ≈ US$10–15/year)**.

### 7.4 Before public launch: separate production
- A **second Supabase project** for production. Supabase Free allows 2 active projects, so it's free, but production should be Pro **(cost)** per §7.1.
- **Maintenance workflows can never target production:**
  - Correct event date, Staging diagnostics, Delete staging event, Set legal setting and Configure push/admin alerts hard-code the staging project ref. They refuse to run if `SUPABASE_PROJECT_REF` differs, or if any `PROD_*` secret is referenced.
  - A CI test (grep over `.github/workflows`) fails if a maintenance workflow mentions `PROD_`.
- Production deploys:
  - Manual dispatch from `main` only, with a typed confirmation input.
  - A separate workflow file reading `PROD_*` secrets only, and a CODEOWNERS entry for `.github/workflows/`.
- Seed script already refuses production (`assertNonProduction`).

## 8. Review
Revisit this plan at every phase gate and after any incident (`INCIDENT-RESPONSE.md`). Update the risk register when a feature adds new data (Phase 4: location attempts; Phase 5: run tracks).

## 9. Owner actions
0. ~~Replace `SUPABASE_ACCESS_TOKEN`~~ **done 2026-10-30** (staging-only token, 90-day expiry; renew by 2027-01-21, PROGRESS "Waiting on the owner" item 8). Deploy database #64 applied the hardening migration.
1. **Turn on Dependabot alerts and security updates:** GitHub → RunLime → Settings → Advanced Security (or "Code security") → **Dependency graph: On**, **Dependabot alerts: Enable**, **Dependabot security updates: Enable**. (GitHub refused these API calls from this session.)
2. Confirm 2-Step Verification and recovery codes on runlimett@gmail.com (R11).
3. Restrict the Firebase Android API key (R17), free:
   1. console.cloud.google.com → choose project **runlime-a3849** → **APIs & Services → Credentials**.
   2. Under **API keys**, open the key named like "Android key (auto created by Firebase)".
   3. **Application restrictions → Android apps → Add**: package name `tt.runlime.app.dev`, SHA-1 fingerprint `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (the staging APK signing key; Mobile build logs prints it for every build).
   4. **API restrictions → Restrict key**: tick **Firebase Installations API** and **FCM Registration API** (add **Firebase Cloud Messaging API** if it is listed). Leave others unticked.
   5. **Save**, wait 5 minutes, open the app once while signed in, then send yourself a race update: it must still arrive. If it doesn't, set API restrictions back to "Don't restrict key" and tell Claude.
   A Phase 8 production key gets the production package and signing SHA-1.
4. Decide §7.1 (backups) and §7.2 (private repo, in that order).
