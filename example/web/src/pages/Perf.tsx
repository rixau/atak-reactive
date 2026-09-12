import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  addMarker,
  updateMarker,
  removeMarker,
  useMapItems,
  on,
  off,
  isNative,
} from '@atak-reactive/sdk';
import type { MapItemData, MapItemsChangedEvent } from '@atak-reactive/sdk';

/**
 * Resource-usage stress scenario. Drives the bridge through a fixed sequence
 * of phases and announces each one on the console as `PERF_TEST:PHASE:<name>`,
 * so `scripts/perf-profile.sh` can sample memory/CPU per phase from the host.
 *
 * The phase pair that matters is `churn` vs `churn-unsubscribed`: same marker
 * load, same update rate, but in the second one no hook is mounted, so the
 * native relay is detached and nothing crosses into the WebView. The delta is
 * what the library itself costs on a busy map.
 */

type Phase =
  | 'ready'
  | 'idle'
  | 'subscribed'
  | 'load'
  | 'loaded'
  | 'churn'
  | 'churn-unsubscribed'
  | 'cleanup'
  | 'cleaned'
  | 'done';

interface Config {
  markers: number;
  updateHz: number;
  phaseSecs: number;
  churnSecs: number;
}

const DEFAULTS: Config = { markers: 200, updateHz: 1, phaseSecs: 15, churnSecs: 30 };

const UID_PREFIX = 'perf-stress-';
const BASE_LAT = 38.8977;
const BASE_LNG = -77.0365;

function mark(line: string) {
  console.log(`PERF_TEST:${line}`);
}

function metric(key: string, value: number | string | null) {
  mark(`METRIC:${key}=${value ?? 'n/a'}`);
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function waitFor(pred: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (pred()) return true;
    await sleep(50);
  }
  return pred();
}

interface ChurnStats {
  ticks: number;
  tickMsTotal: number;
  tickMsMax: number;
  events: number;
  eventItems: number;
  lagMsTotal: number;
  lagMsMax: number;
}

function newChurnStats(): ChurnStats {
  return { ticks: 0, tickMsTotal: 0, tickMsMax: 0, events: 0, eventItems: 0, lagMsTotal: 0, lagMsMax: 0 };
}

