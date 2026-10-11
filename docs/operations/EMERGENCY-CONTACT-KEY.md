# Emergency-contact encryption key — backup and rotation procedure

**Owner:** the RunLime operator (super admin). **Applies to:** every Supabase project (staging and production each have their **own** key).

## What the key protects
- Emergency contacts are encrypted with AES-256-GCM in the `emergency-contact` Edge Function.
- The database stores only ciphertext of the form `v<version>:<iv>:<ciphertext>`. Each ciphertext is bound to its owner's user id, so it can't be copied to another account.
- Keys live only in **Supabase Edge Function secrets**:
  - `EMERGENCY_CONTACT_KEY_V<n>`: 32 random bytes, base64
  - `EMERGENCY_CONTACT_KEY_VERSION`: the version used for new writes
- Old versions stay available for decryption until rotation finishes.
- **If every copy of a key is lost, the contacts encrypted with it can't be recovered.** Users would have to re-enter them. Nothing else in RunLime depends on this key.

## 1. Creating a key (first time, or for rotation)
Do this on **your own computer**. Never in a chat, an email, a ticket or a git commit.
- macOS/Linux/WSL: `openssl rand -base64 32`
- Windows PowerShell (5.1 or 7): `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)`
- The result is 44 characters long and ends with `=`.

## 2. Backup (do this immediately, before the key is used)
1. Save the key in your **password manager** (a free one such as Bitwarden or KeePassXC is fine). Use an entry named `RunLime <staging|production> emergency-contact key v<n>`, with the creation date in the notes.
2. Keep a **second, offline copy**: print it, or write it on paper, and store it somewhere safe and separate from your computer (for example with your important documents). A password manager alone is a single point of failure.
3. Record in the same entry: which project (staging `fmnmylqxrmxuzmdcvmhs`, or production), the version number, and that it's the *current* key.
4. Only then add it to Supabase: **Dashboard → Edge Functions → Secrets → Add**. Set `EMERGENCY_CONTACT_KEY_V<n>` to the key and `EMERGENCY_CONTACT_KEY_VERSION` to `<n>`.
5. Run **Verify** (section 4). Expect `undecryptable: 0`.

## 3. Rotation
Rotate once a year, whenever someone who had access to the secret leaves, or immediately if you suspect the key leaked.
1. Create the new key `V<n+1>` and back it up (sections 1–2). **Keep the old key's secret in place.**
2. In Supabase Secrets, add `EMERGENCY_CONTACT_KEY_V<n+1>` and change `EMERGENCY_CONTACT_KEY_VERSION` to `<n+1>`. New saves now use the new key. Old rows still decrypt with `V<n>`.
3. Run **GitHub → Actions → "Emergency-contact key" → Run workflow**, choosing the environment and `verify`. Expect `undecryptable: 0`, with rows on both versions.
4. Run the same workflow with `rotate`. It re-encrypts every row that's still on an old version. Expect `failed: 0`.
5. Run `verify` again. Expect all rows on `v<n+1>` and `undecryptable: 0`.
6. Delete the old secret `EMERGENCY_CONTACT_KEY_V<n>` from Supabase. Run `verify` once more: it must still show `undecryptable: 0`.
7. In your password manager, mark the old key "retired <date>". Keep it for 90 days, in case a backup restore brings back old rows. Then destroy it, along with its paper copy.

If you suspect a leak: do steps 1–6 the same day. Then follow the incident steps in the Privacy Policy, including assessing whether affected users must be told.

## 4. Verify (run quarterly and after any change)
`verify` decrypts every stored contact in memory and reports counts only. It never returns or logs contact details.
- `undecryptable: 0` means the configured keys match the data.
- `undecryptable > 0` means a key is missing or wrong. Restore it from your password manager or paper backup (section 5) **before** deleting anything.

## 5. Recovery (key missing or wrong in Supabase)
1. Find the key version in the verify output (`byVersion`).
2. Copy that version's key from your password manager. If that's unavailable, type it in from the paper copy.
3. Re-add it in Supabase Secrets under the same name, `EMERGENCY_CONTACT_KEY_V<n>`.
4. Run `verify` again and expect `undecryptable: 0`.

## 6. Database backups and restores
Supabase backups contain only ciphertext. Restoring a backup **doesn't** restore keys. Before restoring, make sure the Supabase secrets include every key version that appears in that backup. That's why retired keys are kept for 90 days.

## Who may do what
- **Owner:** creates, backs up and rotates keys; can open the GitHub workflow and Supabase Secrets.
- **Claude / developers:** never see the key. Code reads it only inside the Edge Function. The GitHub workflow calls the function with the service role key held in GitHub environment secrets.

_Tested locally on 2026-10-11:_
- rotated v1 → v2 (2 rows, 0 failures)
- retired v1: 0 undecryptable
- a wrong key produced `undecryptable: 2`
- restoring the backup returned it to 0
