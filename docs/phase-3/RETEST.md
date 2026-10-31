# Phase 3 phone checks

Numbered per slice. Report pass or fail per step, with a screenshot for any failure. An APK link is added after slices 2, 4 and 6; slices 0, 1, 3 and 5 can be checked on the current APK or the website as noted.

## Retest round 4 (2026-10-31): only these, on the new APK
**APK:** _link added when the build finishes (see docs/reports/LATEST.md)_. Install it over the old app. **Install it before testing photos:** photos are now private, so the old app shows initials instead of photos once the website and database are updated. [App] = phone app, [Website] = website.

**R2 again: keyboard (cause found: see the report)**
R2.1 [App] Help & legal → **Report a safety concern** → tap **Tell us what happened** and type 6+ lines. While the keyboard is open, the whole box stays visible as it grows, and you can scroll down to **Send report** without closing the keyboard.
R2.2 [App] Same check (the box you type in stays fully visible; you can scroll to the button below it with the keyboard open) on: Edit profile (Nickname → scroll to **Save**), Suggest a race (last box → **Send**), Ask for a new club (About the club → **Send**), Delete account (Type DELETE → **Delete my account**), Sign in (email → **Email me a code**).

**R9 again: Private → Public → Private (+ private photo storage)**
R9.1 [App] Account A has a photo and is Private. Account B (not following A): search A and open A's profile: **initials**.
R9.2 [App] A: Edit profile → tap **Public**. A green message says "Saved. Your account is Public…" straight away (no Save button needed for privacy).
R9.3 [App] B: go back to the search list and open A again (or just come back to A's profile): **A's photo shows**. Also in search results after searching again.
R9.4 [App] A: tap **Private** → "Saved. Your account is Private…". B: back to A's profile: **initials** again.
R9.5 [App] A approves a follow request from B: B now sees A's photo (Private account).
R9.6 [App] A sees their own photo on Profile and in the side menu. [Website] Admin → Reports: a report on A's photo shows the photo.
R9.7 [Website] Optional: copy a photo link from an old screenshot or message; it no longer opens (photos are private; links expire after 10 minutes).

## Retest round 3 (2026-10-30): test only these, on the new APK
**APK:** https://expo.dev/artifacts/eas/riM5Nd_cBRJI0XDt5urUP9UAP7ylqfmvHrdKwjoFShA.apk (EAS build c14d742a, commit `51d0154`; same app code as CI #138 on `c9d46e8`; no secrets found). Install it over the old app (same signing key). Every step says where to do it: **[App]** = the phone app, **[Website]** = the website (a phone browser is fine).

**Message limit (read first):** race updates from organisers are limited to **3 per race in any 7 days**, or **10 in the 7 days before the race** (the postponed date if postponed). **Admins are not limited.** Automatic postponed / cancelled / back-on notices never count. If a notification test needs more messages, send them as an admin, or use postpone → back on instead of messages.

**R1. A signed-out phone gets nothing (B1, was 6.11 and F1.4)**
R1.1 [App] Sign in as account A. Say **Going** to a race. Menu → Notification settings shows **Phone notifications: On**.
R1.2 [App] Menu → **Sign out**. Lock the phone.
R1.3 [Website] As admin, send **Message people going** on that race. Wait 2 minutes: **no** notification on the phone.
R1.4 [App] Sign in as account B (a different email, or a different Google account; see R6). Say Going to the same race. [Website] send another message: the phone gets it **once** (for B only).
R1.5 [App] Sign out of B, sign in as A again. [Website] send a message: the phone gets it for A, and B's phone (if B is also signed in elsewhere) is not affected.
R1.6 [App] Turn on airplane mode, sign out, turn airplane mode off, open the app (signed out). [Website] send a message: no notification. (The sign-out finishes when the phone is back online; the server also stops sending once the sign-in has ended.)
R1.7 [App] Optional, with a throwaway account: Settings → **Delete account**. [Website] message a race it was Going to: nothing arrives.

**R2. Keyboard (B2)**
R2.1 [App] Help & legal → **Report a safety concern** → tap **Tell us what happened** and type 6+ lines. The whole box stays above the keyboard while it grows; past about a third of the screen it scrolls inside.
R2.2 [App] Same check (the field you type in stays fully visible): Edit profile (Display name, Nickname), Finish setting up (Display name, Nickname), Suggest a race (every box, especially the last), Ask for a new club (About the club, Leader's sign-in email), Emergency contact, Delete account (Type DELETE), Sign in (email, code).

**R3. Finish setting up (B3)**
R3.1 [App] New account (or a second Google account): on **Finish setting up**, enter a nickname another account already uses (for example your first account's), tap Continue: "That nickname is already taken. Choose another, or leave it empty." (no "Something went wrong").
R3.2 [App] Clear the nickname, Continue: you reach the app.

**R4. Organiser team (B4)**
R4.1 [Website] Sign in as an organisation **owner** → Organiser → **Settings** → your organisation → **Team**: fields **Their RunLime account email** and **Role**, and **Add to team**. Add your second account as Manager.
R4.2 [Website] Sign in as that **manager**: the Team section lists people and says only owners can add people (with the owner's name). (If "Add a team" meant something else, tell me where you clicked.)

**R5. Start run button (B5)**
R5.1 [App] Home, List view: scroll to the bottom. The last race card scrolls fully above the **Start run** button. At the top, the first card is not covered.

**R6. Google account chooser (B6)**
R6.1 [App] Sign in with Google: Android's account chooser appears, even if you used Google before.
R6.2 [App] Sign out, then **Continue with Google** again: the chooser appears again (pick a different Google account to switch).
R6.3 [App] After deleting a Google-based account, signing in with Google shows the chooser.

**R7. Loud notifications (B8)**
R7.1 [App] Open the new app once while signed in. Lock the phone. [Website] send a message: the notification makes a **sound**, vibrates and shows a **banner** (heads-up) while the phone is unlocked.
R7.2 [App] Android Settings → Apps → RunLime → Notifications: one category, **Race alerts**, set to make sound and pop on screen. (Older categories are removed.)

**R8. Organiser message limits (C1)**
R8.1 [Website] As admin, open a race more than 7 days away → **Message people going**: it says "Admins are not limited … The organiser has 3 of 3 left." Send two messages: the organiser's count doesn't change.
R8.2 [Website] As the organiser of that race: "3 of 3 left. Up to 3 updates in any 7 days; in the 7 days before the race, up to 10." Send 3; the button is then disabled and a 4th is refused with the race-week explanation.
R8.3 [Website] For a race within 7 days: the organiser sees "… of 10 left. Race week: up to 10 updates …".
R8.4 [Website] Postpone and put back on a race: the organiser's count doesn't change.
R8.5 [Website] Admin → Settings: `messages.per_race_per_week` = **3** and `messages.race_week_limit` = **10**.

**R9. Photos on Private accounts (C2)**
R9.1 [App] Account A (Private) has a photo. Account B (not following A): search A, open A's profile, any club list and "People you follow who are going": B sees A's **initials**, not the photo.
R9.2 [App] B asks to follow A. A's Followers → Requests shows B's initials (if B is Private and A doesn't follow B), or B's photo if B is Public.
R9.3 [App] A approves: B now sees A's photo.
R9.4 [App] A switches to **Public**: everyone sees the photo. Switch back to Private.
R9.5 [Website] Admin → Reports: a report on A's photo still shows the photo (for moderation).
R9.6 [Website] Privacy Policy (/legal/privacy) says photos on Private accounts are shown only to approved followers.

**Still open from earlier:** F2 report box (now R2.1). Everything else from the fix round passed (owner, 2026-10-30).

## Fix round (2026-10-18) — test only these, on the new APK
**APK:** https://expo.dev/artifacts/eas/UjmOq-8OOhMBJ65bbJO5LyQ0j5rTd1xQ0O9CMf7ANv8.apk (EAS build a90e523c, commit `11be7a2`, CI #132, Firebase config confirmed) — install over the old app (same signing key). Open it once while signed in: that connects this phone for notifications.

**F1. Phone notifications (was 6.9 failed)**
F1.1 Menu → Notification settings: it says **Phone notifications: On**. ("On" now means this phone is connected to your account, not just allowed.)
F1.2 Lock the phone. From the website (organiser or admin race page), **Message people going** on a race you're Going to. Within about a minute a notification appears on the lock screen, with a banner and sound. Tap it: the race opens.
F1.3 Postpone that race (Change status → Postponed, with a new date): a notification "… is postponed to …" arrives. Then "Back on": one arrives too.
F1.4 Sign out, sign in as your **second** account, then back to the first. Repeat F1.2: it still arrives. (This is what broke before.)
F1.5 With the app open on the Home screen, send another message: a banner shows inside the app.

**F2. Keyboard and form messages**
F2.1 Profile → Report a safety concern → tap **Tell us what happened**. The box stays visible above the keyboard (the screen scrolls).
F2.2 Type "short", tap Send report: the "at least 10 characters" message shows. Type more: the message disappears as soon as you edit, and the hint counts ("… (18 so far)").
F2.3 Same keyboard check on: Edit profile (Display name, Nickname), Suggest a race (the last box, "Anything else"), Ask for a new club (About the club, Leader's sign-in email), Emergency contact, Delete account (Type DELETE).

**F3. Photo picker**
F3.1 Edit profile: under **Add a photo** it says "RunLime only sees the photo you choose." Tap it: Android's photo picker opens and no "allow access to photos" permission prompt appears.

**F4. Admin alerts for new reports**
F4.1 From a non-admin account, send a report with "A child may be at risk". Your **admin** account's phone gets "Urgent report: a child may be at risk" at once, and it's in the bell. Tapping it opens Admin → Reports on the website.
F4.2 Website → Admin: the **Reports** menu item shows a red number while a child-safety report is open.
F4.3 After you do `docs/phase-3/ADMIN-ALERTS-SETUP.md`: the test email arrives; then a new child-safety report emails runlimett@gmail.com within about a minute; other categories arrive in the 7:50 am summary the next morning.

**F5. Club leadership**
F5.1 Clubs → Ask for a new club: it asks **Who will lead this club?** Choose **Someone else** and enter your second account's sign-in email. A wrong email says it couldn't find the account.
F5.2 Website → Admin → Clubs: the request shows **Proposed leader: <name> (named by the requester …)** and the tick reads "Make <name> its first leader". Approve.
F5.3 The second account gets "You now lead <club>. You'll approve join requests." (bell, and phone if on).
F5.4 On a third account (or after leaving), open the club: "<leader> approves join requests." shows above **Ask to join**, and after asking: "Your request is waiting for <leader> to approve it."

**Still to confirm from slice 6** — 6.4 (message limit; now R8), 6.6 (organiser-updates toggle saves), 6.7 (Mark all as read), 6.11 (after sign-out, no phone notifications for that account on this phone).


**Final Phase 3 APK (use this one for every step; push included):** https://expo.dev/artifacts/eas/G_euHwOUZLEUh8J3xPID2DEIkUh139fSVI6l15Qsiwk.apk — EAS build c96497e9, commit `47c7cbd` (CI #125), signing SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (same as before, so it installs over the old app), Firebase config: yes (project `runlime-a3849`). The per-slice APK links below are older builds; you don't need them.

## Slice 0: saved welcome answers survive a reinstall (Phase 2 item 7)
Use the current staging APK (EAS build 5d8970b0) or any later one.
0.1 Open the app signed in. Note the "Showing: …" filter line under the calendar (your saved areas and distances). If there is no such line, your account has no saved welcome answers (the screens were skipped): say so in your report and skip this slice; an "Edit my areas and distances" item comes with the Settings work.
0.2 Uninstall RunLime (long-press the icon → Uninstall).
0.3 Install the APK again from the same link, pass the date-of-birth screen and sign in with the same account.
0.4 Expected: the welcome screens do **not** appear; Home opens with the same "Showing: <areas, distances>" line.
0.5 Tap **Clear filters**: all races show. (Your saved answers stay on your account; they're only the starting filters.)
Note: if you pressed **Skip** on the welcome screens, nothing was saved, so they appear again after a reinstall. That is expected.

## Slice 1: runner level, profile photos, reports
The photo picker is new native code, so the phone steps need the **slice 2 APK** (link added then). The website steps work as soon as slice 1 is deployed.
1.1 Phone: Profile → Edit profile. Under **Runner level (optional)** choose **Club runner** and Save. Profile shows "Runner level: Club runner". The note says it never changes how runs or times are checked.
1.2 Edit profile → **Add a photo**. The system photo picker opens (no permission prompt for your whole gallery). Choose a photo taken with your phone's camera, crop, confirm. "Photo saved." appears and the photo shows on Profile and at the top of the side menu.
1.3 Website: Admin → Reports is empty (or shows only older test reports).
1.4 Phone: Help & legal → **Report a safety concern**. Press Send without choosing anything: "Choose what is wrong." Choose **A child may be at risk**, type "Re-test: please ignore", Send: "Thank you. Your report was sent." with the 999 line.
1.5 Website: Admin → Reports: the report is at the top, marked "A child may be at risk". Type a note "Re-test" and **Dismiss**: "Report dismissed." It now appears under **Dismissed** with your note.
1.6 Phone: Edit profile → **Remove photo**: "Photo removed." Initials show again.
1.7 Optional (needs a second account): from the second account, report the first account's photo (available once profiles are visible to others in slices 2–3). Admin → Reports → **Remove photo**: the photo disappears from the first account's profile.
Not on the phone yet: a Report button on other people's photos appears in slice 2 (who's going) and slice 3 (follower profiles).

## Slice 2: RSVPs and My races
**APK (slice 2, EAS build d9d2ae89, commit `227ae53`):** https://expo.dev/artifacts/eas/oNDfdNw_bV3L-P4wRfzBqlbl-6WlhVVTU7hyv1daRiQ.apk — install it over the old one (same signing key). Then also do the slice 1 phone steps above.
2.1 Open any upcoming race. Under **Are you going?** it says "No one has said they are going yet." (or a count).
2.2 Tap **Going**. Steppers appear: **Adults in your group (including you)** starts at 1 and can't go below 1; **Children under 18**. The note says children must be with an adult and only the number is kept.
2.3 Set 2 adults and 1 child, tap **Save RSVP**: "You're going. It's in My races." The count shows "2 going".
2.4 Back on the calendar list (pull down): the race card shows "· 2 going". Children are never shown in the count.
2.5 Menu → **My races**: the race is under **Coming up** with "Going · 2 adults, 1 child". Tap it to open the race.
2.6 Change to **Maybe**, **Update RSVP**: "Saved as Maybe." The count shows "1 maybe". Change to **Not going**: the steppers disappear; after saving, the race leaves My races.
2.7 Website: open the same race's public page (`/e/<race>`): "2 going" style line appears when someone is going (a test RSVP from step 2.3 if you set it back to Going).
2.8 Cancelled race (only if you have one to test with): the RSVP buttons are replaced by "This race is cancelled, so RSVPs are closed."

## Slice 3: followers, block, report (needs a second account; use the slice 4 APK)
Use two phones, or your account plus a second test account on another phone. Both accounts are Private unless you change them.
3.1 Account B: menu → **Followers** → **Find people**, type at least 2 letters of A's name, open A's profile. It says "This account is private…" and shows **Ask to follow**. Tap it: "Request sent…", button shows **Requested**.
3.2 Account A: menu → **Followers** → **Requests (1)** → **Approve**: "… now follows you."
3.3 Account B: reopen A's profile: **Race passport** (0 races, 0 km for now) and **Going to** with any race A said Going to. On that race's page B sees "People you follow who are going: A".
3.4 Account A: Followers tab → **Remove** B. B no longer sees the passport.
3.5 Account A: open B's profile (from search) → **Block** → confirm. B disappears from A's search. On B's phone, A can't be found or followed. A: Followers → **Blocked** → **Unblock** restores it.
3.6 From B, **Report profile** on A: the report appears in Admin → Reports on the website. Dismiss it.
3.7 Edit profile → switch A to **Public**: B can follow instantly (no request) and see the passport. Switch back to Private.

## Slice 4: clubs
**APK (slice 4, EAS build 07af4e39, commit `b65c60d`):** https://expo.dev/artifacts/eas/6pnh2ERiKXp3jtLw3KnoyjNkVK8cZuG535We0R1x4Y4.apk — contains slices 3 and 4. You can skip it and use the slice 6 APK below, which contains everything.
4.1 Menu → **Clubs**. Under **Find a club**, any clubs you added in Admin are listed with member counts.
4.2 **Can't find your club? Ask us to add it** → name "Re-test Runners", Send: "Thanks. We'll review your club request."
4.3 Website: Admin → Clubs → **New-club requests**: "Re-test Runners · asked by <you>". Keep **Make the requester its first leader** ticked, **Approve**: "Club created."
4.4 Phone: Clubs shows **Re-test Runners** under **Your clubs** as "Leader". Open it: "You lead this club." Tap **Make this my primary club**: a ★ appears.
4.5 Second account: open the club → **Ask to join**: "Request sent. A club leader will approve it."
4.6 Your account: club page → **Requests to join (1)** → **Approve**. The second account now shows "You are a member."
4.7 Both accounts: Edit profile → tick **Count me in my clubs' race turnout** → Save. Both say **Going** to the same race. Admin → Settings → set `clubs.turnout_min` to **2**. Open the race (app and website): "Re-test Runners: 2 going". Set the setting back to **5**: the line disappears.
4.8 Website: Admin → Clubs → open a club → **Appoint a leader (account email)** works; **Remove leader role** keeps them as a member.
4.9 From the second account, **Report this club** → it appears in Admin → Reports.

## Slice 5: organiser attendance page (website; works on a phone browser too)
5.1 Use a race with a few RSVPs (yours from slice 2 and the second account's). Website → Admin → Events → that race. Near the top: **Attendance** with tiles **Adults going**, **Children coming** (a total only, never names or ages), **Maybe**, **Not going**.
5.2 **Adults going over time** shows a line (one point per day with changes). Hover or tap a point: "<day>: N adults going, N children, N maybe". **Show as a table** lists the same numbers.
5.3 **Club turnout** shows "Club: N going" when enough opted-in members are going (slice 4 step 4.7), otherwise a short explanation.
5.4 Organiser portal (if you have an organiser account): the race list shows "· N going"; the race page has the same Attendance section.
5.5 Open the page on your phone's browser: nothing is cut off and there's no sideways scrolling.

## Slice 6: notifications (inbox first, then phone notifications)
**APK (slice 6, EAS build d880d4b5, commit `e18d12a`):** https://expo.dev/artifacts/eas/g5DglIwRvhl6hWaBYitvt3mTmj7G1QnBNq932JVkh3E.apk — contains every Phase 3 slice. Phone notifications work in the final APK above (Firebase set up 2026-10-18).
Inbox (works without Firebase):
6.1 The bell (top right) shows a red number when you have unread notifications. Tap it: **Notifications** lists them, newest first; unread ones have a green dot.
6.2 Second account: follow your account (Private): your bell shows "<name> asked to follow you". Tap it: Followers → Requests opens. Approve: the second account gets "<you> approved your follow request".
6.3 Say **Going** to a race. Website: postpone it to a new date with a reason. Phone: pull down on Home; the bell shows 1. The notification reads "<race> is postponed to <day, date, time>" with the reason. Tap it: the race page opens. Put the race back on: "<race> is back on: <date, time>".
6.4 Website → that race (admin or organiser page) → **Message people going**: type "Re-test: parking opens at 5 am", **Send update**: "Sent to N people." Phone: "<race>: update from the organiser" with your text. Organisers: a 4th message in the same 7 days is blocked (3 per 7 days; 10 in race week); admins are not limited (see R8).
6.5 Club join request (slice 4): the leader gets "<name> asked to join <club>"; after approval the member gets "You're now a member of <club>".
6.6 Profile → **Notification settings**: turn **Updates from race organisers** off, **Save**, send another update (next week, or ask me to lower the limit): you don't get it. Turn it back on.
6.7 **Mark all as read** clears the dots and the bell number.
Phone notifications (final APK):
6.8 After your first **Going** on a race, a screen explains notifications **before** Android's own "Allow RunLime to send you notifications?" prompt (Android 13+). Tap **Turn on notifications**, then **Allow**: "Notifications are on."
6.9 Lock the phone. From the website, postpone the race or send an update: a phone notification arrives within about a minute. Tap it: the race opens in the app.
6.10 Notification settings shows "Phone notifications: On". If you tapped **Don't allow** in step 6.8, it shows **Open phone settings** instead (no repeated prompts).
6.11 Sign out: the phone stops getting your notifications.
