import { useSelfLocation, useMapEvent, addMarker, removeMarker, panTo } from '@atak-reactive/sdk';
import type { MarkerEntry } from '../App';

interface Props {
  markers: MarkerEntry[];
  setMarkers: React.Dispatch<React.SetStateAction<MarkerEntry[]>>;
}

export function MarkersPage({ markers, setMarkers }: Props) {
  const location = useSelfLocation();
  const lastClick = useMapEvent('mapClick');

  const dropAtSelf = () => {
    if (!location) return;
    const title = `Self ${markers.length + 1}`;
    const uid = addMarker({ lat: location.lat, lng: location.lng, title });
    if (uid) setMarkers(p => [...p, { uid, title, lat: location.lat, lng: location.lng }]);
  };

  const dropAtClick = () => {
    if (!lastClick) return;
    const title = `Click ${markers.length + 1}`;
    const uid = addMarker({ lat: lastClick.lat, lng: lastClick.lng, title });
    if (uid) setMarkers(p => [...p, { uid, title, lat: lastClick.lat, lng: lastClick.lng }]);
  };

  const remove = (uid: string) => {
    removeMarker(uid);
    setMarkers(p => p.filter(m => m.uid !== uid));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={btnStyle} onClick={dropAtSelf} disabled={!location}>
          Drop at Self
        </button>
        <button style={btnStyle} onClick={dropAtClick} disabled={!lastClick}>
          Drop at Click
        </button>
        <button style={btnStyle} onClick={() => location && panTo(location.lat, location.lng)}>
          Pan to Self
        </button>
      </div>

      {markers.length === 0 ? (
        <p style={{ color: '#555', fontStyle: 'italic', textAlign: 'center', padding: 32 }}>
          No markers yet. Drop one using the buttons above.
        </p>
      ) : (
        <div style={{ background: '#16213e', borderRadius: 8, overflow: 'hidden' }}>
          {markers.map((m, i) => (
            <div key={m.uid} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px',
              borderBottom: i < markers.length - 1 ? '1px solid #1a2744' : 'none',
            }}>
              <div>
                <div style={{ color: '#edf2f4', fontSize: 13, fontWeight: 500 }}>{m.title}</div>
                <div style={{ color: '#555', fontSize: 11, fontFamily: 'monospace' }}>
                  {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                </div>
              </div>
              <button
                onClick={() => remove(m.uid)}
                style={{ ...btnStyle, background: '#3d0000', color: '#ff6b6b', border: '1px solid #5c0000', padding: '4px 12px' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: '#0f3460',
  color: '#e0e0e0',
  border: '1px solid #1a4a7a',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
};
