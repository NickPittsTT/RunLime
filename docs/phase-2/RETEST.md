# Phase 2 re-test (items 1–8)

About 20 minutes. Install the new staging APK over the old one: https://expo.dev/artifacts/eas/XMsbXyhkSdIU9TLQG4f8F78XaKFVjtGaHmGiM-gU58Q.apk (EAS build 2a28da77, commit `c59d427`; same signing key, so Google sign-in still works). Use the real PSCU listing; put it back to normal at the end.

## What went wrong last time (item 1)
The app was right: the race really was back to "published". Staging's change history shows the race was postponed and put back to published 57 seconds later, then cancelled and put back 7 seconds later. The cause was the admin **Publish** button, which was still shown on postponed and cancelled races and set them straight back to published. Publish now only appears for races that aren't live yet, and the database refuses it on postponed or cancelled races.

## 1. Status changes reach the app
1. Website → Admin → Events → PSCU race. At the top: a large **Status: Scheduled** box. There is **no** Publish button.
2. **Change status → Postpone**, reason "Re-test: postponed", **Update status**. The box turns amber: **Status: Postponed**, with the reason. Still no Publish button.
3. Phone: on the race list, pull down. The PSCU card shows a yellow **POSTPONED** strip with the reason. In the month view, 31 Oct is yellow (key under the calendar). "Updated <time>" shows under the title.
4. Open the race: yellow **POSTPONED** banner at the top. Website: **Change status → Cancel**, reason "Re-test: cancelled". On the phone, pull down on the race page: red **CANCELLED** banner. Back on the list, pull down: red strip; 31 Oct is red with the date struck through.
5. Airplane mode, close and reopen the app: the list still shows **CANCELLED**, with "Offline. Showing races as last updated <date, time>". Open the race: same banner plus "Offline. Showing this race as last updated …". Airplane mode off.
6. Website: **Change status → Back on (no longer cancelled)**. Phone: pull down; the strips are gone.

## 2. List and map
7. Home opens on **List**. Tap **Map** in the List | Map switch: pins show the race name above them; the map credit (OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors) is visible bottom-right, and tapping "© OpenStreetMap contributors" opens the copyright page. Tap **List** to go back.
8. Choose a filter (e.g. an area). A line **"Showing: <filters>"** appears with **Clear filters**; one tap clears them.

## 3. Admin events page
9. Admin → Events: **"Add a race you found" → New RunLime listing** is the big first action. **"Organiser events (less common)"** is below, separate. Open **New event for an organiser**: if no verified organisation exists, a yellow box explains why the list is empty and links to Add organisation.

## 4. Add organisation
10. Admin → Organisers → **Add organisation**. Only create a real organisation (e.g. PSCU, if you're working with them); leave the owner email blank if they have no account yet. Expected: "Organisation created and verified." It is now in the Verified tab and in the organiser-event dropdown. (The automated test covers a made-up one; skip this step if you don't have a real one yet.)

## 5. Flyer on a RunLime listing only with permission
11. PSCU listing page → **Organiser's flyer and sponsors**: no upload until you tick **"I have the organiser's permission to use this image"** and **Save permission**. Then "Recorded <date, time>" shows. Only if PSCU has agreed: upload the flyer (no "Photo" type for listings), then check it shows on the public race page and in the app. Otherwise untick and save, and skip the upload.

## 6–8. Onboarding and filters
12. Phone: menu → Sign out, then sign in again with the same account. The welcome screens **don't** appear again, because your answers are on your account now. (To see them again, reinstall the app and sign in: your saved areas and distances come back as filters.)
13. Filters: **Select all / Clear all** next to Areas and next to Distances. **Fun walk / under 5K** is the first distance.
14. Website `/races`: the Distance list includes "Fun walk / under 5K".

## Refund setting
15. Admin → Settings → `payments.cancel_refund_after_live_percent` shows **100** (option A). If you choose option B, set it to **50**; `/legal/refunds` then says "50% of the listing fee" for cancellations after the listing has been live.

Report pass or fail per step, with a screenshot for any failure.

---

## Re-check after the second round of fixes (website only; keep the same APK)
A. **Reason box:** Admin → Events → PSCU race → Change status → Postpone. The reason box shows "Minimum 5 characters". Type "Rain": the counter reads "4 / 500 characters · minimum 5" in red. Press Update status: "Please give a reason of at least 5 characters (you have 4)." appears and nothing changes. Type a longer reason: the race is postponed. Then **Change status → Back on**.
B. **Website map on your phone's browser:** Admin → Events → New RunLime listing. The map shows streets, and tapping it fills Start latitude/longitude. Also open any race page on the public site: the map shows the start pin. (Leave without saving if you don't need a new listing.)

---

## Final fix: postponing to a new date (2026-10-18)
**Root cause.** The new date *was* saved, but it overwrote the race's date and the original was thrown away, so nothing could say "Postponed to". Staging history for the PSCU listing shows it: 30 Oct 6:00 am became 17 Nov 2:33 pm when postponed, then 18 Nov 2:34 pm when it was put back on. The PSCU listing therefore **still says 18 Nov, 2:34 pm**: edit it and set the date back to the real one.

**Now.** The database keeps the original date (`original_starts_at`) and the new date (`starts_at`). Status options:
- *Postpone*: the new date is optional (leave it blank if not known yet: runners see "New date to be confirmed" and the listed date struck through).
- *Set or change the new date* (postponed races): the date is required; the original stays the first date.
- *Back on, on the original date*: undoes the postponement and restores the original date.
- A date is refused when cancelling or putting a race back on, and must be in the future.

**Re-check (install the new APK over the old one: https://expo.dev/artifacts/eas/j3POv-qs8USo_a0i1yR-7ChnPAuGXaYxaJ4m2nsGNOA.apk — EAS build 5d8970b0, same signing key):**
C1. Website → PSCU race → Change status → Postpone, new date a week later, reason "Re-test: new date". The status box says "Postponed to <date, time>. Original date: ~~<old date>~~".
C2. Phone, list: pull down. The card's yellow strip says **Postponed to <date, time>** and **Original date: ~~<old date>~~**; the card is listed under the new date.
C3. Month view: the new date is yellow; the original date has a dashed ring and a struck-through number ("Original date" in the key). Tap the original date: the race is listed there with its "Postponed to" strip.
C4. Open the race: same banner; the date line shows the new date.
C5. Website: Change status → **Back on, on the original date**. Phone: pull down; the race is back on its original date with no strip.
