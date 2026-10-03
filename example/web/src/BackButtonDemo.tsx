import { useState, type ReactNode } from 'react';
import { useBackHandler, closeDropdown } from '@atak-reactive/sdk';
import { TOUCH_GAP, TOUCH_TARGET } from './touch';

/**
 * The Android back button inside a React panel. Each dialog takes back while it
 * is open; the nested one is rendered inside the outer one, so it wins until it
 * closes. With no dialog open, back goes to router history, then closes the panel.
 *
 * `showClosePanel` is off in the embedded view, where closeDropdown() is a no-op.
 */
export function BackButtonDemo({ showClosePanel = true }: { showClosePanel?: boolean }) {
  const [outerOpen, setOuterOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);

  const closeOuter = () => {
    setInnerOpen(false);
    setOuterOpen(false);
  };

  return (
    <>
      <p style={{ color: '#8d99ae', fontSize: 13, marginBottom: 8 }}>
        Open a dialog, then press the Android back button: it closes the dialog,
        not the panel.
      </p>
      <button onClick={() => setOuterOpen(true)} style={primary}>
        Open dialog
      </button>
      {showClosePanel && (
        <button onClick={closeDropdown} style={{ ...outline, marginTop: TOUCH_GAP }}>
          Close panel
        </button>
      )}

      <Dialog title="Dialog" open={outerOpen} onClose={closeOuter}>
        <p style={{ color: '#8d99ae', fontSize: 13, marginBottom: 8 }}>
          Back closes this dialog. Open the nested one to see back close it first.
        </p>
        <button onClick={() => setInnerOpen(true)} style={primary}>
          Open nested dialog
        </button>
        <button onClick={closeOuter} style={{ ...outline, marginTop: TOUCH_GAP }}>
          Close
        </button>

        <Dialog title="Nested dialog" open={innerOpen} onClose={() => setInnerOpen(false)}>
          <p style={{ color: '#8d99ae', fontSize: 13, marginBottom: 8 }}>
            Back closes this one, then the dialog under it.
          </p>
          <button onClick={() => setInnerOpen(false)} style={outline}>
            Close
          </button>
        </Dialog>
      </Dialog>
    </>
  );
}

function Dialog({ title, open, onClose, children }: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useBackHandler(onClose, open);
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 10 }}>
      <div role="dialog" aria-label={title} style={{ width: '100%', maxWidth: 360, padding: 16, background: '#16213e', border: '1px solid #4cc9f0', borderRadius: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#edf2f4', marginBottom: 8 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

const primary = { width: '100%', minHeight: TOUCH_TARGET, border: 'none', borderRadius: 6, background: '#4cc9f0', color: '#0f0f23', fontWeight: 600, fontSize: 13, cursor: 'pointer' } as const;
const outline = { width: '100%', minHeight: TOUCH_TARGET, border: '1px solid #4cc9f0', borderRadius: 6, background: 'transparent', color: '#4cc9f0', fontWeight: 600, fontSize: 13, cursor: 'pointer' } as const;
