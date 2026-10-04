import { useRef, useState } from 'react';
import { useSelfLocation, useAtakEvent, useMapItems, addMarker, removeMarker, panTo } from '@atak-reactive/sdk';
import { useLatencyProbe } from '../perf/latencyProbe';
import { TOUCH_GAP, TOUCH_TARGET } from '../touch';

export function MarkersPage() {
  const location = useSelfLocation();
  const allItems = useMapItems({ visible: true });
  const items = allItems.filter(m => m.lat != null && m.lng != null);
  useLatencyProbe(items);

  // "Drop at Click" arms, then drops on the next map tap. useAtakEvent keeps
  // the first callback it's given, so the handler reads refs, not state.
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  const itemCountRef = useRef(items.length);
  itemCountRef.current = items.length;

  const setArmedBoth = (value: boolean) => {
    armedRef.current = value;
    setArmed(value);
  };

  useAtakEvent('mapClick', click => {
    if (!armedRef.current) return;
    setArmedBoth(false);
    addMarker({ lat: click.lat, lng: click.lng, title: `Click ${itemCountRef.current + 1}` });
  });

  const dropAtSelf = () => {
    if (!location) return;
    const title = `Self ${items.length + 1}`;
    addMarker({ lat: location.lat, lng: location.lng, title });
  };

  const toggleDropAtClick = () => setArmedBoth(!armedRef.current);

  const remove = (uid: string) => {
    removeMarker(uid);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: TOUCH_GAP, marginBottom: 16 }}>
        <button
          style={{ ...btnStyle, flex: '1 1 0', ...(!location && disabledStyle) }}
          onClick={dropAtSelf}
          disabled={!location}
        >
          Drop at Self
        </button>
        <button
          style={{ ...btnStyle, flex: '1 1 0', ...(armed && armedStyle) }}
          onClick={toggleDropAtClick}
          aria-pressed={armed}
        >
          {armed ? 'Cancel Drop' : 'Drop at Click'}
        </button>
        <button style={{ ...btnStyle, flex: '1 1 0' }} onClick={() => location && panTo(location.lat, location.lng)}>
          Pan to Self
        </button>
      </div>

      {armed && (
        <p style={{ color: '#4cc9f0', fontSize: 13, textAlign: 'center', margin: '-8px 0 16px' }}>
          Tap the map to drop a marker…
        </p>
      )}

      {items.length === 0 ? (
        <p style={{ color: '#555', fontStyle: 'italic', textAlign: 'center', padding: 32 }}>
          No map items. Drop a marker or add one in ATAK.
        </p>
      ) : (
        <div style={{ background: '#16213e', borderRadius: 8, overflow: 'hidden' }}>
          {items.map((m, i) => (
            <div key={m.uid} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: TOUCH_GAP, padding: '10px 12px',
              borderBottom: i < items.length - 1 ? '1px solid #1a2744' : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...ellipsis, color: '#edf2f4', fontSize: 13, fontWeight: 500 }}>
                  {m.title || m.callsign || m.uid.slice(0, 12)}
                </div>
                <div style={{ ...ellipsis, color: '#555', fontSize: 11, fontFamily: 'monospace' }}>
                  {m.lat != null ? m.lat.toFixed(4) : '?'}, {m.lng != null ? m.lng.toFixed(4) : '?'}
                  {m.type ? ` · ${m.type}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: TOUCH_GAP, flexShrink: 0 }}>
                <button
                  onClick={() => m.lat != null && m.lng != null && panTo(m.lat, m.lng)}
                  style={rowBtnStyle}
                >
                  Go To
                </button>
                <button
                  onClick={() => remove(m.uid)}
                  style={{ ...rowBtnStyle, background: '#3d0000', color: '#ff6b6b', border: '1px solid #5c0000' }}
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
  minHeight: TOUCH_TARGET,
  padding: '0 14px',
  background: '#0f3460',
  color: '#e0e0e0',
  border: '1px solid #1a4a7a',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

// Inline styles hide the browser's own disabled look, so restore one.
const disabledStyle: React.CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

// Drop at Click while it's waiting for a map tap.
const armedStyle: React.CSSProperties = {
  background: '#4cc9f0',
  color: '#0f0f23',
  border: '1px solid #4cc9f0',
  fontWeight: 600,
};

// Fixed width so every row's buttons line up and match each other,
// whatever the item's title length.
const rowBtnStyle: React.CSSProperties = {
  ...btnStyle,
  width: 84,
  padding: 0,
};

const ellipsis: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
