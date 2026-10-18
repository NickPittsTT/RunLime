# Third-party services register

**Purpose:** one list of every outside service that receives data, for the Phase 8 store privacy forms (Google Play **Data safety**, Apple **App Privacy** labels), the Privacy Policy's "Service providers" section, and the attorney.

**Rule:** add a row **before** a new service goes live, and update the Privacy Policy in the same change. If a row says "to confirm", check it before the store forms are filed. Started 2026-10-17.

## In use now

| Service | Purpose | Data it receives | Region | Since | Store-form notes |
|---|---|---|---|---|---|
| **Supabase** (database, auth, storage, Edge Functions) | All account and app data; sign-in; event flyers/photos; profile photos (metadata stripped); emergency-contact encryption; scheduled jobs (reminders, push dispatch) | Everything in the Privacy Policy table: email, date of birth, profile and photo, consents, encrypted emergency contact, events, RSVPs, followers, clubs, reports, notifications, push tokens; access tokens | United States (AWS us-east-1), project `fmnmylqxrmxuzmdcvmhs` (staging) | Phase 1 | Processor acting for us. Encrypted in transit and at rest |
| **Cloudflare Workers** | Hosts the website and organiser/admin portal | Each visitor's IP address, request URLs and headers, and the sign-in cookie in transit. No database access of its own | Global edge network (served from the data centre nearest the visitor) | Phase 2 | Website only, not the app. May set a strictly necessary security cookie (Privacy Policy §8) |
| **Google: Gmail SMTP** (runlimett@gmail.com) | Sends 6-digit sign-in codes | Recipient email address and the code | Google (global; to confirm the data location for a personal Google account) | Phase 2 | Replace with a domain email service before public launch (custom-domain item) |
| **Google: Sign-In** | "Continue with Google" | Name, email, Google account ID (basic scopes only) | Google (global) | Phase 1 | Disclose "email address" and "name" as collected for account management |
| **OpenFreeMap** (map tiles, style) | Maps on the web and in the app | The device's IP address, the map area/zoom requested (tile URLs), and the user agent. No account data | To confirm (the provider's servers; believed to be in Europe) | Phase 2 | Not "collected by RunLime", because the device contacts it directly. Still list it in the Privacy Policy (done) |
| **Expo (EAS Build)** | Builds the Android app | Source code and public build settings (Supabase URL, anon key, Google client IDs). **No user data** | United States | Phase 1 | Not user data |
| **GitHub** (code, CI) | Source code, automated tests, deploy workflows | Source code; CI uses throwaway local databases. Deploy secrets are stored as encrypted secrets | United States | Phase 0 | Not user data |
| **Expo Push Service** | Phase 3: delivers phone notifications (race changes, reminders, organiser updates, follows, clubs) | The phone's Expo push token, the notification title and text, and a link target (race/person/club id). No email, DOB or location | United States | Phase 3 (active once "Configure push" has run) | Data safety: "device or other IDs" (push token); "app interactions" not shared. Processor for delivery only |
| **Google: Firebase Cloud Messaging** | Phase 3: Android delivery of the same notifications (Expo hands them to FCM) | Push token and notification content in transit | Google (global) | Phase 3 (after the owner's Firebase setup) | Firebase project under the RunLime Google account; no Firebase Analytics or other Firebase products |
| **Device location services** (Android fused location / iOS Core Location, via `expo-location`) | "Near me" in the app | The phone's own location services. RunLime reads one position and keeps it **on the phone** | On the device | Phase 2 | Not collected (never sent off the device) until GPS check-in (Phase 4) and run tracking (Phase 5). Update the forms then |

## Planned (not live; add the details when built)

| Service | Phase | Purpose | Data it will receive | Region | Notes |
|---|---|---|---|---|---|
| **Apple: Sign in with Apple** | When the Apple account is paid for | Sign-in on iOS | Name (first sign-in only), email or private relay email, Apple user ID | Apple | Code exists; deferred |
| **RevenueCat** | 7 | Premium subscription status | App user ID, store purchase receipts, subscription status. No card details | United States | Apple/Google take the payment |
| **Apple App Store / Google Play Billing** | 7 | Premium purchases | Handled by the stores; we receive the subscription status only | Apple / Google | Refunds follow store rules (Refund Policy §2) |
| **Sentry** (crash reports) | 8 | App and web crash reports | Stack traces, device model and OS, app version. No names or emails (scrubbed) | To choose: EU or US data region | Opt-out in Settings (Privacy Policy table) |
| **PostHog** (analytics) | 8 | Privacy-respecting usage analytics | Anonymous events. **Cookieless on the web** (memory persistence), no advertising IDs, no session recordings | To choose: EU or US cloud | Opt-out in Settings. Must stay cookieless (Privacy Policy §8) |
| **Domain email service** (e.g. a transactional email provider) | Before public launch | Sign-in emails from the RunLime domain | Recipient email and the code | To choose | Replaces Gmail SMTP |

## Not used (by decision)
- No advertising networks, no advertising IDs, no data brokers, no session-replay tools.
- No Google Maps / Apple Maps SDKs (MapLibre + OpenFreeMap, owner decision 2026-10-15).
- No card payment gateway (organiser payments by bank transfer only).
