#!/usr/bin/env bash
# Runs inside the emulator step of "Android UI check". Fails if the report box or "Send report" can't sit above
# the open keyboard. Screenshots land in /tmp/ui.
set -euo pipefail
mkdir -p /tmp/ui && cd /tmp/ui
adb install -r /tmp/app.apk
adb shell settings put secure show_ime_with_hard_keyboard 1
status=0
maestro test "$GITHUB_WORKSPACE/.maestro/report-keyboard-1-type.yaml" -e UI_EMAIL="$UI_EMAIL" -e UI_OTP="$UI_OTP"
node "$GITHUB_WORKSPACE/scripts/android-keyboard-geometry.mjs" "Tell us what happened" | tee -a result.txt || status=1
maestro test "$GITHUB_WORKSPACE/.maestro/report-keyboard-2-scroll.yaml"
node "$GITHUB_WORKSPACE/scripts/android-keyboard-geometry.mjs" "Send report" | tee -a result.txt || status=1
exit $status
