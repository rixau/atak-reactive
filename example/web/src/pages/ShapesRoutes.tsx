import { useState } from 'react';
import {
  addShape,
  addCircle,
  addEllipse,
  addRectangle,
  updateShape,
  removeShape,
  addRoute,
  updateRoute,
  addWaypoint,
  removeWaypoint,
  removeRoute,
  startNavigation,
  stopNavigation,
  useMapItems,
  useNavigationState,
} from '@atak-reactive/sdk';

export function ShapesRoutesPage() {
  const [lastShapeUid, setLastShapeUid] = useState<string | null>(null);
  const [lastRouteUid, setLastRouteUid] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const shapes = useMapItems({ type: 'u-d-*' });
  const routes = useMapItems({ type: 'b-m-r' });
  const nav = useNavigationState();

  function appendLog(msg: string) {
    setLog((prev) => [...prev.slice(-19), msg]);
  }

  return (
    <div style={{ fontSize: 13 }}>
      <h2 style={{ fontSize: 14, marginBottom: 8 }}>Shapes</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Btn label="Polygon" onClick={() => {
          const uid = addShape({
            points: [
              { lat: 38.897, lng: -77.036 },
              { lat: 38.898, lng: -77.035 },
              { lat: 38.897, lng: -77.034 },
            ],
            closed: true,
            title: 'Test Polygon',
            strokeColor: '#FFFF0000',
            fillColor: '#3300FF00',
          });
          setLastShapeUid(uid);
          appendLog(`addShape → ${uid}`);
        }} />
        <Btn label="Circle" onClick={() => {
          const uid = addCircle({
            center: { lat: 38.897, lng: -77.036 },
            radius: 500,
            title: 'Test Circle',
          });
          setLastShapeUid(uid);
          appendLog(`addCircle → ${uid}`);
        }} />
        <Btn label="Ellipse" onClick={() => {
          const uid = addEllipse({
            center: { lat: 38.897, lng: -77.036 },
            width: 300,
            length: 800,
            angle: 45,
            title: 'Test Ellipse',
          });
          setLastShapeUid(uid);
          appendLog(`addEllipse → ${uid}`);
        }} />
        <Btn label="Rectangle" onClick={() => {
          const uid = addRectangle({
            points: [
              { lat: 38.896, lng: -77.037 },
              { lat: 38.896, lng: -77.035 },
              { lat: 38.898, lng: -77.035 },
              { lat: 38.898, lng: -77.037 },
            ],
            title: 'Test Rect',
          });
          setLastShapeUid(uid);
          appendLog(`addRectangle → ${uid}`);
        }} />
        <Btn label="Update" onClick={() => {
          if (!lastShapeUid) return appendLog('No shape to update');
          const ok = updateShape(lastShapeUid, { strokeColor: '#FF00FF00' });
          appendLog(`updateShape(${lastShapeUid}) → ${ok}`);
        }} />
        <Btn label="Remove" onClick={() => {
          if (!lastShapeUid) return appendLog('No shape to remove');
          const ok = removeShape(lastShapeUid);
          appendLog(`removeShape(${lastShapeUid}) → ${ok}`);
          setLastShapeUid(null);
        }} />
      </div>

      <h2 style={{ fontSize: 14, marginBottom: 8 }}>Routes</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Btn label="Create" onClick={() => {
          const uid = addRoute({
            waypoints: [
              { lat: 38.88, lng: -77.03 },
              { lat: 38.89, lng: -77.02 },
              { lat: 38.90, lng: -77.01 },
            ],
            title: 'Test Route',
            method: 'Driving',
            direction: 'Infil',
          });
          setLastRouteUid(uid);
          appendLog(`addRoute → ${uid}`);
        }} />
        <Btn label="Add WP" onClick={() => {
          if (!lastRouteUid) return appendLog('No route');
          const ok = addWaypoint(lastRouteUid, { lat: 38.91, lng: -77.0 });
          appendLog(`addWaypoint → ${ok}`);
        }} />
        <Btn label="Rm WP" onClick={() => {
          if (!lastRouteUid) return appendLog('No route');
          const ok = removeWaypoint(lastRouteUid, 'wp-todo');
          appendLog(`removeWaypoint → ${ok}`);
        }} />
        <Btn label="Update" onClick={() => {
          if (!lastRouteUid) return appendLog('No route');
          const ok = updateRoute(lastRouteUid, { title: 'Updated Route' });
          appendLog(`updateRoute → ${ok}`);
        }} />
        <Btn label="Start Nav" onClick={() => {
          if (!lastRouteUid) return appendLog('No route');
          const ok = startNavigation(lastRouteUid);
          appendLog(`startNavigation → ${ok}`);
        }} />
        <Btn label="Stop Nav" onClick={() => {
          const ok = stopNavigation();
          appendLog(`stopNavigation → ${ok}`);
        }} />
        <Btn label="Remove" onClick={() => {
          if (!lastRouteUid) return appendLog('No route');
          const ok = removeRoute(lastRouteUid);
          appendLog(`removeRoute → ${ok}`);
          setLastRouteUid(null);
        }} />
      </div>

      <h2 style={{ fontSize: 14, marginBottom: 8 }}>Live State</h2>

      <Section title={`Nav: ${nav.active ? 'ACTIVE' : 'inactive'}`}>
        {nav.active && (
          <pre style={{ fontSize: 11 }}>
            route: {nav.routeUid}{'\n'}
            waypoint: {nav.currentWaypointIndex}{'\n'}
            gpsLost: {String(nav.gpsLost)}
          </pre>
        )}
      </Section>

      <Section title={`Shapes (${shapes.length})`}>
        {shapes.map((s) => (
          <div key={s.uid} style={{ fontSize: 11, padding: '2px 0' }}>
            {s.type} — {s.title || s.uid}
          </div>
        ))}
      </Section>

      <Section title={`Routes (${routes.length})`}>
        {routes.map((r) => (
          <div key={r.uid} style={{ fontSize: 11, padding: '2px 0' }}>
            {r.title || r.uid} ({r.routeMethod})
          </div>
        ))}
      </Section>

      <Section title="Log">
        {log.map((l, i) => (
          <div key={i} style={{ fontSize: 10, color: '#8d99ae', padding: '1px 0' }}>
            {l}
          </div>
        ))}
      </Section>
    </div>
  );
}

function Btn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        fontSize: 11,
        fontWeight: 600,
        background: '#1a1a2e',
        border: '1px solid #16213e',
        color: '#e2e8f0',
        borderRadius: 4,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4cc9f0', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ padding: '4px 8px', background: '#0f0f23', borderRadius: 4, border: '1px solid #16213e' }}>
        {children}
      </div>
    </div>
  );
}
