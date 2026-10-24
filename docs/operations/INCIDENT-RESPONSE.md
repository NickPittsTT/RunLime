# Incident response (one page)

**Who:** Nicholas (owner) decides and rotates keys; Claude investigates, patches and records. No secret values in chat, issues or commits.
**Severity:** **S1** data exposure / account takeover / child at risk · **S2** outage or exploitable bug, no evidence of exposure · **S3** everything else.

## 1. Detect
Sources:
- Admin report alerts (child safety = urgent)
- Dependabot and CI audit failures
- gitleaks and build-scan failures
- Hosted Security Advisor errors after deploys
- Supabase/Cloudflare/Expo/Google security emails
- Users writing to the support address
- Odd audit-log entries (`admin_audit_log` RPC as an MFA admin; an audit screen comes in Phase 7)

Write down the time first noticed and who noticed.

## 2. Contain (first hour for S1)
- **Child at risk:** follow the Moderation Policy. Remove content and suspend the account; report to TTPS (999 for immediate danger) and, for CSAM, NCMEC. Preserve records; don't delete evidence.
- **Leaked or suspected secret:** rotate it using the table below, then redeploy what uses it. Rotate first, investigate after.
- **Exploited bug:** turn off the feature with a setting where one exists, or roll back by moving `main` to the last good commit and redeploying.

| Secret | Rotate where | Then |
|---|---|---|
| Supabase service-role key / JWT secret | Supabase → Project settings → API (JWT keys) | **Also changes the anon key:** update GitHub secrets/variables, redeploy web + functions, **rebuild the APK** (anon key is built in), Configure push + admin alerts again |
| Database password | Supabase → Database → Reset password | Update `SUPABASE_DB_PASSWORD` (GitHub) |
| Supabase access token | supabase.com → Account → Access tokens (revoke, create) | Update `SUPABASE_ACCESS_TOKEN` |
| Cloudflare API token | Cloudflare → My Profile → API Tokens (roll) | Update `CLOUDFLARE_API_TOKEN` |
| Expo token | expo.dev → Account → Access tokens (revoke, create) | Update `EXPO_TOKEN` |
| FCM service-account key | Firebase → Project settings → Service accounts (delete key, generate new) | Run **Upload FCM key** with the new file, delete the secret |
| Push / admin-alert dispatch secrets | — | Re-run **Configure push** / **Configure admin alerts** (they generate new random secrets) |
| Gmail app password (SMTP) | Google Account → Security → App passwords (remove) | New app password → Supabase Auth SMTP + **Configure admin alerts** |
| Emergency-contact key | `docs/operations/EMERGENCY-CONTACT-KEY.md` (rotate + re-encrypt) | Verify with the key workflow |
| Google OAuth client secret | Google Cloud → Credentials | Update Supabase Auth → Google provider |
| User sessions | Supabase → Authentication (sign out users) or revoke refresh tokens | Affected users sign in again |
| Admin account | Remove role with `set_platform_admin`; reset MFA factor | Re-enrol TOTP |

## 3. Assess (within 24 h)
- **What happened and when:** use the audit log (`admin_audit_log`), Supabase logs, GitHub Actions history and Cloudflare analytics.
- **What data and how many people:** check which tables and columns were involved, and whether emergency contacts were involved (encrypted; was the key exposed?).
- **Is it still happening?** Has the root cause been fixed, and is there a test that would catch it again?

## 4. Notify
- **People affected:** for S1 involving personal data, plain-language email from the support address as soon as the facts are clear (target 72 h). Say what happened, what data, what we did, and what they should do.
- **Authorities:** the attorney confirms the duties under the Trinidad and Tobago Data Protection Act. Child safety: TTPS / NCMEC as above.
- **Stores:** if the app or store listing is affected, follow Apple/Google instructions (Phase 8+).
- **Providers:** report abuse of their service (Supabase, Cloudflare, Expo, Google) through their security contacts.

## 5. Record (within 7 days)
- Add `docs/operations/incidents/YYYY-MM-DD-short-name.md`:
  - timeline, severity, impact (counts, no names), actions, root cause;
  - the test or control added, and follow-ups with owners and dates.
- No personal data or secret values in the record.
- Update the risk register in `SECURITY-PLAN.md`, and this page if a step was missing.
