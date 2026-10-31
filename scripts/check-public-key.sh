#!/usr/bin/env bash
# Refuses a "public" Supabase key that is really a secret one (incident 2026-10-31: a secret key was put in the
# SUPABASE_ANON_KEY variable and built into an APK). Accepts a publishable key (sb_publishable_…) or the legacy anon
# JWT (role "anon"). Never prints the key. Usage: check-public-key.sh "$KEY"
set -euo pipefail
key="${1:-}"
fail() { echo "::error::The value in SUPABASE_ANON_KEY is not a public key ($1). Do not build or deploy. Put the anon/publishable key back (Supabase → Project settings → API keys) and rotate the secret key if it was exposed (docs/operations/INCIDENT-RESPONSE.md)."; exit 1; }
case "$key" in
  sb_publishable_*) exit 0 ;;
  sb_secret_*) fail "it is a secret key" ;;
  eyJ*.*.*)
    payload=$(printf '%s' "$key" | cut -d. -f2 | tr '_-' '/+')
    while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="$payload="; done
    role=$(printf '%s' "$payload" | base64 -d 2>/dev/null | grep -o '"role" *: *"[a-z_]*"' | grep -o '[a-z_]*"$' | tr -d '"' || true)
    [ "$role" = "anon" ] && exit 0
    fail "its role is '${role:-unknown}', not anon" ;;
  *) fail "unrecognised format" ;;
esac
