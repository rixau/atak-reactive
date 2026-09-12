#!/bin/bash
# Memory / CPU profile of the atak-reactive example plugin, per scenario phase.
# Requires: device or emulator, ATAK running, plugin installed.
#
# The Perf tab drives the scenario and announces phases on the console; this
# script watches logcat for them and samples the ATAK process plus every
# WebView renderer (sandboxed_process) while each phase runs.
#
# Usage:
#   cd example && ./scripts/perf-profile.sh [--interval 3] [--baseline 10] [--battery] [--out DIR]
#
#   1. Start with the plugin panel CLOSED. The script samples a "closed" baseline.
#   2. When prompted, open the plugin, go to the Perf tab, tap Run.
#   3. When the scenario completes, close the panel when prompted for the
#      "closed-after" sample — the leak check.
#
# Output: DIR/<timestamp>.csv (raw samples), DIR/<timestamp>.md (summary).
#
# Caveats:
#   - Every WebView renderer on the device is summed, not just ATAK's — they
#     run under isolated uids and cannot be attributed. Kill other apps first.
#   - `dumpsys meminfo` itself costs the target ~100-300ms per sample. Keep the
#     interval >= 2s so the sampler is not a meaningful share of the CPU it reports.
#   - CPU% is per-core-normalised over the sample interval from /proc/<pid>/stat,
#     so 100 = one core fully busy.
#   - Battery figures are only meaningful on a physical device, unplugged.
set -u

PKG="com.atakmap.app.civ"
INTERVAL=3
BASELINE_SECS=10
BATTERY=0
OUT_DIR="perf-results"
SCENARIO_TIMEOUT=900
CLK_TCK=100

while [ $# -gt 0 ]; do
    case "$1" in
        --interval) INTERVAL="$2"; shift 2 ;;
        --baseline) BASELINE_SECS="$2"; shift 2 ;;
        --battery)  BATTERY=1; shift ;;
        --out)      OUT_DIR="$2"; shift 2 ;;
        --package)  PKG="$2"; shift 2 ;;
        -h|--help)  sed -n '2,25p' "$0"; exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "=== atak-reactive perf profile ==="

if ! adb get-state >/dev/null 2>&1; then
    echo "ERROR: no device connected"
    exit 1
fi
ATAK_PID=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')
if [ -z "$ATAK_PID" ]; then
    echo "ERROR: $PKG is not running"
    exit 1
fi

mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
CSV="$OUT_DIR/$STAMP.csv"
MD="$OUT_DIR/$STAMP.md"
echo "ts,phase,atak_pss_kb,renderer_pss_kb,renderer_count,atak_cpu_pct,renderer_cpu_pct" > "$CSV"

MODEL=$(adb shell getprop ro.product.model | tr -d '\r')
ANDROID=$(adb shell getprop ro.build.version.release | tr -d '\r')
WEBVIEW=$(adb shell dumpsys webviewupdate 2>/dev/null | grep -m1 "Current WebView package" | sed 's/.*: //' | tr -d '\r')
echo "device: $MODEL (Android $ANDROID)  webview: ${WEBVIEW:-unknown}  atak pid: $ATAK_PID"
echo "output: $CSV"

# ---- sampling ----------------------------------------------------------------

# Per-pid cumulative CPU ticks and wall time from the previous sample.
declare -A PREV_TICKS
declare -A PREV_TIME

pss_kb() {
    local out
    out=$(adb shell dumpsys meminfo "$1" 2>/dev/null | tr -d '\r')
    local v
    v=$(echo "$out" | grep -m1 'TOTAL PSS:' | awk '{print $3}')
    [ -z "$v" ] && v=$(echo "$out" | awk '/^ *TOTAL /{print $2; exit}')
    echo "${v:-0}"
}

# %CPU for a pid since its last sample, left in $CPU. First call for a pid
# yields "". Not a $(...) function: the previous-tick table must outlive the call.
CPU=""
cpu_pct() {
    local pid="$1"
    local stat now ticks
    CPU=""
    stat=$(adb shell cat "/proc/$pid/stat" 2>/dev/null | tr -d '\r')
    [ -z "$stat" ] && return
    # Fields 14 (utime) and 15 (stime), counted after the ")" that ends comm,
    # which may itself contain spaces.
    ticks=$(echo "${stat##*) }" | awk '{print $12 + $13}')
    now=$(date +%s.%N)
    if [ -n "${PREV_TICKS[$pid]:-}" ]; then
        CPU=$(awk -v t0="${PREV_TICKS[$pid]}" -v t1="$ticks" -v w0="${PREV_TIME[$pid]}" -v w1="$now" -v hz="$CLK_TCK" \
            'BEGIN { d = w1 - w0; if (d <= 0) print ""; else printf "%.1f", (t1 - t0) / hz / d * 100 }')
    fi
    PREV_TICKS[$pid]="$ticks"
    PREV_TIME[$pid]="$now"
}

