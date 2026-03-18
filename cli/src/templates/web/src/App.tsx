import { isNative, useSelfLocation, useMapEvent, addMarker, panTo } from '@atak-reactive/sdk';
import { useState } from 'react';

export function App() {
  const location = useSelfLocation();
  const lastClick = useMapEvent('mapClick');
  const [markers, setMarkers] = useState<{ uid: string; title: string }[]>([]);

  const dropMarker = () => {
    const pt = lastClick ?? location;
    if (!pt) return;
    const title = `Marker ${markers.length + 1}`;
    const uid = addMarker({ lat: pt.lat, lng: pt.lng, title });
    if (uid) setMarkers(p => [...p, { uid, title }]);
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, color: '#fff' }}>My Plugin</h1>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: isNative() ? '#2d6a4f' : '#4a4e69', color: '#d8f3dc' }}>
          {isNative() ? 'ATAK' : 'MOCK'}
        </span>
      </div>

      <div style={{ padding: 12, marginBottom: 12, background: '#16213e', borderRadius: 8 }}>
        <h2 style={{ fontSize: 12, fontWeight: 600, color: '#8d99ae', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Location</h2>
        {location
          ? <p style={{ color: '#edf2f4', fontFamily: 'monospace', fontSize: 13 }}>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
          : <p style={{ color: '#555' }}>Waiting for GPS...</p>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={dropMarker} style={{ padding: '8px 16px', background: '#0f3460', color: '#e0e0e0', border: '1px solid #1a4a7a', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Drop Marker
        </button>
        <button onClick={() => location && panTo(location.lat, location.lng)} style={{ padding: '8px 16px', background: '#0f3460', color: '#e0e0e0', border: '1px solid #1a4a7a', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Pan to Self
        </button>
      </div>

      {markers.length > 0 && (
        <p style={{ color: '#8d99ae', fontSize: 12 }}>{markers.length} marker(s) placed</p>
      )}
    </div>
  );
}
