# Phase 3 phone checks

Numbered per slice. Report pass or fail per step, with a screenshot for any failure. An APK link is added after slices 2, 4 and 6; slices 0, 1, 3 and 5 can be checked on the current APK or the website as noted.

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

## Slice 4: clubs (APK link added when built; it also contains slice 3)
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

## Slice 6: notifications (inbox first, then phone notifications) — APK link added when built
Inbox (works without Firebase):
6.1 The bell (top right) shows a red number when you have unread notifications. Tap it: **Notifications** lists them, newest first; unread ones have a green dot.
6.2 Second account: follow your account (Private): your bell shows "<name> asked to follow you". Tap it: Followers → Requests opens. Approve: the second account gets "<you> approved your follow request".
6.3 Say **Going** to a race. Website: postpone it to a new date with a reason. Phone: pull down on Home; the bell shows 1. The notification reads "<race> is postponed to <day, date, time>" with the reason. Tap it: the race page opens. Put the race back on: "<race> is back on: <date, time>".
6.4 Website → that race (admin or organiser page) → **Message people going**: type "Re-test: parking opens at 5 am", **Send update**: "Sent to N people." Phone: "<race>: update from the organiser" with your text. A third message in the same 7 days is blocked ("0 of 2 left").
6.5 Club join request (slice 4): the leader gets "<name> asked to join <club>"; after approval the member gets "You're now a member of <club>".
6.6 Profile → **Notification settings**: turn **Updates from race organisers** off, **Save**, send another update (next week, or ask me to lower the limit): you don't get it. Turn it back on.
6.7 **Mark all as read** clears the dots and the bell number.
Phone notifications (after `docs/phase-3/FIREBASE-SETUP.md` and the new APK):
6.8 After your first **Going** on a race, a screen explains notifications **before** Android's own "Allow RunLime to send you notifications?" prompt (Android 13+). Tap **Turn on notifications**, then **Allow**: "Notifications are on."
6.9 Lock the phone. From the website, postpone the race or send an update: a phone notification arrives within about a minute. Tap it: the race opens in the app.
6.10 Notification settings shows "Phone notifications: On". If you tapped **Don't allow** in step 6.8, it shows **Open phone settings** instead (no repeated prompts).
6.11 Sign out: the phone stops getting your notifications.
