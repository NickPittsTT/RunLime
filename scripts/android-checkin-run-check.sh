#!/usr/bin/env bash
# Runs inside the emulator step of "Android UI check" (flow: checkin-run). Phase 4+5 with emulator mock locations:
# check in 2 km from a test race pin (expect "too far"), then next to it (expect "Checked in"); replay a 1 km route
# and check the live distance is within 10%; stop, save, and see it uploaded. Results in /tmp/ui/result.txt.
set -euo pipefail
mkdir -p /tmp/ui && cd /tmp/ui
adb install -r /tmp/app.apk
status=0
shot() { adb exec-out screencap -p > "/tmp/ui/$1.png" || true; }
logs() {
  echo "--- crash log"; adb logcat -d -b crash | tail -40 || true
  echo "--- app log"; adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime|FATAL" | tail -60 || true
}
env_args=(-e UI_EMAIL="$UI_EMAIL" -e UI_OTP="$UI_OTP" -e CHECKIN_EVENT_ID="$CHECKIN_EVENT_ID")
if maestro test "$GITHUB_WORKSPACE/.maestro/checkin-run-1.yaml" "${env_args[@]}"; then
  echo "PASS  check-in 2 km from the pin: \"too far\" (within 500 m needed)" | tee -a result.txt
  echo "PASS  check-in next to the pin: \"Checked in … by GPS\"" | tee -a result.txt
else
  echo "FAIL  check-in flow stopped (see screenshot 00-checkin-stopped and the log)" | tee -a result.txt
  shot 00-checkin-stopped; logs; status=1
fi
run_ok=0
if [ $status -eq 0 ]; then
  # Evidence: the emulator's own GPS fix once a second during the replay (time, lat, lng), to tell a replay
  # problem from an app problem.
  ( while true; do echo "$(date +%s) $(adb shell dumpsys location 2>/dev/null | grep -m1 -oE 'Location\[gps [-0-9.]+,[-0-9.]+' | sed 's/Location\[gps //')"; sleep 1; done ) > /tmp/ui/fixes.txt &
  sampler=$!
  t0=$(date +%s)
  if maestro test "$GITHUB_WORKSPACE/.maestro/checkin-run-2.yaml"; then
    run_ok=1
    echo "INFO  route replay took $(( $(date +%s) - t0 )) s (a 1 km route at 4 m/s should take about 250 s)" | tee -a result.txt
    sleep 8
    node "$GITHUB_WORKSPACE/scripts/android-run-distance.mjs" 1.0 0.1 | tee -a result.txt || status=1
    shot 24-live-distance
  else
    echo "FAIL  run start or route replay stopped (see screenshot 00-run-stopped and the log)" | tee -a result.txt
    shot 00-run-stopped; logs; status=1
  fi
  kill $sampler 2>/dev/null || true
  node "$GITHUB_WORKSPACE/scripts/android-fix-summary.mjs" /tmp/ui/fixes.txt | tee -a result.txt || true
fi
# Save the run even when the distance check failed, so the saved run can be inspected on staging.
if [ $run_ok -eq 1 ]; then
  if maestro test "$GITHUB_WORKSPACE/.maestro/checkin-run-3.yaml"; then
    echo "PASS  run stopped, saved and uploaded (\"Saved.\")" | tee -a result.txt
  else
    echo "FAIL  stop/save flow stopped (see screenshot 00-save-stopped and the log)" | tee -a result.txt
    shot 00-save-stopped; logs; status=1
  fi
fi
for f in /tmp/ui/*.png; do
  [ -f "$f" ] || continue
  echo "SCREENSHOT $(basename "$f") BEGIN"; base64 -w 120 "$f"; echo "SCREENSHOT $(basename "$f") END"
done
exit $status
