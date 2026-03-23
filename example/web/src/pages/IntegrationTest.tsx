import { useEffect, useRef, useState } from 'react';
import {
  addMarker,
  removeMarker,
  useMapItems,
  toMGRS,
  formatCoordinate,
  isNative,
} from '@atak-reactive/sdk';

interface TestResult {
  name: string;
  pass: boolean;
  detail?: string;
}

export function IntegrationTestPage() {
  const items = useMapItems();
  const [results, setResults] = useState<TestResult[]>([]);
  const testMarkerUid = useRef<string | null>(null);
  const phase = useRef<'setup' | 'verify' | 'done'>('setup');

  useEffect(() => {
    if (phase.current !== 'setup') return;
    phase.current = 'verify';

    const batch: TestResult[] = [];

    // Test: isNative
    const native = isNative();
    batch.push({ name: 'isNative', pass: native, detail: String(native) });
    console.log(`INTEGRATION_TEST:${native ? 'PASS' : 'FAIL'}:isNative — ${native}`);

    // Test: addMarker returns uid
    const uid = addMarker({
      lat: 38.8977,
      lng: -77.0365,
      title: 'INTEGRATION_TEST_MARKER',
    });
    if (uid) {
      testMarkerUid.current = uid;
      batch.push({ name: 'addMarker returns uid', pass: true });
      console.log('INTEGRATION_TEST:PASS:addMarker returns uid');
    } else {
      batch.push({ name: 'addMarker returns uid', pass: false, detail: 'null' });
      console.log('INTEGRATION_TEST:FAIL:addMarker returns uid');
      phase.current = 'done';
    }

    // Test: toMGRS
    const mgrs = toMGRS(38.8977, -77.0365);
    const mgrsPass = mgrs.length > 0;
    batch.push({ name: 'toMGRS', pass: mgrsPass, detail: mgrs });
    console.log(`INTEGRATION_TEST:${mgrsPass ? 'PASS' : 'FAIL'}:toMGRS — ${mgrs}`);

    // Test: formatCoordinate
    const fmt = formatCoordinate(38.8977, -77.0365);
    const fmtPass = fmt.length > 0;
    batch.push({ name: 'formatCoordinate', pass: fmtPass, detail: fmt });
    console.log(`INTEGRATION_TEST:${fmtPass ? 'PASS' : 'FAIL'}:formatCoordinate — ${fmt}`);

    setResults(batch);
  }, []);

  // Wait for marker in useMapItems stream
  useEffect(() => {
    if (phase.current !== 'verify' || !testMarkerUid.current) return;

    const found = items.find(i => i.uid === testMarkerUid.current);
    if (found) {
      phase.current = 'done';

      const streamResult: TestResult = { name: 'useMapItems sees marker', pass: true };
      console.log('INTEGRATION_TEST:PASS:useMapItems sees marker');

      removeMarker(testMarkerUid.current!);

      setResults(prev => {
        const all = [...prev, streamResult];
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
        }}>
          {r.pass ? 'PASS' : 'FAIL'}: {r.name}{r.detail ? ` — ${r.detail}` : ''}
        </div>
      ))}
      {phase.current === 'verify' && (
        <div style={{ color: '#555', padding: '8px 0' }}>Waiting for marker stream...</div>
      )}
    </div>
  );
}
