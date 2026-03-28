import { StrictMode, Component, type ReactNode, type ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const isDev = import.meta.env.DEV;

function showError(title: string, detail: string) {
  const el = document.getElementById('root');
  if (!el) return;
  el.innerHTML = `
    <div style="margin:0;padding:24px;background:#1a1a2e;color:#f87171;font-family:monospace;
      min-height:100vh;box-sizing:border-box;white-space:pre-wrap;word-break:break-word">
      <div style="font-size:14px;font-weight:bold;margin-bottom:12px">${title}</div>
      <div style="font-size:12px;color:#8d99ae">${detail}</div>
    </div>`;
}

// Catch unhandled errors (outside React tree)
if (isDev) {
  window.onerror = (_msg, _src, _line, _col, err) => {
    showError(err?.message ?? 'Unknown error', err?.stack ?? '');
  };
  window.onunhandledrejection = (e) => {
    const err = e.reason;
    showError(err?.message ?? 'Unhandled promise rejection', err?.stack ?? String(err));
  };
}

// Catch React render errors
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[atak-reactive]', error, info.componentStack);
  }

  render() {
    if (this.state.error && isDev) {
      showError(this.state.error.message, this.state.error.stack ?? '');
      return null;
    }
    return this.props.children;
  }
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
