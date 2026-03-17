import {
  isNative,
  useSelfLocation,
  useMapEvent,
  addMarker,
  removeMarker,
  panTo,
} from '@atak-reactive/sdk';
import { useState } from 'react';

export function App() {
  const location = useSelfLocation();
  const lastClick = useMapEvent('mapClick');
  const [markers, setMarkers] = useState<{ uid: string; title: string }[]>([]);

  const handleDropAtSelf = () => {
    if (!location) return;
    const title = `Pin ${markers.length + 1}`;
    const uid = addMarker({ lat: location.lat, lng: location.lng, title });
    if (uid) setMarkers((prev) => [...prev, { uid, title }]);
  };

  const handleDropAtClick = () => {
    if (!lastClick) return;
    const title = `Click Pin ${markers.length + 1}`;
    const uid = addMarker({ lat: lastClick.lat, lng: lastClick.lng, title });
    if (uid) setMarkers((prev) => [...prev, { uid, title }]);
  };

  const handleRemove = (uid: string) => {
    removeMarker(uid);
    setMarkers((prev) => prev.filter((m) => m.uid !== uid));
  };

  return (
    <div style={{ padding: 16, maxWidth: 480 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, color: '#fff' }}>React Settings</h1>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4,
          background: isNative() ? '#2d6a4f' : '#4a4e69', color: '#d8f3dc',
        }}>
          {isNative() ? 'ATAK' : 'MOCK'}
        </span>
      </header>

      <Section title="Location">
        {location ? (
          <>
            <Row label="Lat" value={location.lat.toFixed(6)} />
            <Row label="Lng" value={location.lng.toFixed(6)} />
            <Row label="Alt" value={`${(location.alt ?? 0).toFixed(1)} m`} />
          </>
        ) : (
          <p style={{ color: '#555', fontStyle: 'italic' }}>No location</p>
        )}
      </Section>

      <Section title="Last Map Click">
        {lastClick ? (
          <Row label="Position" value={`${lastClick.lat.toFixed(6)}, ${lastClick.lng.toFixed(6)}`} />
        ) : (
          <p style={{ color: '#555', fontStyle: 'italic' }}>Tap the map</p>
        )}
      </Section>

      <Section title="Actions">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn onClick={handleDropAtSelf} disabled={!location}>Drop at Self</Btn>
          <Btn onClick={handleDropAtClick} disabled={!lastClick}>Drop at Click</Btn>
          <Btn onClick={() => location && panTo(location.lat, location.lng)}>Pan to Self</Btn>
        </div>
      </Section>

      {markers.length > 0 && (
        <Section title={`Markers (${markers.length})`}>
          {markers.map((m) => (
            <div key={m.uid} style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a2744',
            }}>
              <div>
                <div style={{ color: '#edf2f4', fontSize: 13 }}>{m.title}</div>
                <div style={{ color: '#555', fontSize: 11, fontFamily: 'monospace' }}>
                  {m.uid.slice(0, 12)}...
                </div>
              </div>
              <Btn onClick={() => handleRemove(m.uid)} variant="danger">Remove</Btn>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16, padding: 12, background: '#16213e', borderRadius: 8 }}>
      <h2 style={{
        fontSize: 13, fontWeight: 600, color: '#8d99ae',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
      }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ color: '#8d99ae', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#edf2f4', fontSize: 13, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function Btn({ children, onClick, disabled, variant }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'danger';
}) {
  const bg = variant === 'danger' ? '#3d0000' : '#0f3460';
  const border = variant === 'danger' ? '#5c0000' : '#1a4a7a';
  const color = variant === 'danger' ? '#ff6b6b' : '#e0e0e0';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px', background: bg, color, border: `1px solid ${border}`,
        borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
        fontSize: 12, fontWeight: 500, opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