# `dumpsys meminfo <pid>` prints a header but no memory table for an isolated
# process, and the WebView renderer runs under an isolated uid — so per-pid PSS
# comes back empty and every renderer reads 0. Worse, the call itself crashes
# the renderer: it runs dumpMemInfo inside the sandboxed process, whose seccomp
# filter rejects the mmap that triggers, and ATAK dies with it (see PERF.md,
# "If the run aborts"). Never point dumpsys at a sandboxed_process pid. The
# global report does list them without calling into them, so take the pid and
# its PSS together from "Total PSS by process" in one call.
# That section must be bounded: the same process is repeated under the later
# "by OOM adjustment" and swap sections with different numbers.
renderer_stats() {
    adb shell dumpsys meminfo 2>/dev/null | tr -d '\r' | awk '
        /^Total PSS by process:/ { in_section = 1; next }
        in_section && /^Total / { in_section = 0 }
        in_section && /sandboxed_process/ {
            kb = $1
            gsub(/[,K:]/, "", kb)
            if (match($0, /\(pid [0-9]+/))
                print substr($0, RSTART + 5, RLENGTH - 5), kb
        }
    '
}

# The whole profile is meaningless if the target dies mid-run: dumpsys against a
# dead pid returns nothing, pss_kb falls back to 0, and the summary fills with
# zeroes that look like measurements. Fail loudly instead.
assert_alive() {
    local now
    now=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')
    case " $now " in
        *" $ATAK_PID "*) return 0 ;;
    esac
    echo ""
    if [ -z "$now" ]; then
        echo "ERROR: $PKG died during the run (was pid $ATAK_PID)."
    else
        echo "ERROR: $PKG restarted mid-run (pid $ATAK_PID -> $now)."
    fi
    echo "Samples up to this point are in $CSV; the run is aborted because"
    echo "everything after the death would be recorded as 0."
    exit 1
}

sample() {
    local phase="$1"
    local atak_pss rend_pss=0 rend_cpu="" rend_n=0 pid p c atak_cpu

    assert_alive
    atak_pss=$(pss_kb "$ATAK_PID")
    cpu_pct "$ATAK_PID"; atak_cpu="$CPU"

    # Here-string, not a pipe: the loop must stay in this shell so cpu_pct's
    # previous-tick table survives the iteration.
    while read -r pid p; do
        [ -z "$pid" ] && continue
        rend_n=$((rend_n + 1))
        rend_pss=$((rend_pss + p))
        cpu_pct "$pid"; c="$CPU"
        if [ -n "$c" ]; then
            rend_cpu=$(awk -v a="${rend_cpu:-0}" -v b="$c" 'BEGIN { printf "%.1f", a + b }')
        fi
    done <<< "$(renderer_stats)"

    echo "$(date +%s),$phase,$atak_pss,$rend_pss,$rend_n,$atak_cpu,$rend_cpu" >> "$CSV"
    printf "  %-20s atak %6d MB  renderer %6d MB (%d)  cpu atak %5s%%  renderer %5s%%\n" \
        "$phase" $((atak_pss / 1024)) $((rend_pss / 1024)) "$rend_n" "${atak_cpu:--}" "${rend_cpu:--}"
}

sample_for() {
    local phase="$1" secs="$2"
    local end=$(( $(date +%s) + secs ))
    while [ "$(date +%s)" -lt "$end" ]; do
        sample "$phase"
        sleep "$INTERVAL"
    done
}

prompt() {
    if [ -t 0 ]; then
        read -r -p "$1 [Enter] "
    else
        echo "$1 (non-interactive: continuing in 10s)"
        sleep 10
    fi
}

# ---- run ---------------------------------------------------------------------

if [ "$BATTERY" = 1 ]; then
    adb shell dumpsys batterystats --reset >/dev/null 2>&1
    echo "batterystats reset"
fi

echo ""
prompt "Make sure the plugin panel is CLOSED, then press"
echo "--- closed baseline (${BASELINE_SECS}s) ---"
sample "closed" >/dev/null   # prime CPU counters
sleep "$INTERVAL"
sample_for "closed" "$BASELINE_SECS"

adb logcat -c
echo ""
echo "Open the plugin, go to the Perf tab, and tap Run."
echo "Waiting for the scenario (timeout ${SCENARIO_TIMEOUT}s)..."
echo ""

PHASE="opening"
START=$(date +%s)
while true; do
    LOG=$(adb logcat -d 2>/dev/null | grep -a 'PERF_TEST:' || true)
    LAST_PHASE=$(echo "$LOG" | grep -o 'PERF_TEST:PHASE:[a-z-]*' | tail -1 | sed 's/PERF_TEST:PHASE://')
    [ -n "$LAST_PHASE" ] && PHASE="$LAST_PHASE"

    sample "$PHASE"

    if echo "$LOG" | grep -q 'PERF_TEST:COMPLETE'; then
        break
    fi
    if echo "$LOG" | grep -q 'PERF_TEST:ERROR'; then
        echo "Scenario reported an error:"
        echo "$LOG" | grep 'PERF_TEST:ERROR' | sed 's/.*PERF_TEST/  /'
        break
    fi
    if [ $(( $(date +%s) - START )) -gt "$SCENARIO_TIMEOUT" ]; then
        echo "TIMEOUT waiting for PERF_TEST:COMPLETE"
        break
    fi
    sleep "$INTERVAL"
