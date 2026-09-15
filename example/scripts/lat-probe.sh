#!/system/bin/sh
# Runs ON THE DEVICE — pushed there by lat-compare.sh.
#
# Sends one CoT marker repeatedly, with the device-clock millisecond of the
# send encoded in its callsign. Because the event is generated here rather than
# on the host, that millisecond and Date.now() in the WebView (and
# System.currentTimeMillis() in a native panel) come from the same clock, so
# the latency numbers carry no clock skew.
#
#   lat-probe.sh [uid] [gap-seconds] [total-seconds]
#
# Pick a gap that is not a harmonic of the load's tick, or the samples all land
# at the same phase of the flush cycle and the distribution is a lie.
UID_=${1:-LATPROBE}
GAP=${2:-1.3}
SECS=${3:-60}
end=$(( $(date +%s) + SECS ))
i=0
while [ $(date +%s) -lt $end ]; do
  now=$(date +%s)
  t=$(date -u -d @$now +%Y-%m-%dT%H:%M:%S).000Z
  st=$(date -u -d @$(( now + 300 )) +%Y-%m-%dT%H:%M:%S).000Z
  lat="35.$(printf '%06d' $(( (i * 13711) % 999999 )))"
  ms=$(date +%s%3N)
  printf '<?xml version="1.0" encoding="UTF-8"?><event version="2.0" uid="%s" type="a-f-G-U-C" how="m-g" time="%s" start="%s" stale="%s"><point lat="%s" lon="-106.000000" hae="0.0" ce="9999999.0" le="9999999.0"/><detail><contact callsign="LAT-%s"/><__group name="Cyan" role="Team Member"/></detail></event>' \
    "$UID_" "$t" "$t" "$st" "$lat" "$ms" | nc 127.0.0.1 4242
  # Logged so a run can tell "the page never showed this ping" apart from
  # "the ping never reached ATAK" — nc fails if the input's backlog is full.
  log -t LATSEND "seq=$i ms=$ms rc=$?"
  i=$(( i + 1 ))
  sleep $GAP
done
echo "probe sent $i pings"
