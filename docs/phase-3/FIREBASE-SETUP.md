# Turning on phone notifications (Firebase Cloud Messaging) — owner steps

**Cost:** free. Firebase's no-cost **Spark** plan; no card needed. If any screen asks for a card or to upgrade to **Blaze**, stop and tell me — it isn't needed for this.
**Time:** about 15 minutes. **Secrets:** nothing goes into chat. Files go straight into Expo's website.

Until this is done, everything still works: notifications appear in the **bell inbox**; only the phone pop-ups are off. The app says "Phone notifications aren't available in this test version yet" if you try to turn them on.

## A. Create the Firebase project
1. On a computer, go to **https://console.firebase.google.com** and sign in with **runlimett@gmail.com**.
2. **Create a project** (or "Add project"). Name: **RunLime**. Accept the Firebase terms.
3. When asked about **Google Analytics for this project**, switch it **off** (we don't use it, and it keeps our Privacy Policy accurate). Click **Create project**, then **Continue**.

## B. Add the Android app and download its config file
4. On the project overview, click the **Android** icon ("Add app").
5. **Android package name:** `tt.runlime.app.dev` — the same package name you used for the Google sign-in Android client in Phase 2. (If you used a different one there, use that one here; it must match exactly.)
6. App nickname: **RunLime staging**. Leave the SHA-1 empty. Click **Register app**.
7. Click **Download google-services.json**. Keep the file; you'll upload it in step 10. Click **Next** → **Next** → **Continue to console** (skip the code steps; I've done them).

## C. Give Expo the Firebase sender key (server side)
8. In Firebase: gear icon ⚙ → **Project settings** → **Service accounts** tab → **Generate new private key** → **Generate key**. A JSON file downloads. **This file is a secret.**
9. Go to **https://expo.dev** → the **RunLime** project → **Credentials** (left menu) → **Android** → choose the app identifier `tt.runlime.app.dev` → under **FCM V1 service account key**, click **Add a service account key** → upload the JSON from step 8 → Save. Then **delete the downloaded file** from your computer (Expo keeps it encrypted).

## D. Give the app build the Firebase config (app side)
10. Still on expo.dev → the RunLime project → **Environment variables** → **Add variable**:
    - Name: `GOOGLE_SERVICES_JSON`
    - Type: **File**, upload `google-services.json` from step 7
    - Environments: tick **preview** (our staging builds use it)
    - Visibility: **Sensitive**
    - Save.

## E. Switch on sending (one click)
11. GitHub → **Actions** → **Configure push** → **Run workflow** → target **staging** → Run. It creates a random secret, gives it to our sending function and the database, and checks the function only accepts that secret. Green tick = done. (Nothing secret is printed.)
12. Tell me "Firebase done". I'll build a new APK (the Firebase file is read when the app is built).

## F. Check it on the phone (after you install that APK)
See `docs/phase-3/RETEST.md`, slice 6, steps 6.8–6.11.

## If something goes wrong
- "Phone notifications aren't available in this test version yet": the APK was built before step 10, or the package name in step 5 doesn't match. Tell me which.
- Notifications reach the inbox but not the phone: run **Configure push** again (step 11) and check it ends green.
- To turn push off completely: delete the `GOOGLE_SERVICES_JSON` variable in Expo; the inbox keeps working.
