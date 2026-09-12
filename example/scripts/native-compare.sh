#!/bin/bash
# Compare what a native ATAK panel and the React panel cost while the same
# marker load runs underneath both.
#
# perf-profile.sh can only measure the React panel, because the Perf tab drives
# its own load and closing the dropdown calls WebView.onPause(), which suspends
# the JS timers. To get a native number the load has to come from somewhere
# else: NativeChurnReceiver in the example plugin moves N markers at H Hz from
# a plain thread, triggered by broadcast, so it keeps running no matter which
# panel is on screen.
#
# Usage:
#   cd example && ./scripts/native-compare.sh [--count 200] [--hz 1] [--secs 45]
#
# Requires the example plugin installed and loaded, and the screen unlocked —
# the script drives the UI with `adb shell input`, so the tap coordinates below
# assume a 2400x1080 landscape device. Check them before trusting a run on
# other hardware.
#
# Each panel phase also frame-diffs two screenshots taken 5 s apart. A panel
# that reports STATIC is not repainting, and its CPU number does not mean what
# you would assume — see PERF.md, "Comparing against a native panel".
set -u

PKG="com.atakmap.app.civ"
COUNT=200
HZ=1
SECS=45
INTERVAL=3
OUT_DIR="perf-results"
CLK_TCK=100

while [ $# -gt 0 ]; do
    case "$1" in
        --count) COUNT="$2"; shift 2 ;;
        --hz) HZ="$2"; shift 2 ;;
        --secs) SECS="$2"; shift 2 ;;
        --interval) INTERVAL="$2"; shift 2 ;;
        --out) OUT_DIR="$2"; shift 2 ;;
        -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

ATAK_PID=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')
[ -z "$ATAK_PID" ] && { echo "ERROR: $PKG is not running"; exit 1; }

mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
CSV="$OUT_DIR/$STAMP-native.csv"
echo "ts,phase,atak_pss_kb,renderer_pss_kb,renderer_count,atak_cpu_pct,renderer_cpu_pct" > "$CSV"
echo "atak pid: $ATAK_PID   output: $CSV"

S="adb shell"
CH="am broadcast -p $PKG -a com.atakmap.android.plugintemplate.NATIVE_CHURN"

# ---- sampling (same primitives as perf-profile.sh, so numbers compare) -------

declare -A PREV_TICKS
declare -A PREV_TIME
CPU=""
cpu_pct() {
    local pid="$1" stat now ticks
    CPU=""
    stat=$(adb shell cat "/proc/$pid/stat" 2>/dev/null | tr -d '\r')
    [ -z "$stat" ] && return
    ticks=$(echo "${stat##*) }" | awk '{print $12 + $13}')
    now=$(date +%s.%N)
    if [ -n "${PREV_TICKS[$pid]:-}" ]; then
        CPU=$(awk -v t0="${PREV_TICKS[$pid]}" -v t1="$ticks" -v w0="${PREV_TIME[$pid]}" \
                  -v w1="$now" -v hz="$CLK_TCK" \
            'BEGIN { d = w1 - w0; if (d <= 0) print ""; else printf "%.1f", (t1 - t0) / hz / d * 100 }')
    fi
    PREV_TICKS[$pid]="$ticks"
    PREV_TIME[$pid]="$now"
}

# Never `dumpsys meminfo <renderer pid>` — it crashes the sandboxed renderer.
# See PERF.md, "If the run aborts".
renderer_stats() {
    adb shell dumpsys meminfo 2>/dev/null | tr -d '\r' | awk '
        /^Total PSS by process:/ { s = 1; next }
        s && /^Total / { s = 0 }
        s && /sandboxed_process/ {
            kb = $1; gsub(/[,K:]/, "", kb)
            if (match($0, /\(pid [0-9]+/)) print substr($0, RSTART + 5, RLENGTH - 5), kb
        }'
}

sample() {
    local phase="$1" atak_pss rend_pss=0 rend_cpu="" rend_n=0 pid p c atak_cpu now
    now=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')
    case " $now " in
        *" $ATAK_PID "*) ;;
        *) echo "ERROR: $PKG died or restarted mid-run"; exit 1 ;;
    esac
    atak_pss=$(adb shell dumpsys meminfo "$ATAK_PID" 2>/dev/null | tr -d '\r' \
        | grep -m1 'TOTAL PSS:' | awk '{print $3}')
    cpu_pct "$ATAK_PID"; atak_cpu="$CPU"
    while read -r pid p; do
        [ -z "$pid" ] && continue
        rend_n=$((rend_n + 1)); rend_pss=$((rend_pss + p))
        cpu_pct "$pid"; c="$CPU"
        [ -n "$c" ] && rend_cpu=$(awk -v a="${rend_cpu:-0}" -v b="$c" 'BEGIN { printf "%.1f", a + b }')
    done <<< "$(renderer_stats)"
    echo "$(date +%s),$phase,${atak_pss:-0},$rend_pss,$rend_n,$atak_cpu,$rend_cpu" >> "$CSV"
    printf "  %-22s atak %6d MB  rend %5d MB  cpu atak %6s%%  rend %5s%%\n" \
        "$phase" $((${atak_pss:-0} / 1024)) $((rend_pss / 1024)) "${atak_cpu:--}" "${rend_cpu:--}"
}

