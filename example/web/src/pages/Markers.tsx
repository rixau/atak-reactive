import { useSelfLocation, useMapEvent, useMapItems, addMarker, removeMarker, panTo } from '@atak-reactive/sdk';

export function MarkersPage() {
  const location = useSelfLocation();
  const lastClick = useMapEvent('mapClick');
  const allItems = useMapItems({ visible: true });
  const items = allItems.filter(m => m.lat != null && m.lng != null);

  const dropAtSelf = () => {
    if (!location) return;
    const title = `Self ${items.length + 1}`;
    addMarker({ lat: location.lat, lng: location.lng, title });
  };

  const dropAtClick = () => {
    if (!lastClick) return;
    const title = `Click ${items.length + 1}`;
    addMarker({ lat: lastClick.lat, lng: lastClick.lng, title });
  };

  const remove = (uid: string) => {
    removeMarker(uid);
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

      {items.length === 0 ? (
        <p style={{ color: '#555', fontStyle: 'italic', textAlign: 'center', padding: 32 }}>
          No map items. Drop a marker or add one in ATAK.
        </p>
      ) : (
        <div style={{ background: '#16213e', borderRadius: 8, overflow: 'hidden' }}>
          {items.map((m, i) => (
            <div key={m.uid} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px',
              borderBottom: i < items.length - 1 ? '1px solid #1a2744' : 'none',
            }}>
              <div>
                <div style={{ color: '#edf2f4', fontSize: 13, fontWeight: 500 }}>
                  {m.title || m.callsign || m.uid.slice(0, 12)}
                </div>
                <div style={{ color: '#555', fontSize: 11, fontFamily: 'monospace' }}>
                  {m.lat != null ? m.lat.toFixed(4) : '?'}, {m.lng != null ? m.lng.toFixed(4) : '?'}
                  {m.type ? ` · ${m.type}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => m.lat != null && m.lng != null && panTo(m.lat, m.lng)}
                  style={{ ...btnStyle, padding: '4px 12px' }}
                >
                  Go To
                </button>
                <button
                  onClick={() => remove(m.uid)}
                  style={{ ...btnStyle, background: '#3d0000', color: '#ff6b6b', border: '1px solid #5c0000', padding: '4px 12px' }}
                >
                  Remove
                </button>
              </div>
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
