#!/usr/bin/env bash
# Runs inside the emulator step of "Android UI check" (flow: checkin-run). Phase 4+5 with emulator mock locations:
# check in 2 km from a test race pin (expect "too far"), then next to it (expect "Checked in"); replay a 1 km route
# and check the live distance is within 10%; stop, save, and see it uploaded. Results in /tmp/ui/result.txt.
set -euo pipefail
mkdir -p /tmp/ui && cd /tmp/ui
adb install -r /tmp/app.apk
# A freshly booted CI emulator sometimes shows "Pixel Launcher isn't responding" over the app (run 6). Let it settle
# and close system dialogs before the flow; the flow also taps "Wait" if one appears.
sleep 20
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true
status=0
shot() { adb exec-out screencap -p > "/tmp/ui/$1.png" || true; node "$GITHUB_WORKSPACE/scripts/android-screen-text.mjs" || true; }
logs() {
  echo "--- crash log"; adb logcat -d -b crash | tail -40 || true
  echo "--- app log"; adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime|FATAL" | tail -60 || true
}
env_args=(-e UI_EMAIL="$UI_EMAIL" -e UI_OTP="$UI_OTP" -e CHECKIN_EVENT_ID="$CHECKIN_EVENT_ID")
if maestro test "$GITHUB_WORKSPACE/.maestro/checkin-run-1.yaml" "${env_args[@]}"; then
  echo "PASS  check-in 2 km from the pin: \"too far\" (within 500 m needed)" | tee -a result.txt
  echo "PASS  check-in next to the pin: \"You're checked in\" (server record below)" | tee -a result.txt
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
  if maestro test "$GITHUB_WORKSPACE/.maestro/checkin-run-2.yaml"; then
    run_ok=1
    # 1 km due north from the start: 250 fixes, 4 m apart, one per second (4 m/s, a 4:10 /km runner), through
    # Android's own test location provider. Earlier attempts: Maestro "travel" (22 m jumps, runs 4-5), adb emu geo fix
    # (did not move the CI emulator, runs 7-8), Maestro setLocation steps (0.18 s apart = 22 m/s, run 9).
    adb shell appops set com.android.shell android:mock_location allow
    for p in gps fused; do
      adb shell cmd location providers add-test-provider "$p" >/dev/null 2>&1 || true
      adb shell cmd location providers set-test-provider-enabled "$p" true >/dev/null 2>&1 || true
    done
    echo "INFO  test provider reply to the first fix: $(adb shell cmd location providers set-test-provider-location gps --location 10.650500,-61.500000 --accuracy 5 2>&1 | tr '\n' ' ')" | tee -a result.txt
    t0=$(date +%s)
    for i in $(seq 1 250); do
      lat=$(awk -v i="$i" 'BEGIN { printf "%.6f", 10.6505 + i * 4 / 111195 }')
      for p in gps fused; do adb shell cmd location providers set-test-provider-location "$p" --location "$lat,-61.500000" --accuracy 5 >/dev/null 2>&1 || true; done
      sleep 0.8
    done
    echo "INFO  route replay took $(( $(date +%s) - t0 )) s (250 fixes, 4 m apart, about one per second)" | tee -a result.txt
    shot 21-after-1km
    node "$GITHUB_WORKSPACE/scripts/android-run-distance.mjs" 1.0 0.1 40 | tee -a result.txt || status=1
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
  t_save=$(date +%s)
  if maestro test "$GITHUB_WORKSPACE/.maestro/checkin-run-3.yaml"; then
    echo "PASS  run stopped, saved and uploaded (\"Saved.\" within $(( $(date +%s) - t_save )) s of stopping)" | tee -a result.txt
  else
    # Evidence for a slow or failed upload: the app's own warnings and errors (Expo APK runs 17 and 20).
    app_pid=$(adb shell pidof -s tt.runlime.app.dev 2>/dev/null | tr -d '\r')
    echo "--- app warnings/errors (pid ${app_pid:-none})"
    [ -n "$app_pid" ] && adb logcat -d --pid="$app_pid" '*:W' | grep -vE 'MapLibre|Mbgl|chatty' | tail -80 || true
    echo "FAIL  stop/save flow stopped (see screenshot 00-save-stopped and the log)" | tee -a result.txt
    shot 00-save-stopped; logs; status=1
  fi
fi
# Screenshots are in the run's artifact; base64 copies in the log only on request (they are large).
if [ "${UI_PRINT_SCREENSHOTS:-0}" = "1" ]; then
  for f in /tmp/ui/*.png; do
    [ -f "$f" ] || continue
    echo "SCREENSHOT $(basename "$f") BEGIN"; base64 -w 120 "$f"; echo "SCREENSHOT $(basename "$f") END"
  done
fi
exit $status
