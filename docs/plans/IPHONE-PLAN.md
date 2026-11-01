# iPhone plan (plan only: build nothing for iPhone until the owner says)

**Owner decision (31 Oct 2026):** run the iPhone pilot in **December**, after the Android pilot in November. Keep all new code shared between platforms. After Phase 6, plan the iPhone layer. The **Apple Developer Program (US$99/yr) needs the owner's approval first**, and the owner chooses individual or organisation at that point.

## 1. Where we stand
- One code base (Expo / React Native) for both platforms. Every Phase 1–5 screen and library is cross-platform.
- iOS-specific code already exists, unused until an Apple account is in place:
  - Sign in with Apple (`socialSignIn.ts`: shown only on iOS when available);
  - iOS keyboard events (`ui.tsx`);
  - iOS location permission strings and the iOS "location" background mode for the run tracker (`app.config.ts`: `isIosBackgroundLocationEnabled`);
  - iOS step permission text (expo-sensors `motionPermission`).
- Nothing has ever been built or run on iOS. Confidence that it builds first time: 0.6. Simulator builds don't need the paid account, so they can come first.

## 2. Android-only APIs in use (each has an iOS counterpart or doesn't apply)
| Where | Android-only part | On iPhone |
|---|---|---|
| Run tracker (`tracker.ts`) | `foregroundService` notification ("RunLime is recording your run") | Ignored on iOS. iOS keeps recording via the "location" background mode, started from the open app, with the blue status-bar indicator (`showsBackgroundLocationIndicator: true`). It needs only "While Using" permission. **Must be tested on a real iPhone.** |
| Push (`push.ts`) | Android notification channel ("loud" channel) | iOS has no channels; sound and priority are set per message. Push goes through Expo → **APNs**, which needs an APNs key from the paid Apple account |
| `app.config.ts` | Blocked Android permissions list; `SYSTEM_ALERT_WINDOW` (staging only) | Not applicable |
| Store declarations | Play foreground-service location declaration + video (STORE-REQUIREMENTS #19) | App Store review notes explain background location for run tracking (Guideline 2.5.4) |
| UI check (test only) | Maestro uses `android:id/button1` for dialogs | An iOS flow would use the button label |

**Rule from now on:** every Phase 6+ feature is written once for both platforms. Any new Android-only API gets a row in this table and a line in PROGRESS.md.

## 3. iPhone layer (after Phase 6; each item needs the paid account unless marked)
1. **Apple Developer Program** (US$99/yr). Owner approval required; individual vs organisation is the owner's choice (an organisation needs a D-U-N-S number and takes longer).
2. **Bundle ID + signing.** EAS manages certificates; `tt.runlime.app.dev` for staging and the production ID later.
3. **Sign in with Apple:** required by App Store rule 4.8 because we offer Google sign-in. The code exists; the remaining work is the Apple service ID/key and the Supabase Apple provider settings. These are credentials, so the owner creates them (credentials rule).
4. **Push via APNs:** an APNs key uploaded to Expo (the owner creates it; credentials rule). Test that sign-out stops pushes, as on Android (B1).
5. **Location:**
   - permission strings reviewed (When In Use only; no "Always");
   - background mode "location" for the run tracker;
   - check-in uses a single reading;
   - real-iPhone tests: locked screen, the app swiped away, battery.
6. **Steps:** the Motion & Fitness permission (CoreMotion via expo-sensors). The run works if it's refused.
7. **Maps:** MapLibre + OpenFreeMap work on iOS. Check attribution is visible on every map.
8. **TestFlight:** internal testing (up to 100 testers, no review), then external testing (beta review). The December pilot uses TestFlight.
9. **Store forms:** App Privacy labels from the third-party register, and the age rating (18+ policy).
10. **Simulator first (free, no paid account):** an EAS simulator build plus a Maestro run of the main flows, to catch layout and keyboard problems before any device build.

## 4. Expo free-plan iOS builds
- **15 iOS builds per month**, separate from the 15 Android builds.
  - Basis: our Android builds stopped at exactly 15 in October, which matches the "15 Android + 15 iOS" description, not a single shared 30.
  - Expo's 2023 changelog describes "30 builds, up to 15 iOS". Either way, iOS gets up to 15.
  - Confidence 0.7. To confirm: expo.dev/pricing (it was not readable from the build session).
- Builds that fail within 3 minutes don't count (up to 10 waived per month).
- Simulator builds count as builds too.
- **Cost:** iOS builds themselves are free within the allowance. The only new cost is the Apple Developer Program, which needs the owner's approval.

## 5. Rough timeline (if the owner approves the Apple account in early December)
| Step | Time |
|---|---|
| Simulator build + fixes (free) | 2–3 days, can start right after Phase 6 |
| Apple account approval (Apple's side) | 1–2 days for an individual; 1–3 weeks for an organisation (D-U-N-S) |
| Credentials (owner) + first device build + TestFlight internal | 1–2 days |
| Real-iPhone tests (tracker, check-in, push, Sign in with Apple) | 2–4 days |
| December pilot on TestFlight | After the above |
