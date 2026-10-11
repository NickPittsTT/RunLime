# Phase 2 plan — prepared, NOT started (waiting for Phase 1 approval)

## Task 1 (first): Android development build on your phone
Free-tier only, Android only (iOS and Apple sign-in are deferred until there's a paid Apple Developer account).

What I'll do once Phase 1 is approved and the accounts below exist:
1. Add `expo-dev-client` and an `android` development profile to `eas.json`.
2. Add a GitHub workflow, **"Mobile dev build"**, that runs `eas build --profile development --platform android` on Expo's servers. It uses your `EXPO_TOKEN` from GitHub secrets, so I never see it.
3. Point the build at the **staging** Supabase project (`fmnmylqxrmxuzmdcvmhs`):
   - apply migrations
   - deploy Edge Functions
   - publish the legal drafts
   - configure Auth with a `[remotes.staging]` block in `supabase/config.toml` plus `supabase config push`, run from GitHub Actions
4. Give you the install link (an APK from expo.dev) and the test script below.

Free-tier limits that apply (no card needed):

| Service | Free allowance | Our use |
|---|---|---|
| Expo EAS (Free) | 30 builds/month (max 15 iOS), lower-priority queue | ~2–6 Android builds/month |
| Supabase (Free) | 2 projects; a project **pauses after 7 days without activity** (you un-pause it in the dashboard); built-in email: **very low hourly limit, and only to addresses that are members of your Supabase organisation** | staging only; test with your own email |
| GitHub Actions (private repo, Free) | 2,000 runner-minutes/month | ~10 minutes per CI run |
| Google Cloud OAuth client | free, no card for OAuth clients | Google sign-in |

Two things to confirm in your Supabase dashboard (I can't see it). If either is paid-only on the Free plan, I'll stop and tell you before relying on it:
- **Auth → Hooks:** "Before User Created" and "Custom Access Token" are available on your plan.
- **Auth → Multi-Factor:** TOTP is enabled. TOTP is free on every plan as far as I know. Only phone MFA is paid.

### Decision needed: free web host (the portal + legal pages)
Vercel Pro is on hold. Vercel's free **Hobby plan forbids commercial use**, and RunLime is commercial. Free options:

| Option | Commercial use on free plan | Effort | Recommendation |
|---|---|---|---|
| **Cloudflare Workers (Free) + OpenNext** | Allowed | Medium (adapter for Next.js) | ✅ Recommended |
| Netlify (Free) | Allowed (credit-based limits) | Low | OK alternative |
| Vercel Hobby | Not allowed | Lowest | ✗ Not compliant |

Phase 2's first task doesn't need the web host. The phone build only opens the legal pages, which I can point at a temporary staging URL as soon as you choose.

## Test script for your phone (use after installing the build)
Use **your own email**, the one on your Supabase account, so the free built-in mailer can reach you. Each line has an expected result; tick or note what happened.

**A. Age gate (first screen, before any sign-in)**
1. Open RunLime. Expect: the first screen asks only for your date of birth, with no Google or email buttons.
2. Enter a date that makes you **17** (e.g. today's day and month, 17 years ago) and tap Continue. Expect: "Sorry, you can't create a RunLime account", and no sign-in options.
3. Close the app completely, reopen it. Expect: still the "Sorry" screen. This lasts 24 hours on this phone, with nothing sent to the server.
4. Android Settings → Apps → RunLime (dev) → Storage → **Clear storage**. Reopen. Expect: the date of birth question again.

**B. Email sign-in**
5. Enter your real adult date of birth → Continue. Expect: the sign-in screen with "Continue with Google" and an email box.
6. Enter your email → "Email me a code". Expect: an email "Your RunLime sign-in code" within ~1 minute. If nothing arrives after 5 minutes, tell me; it's probably the free mailer's hourly limit.
7. Enter the 6 digits → Sign in. Expect: "Finish setting up".
8. Fill in Display name, Nickname (optional), Home area, tick the terms box (open "Read the Terms" to check the link works) → Create my account. Expect: the Profile screen "Hi, <name>" showing your area and **Private**.

**C. Profile**
9. Edit profile & privacy → change the nickname and the area → switch to **Public** → Save. Expect: the Profile screen shows the new values.
10. Emergency contact → enter a name and phone → Save → go back and reopen. Expect: the details reload. (They're encrypted; only you can see them.)
11. Your data → Download my data. Expect: an Android share sheet with `runlime-my-data.json`. Save it and check it contains your profile.
12. Sign out → reopen the app. Expect: the date of birth question again (you're signed out).

**D. Google sign-in** (after the Google Cloud setup below)
13. Enter your adult DOB → **Continue with Google** → choose your Google account. Expect: "Finish setting up" (new account), or the Profile screen if this Google email already has a RunLime account.
14. Edge case: if you force-close the app on "Finish setting up" and reopen it, expect to be asked your date of birth again before anything is saved.

**E. Account deletion**
15. Profile → Delete account → type `DELETE` → Delete my account. Expect: you're signed out and back at the date of birth question.
16. Sign in again with the same email. Expect: "Finish setting up" (a brand-new account; the old one is gone).
17. Delete this second account too, so staging is clean.

Report back: the step number, what you expected, what happened, and a screenshot if possible.

## Accounts and keys I need — and how to give each one safely
**Never paste a password, token or key into this chat.** Values marked *secret* go straight from the provider's website into GitHub or Supabase. Values marked *public* aren't secret (they ship inside the app), but GitHub variables are still the tidy place for them.

| # | What | Secret? | Where you create it | Where you put it |
|---|---|---|---|---|
| 1 | **Expo account** (free) and a project named `runlime` | — | expo.dev → Sign up → Create project | Tell me the **project ID** in chat (not secret), or add it as a GitHub *variable* `EAS_PROJECT_ID` |
| 2 | **Expo access token** | secret | expo.dev → Account settings → Access tokens → Create | GitHub → repo **Settings → Secrets and variables → Actions → New repository secret** `EXPO_TOKEN` |
| 3 | **GitHub environment `staging`** | — | GitHub → repo **Settings → Environments → New environment** `staging` | (holds items 4–7) |
| 4 | Supabase **project ref** `fmnmylqxrmxuzmdcvmhs` | public | already known | `staging` environment → *Variables* → `SUPABASE_PROJECT_REF` |
| 5 | Supabase **personal access token** (lets CI run migrations) | secret | supabase.com → Account → Access Tokens → Generate | `staging` environment → *Secrets* → `SUPABASE_ACCESS_TOKEN` |
| 6 | Supabase **database password** | secret | Project → Settings → Database (reset it if you don't have it) | `staging` environment → *Secrets* → `SUPABASE_DB_PASSWORD` |
| 7 | Supabase **service_role key (legacy JWT)** | secret | Project → Settings → API Keys → *Legacy* tab → `service_role` | `staging` environment → *Secrets* → `SUPABASE_SERVICE_ROLE_KEY` |
| 8 | Supabase **anon key (legacy JWT)** | public | same page → `anon` | GitHub *variable* `SUPABASE_ANON_KEY` (it's embedded in the app by design) |
| 9 | **Emergency-contact encryption key** | secret | **your computer** — see docs/operations/EMERGENCY-CONTACT-KEY.md §1 | your password manager + paper copy, then Supabase → Edge Functions → **Secrets**: `EMERGENCY_CONTACT_KEY_V1`, plus `EMERGENCY_CONTACT_KEY_VERSION` = `1`. **Not GitHub, not chat.** |
| 10 | **Google Cloud project** (free) + OAuth consent screen (External, *Testing*, your Gmail as a test user) | — | console.cloud.google.com | — |
| 11 | Google **Web client ID** | public | Credentials → Create OAuth client → *Web application*; authorised redirect URI `https://fmnmylqxrmxuzmdcvmhs.supabase.co/auth/v1/callback` | GitHub *variable* `GOOGLE_WEB_CLIENT_ID` |
| 12 | Google **Web client secret** | secret | shown with item 11 | **Only** Supabase → Authentication → Providers → Google (paste the client ID + secret there). Not GitHub, not chat |
| 13 | Google **Android client ID** | public | Credentials → OAuth client → *Android*; package `tt.runlime.app.dev`; SHA-1 from expo.dev → project → Credentials → Android (available after the first build — I'll tell you when) | GitHub *variable* `GOOGLE_ANDROID_CLIENT_ID` |
| 14 | **Your legal details** (full name, address, support email, child-safety contact name + email) | personal | — | Optional to share with me. You can type them straight into Supabase → Table Editor → `app_settings` (staging): keys `legal.operator_name`, `legal.operator_address`, `legal.support_email`, `legal.child_safety_contact_email`. Values are JSON strings, e.g. `"Jane Doe"` including the quotes |

Notes:
- Items 1–9 are needed for task 1. Items 10–13 are needed for Google sign-in (test steps 13–14). Item 14 removes the DRAFT "operator details missing" banner.
- Item 7 must be the **legacy** `service_role` JWT, not the new `sb_secret_…` key. The current Edge Functions and the key-rotation workflow compare against the legacy key. Migrating to the new key format is noted for Phase 8.
- If your Supabase project only offers the new API keys (legacy disabled), tell me (no values) and I'll adapt the functions first.
- Apple items are deferred (paid Apple Developer account).