sample_for() {
    local phase="$1" secs="$2"
    local end=$(( $(date +%s) + secs ))
    sample "$phase" > /dev/null       # prime the CPU counters
    sed -i '$d' "$CSV"
    sleep "$INTERVAL"
    while [ "$(date +%s)" -lt "$end" ]; do sample "$phase"; sleep "$INTERVAL"; done
}

# A panel that does not repaint while items move is not doing the work you
# think you are measuring. Two frames, five seconds apart, panel area only.
live_check() {
    local tag="$1"
    adb exec-out screencap -p > "/tmp/nc-$tag-a.png"
    sleep 5
    adb exec-out screencap -p > "/tmp/nc-$tag-b.png"
    python3 - "$tag" <<'PY' || echo "  (live-check needs python3 + Pillow)"
from PIL import Image, ImageChops
import sys
t = sys.argv[1]
a = Image.open(f'/tmp/nc-{t}-a.png').convert('RGB')
b = Image.open(f'/tmp/nc-{t}-b.png').convert('RGB')
box = (1270, 380, 2400, 1010)
d = ImageChops.difference(a.crop(box), b.crop(box))
px = sum(1 for p in d.getdata() if sum(p) > 30)
print(f"  LIVE-CHECK {t}: {px} px changed in 5s -> {'UPDATING' if px > 500 else 'STATIC'}")
PY
}

# ---- run ---------------------------------------------------------------------

echo "=== 1. control: no load, no panel ==="
$S "$CH --es op stop" > /dev/null 2>&1; sleep 3
sample_for "no-load-no-panel" 30

echo "=== 2. load on, no panel (baseline) ==="
$S "$CH --es op start --ei count $COUNT --ei hz $HZ" > /dev/null 2>&1
sleep 10
sample_for "load-no-panel" "$SECS"

echo "=== 3. load on, Overlay Manager ==="
$S input tap 1651 116; sleep 3      # layers icon
$S input tap 2352 246; sleep 2      # search
$S input text "LOAD"; sleep 2
$S input keyevent 4; sleep 3        # dismiss IME
live_check om
sample_for "load-overlay-mgr" "$SECS"
$S input tap 2355 976; sleep 3      # close

echo "=== 4. load on, React panel ==="
$S input tap 2335 125; sleep 2      # Tools
$S input swipe 2016 900 2016 300 300; sleep 1
$S input swipe 2016 900 2016 300 300; sleep 1
$S input tap 2272 700; sleep 6      # Plugin Template
$S input tap 1604 973; sleep 5      # Map Items tab
live_check rx
sample_for "load-reactive" "$SECS"
$S input keyevent 4; sleep 3

echo "=== 5. load on, no panel again (drift check) ==="
sample_for "load-no-panel-2" 30
$S "$CH --es op stop" > /dev/null 2>&1

echo ""
awk -F, 'NR > 1 {
    c[$2]++; a[$2] += $3; r[$2] += $4
    if ($6 != "") { ac[$2] += $6; acn[$2]++ }
    if ($7 != "") { rc[$2] += $7; rcn[$2]++ }
}
END {
    printf "%-22s %8s %8s %10s %10s\n", "phase", "atakMB", "rendMB", "atakCPU", "rendCPU"
    for (p in c)
        printf "%-22s %8.0f %8.0f %10.1f %10.1f\n", p, a[p]/c[p]/1024, r[p]/c[p]/1024,
            acn[p] ? ac[p]/acn[p] : 0, rcn[p] ? rc[p]/rcn[p] : 0
}' "$CSV" | sort
echo ""
echo "written: $CSV"