export function PerfPage() {
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [phase, setPhase] = useState<Phase>('ready');
  const [subscribed, setSubscribed] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const seenRef = useRef(0);
  const renderCountRef = useRef(0);
  const running = useRef(false);

  const note = (line: string) => setLog(prev => [...prev.slice(-40), line]);

  const enter = (p: Phase) => {
    setPhase(p);
    mark(`PHASE:${p}`);
    note(`→ ${p}`);
  };

  const churn = async (uids: string[], secs: number, expectEvents: boolean): Promise<ChurnStats> => {
    const stats = newChurnStats();
    let lastTickAt = 0;

    const handler = (ev: MapItemsChangedEvent) => {
      stats.events++;
      stats.eventItems += ev.updated.length + ev.added.length + ev.removed.length;
      if (lastTickAt > 0) {
        const lag = performance.now() - lastTickAt;
        stats.lagMsTotal += lag;
        if (lag > stats.lagMsMax) stats.lagMsMax = lag;
      }
    };
    on('mapItemsChanged', handler);

    const intervalMs = 1000 / cfg.updateHz;
    const end = performance.now() + secs * 1000;
    let step = 0;
    while (performance.now() < end) {
      const t0 = performance.now();
      step++;
      // Walk each marker a few metres in a slow circle so every update is a
      // real position change, not a no-op the native side could skip.
      const angle = (step / 20) * Math.PI * 2;
      for (let i = 0; i < uids.length; i++) {
        const r = 0.001 + (i % 10) * 0.0002;
        updateMarker(uids[i]!, {
          lat: BASE_LAT + Math.sin(angle + i) * r,
          lng: BASE_LNG + Math.cos(angle + i) * r,
        });
      }
      const tickMs = performance.now() - t0;
      lastTickAt = performance.now();
      stats.ticks++;
      stats.tickMsTotal += tickMs;
      if (tickMs > stats.tickMsMax) stats.tickMsMax = tickMs;

      const remaining = intervalMs - tickMs;
      if (remaining > 0) await sleep(remaining);
    }
    // Let the last debounce window drain before detaching the counter.
    await sleep(300);
    off('mapItemsChanged', handler);

    const p = expectEvents ? 'churn' : 'churn-unsubscribed';
    metric(`${p}.ticks`, stats.ticks);
    metric(`${p}.updateCallsPerSec`, Math.round((stats.ticks * uids.length) / secs));
    metric(`${p}.tickMsAvg`, (stats.tickMsTotal / Math.max(1, stats.ticks)).toFixed(1));
    metric(`${p}.tickMsMax`, stats.tickMsMax.toFixed(1));
    metric(`${p}.eventsReceived`, stats.events);
    metric(`${p}.itemsReceived`, stats.eventItems);
    metric(`${p}.lagMsAvg`, stats.events ? (stats.lagMsTotal / stats.events).toFixed(1) : 'n/a');
    metric(`${p}.lagMsMax`, stats.events ? stats.lagMsMax.toFixed(1) : 'n/a');
    return stats;
  };

  const run = async () => {
    if (running.current) return;
    running.current = true;
    const phaseMs = cfg.phaseSecs * 1000;
    const uids: string[] = [];

    mark(`CONFIG:${JSON.stringify({ ...cfg, native: isNative() })}`);
    if (!isNative()) {
      // The mock never pushes mapItemsChanged, so the consistency waits below
      // would each sit out their 30s timeout. Numbers from a browser are not
      // what this page is for anyway.
      note('mock bridge: consistency waits will time out; run on a device');
    }

    try {
      // 1. Page mounted, no hooks — cost of React + a live WebView doing nothing.
      enter('idle');
      await sleep(phaseMs);

      // 2. useMapItems() mounted on whatever the map already holds.
      renderCountRef.current = 0;
      setSubscribed(true);
      enter('subscribed');
      await sleep(phaseMs);
      metric('subscribed.renders', renderCountRef.current);

      // 3. Bulk add.
      enter('load');
      const t0 = performance.now();
      for (let i = 0; i < cfg.markers; i++) {
        const uid = addMarker({
          uid: `${UID_PREFIX}${i}`,
          lat: BASE_LAT + (Math.random() - 0.5) * 0.02,
          lng: BASE_LNG + (Math.random() - 0.5) * 0.02,
          title: `PERF ${i}`,
        });
        if (uid) uids.push(uid);
      }
      metric('load.addMarkerMs', Math.round(performance.now() - t0));
      metric('load.created', uids.length);
      const consistent = await waitFor(() => seenRef.current >= uids.length, 30000);
      metric('load.timeToConsistentMs', Math.round(performance.now() - t0));
      metric('load.consistent', consistent ? 1 : 0);
      metric('load.seen', seenRef.current);

      // 4. Steady state with N items, no updates.
      renderCountRef.current = 0;
      enter('loaded');
      await sleep(phaseMs);
      metric('loaded.renders', renderCountRef.current);

      // 5. Updates flowing with a hook mounted — the full path.
      renderCountRef.current = 0;
      enter('churn');
      await churn(uids, cfg.churnSecs, true);
      metric('churn.renders', renderCountRef.current);

      // 6. Same updates, hook unmounted — relay detached, nothing crosses.
      setSubscribed(false);
      await sleep(500);
      enter('churn-unsubscribed');
      await churn(uids, cfg.churnSecs, false);

      // 7. Remove everything; remount the hook so the removals are observed.
      enter('cleanup');
      setSubscribed(true);
      // The hook's effect (and so startMapItemStream) runs on commit, after this
      // task yields. Removing before that would fire into a detached relay.
      await sleep(500);
      const t1 = performance.now();
      for (const uid of uids) removeMarker(uid);
      metric('cleanup.removeMarkerMs', Math.round(performance.now() - t1));
      await waitFor(() => seenRef.current === 0, 30000);
      metric('cleanup.timeToConsistentMs', Math.round(performance.now() - t1));
      setSubscribed(false);

      // 8. Back to nothing — should match `idle`. Growth here is a leak.
      enter('cleaned');
      await sleep(phaseMs);

      enter('done');
      mark('COMPLETE');
    } catch (e) {
      mark(`ERROR:${String(e)}`);
      note(`error: ${String(e)}`);
      setPhase('done');
    } finally {
      running.current = false;
    }
  };

  const field = (key: keyof Config, label: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#8d99ae' }}>
      {label}
      <input
        type="number"
        value={cfg[key]}
        disabled={phase !== 'ready' && phase !== 'done'}
        onChange={e => setCfg({ ...cfg, [key]: Number(e.target.value) })}
        style={{
          width: 72, padding: '4px 6px', borderRadius: 4, fontSize: 13,
          background: '#0f0f23', color: '#edf2f4', border: '1px solid #1a2744',
        }}
      />
    </label>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        {field('markers', 'Markers')}
        {field('updateHz', 'Update Hz')}
        {field('phaseSecs', 'Phase secs')}
        {field('churnSecs', 'Churn secs')}
        <button
          onClick={run}
          disabled={phase !== 'ready' && phase !== 'done'}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
            background: phase === 'ready' || phase === 'done' ? '#4cc9f0' : '#1a2744',
            color: phase === 'ready' || phase === 'done' ? '#0f0f23' : '#555',
          }}
        >
          Run
        </button>
      </div>

      <div style={{
        padding: '10px 12px', marginBottom: 12, borderRadius: 8, background: '#16213e',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: '#edf2f4', fontSize: 14, fontWeight: 600 }}>
          {phase === 'ready' ? 'Ready' : phase === 'done' ? 'Complete' : `Phase: ${phase}`}
        </span>
        <span style={{ color: '#8d99ae', fontSize: 12, fontFamily: 'monospace' }}>
          {subscribed ? 'hook mounted' : 'no hook'}
        </span>
      </div>

      {subscribed && <Subscriber seenRef={seenRef} renderCountRef={renderCountRef} />}

      <div style={{ marginTop: 12, fontSize: 11, fontFamily: 'monospace', color: '#555' }}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}

