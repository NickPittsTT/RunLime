# Phase 3 plan (draft, waiting for owner approval)

**Scope** (from PROGRESS.md, `00-OVERVIEW.md` S1/S6, screens M9a, M10, M18–M21, M39, M45, A6, A14, O10, W2; data model `rsvps`, `follows`, `blocks`, `notification_*`, `broadcasts`). Nothing here is built until you approve.

## Build order (each step: migration + RLS + pgTAP first, then app, then web, then tests)
1. **Runner level + profile photos.** Optional Casual / Club runner / Competitive (onboarding M9a + edit profile); never affects speed checks. Profile photo upload (resized on the phone, location data stripped), report a photo, admin removal queue, audit-logged.
2. **RSVP (M18–M20).** Attending / Maybe / Not; adults stepper + children-under-18 stepper with the "minors must be accompanied by an adult" note. Children appear only as a total for organisers. "My races" lists upcoming RSVPs. RSVP counts on cards and race pages ("N attending").
3. **Followers (M39, M45).** Private by default (requests need approval), Public optional. Followers see the race passport (races attended, km; filled in by Phase 4 check-ins and Phase 5 runs) and races the person is attending. Block (removes follows both ways, stops new requests) and report a profile.
4. **Clubs (A14, M9a, W2).** Approved list (exists); request to join → the club leader approves; request a new club → admin approves; per-club leader role; one primary club. Club turnout "Club X: 25 attending" from opted-in approved members, hidden below `clubs.turnout_min` (setting).
5. **Organiser attendance dashboard (O10).** RSVP totals and trend, children total, club turnout. No names unless the attendee opted in.
6. **Notifications (M10, M21).** In-app inbox behind the bell. Push messages for: follow request / accepted, club join approved, **a race you RSVP'd to is postponed (with the new date) or cancelled**, day-before reminder, organiser broadcasts to attendees (rate limit as a setting). Quiet hours. Per-type opt-out. Android 13 notification permission asked only after the M10 explainer.

## Decisions I need from you before starting
1. **Push provider.** Recommended: Expo Push Service + Firebase Cloud Messaging. Both are free, and Firebase needs no card. You'd create a Firebase project with the runlimett Google account; I'd give step-by-step instructions, and the key goes into Expo/GitHub secrets, never chat. Alternative: in-app inbox only in Phase 3, push added later. Either way the services register and Privacy Policy get updated first.
2. **Broadcast limit.** Default proposal: 2 per race per week for Basic listings. Setting, changeable.
3. **Turnout minimum.** Default proposal: hide club counts below 5. Setting.
4. **"Maybe" RSVP.** Keep it (as designed) or offer only Going / Not going.

## Checks before building
- Recheck Google Play User Generated Content policy (photos, profiles, follows need report + block + moderation; included above), CSAE standards (child-safety contact still needed from you), notification permission rules. Apple equivalents noted for later.
- 18+ rule unchanged: no minor accounts, children only as counts.

## Testing and handover
pgTAP for every new table and RPC (RLS, children aggregate-only, blocked users invisible, private profiles), Jest for app screens, Playwright for web. New APK + website deploy, then a phone test script like Phase 2. Stop for your approval at the end.

**Rough effort:** 12–16 working days. Clubs and notifications are the largest parts; the push setup depends on decision 1.
