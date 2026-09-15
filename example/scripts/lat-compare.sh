#!/bin/bash
# How long does a marker take to get from the network onto the screen, and how
# much of that is the library?
#
# Measures the React Map Items page against NativeListReceiver — which uses the
# same listener set and the same 100 ms / 500 ms batching as MapItemEventRelay —
# under identical CoT load, in the same ATAK process. Whatever the native panel
# costs is what this design costs; the gap is the WebView hop.
#
# The probe marker is generated on the device (lat-probe.sh) so send time and
# receive time come from one clock. See web/src/perf/latencyProbe.ts for the
# three stages, and PERF.md for results.
#
# Requires a build with the probe compiled in:
#   cd web && VITE_PERF_TAB=true npm run build
#   cd .. && ./gradlew assembleCivRelease && adb install -r app/build/outputs/apk/civ/release/*.apk
#
# On the emulator, redirect a host port to ATAK's CoT input first:
#   TOKEN=$(cat ~/.emulator_console_auth_token)
#   printf 'auth %s\nredir add tcp:14242:4242\nquit\n' "$TOKEN" | nc -q1 localhost 5554
#
# Usage:
#   cd example && ./scripts/lat-compare.sh [--counts "0 100 250 500"] [--hz 1] [--secs 90]
set -u

PKG="com.atakmap.app.civ"
COUNTS="0 100 250 500"
HZ=1
SECS=90
GAP=1.3
OUT_DIR="perf-results"

while [ $# -gt 0 ]; do
    case "$1" in
        --counts) COUNTS="$2"; shift 2 ;;
        --hz) HZ="$2"; shift 2 ;;
        --secs) SECS="$2"; shift 2 ;;
        --gap) GAP="$2"; shift 2 ;;
        --out) OUT_DIR="$2"; shift 2 ;;
        -h|--help) sed -n '2,27p' "$0"; exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

HERE=$(cd "$(dirname "$0")" && pwd)
adb shell pidof "$PKG" > /dev/null 2>&1 || { echo "ERROR: $PKG is not running"; exit 1; }
mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
RAW="$OUT_DIR/$STAMP-latency"
mkdir -p "$RAW"

adb push "$HERE/lat-probe.sh" /data/local/tmp/lat-probe.sh > /dev/null
adb shell chmod 755 /data/local/tmp/lat-probe.sh

B="adb shell am broadcast -p $PKG -a com.atakmap.android.plugintemplate.BENCH"
LOAD_PID=""

start_load() {
    local count="$1"
    [ "$count" -eq 0 ] && return
    python3 "$HERE/cot-load.py" --count "$count" --hz "$HZ" --secs 100000 --prefix LOADX > /dev/null 2>&1 &
    LOAD_PID=$!
    # Let every marker arrive and the panel settle before timing anything.
    sleep $(( 20 + count / 25 ))
}

stop_load() {
    local count="$1"
    [ -n "$LOAD_PID" ] && kill "$LOAD_PID" 2>/dev/null
    LOAD_PID=""
    [ "$count" -eq 0 ] && return
    sleep 1
    python3 "$HERE/cot-delete.py" LOADX "$count" > /dev/null 2>&1
    sleep 5
}

# $1 label, $2 grep pattern, $3 output file
run_probe() {
    adb logcat -c
    adb shell /data/local/tmp/lat-probe.sh LATPROBE "$GAP" "$SECS" > /dev/null
    sleep 2
    adb logcat -d | grep -o "$2" > "$3"
    printf "    %-8s %s samples\n" "$1" "$(wc -l < "$3")"
}

for count in $COUNTS; do
    echo "=== load: $count markers @ $HZ Hz ==="
    start_load "$count"

    echo "  react"
    $B --es op react > /dev/null 2>&1; sleep 6
    adb shell input tap 1604 973                     # Map Items tab
    sleep $(( 6 + count / 50 ))                      # the example list is not virtualized
    run_probe react "LATPROBE[^(]*" "$RAW/react-$count.txt"
    adb shell input keyevent 4; sleep 3

    echo "  native"
    $B --es op native-list > /dev/null 2>&1
    sleep $(( 6 + count / 50 ))
    run_probe native "LATNATIVE.*" "$RAW/native-$count.txt"
    adb shell input keyevent 4; sleep 3

    stop_load "$count"
done

python3 - "$RAW" <<'PY'
import glob, os, re, statistics as st, sys
raw = sys.argv[1]

def stats(v):
    v = sorted(v); n = len(v)
    return n, v[0], round(st.median(v)), round(st.mean(v)), v[int(n * 0.95) - 1], v[-1]

def load(path, pattern):
    if not os.path.exists(path): return []
    return [int(x) for x in re.findall(pattern, open(path).read())]

counts = sorted({int(re.search(r'-(\d+)\.txt$', p).group(1))
                 for p in glob.glob(os.path.join(raw, '*-*.txt'))})

print()
print(f"{'load':>6}  {'stage':26} {'n':>4} {'min':>6} {'p50':>6} {'mean':>6} {'p95':>6} {'max':>6}")
for c in counts:
    rows = [
        ('native: ingest -> listener', load(f'{raw}/native-{c}.txt', r'listener=(\d+)')),
        ('native: send -> row updated', load(f'{raw}/native-{c}.txt', r'flush=(\d+)')),
        ('react:  send -> JS batch', load(f'{raw}/react-{c}.txt', r'bridge=(\d+)')),
        ('react:  send -> commit', load(f'{raw}/react-{c}.txt', r'commit=(\d+)')),
        ('react:  send -> painted', load(f'{raw}/react-{c}.txt', r'paint=(\d+)')),
    ]
    for name, v in rows:
        if not v: continue
        n, mn, p50, mean, p95, mx = stats(v)
        print(f"{c:>6}  {name:26} {n:>4} {mn:>6} {p50:>6} {mean:>6} {p95:>6} {mx:>6}")
    print()
PY

echo "raw samples: $RAW"
