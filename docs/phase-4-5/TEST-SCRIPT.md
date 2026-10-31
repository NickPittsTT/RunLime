# Phase 4 + 5 phone test script

**Status: draft. The APK is not built yet.** One combined APK covers Phase 4 (GPS check-in) and Phase 5 (run tracker). The link is added here when it is built.
Phase 4/5 also needs the database and website on staging. **They are not deployed yet.** The owner decides when (see docs/reports/LATEST.md).

Report pass or fail for each step. Add a screenshot for any failure.
- **[App]** = phone app.
- **[Website]** = website. A laptop is easiest for the admin steps.

The test is planned as **one outdoor outing** (part A: check-in, then a short run) plus **indoor checks** that need no outing (parts B and C).
Expected time outside: about 30 minutes.

## Before the outing (indoors, about 10 minutes)

P0.1 [Website] Sign in as admin (with MFA). Go to Admin → Events → **Add event** → RunLime listing. Fill it in as follows:
- name "Check-in test (delete after)";
- the start time **30 minutes after you plan to arrive**;
- a park or open space near you as the venue.

P0.2 Type the venue and tap **Search**:
- a result appears with a label **Exact**, **Street** or **Town**;
- a **Town**-only result asks you to place the pin by hand;
- the OpenStreetMap credit is shown.

