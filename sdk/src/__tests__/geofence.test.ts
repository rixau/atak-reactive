import { describe, it, expect, vi } from 'vitest';
import { createMockBridge } from './setup';

async function loadModules() {
  return import('../index');
}

describe('Geofence functions', () => {
  it('createGeofence calls bridge with serialized options', async () => {
    const createFn = vi.fn(() => 'true');
    window._atak = createMockBridge({ createGeofence: createFn });
    const { createGeofence } = await loadModules();

    createGeofence({ shapeUid: 's1', trigger: 'both', monitoredTypes: 'all' });
    expect(createFn).toHaveBeenCalledWith(
      JSON.stringify({ shapeUid: 's1', trigger: 'both', monitoredTypes: 'all' }),
    );
  });

  it('removeGeofence calls bridge', async () => {
    const removeFn = vi.fn();
    window._atak = createMockBridge({ removeGeofence: removeFn });
    const { removeGeofence } = await loadModules();

    removeGeofence('shape-1');
    expect(removeFn).toHaveBeenCalledWith('shape-1');
  });
});
