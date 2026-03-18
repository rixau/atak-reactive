import { useState } from 'react';
import { isNative, useSelfLocation, useMapEvent, addMarker, removeMarker, panTo } from '@atak-reactive/sdk';

export function App() {
  const location = useSelfLocation();
  const lastClick = useMapEvent('mapClick');
  const [markers, setMarkers] = useState<{ uid: string; title: string }[]>([]);

  const dropAtSelf = () => {
    if (!location) return;
    const title = `Pin ${markers.length + 1}`;
    const uid = addMarker({ lat: location.lat, lng: location.lng, title });
    if (uid) setMarkers(p => [...p, { uid, title }]);
  };

  const dropAtClick = () => {
    if (!lastClick) return;
    const title = `Click ${markers.length + 1}`;
    const uid = addMarker({ lat: lastClick.lat, lng: lastClick.lng, title });
    if (uid) setMarkers(p => [...p, { uid, title }]);
  };

  const remove = (uid: string) => {
    removeMarker(uid);
    setMarkers(p => p.filter(m => m.uid !== uid));
  };

  const s = {
    box: { padding: 12, marginBottom: 12, background: '#16213e', borderRadius: 8 } as const,
    h2: { fontSize: 12, fontWeight: 600, color: '#8d99ae', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 },
    row: { display: 'flex', justifyContent: 'space-between', padding: '3px 0' } as const,
    label: { color: '#8d99ae', fontSize: 13 },
    val: { color: '#edf2f4', fontSize: 13, fontFamily: 'monospace' },
    btn: { padding: '6px 14px', background: '#0f3460', color: '#e0e0e0', border: '1px solid #1a4a7a', borderRadius: 6, cursor: 'pointer', fontSize: 12 } as const,
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, color: '#fff' }}>atak-reactive test</h1>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: isNative() ? '#2d6a4f' : '#4a4e69', color: '#d8f3dc' }}>
          {isNative() ? 'NATIVE' : 'MOCK'}
        </span>
      </div>

      <div style={s.box}>
        <h2 style={s.h2}>Location</h2>
        {location ? (
          <>
            <div style={s.row}><span style={s.label}>Lat</span><span style={s.val}>{location.lat.toFixed(6)}</span></div>
            <div style={s.row}><span style={s.label}>Lng</span><span style={s.val}>{location.lng.toFixed(6)}</span></div>
          </>
        ) : <p style={{ color: '#555' }}>Waiting...</p>}
      </div>

      <div style={s.box}>
        <h2 style={s.h2}>Last Click</h2>
        {lastClick
          ? <div style={s.row}><span style={s.val}>{lastClick.lat.toFixed(6)}, {lastClick.lng.toFixed(6)}</span></div>
          : <p style={{ color: '#555' }}>Tap the map</p>}
      </div>

      <div style={s.box}>
        <h2 style={s.h2}>Actions</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={s.btn} onClick={dropAtSelf} disabled={!location}>Drop at Self</button>
          <button style={s.btn} onClick={dropAtClick} disabled={!lastClick}>Drop at Click</button>
          <button style={s.btn} onClick={() => location && panTo(location.lat, location.lng)}>Pan to Self</button>
        </div>
      </div>

      {markers.length > 0 && (
        <div style={s.box}>
          <h2 style={s.h2}>Markers ({markers.length})</h2>
          {markers.map(m => (
            <div key={m.uid} style={{ ...s.row, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a2744' }}>
              <span style={s.val}>{m.title}</span>
              <button style={{ ...s.btn, background: '#3d0000', color: '#ff6b6b', border: '1px solid #5c0000', padding: '3px 10px' }} onClick={() => remove(m.uid)}>x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
