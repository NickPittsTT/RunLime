# Report: Phase 3 retest round 3 fixes (30 Oct 2026)

Phase 3 is **not approved**. Only the owner approves it, after testing.

## 1. Summary
- **B1 (privacy, top priority), cause found and fixed.** A phone's notification token outlived a sign-out: the app's "remove my phone" call could fail silently (offline or slow), and nothing on the server tied a token to a sign-in. Staging data showed account A's token row unchanged since 24 Oct, through sign-outs. Now every token is tied to its sign-in session, and the server sends **only** to tokens whose sign-in is still alive. Ending a sign-in therefore stops notifications even if the phone was offline. Sign-out and account deletion delete the token on the server, retried at the next app start if they fail. Signing in moves the token to the new account only.
- **F1.4** (no notification after switching accounts and back): the staging logs show the 11:46 message *was* delivered to account A's phone. The most likely cause was the silent notification channel (B8), so it arrived without sound or banner. This is not certain; retest R1.5 checks it.
- **Fixed:** B2–B6 and B8. **Done:** B7 (RETEST updated) and B9 (runners pinned). **Built:** C1 (message limits) and C2 (private photos).
- **Live on staging:** database deploy #65, web deploy #39, staging security check 12/12, hosted Security Advisor with 0 errors.
- **New APK:** https://expo.dev/artifacts/eas/riM5Nd_cBRJI0XDt5urUP9UAP7ylqfmvHrdKwjoFShA.apk (EAS build `c14d742a`, secret scan: none found, Firebase config: yes).

## 2. What changed
Commits on `phase-3`:
- `c9d46e8` fix: owner retest round 3 (all code changes below). CI #138 passed; `main` was fast-forwarded to it.
- `51d0154` docs(security): token renewed; Firebase key restriction steps.
- `029ae86` ci(diagnostics): staging checks for round 3. Its push CI run was cancelled on purpose, to protect the Ubuntu 26.04 test. CI #142 then passed on this commit (on Ubuntu 26.04), and `main` was fast-forwarded to it.

Deploys and runs:
- Deploy database #65 and Deploy web #39: success.
- Staging diagnostics #16 (security-baseline): 12/12 PASS.
- Mobile build: EAS build `c14d742a` (from `51d0154`, same app code as `c9d46e8`). Mobile build logs #16: finished, signing SHA-1 unchanged, Firebase config in the APK, **no secrets found**.
- CI #142 on **Ubuntu 26.04**: both jobs passed (lint, typecheck, unit tests, secret scan, dependency audit, database tests, Security Advisor, website build and end-to-end tests).

Detail:
- **B1:**
  - New database migration `20261030000100`: tokens carry the sign-in session id; `push_targets` (server only) returns live-session tokens; hourly clean-up of orphan tokens; the phone can remove its own token while signed out.
  - App: stores its token, deletes it on sign-out, keeps a "pending removal" if offline and retries at start.
  - Tests: database file 025 (14 checks: sign-out, switching, deletion, purge); app tests Push (7) and SignOut (3).
- **B2:** the focused text box scrolls fully into view when it gets focus, when the keyboard opens and while it grows. Multi-line boxes stop at about a third of the screen and scroll inside. App test KeyboardReveal (6). Applies to every screen built with the shared text field.
- **B3:** the server now rejects a nickname already in use (any case) with "That nickname is already taken. Choose another, or leave it empty." Other errors are specific too: still loading terms, expired sign-in, no permission, or a code number instead of only "Something went wrong". App test Errors (7); database test 026.
- **B4:** the Team section (Organiser → Settings → organisation) already had the fields, but showed them only to organisation **owners**; managers saw an empty section. Managers now see who the owners are and that only owners add people. Website end-to-end test: the owner sees the fields.
- **B5:** the Home list now pads for the measured height of the Start run bar. App test HomeScreen.
- **B6:** the app forgets the Google account on sign-out (with a 3-second limit, never blocking) and before every Google sign-in, so Android's chooser always shows. This also covers account deletion, which signs out. App test SignOut.
- **B7:** `docs/phase-3/RETEST.md` has a new "Retest round 3" section. Every step is marked [App] or [Website], the message-limit note comes first, and steps R1–R9 cover each fix.
- **B8:** a new Android channel `race-alerts`: maximum importance (sound, vibration, pop-up banner, lock screen). The old channels are removed.
- **B9:** all 15 workflows are pinned to `ubuntu-24.04`, so they don't move to Ubuntu 26 automatically. CI can be run on `ubuntu-26.04` from "Run workflow" to test it first.
- **C1:**
  - Organisers get 3 updates per race in any 7 days (`messages.per_race_per_week` = 3) and 10 in the 7 days before the race (new `messages.race_week_limit` = 10). The race date used is the postponed date when postponed.
  - Admins are exempt. Their messages are marked as admin messages, audit-logged, and don't use the organiser's allowance. Automatic postponed/cancelled/back-on notices are never counted.
  - The website form shows "N of M left" and the race-week explanation.
  - Both settings were set to the new defaults by the deploy (verified on staging).
  - Tests: database test 026; website end-to-end test.
- **C2:**
  - Photos on Private accounts are shown only to the person, approved followers and admins. Everyone else sees initials: search, profiles, follow requests, who's going, club lists. Public accounts show the photo to everyone signed in. Admins see photos in Reports.
  - Privacy Policy is now draft 5 and attorney note (1) is marked resolved. Moderation Policy is draft 3 (message limits).
  - Tests: database test 026; app test AvatarPrivacy.
