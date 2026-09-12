#!/bin/bash
# Head-to-head under a real CoT feed: no panel, Overlay Manager, a purpose-built
# native list, and the React Map Items page, each measured for the same time
# with the same markers moving underneath.
#
# The load is real: cot-load.py sends one CoT event per TCP connection to
# ATAK's default input on 4242, so the markers arrive through ATAK's own ingest
# and every panel sees them the way it would in the field. Item listeners fire
# on CotDispatcher, not the UI thread, which is what makes this a different
# measurement from native-compare.sh (marker moves posted to the UI thread).
#
# Usage (emulator):
#   TOKEN=$(cat ~/.emulator_console_auth_token)
#   printf 'auth %s\nredir add tcp:14242:4242\nquit\n' "$TOKEN" | nc -q1 localhost 5554
#   cd example && ./scripts/cot-compare.sh [--count 100] [--hz 1] [--secs 60]
#
# On a device, point --host/--port at ATAK directly (cot-load.py --host).
#
# Requires the example plugin installed and loaded, the screen unlocked and
# landscape 2400x1080 (the Overlay Manager taps are coordinates; the other two
# panels open by broadcast through BenchReceiver). Each panel phase frame-diffs
# two screenshots 5 s apart; a panel reported STATIC was not repainting and its
# number is not a measurement of anything.
set -u

PKG="com.atakmap.app.civ"
COUNT=100
HZ=1
SECS=60
WINDOW=10
PREFIX="H2H"
OUT_DIR="perf-results"

while [ $# -gt 0 ]; do
    case "$1" in
        --count) COUNT="$2"; shift 2 ;;
        --hz) HZ="$2"; shift 2 ;;
        --secs) SECS="$2"; shift 2 ;;
        --window) WINDOW="$2"; shift 2 ;;
        --out) OUT_DIR="$2"; shift 2 ;;
        -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

HERE=$(cd "$(dirname "$0")" && pwd)
PID=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')
[ -z "$PID" ] && { echo "ERROR: $PKG is not running"; exit 1; }

mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
CSV="$OUT_DIR/$STAMP-cot.csv"
echo "phase,atak_cpu_pct,atak_pss_mb,renderer_pss_mb,renderer_cpu_pct" > "$CSV"

S="adb shell input"
B="adb shell am broadcast -p $PKG -a com.atakmap.android.plugintemplate.BENCH"

# ---- sampling ----------------------------------------------------------------
# One CPU reading per WINDOW seconds from /proc ticks, rather than the 3 s
# snapshots perf-profile.sh takes: the differences between panels here are a
# few points on a ~140% base, and short windows cannot resolve that.

ticks() { adb shell cat "/proc/$PID/stat" | tr -d '\r' | awk '{print $14 + $15}'; }
rend_pids() { adb shell ps -A 2>/dev/null | tr -d '\r' | awk '/sandboxed_process/ {print $2}'; }
rend_ticks() {
    local t=0 p x
    for p in $(rend_pids); do
        x=$(adb shell cat "/proc/$p/stat" 2>/dev/null | tr -d '\r' | awk '{print $14 + $15}')
        t=$((t + ${x:-0}))
    done
    echo "$t"
}
# Never `dumpsys meminfo <renderer pid>` — it crashes the sandboxed renderer.
rend_mb() {
    adb shell dumpsys meminfo 2>/dev/null | tr -d '\r' | awk '
        /^Total PSS by process:/ { s = 1; next }
        s && /^Total / { s = 0 }
        s && /sandboxed_process/ { gsub(/[,K]/, "", $1); t += $1 }
        END { print int(t / 1024) }'
}
atak_mb() {
    adb shell dumpsys meminfo "$PID" 2>/dev/null | tr -d '\r' \
        | grep -m1 'TOTAL PSS:' | awk '{print int($3 / 1024)}'
}

