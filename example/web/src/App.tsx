import { Routes, Route, NavLink } from 'react-router-dom';
import { isNative } from '@atak-reactive/sdk';
import { HomePage } from './pages/Home';
import { MarkersPage } from './pages/Markers';
import { SettingsPage } from './pages/Settings';
import { IntegrationTestPage } from './pages/IntegrationTest';

export function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #16213e' }}>
        <h1 style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>atak-reactive</h1>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: isNative() ? '#2d6a4f' : '#4a4e69', color: '#d8f3dc', fontWeight: 600 }}>
          {isNative() ? 'ATAK' : 'MOCK'}
        </span>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/markers" element={<MarkersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/test" element={<IntegrationTestPage />} />
        </Routes>
      </div>

      <nav style={{ display: 'flex', borderTop: '1px solid #16213e', background: '#0f0f23' }}>
        <Tab to="/" label="Home" />
        <Tab to="/markers" label="Map Items" />
        <Tab to="/settings" label="Settings" />
        <Tab to="/test" label="Test" />
      </nav>
    </div>
  );
}

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        flex: 1,
        padding: '10px 0',
        textAlign: 'center' as const,
        fontSize: 12,
        fontWeight: 600,
        textDecoration: 'none',
        color: isActive ? '#4cc9f0' : '#8d99ae',
        borderTop: isActive ? '2px solid #4cc9f0' : '2px solid transparent',
        transition: 'color 0.15s',
      })}
    >
      {label}
    </NavLink>
  );
}