- **0a:** the new token works: Deploy database #64 and #65 succeeded, hardening migration `20261024000100` is live, and the hosted advisor ran.
- **Other changes:**
  - New audit exception for a high-severity issue in an Expo command-line dependency (`decode-uri-component`, used only by the build tools, not shipped in the app). Forcing a newer version broke the app, so the fix is the Expo SDK 58 upgrade (in the backlog; review by 29 Nov).
  - Risk register: new risk R19 (B1).
  - PROGRESS: token renewal reminder.

## 3. Owner actions
1. **Install the new APK and run RETEST.md "Retest round 3"** (R1 first: the privacy fix).
2. **Dependabot (S1):** GitHub → RunLime → Settings → **Advanced Security**. Make sure **Dependency graph**, **Dependabot alerts** and **Dependabot security updates** are all on. Version updates are confirmed on (PR #1 and today's Dependabot run). The other three toggles couldn't be checked from here: GitHub refused those API calls (403), so their state is **unknown**, not "off".
3. **Firebase key (S2):** follow `docs/operations/SECURITY-PLAN.md` §9 item 3 (Google Cloud → project runlime-a3849 → APIs & Services → Credentials → the Firebase Android key → restrict to package `tt.runlime.app.dev` + the signing SHA-1 → allow only Firebase Installations and FCM Registration APIs). Then send yourself a race update to confirm it still arrives.
4. **Renew `SUPABASE_ACCESS_TOKEN` by 21 Jan 2027.** It expires about 28 Jan 2027 (assumes it was created on 30 Oct; check the exact date in Supabase → Access tokens).
5. **Decide backups (S3).** Options:
   - **Free:** a nightly encrypted export, kept 30 days, with a monthly tested restore. Claude builds it; the private key stays only with you.
   - **Supabase Pro (cost, about US$25/month):** 7 days of daily backups with one-click restore, and the project never pauses.
   - Recommended: Free for the pilot, Pro at public launch.
6. **Decide the private-repo move (S4):** a 5-step order that keeps every workflow working (`SECURITY-PLAN.md` §7.2). Copy the environment secrets to repository secrets while public; Claude switches the workflows and verifies CI, deploys and APK; then the old secrets are deleted and the repo made private. Cost to watch: 2,000 free Actions minutes/month (use is about 1,000).

## 4. What to test
APK: https://expo.dev/artifacts/eas/riM5Nd_cBRJI0XDt5urUP9UAP7ylqfmvHrdKwjoFShA.apk (EAS build `c14d742a`). It installs over the old app (same signing key). Open it once while signed in.
1. [App] R1: sign out, then send a message from the website: **no** notification. Switching accounts, an offline sign-out and account deletion are steps R1.4–R1.7.
2. [App] R2: the report box and every text box stay fully visible as they grow.
3. [App] R3: a taken nickname on Finish setting up shows the clear message.
4. [Website] R4: owner sees the Team fields; manager sees who to ask.
5. [App] R5: the last race card scrolls clear of Start run.
6. [App] R6: the Google chooser shows every time.
7. [App] R7: notifications make a sound and show a banner.
8. [Website] R8: message limits (admin not limited; organiser 3, race week 10).
9. [App + Website] R9: Private-account photos show initials to non-followers.

Note: the message limit can block notification tests. Send from an admin account (not limited), or use postpone → back on.

## 5. Not tested / known issues
- **Nothing tested on a real phone yet.** Notifications, keyboard behaviour, the Google chooser and sound/banner are covered only by automated tests and code review.
- **Photo links:** the photos bucket is publicly readable. Paths include a random part, so they can't be guessed, but someone who already saw a photo link can keep opening it until that photo is changed.
- **B4:** the manager view has no automated test (it needs a second email sign-in in the test). I'm not sure "Add a team" meant this screen; R4.2 asks.
- **C1:** the organiser's own view of the limit is tested in the database (3, blocked 4th, race week 10), not by a website test signed in as an organiser.
- **F1.4:** cause not proven (see the summary).
- **B9:** CI passes on Ubuntu 26.04 (CI #142). Deploy and build workflows were not run on 26.04; they stay pinned to 24.04 until switched on purpose (a one-line change per workflow, later).
- **Supabase logs:** the auth-log endpoint can't be queried from here, so B1 diagnosis used database rows (sessions, tokens, notifications), not auth logs.
- **Local end-to-end run:** 4 website tests first failed locally because of leftover test data and stopped local server functions. After fixing that, all passed. CI is the reference.

## 6. Confidence per item
| Item | Confidence | Evidence |
|---|---|---|
| B1 server side (no pushes after a sign-in ends) | 0.9 | database test 025; staging check |
| B1 end to end on a phone | 0.75 | not phone-tested |
| F1.4 cause (silent channel) | 0.6 | delivery receipt OK on staging |
| B2 keyboard | 0.7 | unit tests only; phone layout varies |
| B3 nickname message | 0.85 | database test 026, app test Errors |
| B4 Team section | 0.7 | owner end-to-end test; unsure it's the right screen |
| B5 padding | 0.85 | app test |
| B6 Google chooser | 0.75 | app test; not phone-tested |
| B7 RETEST | 0.95 | document |
| B8 sound/banner | 0.8 | channel settings; Android can keep old user choices per channel, hence the new channel id |
| B9 runners | 0.9 | all workflows pinned to 24.04; CI #142 green on 26.04 |
| C1 limits | 0.9 | database test 026, website end-to-end test, staging setting check |
| C2 private photos | 0.85 | database test 026, app test, staging check |
| 0a token / migration live | 0.95 | deploys #64/#65, staging check 12/12 |
| Security Advisor | 0.95 | hosted: 80 findings, 0 ERROR |

## 7. Decisions needed
1. Backups: Free nightly export now, Pro (cost) at launch? (S3)
2. When to make the repo private (S4)?
3. Was "Add a team" the organisation Team section (B4)?
