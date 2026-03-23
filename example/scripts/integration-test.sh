#!/bin/bash
# Integration test runner for atak-reactive example plugin
# Requires: emulator running, ATAK loaded, plugin installed
#
# The tests run when the user navigates to the Test tab in the plugin.
# This script waits for the results in logcat.
#
# Usage:
#   1. Open the plugin in ATAK and tap the Test tab
#   2. Run: cd example && ./scripts/integration-test.sh
set -e

TIMEOUT=30

echo "=== atak-reactive integration test ==="

# Check emulator
if ! adb devices | grep -q "emulator"; then
    echo "ERROR: No emulator found"
    exit 1
fi

# Check ATAK running
if ! adb shell pidof com.atakmap.app.civ > /dev/null 2>&1; then
    echo "ERROR: ATAK is not running"
    exit 1
fi

adb logcat -c
echo "Tap the Test tab in the plugin."
echo "Waiting for results (${TIMEOUT}s timeout)..."

ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if adb logcat -d | grep -q "INTEGRATION_TEST:COMPLETE"; then
        break
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

echo ""
echo "--- Results ---"
adb logcat -d | grep "INTEGRATION_TEST" | sed 's/.*INTEGRATION_TEST/  /' || true
echo ""

COMPLETE=$(adb logcat -d | grep "INTEGRATION_TEST:COMPLETE" | head -1 || true)
if [ -z "$COMPLETE" ]; then
    echo "TIMEOUT: Tests did not complete within ${TIMEOUT}s"
    exit 1
fi

COUNTS=$(echo "$COMPLETE" | grep -oP '\d+/\d+')
PASS=$(echo "$COUNTS" | cut -d/ -f1)
TOTAL=$(echo "$COUNTS" | cut -d/ -f2)

if [ "$PASS" = "$TOTAL" ]; then
    echo "ALL TESTS PASSED ($COUNTS)"
    exit 0
else
    echo "TESTS FAILED ($COUNTS)"
    exit 1
fi
