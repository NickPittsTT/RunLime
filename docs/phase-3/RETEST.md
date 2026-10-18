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
