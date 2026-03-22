import { useSelfLocation, useMapEvent } from '@atak-reactive/sdk';

export function HomePage() {
  const location = useSelfLocation();
  const lastClick = useMapEvent('mapClick');
  const selected = useMapEvent('itemSelected');

  return (
    <div>
      <Section title="Self Location">
        {location ? (
          <>
            <Row label="Lat" value={location.lat.toFixed(6)} />
            <Row label="Lng" value={location.lng.toFixed(6)} />
            <Row label="Alt" value={`${(location.alt ?? 0).toFixed(1)} m`} />
            <Row label="Bearing" value={`${location.bearing.toFixed(0)}\u00B0`} />
            <Row label="Speed" value={`${location.speed.toFixed(1)} m/s`} />
          </>
        ) : (
          <p style={{ color: '#555', fontStyle: 'italic' }}>Waiting for GPS...</p>
        )}
      </Section>

      <Section title="Last Map Click">
        {lastClick ? (
          <Row label="Position" value={`${lastClick.lat.toFixed(6)}, ${lastClick.lng.toFixed(6)}`} />
        ) : (
          <p style={{ color: '#555', fontStyle: 'italic' }}>Tap the map</p>
        )}
      </Section>

      <Section title="Selected Item">
        {selected ? (
          <>
            <Row label="Title" value={selected.title} />
            <Row label="Type" value={selected.type} />
            <Row label="UID" value={selected.uid.slice(0, 16) + '...'} />
          </>
        ) : (
          <p style={{ color: '#555', fontStyle: 'italic' }}>Tap a map item</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 12, marginBottom: 12, background: '#16213e', borderRadius: 8 }}>
      <h2 style={{ fontSize: 12, fontWeight: 600, color: '#8d99ae', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: '#8d99ae', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#edf2f4', fontSize: 13, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}
