# Turning on phone notifications (Firebase Cloud Messaging) — owner steps

**Cost:** free. Firebase's no-cost **Spark** plan; no card needed. If any screen asks for a card or to upgrade to **Blaze**, stop and tell me — it isn't needed for this.
**Time:** about 15 minutes. **Secrets:** nothing goes into chat. The server key passes through a GitHub secret that you delete straight after (Part C); the app config file goes into Expo's website (Part D).

Until this is done, everything still works: notifications appear in the **bell inbox**; only the phone pop-ups are off. The app says "Phone notifications aren't available in this test version yet" if you try to turn them on.

## A. Create the Firebase project
1. On a computer, go to **https://console.firebase.google.com** and sign in with **runlimett@gmail.com**.
2. **Create a project** (or "Add project"). Name: **RunLime**. Accept the Firebase terms.
3. When asked about **Google Analytics for this project**, switch it **off** (we don't use it, and it keeps our Privacy Policy accurate). Click **Create project**, then **Continue**.

## B. Add the Android app and download its config file
4. On the project overview, click the **Android** icon ("Add app").
5. **Android package name:** `tt.runlime.app.dev` — the same package name you used for the Google sign-in Android client in Phase 2. (If you used a different one there, use that one here; it must match exactly.)
6. App nickname: **RunLime staging**. Leave the SHA-1 empty. Click **Register app**.
7. Click **Download google-services.json**. Keep the file; you'll upload it in step 15. Click **Next** → **Next** → **Continue to console** (skip the code steps; I've done them).

## C. Give Expo the Firebase sender key (server side), through GitHub
Nothing to install, no keystore involved. The key goes into a GitHub secret for a few minutes, a workflow hands it to Expo, then you delete the secret.

**Does this affect Google sign-in? No.** The key is attached only to the FCM V1 slot of Expo's credentials for `tt.runlime.app.dev`. The app signing key (whose SHA-1 the Google sign-in Android client is tied to) isn't created, read or changed, and the workflow checks that after the upload.

**Don't use "Add application identifier" on expo.dev.** That wizard asks for an upload keystore, which staging doesn't use: staging APKs are built `withoutCredentials` and signed with the React Native debug keystore (SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`), which isn't stored on Expo. When Expo has no Android credentials for the app, the workflow creates a record holding **only** the FCM V1 key (no keystore, no build credentials) through Expo's API. Staging builds never read that record, so signing and Google sign-in stay exactly as they are.

**C1. Download the key from Firebase**
8. In Firebase: gear icon ⚙ → **Project settings** → **Service accounts** tab → **Generate new private key** → **Generate key**. A JSON file downloads. **This file is a secret.** Don't email it, don't paste it into chat.

**C2. Put it in a GitHub secret (staging environment)**
9. GitHub → the **RunLime** repository → **Settings** → **Environments** (left menu) → **staging**.
10. Under **Environment secrets**, click **Add environment secret**.
    - Name: `FCM_SERVICE_ACCOUNT_JSON`
    - Value: open the downloaded file in Notepad, press **Ctrl+A**, **Ctrl+C**, then paste it into the box. Paste the whole file unchanged.
    - Click **Add secret**.
11. Delete the downloaded file from your computer, and empty the Recycle Bin. If you ever need it again, generate a new key (step 8); you never need the old file.

**C3. Run the upload**
12. GitHub → **Actions** → **Upload FCM key** (left list) → **Run workflow** → branch **main** → **Run workflow**.
13. When it finishes (about 1 minute), open the run → **upload** → **Upload to Expo and verify**. A green tick and these lines mean it worked:
    - `Firebase project ID: runlime-a3849`. The workflow refuses a key from any other project, and changes nothing if so.
    - `uploaded` (or `This key is already attached` if you run it twice)
    - `FCM V1 key attached to tt.runlime.app.dev (Firebase project …)`
    - `Build signing unchanged: no signing keys on Expo (staging APKs keep the debug keystore, SHA-1 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25)`. This is the same SHA-1 as your Google sign-in Android client, so sign-in is unaffected.

    A red cross shows one line starting with `failed:` and what to fix. Nothing from the key is ever printed (the logs are public). Tell me the `failed:` line if it isn't clear.

**C4. Delete the secret**
14. GitHub → **Settings** → **Environments** → **staging** → next to `FCM_SERVICE_ACCOUNT_JSON`, click the **bin icon** → confirm. Expo now keeps the key, encrypted. Do this even if the upload failed. You can add the secret again to retry.

_Optional check:_ expo.dev → RunLime → **Credentials** → **Android** → `tt.runlime.app.dev` shows an **FCM V1 service account key** with your Firebase project ID.
_Alternative:_ if GitHub ever isn't an option, the same file can be uploaded on that expo.dev page (**Add a service account key**).

## D. Give the app build the Firebase config (app side)
15. On **https://expo.dev** → the RunLime project → **Environment variables** → **Add variable**:
    - Name: `GOOGLE_SERVICES_JSON`
    - Type: **File**, upload `google-services.json` from step 7
    - Environments: tick **preview** (our staging builds use it)
    - Visibility: **Sensitive**
    - Save.

## E. Switch on sending (one click)
16. GitHub → **Actions** → **Configure push** → **Run workflow** → target **staging** → Run. It creates a random secret, gives it to our sending function and the database, and checks the function only accepts that secret. Green tick = done. (Nothing secret is printed.)
17. Tell me "Firebase done". I'll build a new APK (the Firebase file is read when the app is built).

## F. Check it on the phone (after you install that APK)
See `docs/phase-3/RETEST.md`, slice 6, steps 6.8–6.11.

## If something goes wrong
- "Phone notifications aren't available in this test version yet": the APK was built before step 15, or the package name in step 5 doesn't match. Tell me which.
- Notifications reach the inbox but not the phone: run **Configure push** again (step 16) and check it ends green.
- To turn push off completely: delete the `GOOGLE_SERVICES_JSON` variable in Expo; the inbox keeps working.
