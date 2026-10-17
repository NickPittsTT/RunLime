# Repository audit before going private (2026-10-17)

## 1. Secrets and personal data in the repository and its history

| Check | How | Result |
|---|---|---|
| Secrets in any commit, any branch (67 commits) | gitleaks 8.28.0, default rules + RunLime rules (`.gitleaks.toml`: Supabase `sb_secret_`/`sbp_`/service_role JWT, Google OAuth `GOCSPX-`, Expo and Cloudflare tokens, emergency-contact key, private keys) | **None found** |
| The rules actually catch our key types | Planted realistic fake keys in a throwaway repo | All caught (service_role JWT, `sb_secret_`, `GOCSPX-`, emergency-contact key) |
| Owner's personal email, address, bank details, phone | `git grep` across every version of every file for the personal email, name, TT phone formats, IBAN/SWIFT/account numbers, TT bank names, street/P.O. box patterns | **No address, bank details or personal email.** All phone numbers are fictional `555` numbers |
| Owner's name | Same search | First name appeared once in PROGRESS.md (a quoted test greeting). **Removed from the current file.** It remains in older commits (no history rewrites, owner rule); it becomes private when the repo goes private |
| Commit identities | `git log --format` | All 67 commits authored as `Claude <noreply@anthropic.com>`; no personal email in commit metadata |
| Operator address | — | Never committed; lives only in the private `legal.operator_address` setting (admins with MFA) |

## 2. Logs never print secrets

- GitHub masks every repository/environment **secret** in logs. Values that are public by design (Supabase anon key, project ref, staging URL, EXPO_PUBLIC_*) are GitHub *variables* and may appear.
- Reviewed all 11 workflows: no `set -x`, `printenv`, env dumps or echo of secrets. The emergency-contact key workflow prints counts only; `configure-auth.mjs` masks the sender email and never prints the SMTP password (only "set/not set"); bootstrap prints the email being granted (the public support address).
- **Fixed:** `scripts/seed-dev.ts` printed the dev password and admins' TOTP secrets. No workflow runs it, but it now refuses to print them when run under CI.
- Workflow inputs (e.g. an email typed into "Bootstrap super admin") are visible in the run page; `operator_address` is deliberately not a workflow input.

## 3. CI blocks secret-like values

The CI "checks" job now runs gitleaks over the **whole history** on every run (pinned release, SHA-256 verified). Any secret-like value fails CI, and deploys refuse commits whose CI didn't pass. Run locally: `gitleaks git --config .gitleaks.toml .`.

## 4. GitHub Actions minutes

**Now:** the repository is public, so Actions minutes are free and **0 have been billed**. The private-repo allowance is **2,000 minutes/month** (Linux; each job is rounded up to the whole minute).

**Measured this month (11–17 Oct, private-repo equivalent, from real job timings):**

| Workflow | Runs | Billable min/run | Approx. minutes |
|---|---|---|---|
| CI (3 jobs: checks 1 + database 2 + E2E 5) | ~109 (about half were the same commit on `phase-2` and `main`) | ~8 | ~760 |
| Android build (runner idles while Expo builds) | 7 | ~16 | ~110 |
| Deploy web / Deploy database | ~45 effective | 1–2 | ~65 |
| Manual tools (bootstrap, settings, diagnostics, logs) | ~15 | 1 | ~15 |
| **Total** | | | **~950 in 7 days** → on course for ~4,000/month |

**Changes made:**
1. **No duplicate CI runs:** CI runs on the phase branch only (plus pull requests and manual runs). `main` is fast-forwarded only to a commit that already passed.
2. **Deploys** run on pushes to `main` that touch their files (web: `apps/web`, `packages`, lockfile; database: `supabase`, `docs/legal`, legal sync), and **refuse** a commit with no passing CI run.
3. **Docs-only changes skip CI** (`docs/**`, `*.md`), except `docs/legal/**`, which is synced to the database and tested.
4. **Superseded runs are cancelled** (newer push on the same branch cancels the older CI run).
5. **One database start instead of two:** pgTAP now runs inside the E2E job (saves ~2 min/run). The E2E job is **skipped** when only the mobile app or non-legal docs changed (Jest covers the app).
6. **The secret scan adds seconds to the existing checks job**, not a new job.
7. **Android builds don't wait** for Expo by default (saves ~15 min/build). "Mobile build logs" (blank build ID = latest) gives the APK link and signing SHA-1 when it's done (~2 min). Tick "wait" to get the old behaviour.

**Expected after the changes:** CI ~6–7 min per push to the phase branch (~2 min when only the app changed), deploys only when relevant, builds ~1 min to start + ~2 min to fetch. At an active pace of ~4 pushes a day, about **900–1,000 minutes/month**, under the 2,000 limit with room for build-heavy weeks. Pushing in batches keeps it lower.

**Before switching to private:** nothing else in the workflows depends on the repo being public. Expo, Supabase and Cloudflare keep working (they use stored tokens). Check usage any time in GitHub → Settings → Billing and plans → Usage.
