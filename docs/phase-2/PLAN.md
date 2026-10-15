# Phase 2 plan

**Status (2026-10-15):** Task 1 (Android build on the owner's phone) is **complete**: phone test sections A–E passed, Google sign-in and legal links work. Phase 2 feature work started.

## Phase 2 feature work (in build order)
1. **Database:** RunLime listings (`listing_source`, organiser optional, official link required, no flyers/logos), event distances, media + sponsors (organiser events only), co-organisers, change history, race suggestions, duplicate detection, Phase 2 settings (incl. `events.unaffiliated_notice`), public calendar queries. pgTAP for every table/rule.
2. **Admin (web):** create event (A4) as an organiser event **or a RunLime listing**; event approval queue (A3); race suggestions (A5); Phase 2 settings (A10).
3. **Organiser portal (web):** dashboard, multi-step event editor with start pin + route (MapLibre; tap points or GPX), duplicate, postpone/cancel, co-organisers, organisation settings.
4. **Public web:** landing, `/races` calendar, `/e/[slug]` event page with the minors and "not affiliated" notices.
5. **Mobile:** new navigation (home = calendar, top bar, side menu, fixed "Start run" button, no bottom tabs); age-gate auto-advance; month view + list, filters, search, near me (MapLibre), event detail + route map; onboarding (walkthrough, areas & distances); suggest a race; offline banner.
6. **Review:** CI green, staging deployed, test build + test script, review report; stop for owner review.

UX notes from the owner's Task 1 testing (2026-10-15): age gate auto-advance; ride-share style navigation (see `03-SCREENS.md` → Navigation). Maps: MapLibre + OpenFreeMap (owner, 2026-10-15). Profile photos: Phase 3.

---

# Task 1 record

## Task 1 (first): Android build on your phone (internal staging APK)
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

**Limits of this first build (expected, not bugs):**
- **"Read the Terms" / "Help & legal" links won't open yet.** The staging web portal isn't deployed (it needs the free Cloudflare account, the next step). Skip the link check in step 9 and the legal links.
- **No "Continue with Google" button yet.** It appears once the Google Cloud setup (items 10–13) is done. Section D waits for that.
- **Install:** open the APK link on your Android phone and allow "Install unknown apps" for your browser when asked. The app is called **RunLime (staging)**. It's a standalone internal build: it opens straight to the date-of-birth screen, with no computer or dev server needed.
Use **runlimett@gmail.com** or another inbox you control (sign-in codes are sent through the Gmail SMTP you set up). Each line has an expected result; tick or note what happened.

**A. Age gate (first screen, before any sign-in)**
1. Open RunLime. Expect: the first screen asks only for your date of birth, with no Google or email buttons.
   *Dates use today's date in Trinidad and Tobago.* Example for 11 Oct 2026: "18 today" = 11/10/2008, "18 tomorrow" = 12/10/2008.
2. **Exactly 18 today:** enter today's day and month, 18 years ago → Continue. Expect: the sign-in screen (allowed). **Don't sign in.** Tap back.
3. **18 tomorrow:** enter tomorrow's day and month, 18 years ago → Continue. Expect: "Sorry, you can't create a RunLime account", and no sign-in options.
4. Close the app completely, reopen it. Expect: still the "Sorry" screen. This lasts 24 hours on this phone, with nothing sent to the server.
5. Android Settings → Apps → RunLime (staging) → Storage → **Clear storage**. Reopen. Expect: the date of birth question again.

**B. Email sign-in**
6. Enter your real adult date of birth → Continue. Expect: the sign-in screen with an email box (the Google button appears in a later build, see Section D).
7. Enter your email → "Email me a code". Expect: an email "Your RunLime sign-in code" within ~1 minute. If nothing arrives after 5 minutes, check spam, then tell me.
8. Enter the 6 digits → Sign in. Expect: "Finish setting up".
9. Fill in Display name, Nickname (optional), Home area, tick the terms box (the "Read the Terms" link won't open yet; see the limits above) → Create my account. Expect: the Profile screen "Hi, <name>" showing your area and **Private**.

**C. Profile**
10. Edit profile & privacy → change the nickname and the area → switch to **Public** → Save. Expect: the Profile screen shows the new values.
11. Emergency contact → enter a name and phone → Save → go back and reopen. Expect: the details reload. (They're encrypted; only you can see them.)
12. Your data → Download my data. Expect: an Android share sheet with `runlime-my-data.json`. Save it and check it contains your profile.
13. Sign out → reopen the app. Expect: the date of birth question again (you're signed out).

**D. Google sign-in** (after the Google Cloud setup below)
14. Enter your adult DOB → **Continue with Google** → choose your Google account. Expect: "Finish setting up" (new account), or the Profile screen if this Google email already has a RunLime account.
15. Edge case: if you force-close the app on "Finish setting up" and reopen it, expect to be asked your date of birth again before anything is saved.

**E. Account deletion**
16. Profile → Delete account → type `DELETE` → Delete my account. Expect: you're signed out and back at the date of birth question.
17. Sign in again with the same email. Expect: "Finish setting up" (a brand-new account; the old one is gone).
18. Delete this second account too, so staging is clean.

Report back: the step number, what you expected, what happened, and a screenshot if possible.

## Accounts and keys I need — and how to give each one safely
**Never paste a password, token or key into this chat.** Values marked *secret* go straight from the provider's website into GitHub or Supabase. Values marked *public* aren't secret (they ship inside the app), but GitHub variables are still the tidy place for them.

| # | What | Secret? | Where you create it | Where you put it |
|---|---|---|---|---|
| 1 | **Expo account** (free) and a project named `runlime` | — | expo.dev → Sign up → Create project | ✅ Done — project ID `ca1a5ee2-b15a-488d-b123-8fd075db8be1`, linked in `apps/mobile/app.config.ts` |
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
| 13 | Google **Android client ID** | public | Credentials → OAuth client → *Android*; package `tt.runlime.app.dev`; SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (the staging APK is signed with the Expo template's debug key; the build workflow prints the APK's real SHA-1 to confirm). Production gets its own upload key and SHA-1 in Phase 8 | GitHub *variable* `GOOGLE_ANDROID_CLIENT_ID` |
| 14 | **Your legal details** (full name, address, support email, child-safety contact name + email) | personal | — | Optional to share with me. You can type them straight into Supabase → Table Editor → `app_settings` (staging): keys `legal.operator_name`, `legal.support_email`, `legal.child_safety_contact_email`. Optionally `legal.operator_address`: non-public, kept for official records only, never shown on RunLime pages or in the app (owner decision 2026-10-15). Values are JSON strings, e.g. `"Jane Doe"` including the quotes |

### Cloudflare (staging web portal + legal pages) — free plan, no card
| # | What | Secret? | Where you create it | Where you put it |
|---|---|---|---|---|
| 15 | **Cloudflare account** (Free plan) and a **workers.dev subdomain** | — | dash.cloudflare.com/sign-up with runlimett@gmail.com → verify the email. Skip every "add a site/domain" prompt. Then **Workers & Pages** (may be listed under **Compute (Workers)**) → on the overview, set **your subdomain** (e.g. `runlime`; it's public, so not your personal name) | — |
| 16 | **Account ID** | public | Workers & Pages overview → right-hand panel → **Account ID** → copy | GitHub → **Settings → Environments → `staging` → Variables** → `CLOUDFLARE_ACCOUNT_ID` |
| 17 | **API token** for deploys | **secret** | Profile icon (top right) → **My Profile → API Tokens → Create Token** → template **"Edit Cloudflare Workers"** → *Use template*. **Account Resources:** Include → your account. **Zone Resources:** Include → All zones from an account → your account (you have no zones; that's fine). Leave IP filtering empty; TTL optional. **Continue to summary → Create Token** → copy it once | GitHub → **Settings → Environments → `staging` → Secrets** → `CLOUDFLARE_API_TOKEN`. **Not chat** |
| 18 | **Staging web URL** | public | Printed by the "Deploy web" run (e.g. `https://runlime-web-staging.<subdomain>.workers.dev`) | GitHub → `staging` environment → Variables → `STAGING_WEB_URL` (the next app build then opens the legal links) |

- Free plan only: Workers Free (100,000 requests/day). **If Cloudflare asks for a card or a paid plan at any point, stop and tell me.** We don't use R2, KV or a custom domain.
- The free plan caps the site's code at 3 MiB (compressed). Ours is 2.52 MiB (82%, with minify). CI checks this on every change and fails before we would ever need a paid plan.
- The "Edit Cloudflare Workers" template grants a bit more than the deploy needs (e.g. KV/R2/Pages edit), limited to this one account. A narrower custom token is possible later.

Notes:
- Items 1–9 are needed for task 1. Items 10–13 are needed for Google sign-in (test steps 14–15). Item 14 removes the DRAFT "operator details missing" banner.
- Item 7 must be the **legacy** `service_role` JWT, not the new `sb_secret_…` key. The current Edge Functions and the key-rotation workflow compare against the legacy key. Migrating to the new key format is noted for Phase 8.
- If your Supabase project only offers the new API keys (legacy disabled), tell me (no values) and I'll adapt the functions first.
- Apple items are deferred (paid Apple Developer account).
