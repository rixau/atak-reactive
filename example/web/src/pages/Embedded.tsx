import { useState } from 'react';
import { useMapItems, useSelfLocation, addMarker, removeMarker } from '@atak-reactive/sdk';

/**
 * Embedded React tab — runs inside a ReactiveWebView within a native tabbed layout.
 * Demonstrates that the full SDK works identically in an embedded view.
 */
export function EmbeddedPage() {
  const items = useMapItems();
  const location = useSelfLocation();
  const [lastDropped, setLastDropped] = useState<string | null>(null);

  const dropMarker = () => {
    if (!location) return;
    const uid = addMarker({
      lat: location.lat,
      lng: location.lng,
      title: `Drop ${new Date().toLocaleTimeString()}`,
      type: 'a-f-G-U-C',
    });
    setLastDropped(uid);
  };

  return (
    <div>
      <div style={styles.header}>
        <span style={styles.badge}>EMBEDDED</span>
        <span style={styles.subtitle}>ReactiveWebView</span>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>MAP ITEMS</h2>
        <p style={styles.count}>{items.length} items on map</p>
        <div style={styles.list}>
          {items.slice(0, 8).map(item => (
            <div key={item.uid} style={styles.row}>
              <span style={styles.itemTitle}>{item.title || item.uid.slice(0, 12)}</span>
              <span style={styles.itemType}>{item.type}</span>
            </div>
          ))}
          {items.length > 8 && (
            <p style={styles.more}>+{items.length - 8} more</p>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>ACTIONS</h2>
        <button onClick={dropMarker} disabled={!location} style={styles.button}>
          Drop Marker at My Location
        </button>
        {lastDropped && (
          <div style={styles.row}>
            <span style={styles.dim}>Last dropped</span>
            <button onClick={() => { removeMarker(lastDropped); setLastDropped(null); }} style={styles.removeBtn}>
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  badge: { fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#2d6a4f', color: '#d8f3dc', fontWeight: 600, letterSpacing: 1 },
  subtitle: { fontSize: 12, color: '#8d99ae' },
  card: { padding: 12, marginBottom: 12, background: '#16213e', borderRadius: 8 },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: '#8d99ae', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 },
  count: { fontSize: 14, color: '#edf2f4', marginBottom: 8 },
  list: { maxHeight: 200, overflow: 'auto' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' },
  itemTitle: { color: '#edf2f4', fontSize: 13 },
  itemType: { color: '#8d99ae', fontSize: 11, fontFamily: 'monospace' },
  more: { color: '#8d99ae', fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  dim: { color: '#8d99ae', fontSize: 12 },
  button: { width: '100%', padding: '10px 0', border: 'none', borderRadius: 6, background: '#4cc9f0', color: '#0f0f23', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 8 },
  removeBtn: { background: 'none', border: '1px solid #8d99ae', borderRadius: 4, color: '#8d99ae', fontSize: 11, padding: '2px 8px', cursor: 'pointer' },
};
