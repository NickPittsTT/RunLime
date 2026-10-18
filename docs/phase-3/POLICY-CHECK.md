# Google Play policy recheck before Phase 3 (2026-10-18)

**How this was checked.** support.google.com and docs.github.com are blocked from the build container, so the Google policy pages were read through web search results (official pages listed first), and the Android notification page directly. **Before store submission (Phase 8) you or the attorney should open each official link and confirm the wording**; policy pages change.

## Sources
1. Google Play, *User Generated Content*: https://support.google.com/googleplay/android-developer/answer/9876937
2. Google Play, *Understanding moderation requirements and incidental sexual content in UGC apps*: https://support.google.com/googleplay/android-developer/answer/12923286
3. Google Play, *Child Safety Standards policy*: https://support.google.com/googleplay/android-developer/answer/14747720
4. Google Play, *Developer Program Policy* (system-level notifications, spam, deceptive behaviour): https://support.google.com/googleplay/android-developer/answer/16933379 (also served as /answer/18258653)
5. Android Developers, *Notification runtime permission* (read in full): https://developer.android.com/develop/ui/views/notifications/notification-permission
6. Secondary (restate the rules, not authoritative): BuddyBoss UGC and CSAE guides; iubenda overview.

## What the rules require, and how Phase 3 meets them

| Rule (source) | What it says | Phase 3 design |
|---|---|---|
| Terms accepted before UGC (1) | Users must accept the terms / user policy before they can create or upload UGC; the terms must define objectionable content; the step can't be skipped | Already: Terms acceptance is part of sign-up (M7) before any profile exists. **Change:** Terms §3 and the Moderation Policy get an explicit "objectionable content" list covering photos, names and club requests |
| Report users and content (1) | Apps with publicly accessible UGC (social apps) must let users report users and content in the app | Slice 1: **Report** on profile photos and profiles; slice 3: report a profile from the followers screens; slice 4: report a club. All go to one admin queue (A-screens), reviewed within 48 h, child-safety reports first (existing owner decision) |
| Block users (1) | Social apps must let users block users | Slice 3: **Block** (removes follows both ways, stops requests, hides each from the other). Available from every profile |
| Moderation (1, 2) | Moderation must be ongoing and reasonable for the content; act on reports; apps that keep ignoring complaints are removed | Admin removal queue with audit log (slice 1); removal notifies the person (slice 6 inbox); repeat offenders can be suspended (existing admin tool) |
| Incidental sexual content (2) | UGC apps must take steps against sexual content even if it isn't the app's purpose | Profile photos only (no galleries, no messages). Report + removal queue; Moderation Policy bans sexual/nude images. Automated image scanning is not in scope (would need a paid or new service; flagged as an option for later) |
| Child Safety Standards (3) | Social apps must publish standards prohibiting CSAE, have an **in-app** way to send feedback/reports, address CSAM (report to NCMEC or the regional authority), comply with law, and name a child-safety contact | Published: `child-safety-policy.md` (exists). **New in slice 1:** an in-app "Report a safety concern" form (not a mailto link) feeding the admin queue, child-safety category first. CSAM handling step added to the Moderation Policy. **You still need to name the contact person in Play Console (Phase 8).** |
| Notifications only for integral features (4) | System notifications must relate to the app's features; no ads in notifications; don't mimic system prompts | Notifications: follow requests, club approvals, race postponed-to/cancelled, day-before reminder, organiser messages **about that race** to people who RSVP'd (2 per race per week). No ads. Organiser messages are limited to race updates in Phase 3 (no promotions); the organiser composer says so |
| Android 13+ permission (5) | `POST_NOTIFICATIONS` is a runtime permission; notifications are off by default on new installs; ask in context (after a user action), not at startup; explain the value first; check `areNotificationsEnabled()` before sending | Slice 6: the M10 explainer appears only when the user first does something that benefits (RSVPs, follows, joins a club, or taps the bell's "Turn on"), then the system prompt. If denied: no re-prompting loops; the inbox still works and Settings shows "Notifications are off" with a link to system settings. Target SDK stays at the Expo SDK 57 default (35+) |
| Data safety form (Phase 8) | Declare data collected and shared | New data types to declare: photos (profile photo), user-generated content (club requests, reports), social connections (followers), app interactions (RSVPs), device push token. Logged in the third-party register when push is added |

## Not affected / unchanged
- 18+ only. Children appear only as a count in an adult's RSVP; organisers see a total, never names or ages.
- No direct messages in v1 (the strictest 1:1 rules and CSAE risks don't apply). Kept out on purpose.
