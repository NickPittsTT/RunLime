# Health check (25 Nov 2026, 08:15 Port of Spain)

**Verdict: Action needed.**
- Staging is **up and not paused**, so no resume was needed and none was done.
- The Supabase **Management API token (`SUPABASE_ACCESS_TOKEN`) has been invalid since 7 Nov**. Because of that:
  - **no backup has been kept at all** (and none could have been: the backup keys were never set up);
  - deploys, the security baseline, the Security Advisor and the push diagnostic can't run.
- The token fix and the backup keys are both yours to do (credentials rule); steps are in §3.

Confidence: **High** = I read it in a log or response today. **Medium** = inferred. **Low** = not checked.

## 1. Every item
| Area | Item | Result | Evidence (25 Nov unless dated) | Confidence |
|---|---|---|---|---|
| Supabase | Project status | **OK: active, not paused** | REST read with the anon key: HTTP 200, 3 races. REST + Auth admin reads with the service key: HTTP 200. Exact status, date and restore window need the Management API, which is down (couldn't check) | High that it's up |
| Supabase | Resume | **Not needed, not done** | The project answers normally | High |
| Supabase | Management API token | **Problem: invalid since 7 Nov** | Every Management API call returns `401 {"message":"Invalid access token"}`. Backups worked on 6 Nov 15:03 UTC; the first 401 was 7 Nov 14:02 UTC. Most likely cause: the token made on 30 Oct got a short expiry (e.g. 7 days) instead of 90 days (inferred, not checked). It **won't last until 21 Jan 2027 as planned** | High (invalid); Medium (cause) |
| Supabase | Security baseline (12/12) | **Couldn't check** | Needs the Management API: 401 | — |
| Supabase | Security Advisor (0 ERROR) | **Couldn't check** | Same. Last result: 0 ERROR on 1 Nov (Deploy database #68) | — |
| Supabase | Auth health | **OK** | Auth admin read HTTP 200; 3 accounts | High |
| Supabase | Auth settings | **Partly checked: OK** | Public settings: sign-in with **Google + email** enabled; signups open; email autoconfirm off; phone off. MFA, redirect URLs, Site URL, SMTP sender and hooks need the Management API (couldn't check). Last verified: Site URL, MFA and hook probes all OK on 31 Oct (Configure auth #11) | High (public part) |
| Supabase | Races list | **OK** | 3 races (published/postponed/cancelled) via the anon key; the PSCU 5K's full change history is intact | High |
| Supabase | Storage buckets | **OK** | `avatars` private; `event-media` public | High |
| Supabase | Edge Functions | **OK (deployed)** | Called with no key: emergency-contact, emergency-contact-keys, export-user-data and profile-photo answer 401 (sign-in required); push-dispatch and admin-alerts answer 403 (shared secret required). None are missing (404) | High |
| Supabase | Vault entries | **Couldn't check** | Needs the Management API | — |
| Supabase | pg_cron jobs (attempt purge etc.) | **Couldn't check** | Needs the Management API (the `cron` schema isn't reachable through REST) | — |
| Supabase | Data (row counts) | **OK for test data** | Accounts 3; profiles 3; user_roles 4; consents 6; regions 21; countries 1; app_settings 45; legal_documents 21; organisations 2; events 3; event_distances 3; event_changes 28; event_messages 4; rsvps 2; follows 3; clubs 3; club_members 2; reports 4; notifications 31; push_tokens 1; race_suggestions 2; **check_ins / checkin_attempts / runs / venues: 0**. The zeros are expected: emulator test data is deleted after each run, and your phone test hasn't happened yet | High (counts); Medium ("expected") |
| Supabase | API keys | **OK** | Legacy anon and service_role both work. Whether new keys were created needs the Management API (couldn't check). Evidence against: the GitHub secret is still the legacy service_role JWT | High (work); — (new keys) |
| GitHub | Scheduled workflows | **Problem** | Only one is scheduled: **Backup database**. It succeeded daily from 1 to 6 Nov, then **failed every day 7–24 Nov (18 failures)** with the token 401. No other scheduled jobs exist (the check-in purge is a database pg_cron job, not GitHub) | High |
| GitHub | Workflows disabled | **OK** | All 18 workflows `active`. None disabled | High |
| GitHub | Other workflow runs since 1 Nov | **OK** | CI, deploys and builds ran on 1 Nov (all ours). After that, only Dependabot runs and the daily backup | High |
| GitHub | Backups since 31 Oct | **Problem: none kept** | 1–6 Nov were **self-tests** (no keys → throwaway key, nothing kept); 7–24 Nov failed before dumping. **No encrypted backup file exists.** Steps in §3 | High |
| GitHub | Commits | **OK** | No commits on `main` since 1 Nov (last `884420e`, ours). Dependabot branches only | High |
| GitHub | Branches | **OK** | main, phase-1, phase-2, phase-3, phase-4-5, plus 2 Dependabot branches | High |
| GitHub | Collaborators | **OK** | Only you (admin) | High |
| GitHub | Deploy keys, webhooks | **Couldn't check** | My GitHub tools can't list them. Check: Settings → Deploy keys / Webhooks (expect none) | — |
| GitHub | Secrets and variables | **Couldn't check names/changes** | My tools can't list them. What I could see: `SUPABASE_SERVICE_ROLE_KEY` is still the legacy service_role key and works; `EXPO_TOKEN` works; `SUPABASE_ACCESS_TOKEN` is invalid; `BACKUP_AGE_RECIPIENTS` and `BACKUP_RESTORE_KEY` are **empty / not set** | High (those items) |
| GitHub | Dependabot PRs | **1 not safe, 1 probably safe** | **#5** (37 npm minor/patch updates): CI **fails** (lint + mobile tests). Don't merge; it needs a fix branch. **#2** (6 GitHub Actions updates, e.g. checkout v7): CI **passed** 1 Nov. Probably safe, but it changes every workflow, so merge it only after the token is fixed, then run a deploy + backup to confirm | High |
| GitHub | 60-day schedule rule | **Risk (time)** | Last commit on `main`: 1 Nov. GitHub disables scheduled workflows in public repos after 60 days without activity (around 31 Dec if nothing happens). See §4 | Medium (exact date) |
| Expo | Builds since 1 Nov | **OK** | Only our 3 on 1 Nov (95784967, ee523162, 4e591520). None you didn't start. **November: 3 of 15 used** | High |
| Expo | Environment variables | **OK** | Preview: 4 `EXPO_PUBLIC_*` (PUBLIC; the anon key is the legacy anon JWT), updated 1 Nov 07:43 by our build sync; `GOOGLE_SERVICES_JSON` (SENSITIVE), unchanged since 18 Oct. Development/production: empty | High |
| Expo | FCM credentials | **OK** | `tt.runlime.app.dev`: FCM V1 key attached (project runlime-a3849) | High |
| Push | Read-only push diagnostic | **Couldn't check** | Its database queries need the Management API (401). The FCM part passed (row above) | — |
| Cloudflare | Website responds | **Couldn't check** | This session's network can't reach workers.dev (DNS blocked here; that isn't a sign the site is down). Last deploy: **1 Nov 01:51 UTC** (Deploy web #42, success) | — |
| Cloudflare | Website → Supabase | **Couldn't check directly** | Supabase answers the same anon-key query the website uses (row 1) | Medium |

## 2. What went wrong, and when
1. **Token, 7 Nov.** `SUPABASE_ACCESS_TOKEN` stopped working between 6 Nov 15:03 UTC and 7 Nov 14:02 UTC.
   - Everything that uses the Supabase Management API has failed since then: backups, Deploy database, Deploy web, the security baseline, the Security Advisor and the push/credentials diagnostics.
   - Nothing tried to deploy in that time, so the only visible failures are the 18 backup runs.
   - If GitHub notifications for Actions are on, you probably got failure emails for these.
2. **Backups never kept anything.** Even while the token worked (1–6 Nov), the backup ran only as a self-test, because the two backup keys (§7.1) were never added. **We have no backup of staging.** It's test data, so the loss risk is low, but the pilot will have real data.
3. **Staging did not pause.** Supabase's free plan pauses projects after about 7 days of low activity, but staging is up today. I can't see why or when its status last changed without the Management API. Don't rely on it staying up (§4).

## 3. What you need to do (credentials rule: these are yours)
**A. Replace the Supabase access token (about 5 min). This fixes backups, deploys and checks.**
1. supabase.com → your avatar → **Account preferences → Access tokens**. Look at the token made on 30 Oct: if its expiry says 6–7 Nov, that confirms the cause.
2. Choose **Generate new token**: name `runlime-github-actions`, the **longest expiry offered**. Copy it once.
3. GitHub → RunLime → Settings → **Environments → staging** → secret `SUPABASE_ACCESS_TOKEN` → **Update** → paste. (It's also needed at repository level only after private-repo step 1, §7.2.)
4. Revoke the expired token in Supabase.
5. Tell me. I'll then run, read-only: the baseline, the Security Advisor, the credentials audit (keys, Vault, Auth settings, Edge Function secrets) and the push diagnostic, plus one backup run.

**B. Backup keys (SECURITY-PLAN §7.1, about 10 min).** Install age (age-encryption.org; free), then:
1. `age-keygen -o runlime-backup-owner.key`. Keep this file in your password manager plus one offline copy, never in GitHub or chat. Note the `age1…` public key it prints.
2. `age-keygen -o restore-test.key`, then `age-keygen -y restore-test.key` (note this second `age1…` public key).
3. GitHub → Settings → Secrets and variables → Actions:
   - **New repository secret** `BACKUP_RESTORE_KEY` = the whole content of `restore-test.key`.
   - **New repository variable** `BACKUP_AGE_RECIPIENTS` = the two public keys separated by a space.
4. Delete `restore-test.key` from your computer.
5. Tell me. I'll run "Backup database" with the restore test and confirm an encrypted file was kept and restored (row counts must match).

## 4. Prevention (plans only; nothing added)
- **Keep-alive (free).** A scheduled GitHub workflow every 2 days (and on demand) that reads one row with the public anon key, e.g. `events?select=id&limit=1`. It's read-only, uses no Management API and no secret beyond the public key, and fails loudly (GitHub emails you) if the project is paused or the key stops working. It costs about 10 seconds of Actions time. Once the token is fixed, the nightly backup also touches the database daily. **Say yes and I'll add it.**
- **Token expiry alarm.** Add a monthly step that calls the Management API once and fails if it gets 401, so we'd hear within days, not weeks. It can go in the same keep-alive workflow.
- **60-day rule.** GitHub disables scheduled workflows in a public repo after 60 days without repository activity (commits). Last commit on `main`: 1 Nov, so around **31 Dec** without activity. GitHub says it notifies the repository before disabling and shows a banner on the Actions tab (I couldn't confirm the exact notice from here); re-enabling is one click (Actions → the workflow → Enable). Any commit resets the clock, and normal Phase 6 work will keep it active. The keep-alive alone does **not** count as activity.
- **Free-plan pausing.** Inactive free projects pause after about a week, and a paused project can be restored from the dashboard within a limited window. The keep-alive avoids this; Supabase Pro at launch removes it (SECURITY-PLAN R6).

## 5. Project status
- **Phase 3:** approved by you (31 Oct).
- **Phase 4+5:** built, CI-tested, live on staging since 1 Nov. Emulator checks passed on the phone APK `4e591520` (link in `docs/phase-4-5/TEST-SCRIPT.md`).
  - **Your outdoor phone test is still outstanding.** Staging shows no real check-ins or runs.
  - Not approved; that's yours after the test.
- **Phase 6:** planned (`docs/phase-6/PLAN.md`), not started. It waits for your answers to decisions D1–D14 and your Phase 4/5 approval.
- **Pilot date:** 28/29 Nov is no longer possible.
  - The Phase 6 must-haves are about 14–18 working days of work after your go-ahead, plus your phone test and fixes.
  - If you test this week and answer D1–D14 by ~30 Nov, the earliest realistic full pilot is **mid-January 2027 (e.g. Sat 16 / Sun 17 Jan)**, after the holidays. Confidence 0.6.
  - **First December race (fallback):** only realistic as a **reduced pilot** that tests Phase 4+5 alone (GPS check-in + run tracking at a real race, no community times or leaderboards), under the pilot notice and consent from Phase 6 slice 6.0 (about 2 days of work). Confidence 0.7 if your phone test passes this week.
  - Your choice; I recommend the reduced December pilot followed by the full January pilot.

## 6. Changes I made (credentials rule)
- **No credentials, keys, tokens, variables, plans or billing were touched. Staging was not resumed (it wasn't paused).**
- Read-only workflow runs today: Staging diagnostics #22–#27 (api-cache-headers, event-history, credentials-audit, security-baseline, push, rest-health).
- **One repository change:** a new read-only diagnostic, `rest-health` (`scripts/staging-rest-health.mjs` + an option in Staging diagnostics). It's on branch `phase-4-5` (commit `6260139`, CI #180 green). It reads counts, names and status codes only, using the existing keys, so health can be checked without the Management API.
  - It is **not on `main`**: I tried to fast-forward `main` and that was blocked as outside "read-only". It's yours to approve; it will reach `main` with the next approved push.
- This report: docs only, on `main`.
