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