Drag the pin to the exact spot you will stand at. Tap **Open in Google Maps (satellite)** beside the pin: Google Maps opens in a new tab or the Maps app, in satellite view, centred on the pin (the centre of the screen is the pin; there's no marker). If the pin ends up more than 1 km from the found address, a warning appears.
P0.3 Try **Publish** without the ticks: it is refused. Tick **The pin is on the start line** and **Pin checked**, then publish. Now move the pin slightly and save. Both ticks are cleared and must be ticked again before publishing. Put the pin back, tick both and publish.
P0.4 [App] Open the race. The **Race-day check-in** box says when check-in opens (1 hour before the start) and that it works **within 500 m of the start**.
P0.5 [App] If the start is more than 1 hour away, tap **Check in**. The app asks for location ("while using the app" only; there is **no** "all the time" option). The result is **Check-in opens at …**.

## Part A: outdoor outing

### Phase 4: check-in (at the venue)
A4.1 [App] **About 600–1000 m from the pin** (on the way), tap **Check in** → "Your phone places you about … m from the start; check-in works within 500 m…". Tap **I'm here but can't check in**, type a note, send → "Sent. A RunLime admin will check…".
A4.2 [App] **Within 500 m of the pin**, tap **Check in** → **Checked in at HH:MM, by GPS**. Tap again → already checked in (no second check-in).
A4.3 [Website] Admin → Events → this race: the **check-in count** shows 1 (no names). Admin → **Check-ins**: the help request from A4.1 is listed. **Decline** it with a short reason (it is no longer needed; approving is tested in B4.3).

### Phase 5: short run (straight after, 10–15 minutes)
A5.1 [App] Tap **Start run** (home screen). The pre-run screen shows:
- **Auto-pause** (on by default);
- **Body weight in kg (optional)**, which says it stays on the phone.

Leave the weight empty. Tap **Start**. The app asks for **physical activity** (steps) once. Allow it the first time. (B5.2 checks refusing it.)
A5.2 [App] A notification "**RunLime is recording your run**" appears and stays while recording. Time, distance and pace update; the map draws your route.
A5.3 [App] **Lock the phone** and run/walk for at least 3 minutes, then unlock. The distance and route include the locked part (no straight-line jump across it).
A5.4 [App] Stand still for 15 seconds → **Auto-paused while you're stopped.** Move on → it resumes by itself. Tap **Pause** → "Paused. Time and distance aren't counting." Walk 50 m, tap **Resume**: those 50 m are not counted.
A5.5 [App] Turn on **airplane mode** for the last few minutes (the GPS still works). Tap **Stop**. The summary shows:
- distance, moving time, pace and splits;
- steps;
- calories labelled as a **general estimate** (because no weight was given).

Tap **Save run**. The notification goes away.
A5.6 [App] Menu → **Run history**: the run is listed with **Saved on this phone. It uploads when you're online.** Turn airplane mode off and reopen Run history. The run shows **Saved.** (uploaded). The **Races** totals list the test race (the run started during its check-in window, after you checked in).
A5.7 Compare the distance with a known route or another app. Within about 5% is a pass; note the numbers either way.

## Part B: indoor checks (any day)

### Phase 4
B4.1 [Website] Admin → the test race → **GPS check-in** → **Check-in radius in metres**: 2000, save. The message reads "Saved. N earlier failed check-ins now pass and were approved after correction." Only runners who never checked in are counted. If only your own account tried (you checked in at A4.2), it just says "Saved." That is a pass; the re-test rule itself is covered by pgTAP 028. To see N ≥ 1, have a second account tap Check in from 600–1000 m away during the outing. That runner's race page shows **Checked in at …, approved after the race pin was corrected**.
B4.2 [App] A second account that has not checked in tries **Check in** at home after the race window → **Check-in for this race has closed.**
B4.3 [App] That account taps **I'm here but can't check in**. [Website] Admin → Check-ins:
- **Approve** with an empty reason → refused.
- Approve with a reason → done. The runner gets a notification in the bell.
- The race page shows **Checked in at …, confirmed by a RunLime admin**.

B4.4 [Website] Change the race status to **Postponed** with a new date tomorrow. [App] Check-in now says it opens 1 hour before the **new** date. Use **Back on** afterwards.
B4.5 [App] Menu → **Your data** → **Download my data**: the file contains `check_ins` and `runs`.
B4.6 [App] Turn location **off** for the app in phone settings, then tap **Check in** → message: allow location while the app is open.

### Phase 5
B5.1 [App] Start a run with a body weight (e.g. 70). Walk around for 1 minute, stop and save. The calories no longer say "general estimate". Menu → **Sign out**, then sign back in. The weight box is empty again: weight and run settings are cleared on sign-out, and the run is uploaded before the sign-out.
B5.2 [App] Phone settings → RunLime → Physical activity: **Don't allow**. Start a run. The run works; the summary has no steps line.
B5.3 [App] Turn **Auto-pause** off before a run. Standing still no longer pauses.
B5.4 [App] Open a saved run → **Export GPX** → share to Files/Drive. The file opens in another app (e.g. a GPX viewer) and shows the route. The run page says **Only you can see this route.**
B5.5 [App] **Delete run** → confirm. It disappears from history and from the totals.
**B5.6 SWIPE-AWAY TEST (clearly marked: please do this one)**
1. [App] Start a run (outdoors or walking around indoors is fine). Wait until the distance shows at least 0.05 km.
2. Open the recent-apps screen and **swipe RunLime away**.
3. Check the notification shade: **expected:** the notification "RunLime is recording your run" is **still there**.
4. Walk for 2 minutes. Then tap the notification (or open RunLime and tap **Start run**).
5. **Expected:** the live run screen opens with the timer still counting and the distance **including the 2 minutes you walked** after swiping. Stop and save as usual.

Report which of these you saw:
- **(a) Pass:** the notification stayed and the distance includes the walk.
- **(b) Partial:** the notification disappeared, but on reopening the run is still there. The part after the swipe is missing, or drawn as a straight line. Stop and save works.
- **(c) Fail:** the run is gone.

Also note your phone make and model and Android version (different makers' battery savers behave differently).

What happens next for each result: see the report's "Swipe-away fallback". In short, (b) gets a gap-as-pause fix plus a battery-settings tip, and (c) is a bug I fix before the next build.
B5.7 Battery: note the battery % before and after the 10–15 minute run in A5. About 1–2% per 10 minutes is expected on a typical phone.

## Part C: website only (any day)
C1 [Website] As an organiser, create a race and tap **Submit**. Submitting is refused until **The pin is on the start line** is ticked.
C2 [Website] As a runner (not an organiser or admin), the venue search is not offered.

## What CI already checks (no phone needed)
- pgTAP 028 (check-in rules, window, radius, accuracy allowance, help queue, re-test, privacy, purge, daily limit, venue search) and 029 (runs privacy, validation, race link, totals, export, deletion).
- Shared unit tests (distance, bad-point filter, auto-pause, splits, calories, GPX, privacy trim).
- App unit tests (check-in panel, tracker screen, offline outbox).
- Web E2E (pin ticks, check-in queue, check-in count).
- Not covered by CI: real GPS, the locked screen, the foreground notification, the step sensor, battery and distance accuracy. These need the phone (part A).