sample_for() {
    local phase="$1" secs="$2" end t0 t1 r0 r1 w0 w1 c rc a r
    end=$(( $(date +%s) + secs ))
    while [ "$(date +%s)" -lt "$end" ]; do
        case " $(adb shell pidof "$PKG" | tr -d '\r') " in
            *" $PID "*) ;;
            *) echo "ERROR: $PKG died or restarted mid-run"; exit 1 ;;
        esac
        t0=$(ticks); r0=$(rend_ticks); w0=$(date +%s.%N)
        sleep "$WINDOW"
        t1=$(ticks); r1=$(rend_ticks); w1=$(date +%s.%N)
        c=$(awk -v a="$t0" -v b="$t1" -v x="$w0" -v y="$w1" 'BEGIN { printf "%.0f", (b - a) / 100 / (y - x) * 100 }')
        rc=$(awk -v a="$r0" -v b="$r1" -v x="$w0" -v y="$w1" 'BEGIN { printf "%.1f", (b - a) / 100 / (y - x) * 100 }')
        a=$(atak_mb); r=$(rend_mb)
        echo "$phase,$c,$a,$r,$rc" >> "$CSV"
        printf "  %-12s cpu %4s%%  atak %4s MB  rend %3s MB  rend cpu %4s%%\n" "$phase" "$c" "$a" "$r" "$rc"
    done
}

live_check() {
    local tag="$1"
    adb exec-out screencap -p > "/tmp/cc-$tag-a.png"
    sleep 5
    adb exec-out screencap -p > "/tmp/cc-$tag-b.png"
    python3 - "$tag" <<'PY' || echo "  (live-check needs python3 + Pillow)"
from PIL import Image, ImageChops
import sys
t = sys.argv[1]
a = Image.open(f'/tmp/cc-{t}-a.png').convert('RGB')
b = Image.open(f'/tmp/cc-{t}-b.png').convert('RGB')
box = (1270, 380, 2400, 1010)
d = ImageChops.difference(a.crop(box), b.crop(box))
px = sum(1 for p in d.getdata() if sum(p) > 30)
print(f"  LIVE-CHECK {t}: {px} px changed in 5s -> {'UPDATING' if px > 500 else 'STATIC'}")
PY
}

# ---- run ---------------------------------------------------------------------

TOTAL=$(( SECS * 5 + 120 ))
echo "atak pid: $PID   load: $COUNT markers @ $HZ Hz for ${TOTAL}s   output: $CSV"
python3 "$HERE/cot-load.py" --count "$COUNT" --hz "$HZ" --secs "$TOTAL" --prefix "$PREFIX" > /dev/null 2>&1 &
LOAD=$!
trap 'kill $LOAD 2>/dev/null' EXIT
sleep 15

echo "=== A. no panel ==="
sample_for no-panel "$SECS"

echo "=== B. Overlay Manager ==="
$S tap 1651 116; sleep 3      # layers icon
$S tap 2352 246; sleep 2      # search
$S text "$PREFIX"; sleep 2
$S keyevent 4; sleep 3        # dismiss IME
live_check om
sample_for overlay-mgr "$SECS"
$S tap 2355 976; sleep 3      # close

echo "=== C. native list ==="
$B --es op native-list > /dev/null 2>&1; sleep 5
live_check nl
sample_for native-list "$SECS"
$S keyevent 4; sleep 3

echo "=== D. React panel (Map Items) ==="
$B --es op react > /dev/null 2>&1; sleep 6
$S tap 1604 973; sleep 5      # Map Items tab
live_check rx
sample_for reactive "$SECS"
$S keyevent 4; sleep 3

echo "=== E. no panel again (drift check) ==="
sample_for no-panel-2 "$SECS"

kill $LOAD 2>/dev/null; wait $LOAD 2>/dev/null
python3 "$HERE/cot-delete.py" "$PREFIX" "$COUNT" > /dev/null 2>&1

echo ""
awk -F, 'NR > 1 { n[$1]++; c[$1] += $2; a[$1] += $3; r[$1] += $4; q[$1] += $5 }
END {
    printf "%-12s %6s %8s %8s %9s\n", "phase", "cpu%", "atakMB", "rendMB", "rendCPU%"
    for (p in n) printf "%-12s %6.0f %8.0f %8.0f %9.1f\n", p, c[p]/n[p], a[p]/n[p], r[p]/n[p], q[p]/n[p]
}' "$CSV"
echo ""
echo "written: $CSV"
