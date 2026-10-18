# Report alert emails — owner steps (about 5 minutes, free)

Admins already get every new report **in the app's bell and as a phone notification** — nothing to set up for that.
This page switches on the **emails** to the support address (`legal.support_email`, currently runlimett@gmail.com):
"A child may be at risk" reports at once, everything else in one summary each morning at 7:50 am.

The emails go through the same Gmail account that sends sign-in codes. Supabase never shows that account's password
again, so GitHub needs its own copy for a few minutes. **Nothing goes into chat.**

## 1. Get a Gmail app password
1. Sign in to **https://myaccount.google.com** as **runlimett@gmail.com** → **Security** → **2-Step Verification** (must be on) → **App passwords**.
2. Name it **RunLime alerts** → **Create**. Google shows a 16-letter password once. Keep that tab open.
   (If you still have the app password you made for sign-in emails, you can use that one instead.)

## 2. Put it in a GitHub secret (staging environment)
3. GitHub → the **RunLime** repository → **Settings** → **Environments** → **staging** → **Add environment secret**.
4. Name: `SMTP_PASSWORD` · Value: the 16 letters (spaces don't matter) → **Add secret**.

## 3. Run the setup
5. GitHub → **Actions** → **Configure admin alerts** → **Run workflow** → branch **main**, target **staging** → **Run workflow**.
6. A green tick, and a **test email "RunLime admin alerts are set up"** in runlimett@gmail.com (check Spam the first time), mean it works.
   The log shows `wrong secret: HTTP 403 … test email: {"sent":1}`. Nothing secret is printed.

## 4. Tidy up
7. Delete the `SMTP_PASSWORD` secret in GitHub (Settings → Environments → staging → bin icon). Supabase keeps its copy.
8. To stop the emails later: in Google, remove the **RunLime alerts** app password. The bell and phone alerts keep working.

## What the emails contain
Only the category ("A child may be at risk", "Spam or scam" …), what was reported ("a profile", "a photo" …), the time,
and a link to **Admin → Reports**. Never the report text, the reporter or the reported person — those stay in the
admin console behind MFA. Please don't forward them.
