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
