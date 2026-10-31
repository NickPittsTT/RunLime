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
maestro test "$GITHUB_WORKSPACE/.maestro/report-keyboard-2-scroll.yaml" || { echo "FAIL  could not scroll to \"Send report\" with the keyboard open" | tee -a result.txt; status=1; adb exec-out screencap -p > /tmp/ui/02-send-report-not-reachable.png; }
node "$GITHUB_WORKSPACE/scripts/android-keyboard-geometry.mjs" "Send report" | tee -a result.txt || status=1
# Screenshots into the log (downscaled; test account and test text only), so they can be checked without the
# artifact download.
for f in /tmp/ui/*.png; do
  [ -f "$f" ] || continue
  convert "$f" -resize 360x -quality 70 "/tmp/ui/small.jpg" 2>/dev/null || continue
  echo "SCREENSHOT $(basename "$f") BEGIN"; base64 -w 76 /tmp/ui/small.jpg; echo "SCREENSHOT $(basename "$f") END"
done
exit $status
