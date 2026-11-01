#!/usr/bin/env bash
# Runs inside the emulator step of "Android UI check". Fails if the report box or "Send report" can't sit above
# the open keyboard. Screenshots land in /tmp/ui.
set -euo pipefail
mkdir -p /tmp/ui && cd /tmp/ui
adb install -r /tmp/app.apk
# A freshly booted CI emulator can show "Pixel Launcher isn't responding" over the app; let it settle first.
sleep 20
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true
adb shell settings put secure show_ime_with_hard_keyboard 1
status=0
if ! maestro test "$GITHUB_WORKSPACE/.maestro/report-keyboard-1-type.yaml" -e UI_EMAIL="$UI_EMAIL" -e UI_OTP="$UI_OTP"; then
  echo "FAIL  the sign-in and typing flow stopped (screenshot and crash log below)" | tee -a result.txt
  adb exec-out screencap -p > /tmp/ui/00-flow-stopped.png || true
  node "$GITHUB_WORKSPACE/scripts/android-screen-text.mjs" || true
  echo "--- crash log"; adb logcat -d -b crash | tail -40 || true
  echo "--- app log"; adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime|FATAL" | tail -40 || true
  status=1
fi
node "$GITHUB_WORKSPACE/scripts/android-keyboard-geometry.mjs" "Tell us what happened" | tee -a result.txt || status=1
maestro test "$GITHUB_WORKSPACE/.maestro/report-keyboard-2-scroll.yaml" || { echo "FAIL  could not scroll to \"Send report\" with the keyboard open" | tee -a result.txt; status=1; adb exec-out screencap -p > /tmp/ui/02-send-report-not-reachable.png; }
node "$GITHUB_WORKSPACE/scripts/android-keyboard-geometry.mjs" "Send report" | tee -a result.txt || status=1
# Screenshots into the log too (test account and test text only), so they can be checked without the artifact.
# Screenshots are in the run's artifact; base64 copies in the log only on request (they are large).
if [ "${UI_PRINT_SCREENSHOTS:-0}" = "1" ]; then
  for f in /tmp/ui/*.png; do
    [ -f "$f" ] || continue
    echo "SCREENSHOT $(basename "$f") BEGIN"; base64 -w 120 "$f"; echo "SCREENSHOT $(basename "$f") END"
  done
fi
exit $status
