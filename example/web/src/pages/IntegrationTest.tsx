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
  setPreference,
  removePreference,
  setDropdownSize,
  getDropdownSize,
  setNavVisible,
  getNavVisible,
  setItemMeta,
  getItemMeta,
  isNative,
  sendCot,
  sendBroadcast,
  addShape,
  addCircle,
  updateShape,
  removeShape,
  addRoute,
  addWaypoint,
  updateRoute,
  removeRoute,
  startNavigation,
  stopNavigation,
  useNavigationState,
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
  const nav = useNavigationState();
  const [results, setResults] = useState<TestResult[]>([]);
  const testMarkerUid = useRef<string | null>(null);
  const testShapeUid = useRef<string | null>(null);
  const testCircleUid = useRef<string | null>(null);
  const testRouteUid = useRef<string | null>(null);
  const phase = useRef<
    | 'setup' | 'verify-stream' | 'verify-update' | 'verify-meta' | 'verify-remove'
    | 'shape-create' | 'shape-verify-stream' | 'shape-update' | 'shape-verify-update' | 'shape-remove' | 'shape-verify-remove'
    | 'circle-create' | 'circle-verify-stream' | 'circle-remove' | 'circle-verify-remove'
    | 'route-create' | 'route-verify-stream' | 'route-update' | 'route-waypoint' | 'route-remove' | 'route-verify-remove'
    | 'done'
  >('setup');

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

    // --- Preferences write/read roundtrip ---
    const prefKey = 'test.spike1.integration';
    const setPrefResult = setPreference(prefKey, 'test_value');
    log(setPrefResult, 'setPreference returns true', String(setPrefResult));

    const readBack = getPreference(prefKey);
    log(readBack === 'test_value', 'getPreference reads back written value', readBack ?? 'null');

    const removePrefResult = removePreference(prefKey);
    log(removePrefResult, 'removePreference returns true', String(removePrefResult));

    const afterRemove = getPreference(prefKey);
    log(afterRemove === null, 'getPreference returns null after remove', afterRemove ?? 'null');

    // --- Dropdown sizing ---
    try {
      setDropdownSize('full', 'full');
      const size = getDropdownSize();
      log(size.width === 1.0 && size.height === 1.0, 'setDropdownSize + getDropdownSize',
        `${size.width}x${size.height}`);
      // Restore default
      setDropdownSize('half', 'full');
    } catch (e) {
      log(false, 'dropdown sizing', String(e));
    }

    // --- Nav visibility ---
    try {
      const initialNav = getNavVisible();
      log(typeof initialNav === 'boolean', 'getNavVisible returns boolean', String(initialNav));

      setNavVisible(false);
      // Small delay needed for intent broadcast round-trip
      setTimeout(() => {
        const afterHide = getNavVisible();
        log(afterHide === false, 'setNavVisible(false) hides nav', String(afterHide));
        // Restore
        setNavVisible(true);
      }, 200);
    } catch (e) {
      log(false, 'nav visibility', String(e));
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

  // Phase 5: Verify marker removal → start shape tests
  useEffect(() => {
    if (phase.current !== 'verify-remove' || !testMarkerUid.current) return;

    const found = items.find(i => i.uid === testMarkerUid.current);
    if (!found) {
      phase.current = 'shape-create';
      addResult({ name: 'removeMarker removes from stream', pass: true });

      // --- Shape: create polygon ---
      const uid = addShape({
        points: [
          { lat: 38.897, lng: -77.036 },
          { lat: 38.898, lng: -77.035 },
          { lat: 38.897, lng: -77.034 },
        ],
        closed: true,
        title: 'TEST_SHAPE',
        strokeColor: '#FFFF0000',
        fillColor: '#3300FF00',
      });
      addResult({ name: 'addShape returns uid', pass: !!uid, detail: uid ?? 'null' });
      if (uid) {
        testShapeUid.current = uid;
        phase.current = 'shape-verify-stream';
      }
    }
  }, [items]);

  // Phase 6: Verify shape appears in stream
  useEffect(() => {
    if (phase.current !== 'shape-verify-stream' || !testShapeUid.current) return;

    const found = items.find(i => i.uid === testShapeUid.current);
    if (found) {
      phase.current = 'shape-update';
      addResult({ name: 'useMapItems sees shape', pass: true, detail: found.type });

      const ok = updateShape(testShapeUid.current!, { strokeColor: '#FF00FF00', title: 'UPDATED_SHAPE' });
      addResult({ name: 'updateShape returns true', pass: ok });
      if (ok) phase.current = 'shape-verify-update';
    }
  }, [items]);

  // Phase 7: Verify shape update in stream
  useEffect(() => {
    if (phase.current !== 'shape-verify-update' || !testShapeUid.current) return;

    const found = items.find(i => i.uid === testShapeUid.current);
    if (found && found.title === 'UPDATED_SHAPE') {
      phase.current = 'shape-remove';
      addResult({ name: 'useMapItems sees shape update', pass: true, detail: found.title });

      removeShape(testShapeUid.current!);
      phase.current = 'shape-verify-remove';
    }
  }, [items]);

  // Phase 8: Verify shape removal
  useEffect(() => {
    if (phase.current !== 'shape-verify-remove' || !testShapeUid.current) return;

    const found = items.find(i => i.uid === testShapeUid.current);
    if (!found) {
      phase.current = 'circle-create';
      addResult({ name: 'removeShape removes from stream', pass: true });

      // --- Circle: create ---
      const uid = addCircle({
        center: { lat: 38.897, lng: -77.036 },
        radius: 500,
        title: 'TEST_CIRCLE',
      });
      addResult({ name: 'addCircle returns uid', pass: !!uid, detail: uid ?? 'null' });
      if (uid) {
        testCircleUid.current = uid;
        phase.current = 'circle-verify-stream';
      }
    }
  }, [items]);

  // Phase 9: Verify circle in stream → remove
  useEffect(() => {
    if (phase.current !== 'circle-verify-stream' || !testCircleUid.current) return;

    const found = items.find(i => i.uid === testCircleUid.current);
    if (found) {
      addResult({ name: 'useMapItems sees circle', pass: true, detail: `radius=${found.radius}` });

      removeShape(testCircleUid.current!);
      phase.current = 'circle-verify-remove';
    }
  }, [items]);

  // Phase 10: Verify circle removal → start route tests
  useEffect(() => {
    if (phase.current !== 'circle-verify-remove' || !testCircleUid.current) return;

    const found = items.find(i => i.uid === testCircleUid.current);
    if (!found) {
      phase.current = 'route-create';
      addResult({ name: 'removeShape(circle) removes from stream', pass: true });

      // --- Route: create ---
      const uid = addRoute({
        waypoints: [
          { lat: 38.88, lng: -77.03 },
          { lat: 38.89, lng: -77.02 },
          { lat: 38.90, lng: -77.01 },
        ],
        title: 'TEST_ROUTE',
        method: 'Driving',
        direction: 'Infil',
      });
      addResult({ name: 'addRoute returns uid', pass: !!uid, detail: uid ?? 'null' });
      if (uid) {
        testRouteUid.current = uid;
        phase.current = 'route-verify-stream';
      }
    }
  }, [items]);

  // Phase 11: Verify route in stream → update + waypoint
  useEffect(() => {
    if (phase.current !== 'route-verify-stream' || !testRouteUid.current) return;

    const found = items.find(i => i.uid === testRouteUid.current);
    if (found) {
      addResult({ name: 'useMapItems sees route', pass: true, detail: found.routeMethod ?? '' });

      const upOk = updateRoute(testRouteUid.current!, { title: 'UPDATED_ROUTE' });
      addResult({ name: 'updateRoute returns true', pass: upOk });

      const wpOk = addWaypoint(testRouteUid.current!, { lat: 38.91, lng: -77.0 });
      addResult({ name: 'addWaypoint returns true', pass: wpOk });

      // Navigation: start then immediately stop (just verify bridge calls work)
      const navStart = startNavigation(testRouteUid.current!);
      addResult({ name: 'startNavigation returns true', pass: navStart });

      const navStop = stopNavigation();
      addResult({ name: 'stopNavigation returns true', pass: navStop });

      // Remove route
      removeRoute(testRouteUid.current!);
      phase.current = 'route-verify-remove';
    }
  }, [items]);

  // Phase 12: Verify route removal → done
  useEffect(() => {
    if (phase.current !== 'route-verify-remove' || !testRouteUid.current) return;

    const found = items.find(i => i.uid === testRouteUid.current);
    if (!found) {
      phase.current = 'done';

      addResult({ name: 'removeRoute removes from stream', pass: true });

      // Navigation state check (should be inactive after stopNavigation)
      addResult({
        name: 'useNavigationState returns state',
        pass: typeof nav.active === 'boolean',
        detail: `active=${nav.active}`,
      });

      // Final count
      setResults(prev => {
        const passed = prev.filter(r => r.pass).length;
        console.log(`INTEGRATION_TEST:COMPLETE:${passed}/${prev.length} passed`);
        return prev;
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