const ROWS_SHOWN = 50;

/**
 * The consumer under test. Unfiltered `useMapItems()` is what most real
 * screens use, so it is what gets measured; the list render is capped so the
 * DOM cost stays representative of a panel rather than growing with N.
 */
function Subscriber({ seenRef, renderCountRef }: {
  seenRef: MutableRefObject<number>;
  renderCountRef: MutableRefObject<number>;
}) {
  const items = useMapItems();
  renderCountRef.current++;

  const mine = items.filter(i => i.uid.startsWith(UID_PREFIX));
  useEffect(() => { seenRef.current = mine.length; }, [mine.length, seenRef]);

  return (
    <div style={{ background: '#16213e', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', fontSize: 12, color: '#8d99ae', borderBottom: '1px solid #1a2744' }}>
        {items.length} map items · {mine.length} stress markers
      </div>
      {mine.slice(0, ROWS_SHOWN).map((m: MapItemData) => (
        <div key={m.uid} style={{
          padding: '6px 12px', borderBottom: '1px solid #1a2744',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ color: '#edf2f4', fontSize: 12 }}>{m.title}</span>
          <span style={{ color: '#555', fontSize: 11, fontFamily: 'monospace' }}>
            {m.lat?.toFixed(5)}, {m.lng?.toFixed(5)}
          </span>
        </div>
      ))}
    </div>
  );
}
