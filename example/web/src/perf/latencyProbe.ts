import { useEffect, useRef } from 'react';
import { on, off } from '@atak-reactive/sdk';

/**
 * Marker-to-pixels latency probe. Built in only when VITE_PERF_TAB=true, so a
 * stock bundle carries none of this (the effects below compile away and no
 * listener is ever registered).
 *
 * scripts/lat-probe.sh runs on the device and sends a CoT marker whose
 * callsign is LAT-<device-clock millisecond at send>. Because the event is
 * generated on the device, that millisecond and Date.now() in the WebView come
 * from the same clock, so these deltas contain no host/device skew — which is
 * what makes the numbers in PERF.md trustworthy.
 *
 * Three stages, each logged relative to the send:
 *   bridge  ATAK ingest + relay batching + serialize + evaluateJavascript,
 *           i.e. everything before JS runs
 *   commit  + store re-filter and React render
 *   paint   + the frame is actually up (second rAF)
 *
 * Also logs a running count of mapItemsChanged batches. Compare it against the
 * number of pings sent: if the page logs fewer samples than were sent, the
 * relay coalesced pings between flushes and the latency figures only cover the
 * freshest ping in each batch — a survivorship bias that makes the panel look
 * more responsive than it is. PERF.md shows where that starts to happen.
 *
 * Takes the caller's already-filtered list rather than subscribing itself, so
 * it measures the page's real render and adds no second subscription.
 */
const ENABLED = import.meta.env.VITE_PERF_TAB === 'true';

export function useLatencyProbe(items: ReadonlyArray<{ title?: string | null }>) {
  const bridgeAt = useRef(0);
  const lastSent = useRef(0);
  const batches = useRef(0);

  useEffect(() => {
    if (!ENABLED) return;
    const handler = () => { bridgeAt.current = Date.now(); batches.current += 1; };
    on('mapItemsChanged', handler);
    return () => off('mapItemsChanged', handler);
  }, []);

  useEffect(() => {
    if (!ENABLED) return;
    const probe = items.find(m => typeof m.title === 'string' && m.title.startsWith('LAT-'));
    if (!probe || typeof probe.title !== 'string') return;
    const sent = Number(probe.title.slice(4));
    // One log per ping: the effect also re-runs for unrelated batches.
    if (!sent || sent === lastSent.current) return;
    lastSent.current = sent;
    const bridge = bridgeAt.current - sent;
    const commit = Date.now() - sent;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      console.log(`LATPROBE n=${items.length} batches=${batches.current} bridge=${bridge} commit=${commit} paint=${Date.now() - sent}`);
    }));
  }, [items]);
}
