import { isNative, getPreference } from '@atak-reactive/sdk';
import { useState } from 'react';

export function SettingsPage() {
  const [prefKey, setPrefKey] = useState('');
  const [prefValue, setPrefValue] = useState<string | null>(null);

  const lookupPref = () => {
    if (!prefKey.trim()) return;
    const val = getPreference(prefKey.trim());
    setPrefValue(val);
  };

  return (
    <div>
      <div style={{ padding: 12, marginBottom: 12, background: '#16213e', borderRadius: 8 }}>
        <h2 style={h2Style}>Plugin Info</h2>
        <Row label="Bridge" value={isNative() ? 'Native (ATAK)' : 'Mock (Browser)'} />
        <Row label="SDK" value="@atak-reactive/sdk" />
        <Row label="Router" value="HashRouter" />
      </div>

      <div style={{ padding: 12, marginBottom: 12, background: '#16213e', borderRadius: 8 }}>
        <h2 style={h2Style}>Preference Lookup</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            placeholder="preference.key"
            value={prefKey}
            onChange={e => setPrefKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupPref()}
            style={{
              flex: 1, padding: '6px 10px', background: '#0f0f23', color: '#edf2f4',
              border: '1px solid #1a4a7a', borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
            }}
          />
          <button
            onClick={lookupPref}
            style={{
              padding: '6px 14px', background: '#0f3460', color: '#e0e0e0',
              border: '1px solid #1a4a7a', borderRadius: 6, cursor: 'pointer', fontSize: 12,
            }}
          >
            Lookup
          </button>
        </div>
        {prefValue !== null && (
          <div style={{ padding: '8px 10px', background: '#0f0f23', borderRadius: 6, fontFamily: 'monospace', fontSize: 12, color: prefValue ? '#edf2f4' : '#555' }}>
            {prefValue || 'null'}
          </div>
        )}
      </div>
    </div>
  );
}

const h2Style: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#8d99ae',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: '#8d99ae', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#edf2f4', fontSize: 13 }}>{value}</span>
    </div>
  );
}