done

echo ""
prompt "Scenario finished. CLOSE the plugin panel, then press"
echo "--- closed-after (${BASELINE_SECS}s) ---"
sample_for "closed-after" "$BASELINE_SECS"

# ---- summary -----------------------------------------------------------------

CONFIG=$(adb logcat -d 2>/dev/null | grep -a -o 'PERF_TEST:CONFIG:.*' | head -1 | sed 's/PERF_TEST:CONFIG://; s/ (.*//')
METRICS=$(adb logcat -d 2>/dev/null | grep -a -o 'PERF_TEST:METRIC:[^ ]*' | sed 's/PERF_TEST:METRIC://')

{
    echo "# atak-reactive perf profile — $STAMP"
    echo ""
    echo "- device: $MODEL (Android $ANDROID)"
    echo "- webview: ${WEBVIEW:-unknown}"
    echo "- scenario: \`${CONFIG:-unknown}\`"
    echo "- sample interval: ${INTERVAL}s"
    echo ""
    echo "## Per phase"
    echo ""
    echo "| phase | samples | ATAK PSS avg (MB) | ATAK PSS max | renderer PSS avg (MB) | renderer PSS max | ATAK CPU avg % | ATAK CPU max | renderer CPU avg % | renderer CPU max |"
    echo "|---|---|---|---|---|---|---|---|---|---|"
    # Phases in first-seen order, not sorted, so the table reads as a timeline.
    awk -F, 'NR > 1 {
        p = $2
        if (!(p in seen)) { seen[p] = 1; order[++n] = p }
        cnt[p]++
        apss[p] += $3; if ($3 > apmax[p]) apmax[p] = $3
        rpss[p] += $4; if ($4 > rpmax[p]) rpmax[p] = $4
        if ($6 != "") { acpu[p] += $6; acn[p]++; if ($6 > acmax[p]) acmax[p] = $6 }
        if ($7 != "") { rcpu[p] += $7; rcn[p]++; if ($7 > rcmax[p]) rcmax[p] = $7 }
    }
    END {
        for (i = 1; i <= n; i++) {
            p = order[i]
            printf "| %s | %d | %.0f | %.0f | %.0f | %.0f | %s | %s | %s | %s |\n", p, cnt[p],
                apss[p] / cnt[p] / 1024, apmax[p] / 1024,
                rpss[p] / cnt[p] / 1024, rpmax[p] / 1024,
                acn[p] ? sprintf("%.1f", acpu[p] / acn[p]) : "-", acn[p] ? sprintf("%.1f", acmax[p]) : "-",
                rcn[p] ? sprintf("%.1f", rcpu[p] / rcn[p]) : "-", rcn[p] ? sprintf("%.1f", rcmax[p]) : "-"
        }
    }' "$CSV"
    echo ""
    echo "## Deltas"
    echo ""
    awk -F, 'NR > 1 {
        cnt[$2]++; a[$2] += $3; r[$2] += $4
        if ($6 != "") { ac[$2] += $6; acn[$2]++ }
    }
    function mb(p) { return cnt[p] ? (a[p] + r[p]) / cnt[p] / 1024 : 0 }
    function cpu(p) { return acn[p] ? ac[p] / acn[p] : 0 }
    END {
        if (cnt["closed"] && cnt["idle"])
            printf "- panel open, idle vs closed: **%+.0f MB** total PSS (ATAK + renderer)\n", mb("idle") - mb("closed")
        if (cnt["churn"] && cnt["churn-unsubscribed"])
            printf "- churn with hook vs without: **%+.0f MB**, **%+.1f%% ATAK CPU** — the bridge + React share of a busy map\n", mb("churn") - mb("churn-unsubscribed"), cpu("churn") - cpu("churn-unsubscribed")
        if (cnt["cleaned"] && cnt["idle"])
            printf "- after cleanup vs idle: **%+.0f MB** (growth here suggests a leak)\n", mb("cleaned") - mb("idle")
        if (cnt["closed-after"] && cnt["idle"])
            printf "- closed-after vs idle: **%+.0f MB** retained after close (the page stays loaded; growth here that repeats run over run is a leak)\n", mb("closed-after") - mb("idle")
    }' "$CSV"
    echo ""
    echo "## In-page metrics"
    echo ""
    echo '```'
    echo "${METRICS:-none captured}"
    echo '```'
    if [ "$BATTERY" = 1 ]; then
        echo ""
        echo "## Battery (dumpsys batterystats)"
        echo ""
        echo '```'
        adb shell dumpsys batterystats "$PKG" 2>/dev/null | tr -d '\r' \
            | grep -A 12 -i 'Estimated power use' | head -30
        echo '```'
    fi
} > "$MD"

echo ""
cat "$MD"
echo ""
echo "written: $MD"
