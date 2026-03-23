import { useEffect, useRef, useState } from 'react';
import {
  addMarker,
  updateMarker,
  removeMarker,
  useMapItems,
  useMapItem,
  useMapGroups,
  useSelfLocation,
  toMGRS,
  toUTM,
  fromMGRS,
  fromUTM,
  formatCoordinate,
  distanceTo,
  useCoordinateFormat,
  getPreference,
  setItemMeta,
  getItemMeta,
  isNative,
  sendCot,
  sendBroadcast,
} from '@atak-reactive/sdk';

interface TestResult {
  name: string;
  pass: boolean;
  detail?: string;
}

function log(pass: boolean, name: string, detail?: string) {
  const d = detail ? ` — ${detail}` : '';
  console.log(`INTEGRATION_TEST:${pass ? 'PASS' : 'FAIL'}:${name}${d}`);
}

export function IntegrationTestPage() {
  const items = useMapItems();
  const [trackUid, setTrackUid] = useState<string | null>(null);
  const trackedItem = useMapItem(trackUid ?? '');
  const groups = useMapGroups();
  const location = useSelfLocation();
  const coordFormat = useCoordinateFormat();
  const [results, setResults] = useState<TestResult[]>([]);
  const testMarkerUid = useRef<string | null>(null);
  const phase = useRef<'setup' | 'verify-stream' | 'verify-update' | 'verify-meta' | 'verify-remove' | 'done'>('setup');

  const addResult = (r: TestResult) => {
    log(r.pass, r.name, r.detail);
    setResults(prev => [...prev, r]);
  };

  // Phase 1: Synchronous tests + drop a marker
  useEffect(() => {
    if (phase.current !== 'setup') return;
    phase.current = 'verify-stream';

    // --- Bridge basics ---
    const native = isNative();
    log(native, 'isNative', String(native));

    // --- Markers ---
    const uid = addMarker({ lat: 38.8977, lng: -77.0365, title: 'TEST_MARKER' });
    log(!!uid, 'addMarker returns uid', uid ?? 'null');
    if (uid) {
      testMarkerUid.current = uid;
      setTrackUid(uid);
    }

    // --- Coordinate conversions ---
    const mgrs = toMGRS(38.8977, -77.0365);
    log(mgrs.length > 0, 'toMGRS', mgrs);

    const utm = toUTM(38.8977, -77.0365);
    log(utm.length > 0, 'toUTM', utm);

    const fromMgrs = fromMGRS(mgrs);
    log(fromMgrs !== null && Math.abs(fromMgrs.lat - 38.8977) < 0.01, 'fromMGRS roundtrip',
      fromMgrs ? `${fromMgrs.lat.toFixed(4)}, ${fromMgrs.lng.toFixed(4)}` : 'null');

    const fromUtm = fromUTM(utm);
    log(fromUtm !== null, 'fromUTM', fromUtm ? `${fromUtm.lat.toFixed(4)}, ${fromUtm.lng.toFixed(4)}` : 'null');

    const fmt = formatCoordinate(38.8977, -77.0365);
    log(fmt.length > 0, 'formatCoordinate', fmt);

    const dist = distanceTo({ lat: 38.0, lng: -77.0 }, { lat: 39.0, lng: -77.0 });
    log(dist !== null && dist.distance > 0, 'distanceTo',
      dist ? `${Math.round(dist.distance)}m, ${Math.round(dist.bearing)}°` : 'null');

    log(typeof coordFormat === 'string' && coordFormat.length > 0, 'useCoordinateFormat', coordFormat);

    // --- Preferences ---
    const pref = getPreference('coordinateFormat');
    log(pref !== null, 'getPreference', pref ?? 'null');

    // --- Map groups ---
    log(Array.isArray(groups), 'useMapGroups returns array', `${groups.length} groups`);

    // --- Self location ---
    // May be null on emulator without GPS mock, so just check it doesn't crash
    log(true, 'useSelfLocation no crash', location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'null (no GPS)');

    // --- CoT send (single device, just verify no crash) ---
    const cotResult = sendCot({
      uid: 'test-cot-event',
      type: 'a-f-G-U-C',
      lat: 38.8977,
      lng: -77.0365,
      alt: null,
      how: 'h-g-i-g-o',
      time: Date.now(),
      stale: Date.now() + 300000,
      callsign: 'TEST',
      team: 'Cyan',
      detail: {},
    }, 'internal');
    log(cotResult === true, 'sendCot internal', String(cotResult));

    // --- Intent send (just verify no crash) ---
    try {
      sendBroadcast('com.atakmap.android.plugintemplate.TEST_INTENT', { test: true });
      log(true, 'sendBroadcast no crash');
    } catch (e) {
      log(false, 'sendBroadcast', String(e));
    }

    setResults([
      { name: 'isNative', pass: native, detail: String(native) },
      { name: 'addMarker returns uid', pass: !!uid, detail: uid ?? 'null' },
      { name: 'toMGRS', pass: mgrs.length > 0, detail: mgrs },
      { name: 'toUTM', pass: utm.length > 0, detail: utm },
      { name: 'fromMGRS roundtrip', pass: fromMgrs !== null && Math.abs(fromMgrs!.lat - 38.8977) < 0.01, detail: fromMgrs ? `${fromMgrs.lat.toFixed(4)}` : 'null' },
      { name: 'fromUTM', pass: fromUtm !== null, detail: fromUtm ? `${fromUtm.lat.toFixed(4)}` : 'null' },
      { name: 'formatCoordinate', pass: fmt.length > 0, detail: fmt },
      { name: 'distanceTo', pass: dist !== null && dist!.distance > 0, detail: dist ? `${Math.round(dist.distance)}m` : 'null' },
      { name: 'useCoordinateFormat', pass: coordFormat.length > 0, detail: coordFormat },
      { name: 'getPreference', pass: pref !== null, detail: pref ?? 'null' },
      { name: 'useMapGroups', pass: Array.isArray(groups), detail: `${groups.length} groups` },
      { name: 'useSelfLocation', pass: true, detail: location ? `${location.lat.toFixed(4)}` : 'null' },
      { name: 'sendCot internal', pass: cotResult === true },
      { name: 'sendBroadcast no crash', pass: true },
    ]);
  }, []);

  // Phase 2: Verify marker appears in useMapItems stream
  useEffect(() => {
    if (phase.current !== 'verify-stream' || !testMarkerUid.current) return;

    const found = items.find(i => i.uid === testMarkerUid.current);
    if (found) {
      phase.current = 'verify-update';

      addResult({ name: 'useMapItems sees marker', pass: true });

      // Update the marker
      const updated = updateMarker(testMarkerUid.current!, { title: 'UPDATED_MARKER' });
      addResult({ name: 'updateMarker returns true', pass: updated });
    }
  }, [items]);

  // Phase 3: Verify updateMarker reflected in useMapItem
  useEffect(() => {
    if (phase.current !== 'verify-update' || !trackedItem) return;

    if (trackedItem.title === 'UPDATED_MARKER') {
      phase.current = 'verify-meta';

      addResult({ name: 'useMapItem sees update', pass: true, detail: trackedItem.title });

      // Set metadata
      setItemMeta(testMarkerUid.current!, 'test-key', 'test-value');
    }
  }, [trackedItem]);

  // Phase 4: Verify metadata write reflected in stream
  useEffect(() => {
    if (phase.current !== 'verify-meta' || !testMarkerUid.current) return;

    // Check if we can read the metadata back
    const meta = getItemMeta(testMarkerUid.current!, 'test-key');
    if (meta === 'test-value') {
      phase.current = 'verify-remove';

      addResult({ name: 'setItemMeta + getItemMeta', pass: true, detail: meta });

      // Remove the marker
      removeMarker(testMarkerUid.current!);
    }
  }, [items]);

  // Phase 5: Verify removal
  useEffect(() => {
    if (phase.current !== 'verify-remove' || !testMarkerUid.current) return;

    const found = items.find(i => i.uid === testMarkerUid.current);
    if (!found) {
      phase.current = 'done';

      addResult({ name: 'removeMarker removes from stream', pass: true });

      // Final count
      setResults(prev => {
        const all = prev;
        const passed = all.filter(r => r.pass).length;
        console.log(`INTEGRATION_TEST:COMPLETE:${passed}/${all.length} passed`);
        return all;
      });
    }
  }, [items]);

  const passed = results.filter(r => r.pass).length;
  const total = results.length;

  return (
    <div>
      <h2 style={{ margin: '0 0 12px', fontSize: 14, color: '#8d99ae' }}>
        Integration Tests {phase.current === 'done' ? `— ${passed}/${total}` : '— running...'}
      </h2>
      {results.map((r, i) => (
        <div key={i} style={{
          padding: '6px 10px', marginBottom: 3, borderRadius: 4,
          background: r.pass ? '#1a3a2a' : '#3a1a1a',
          color: r.pass ? '#4ade80' : '#f87171',
          fontSize: 12,
        }}>
          {r.pass ? 'PASS' : 'FAIL'}: {r.name}{r.detail ? ` — ${r.detail}` : ''}
        </div>
      ))}
      {phase.current !== 'done' && phase.current !== 'setup' && (
        <div style={{ color: '#555', padding: '8px 0', fontSize: 12 }}>
          Phase: {phase.current}...
        </div>
      )}
    </div>
  );
}
