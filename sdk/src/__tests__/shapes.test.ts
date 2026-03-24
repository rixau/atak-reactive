import { describe, it, expect, vi } from 'vitest';
import { createMockBridge } from './setup';

async function loadModules() {
  const shapes = await import('../shapes');
  return shapes;
}

describe('addShape', () => {
  it('calls bridge.addShape with JSON-stringified ShapeOptions', async () => {
    const spy = vi.fn(() => 'shape-uid-1');
    window._atak = createMockBridge({ addShape: spy });
    const { addShape } = await loadModules();

    const opts = {
      points: [
        { lat: 38.0, lng: -77.0 },
        { lat: 38.1, lng: -77.1 },
        { lat: 38.0, lng: -77.1 },
      ],
      closed: true,
      title: 'Test Polygon',
      strokeColor: '#FFFF0000',
    };
    const uid = addShape(opts);

    expect(spy).toHaveBeenCalledWith(JSON.stringify(opts));
    expect(uid).toBe('shape-uid-1');
  });

  it('returns null when bridge returns null', async () => {
    window._atak = createMockBridge({ addShape: () => 'null' });
    const { addShape } = await loadModules();

    expect(addShape({ points: [{ lat: 0, lng: 0 }] })).toBeNull();
  });

  it('tracks uid in managed set', async () => {
    window._atak = createMockBridge({ addShape: () => 'tracked-1' });
    const { addShape, getManagedShapeUids } = await loadModules();

    addShape({ points: [{ lat: 0, lng: 0 }] });
    expect(getManagedShapeUids().has('tracked-1')).toBe(true);
  });
});

describe('addCircle', () => {
  it('calls bridge.addCircle with center and radius', async () => {
    const spy = vi.fn(() => 'circle-uid-1');
    window._atak = createMockBridge({ addCircle: spy });
    const { addCircle } = await loadModules();

    const opts = {
      center: { lat: 38.0, lng: -77.0 },
      radius: 500,
      title: 'Test Circle',
    };
    const uid = addCircle(opts);

    expect(spy).toHaveBeenCalledWith(JSON.stringify(opts));
    expect(uid).toBe('circle-uid-1');
  });

  it('returns null when bridge returns null', async () => {
    window._atak = createMockBridge({ addCircle: () => 'null' });
    const { addCircle } = await loadModules();

    expect(
      addCircle({ center: { lat: 0, lng: 0 }, radius: 100 }),
    ).toBeNull();
  });
});

describe('addEllipse', () => {
  it('calls bridge.addEllipse with center, width, length, angle', async () => {
    const spy = vi.fn(() => 'ellipse-uid-1');
    window._atak = createMockBridge({ addEllipse: spy });
    const { addEllipse } = await loadModules();

    const opts = {
      center: { lat: 38.0, lng: -77.0 },
      width: 500,
      length: 2000,
      angle: 45,
    };
    const uid = addEllipse(opts);

    expect(spy).toHaveBeenCalledWith(JSON.stringify(opts));
    expect(uid).toBe('ellipse-uid-1');
  });
});

describe('addRectangle', () => {
  it('calls bridge.addRectangle with 4 corner points', async () => {
    const spy = vi.fn(() => 'rect-uid-1');
    window._atak = createMockBridge({ addRectangle: spy });
    const { addRectangle } = await loadModules();

    const opts = {
      points: [
        { lat: 38.0, lng: -77.0 },
        { lat: 38.0, lng: -77.1 },
        { lat: 38.1, lng: -77.1 },
        { lat: 38.1, lng: -77.0 },
      ] as [
        { lat: number; lng: number },
        { lat: number; lng: number },
        { lat: number; lng: number },
        { lat: number; lng: number },
      ],
      title: 'Test Rect',
    };
    const uid = addRectangle(opts);

    expect(spy).toHaveBeenCalledWith(JSON.stringify(opts));
    expect(uid).toBe('rect-uid-1');
  });
});

describe('updateShape', () => {
  it('calls bridge.updateShape with uid and partial options', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({ updateShape: spy });
    const { updateShape } = await loadModules();

    const result = updateShape('shape-1', { strokeColor: '#FF00FF00' });

    expect(spy).toHaveBeenCalledWith(
      'shape-1',
      JSON.stringify({ strokeColor: '#FF00FF00' }),
    );
    expect(result).toBe(true);
  });

  it('returns false when bridge returns false', async () => {
    window._atak = createMockBridge({ updateShape: () => 'false' });
    const { updateShape } = await loadModules();

    expect(updateShape('bad-uid', {})).toBe(false);
  });
});

describe('removeShape', () => {
  it('calls bridge.removeShape and removes from managed set', async () => {
    const spy = vi.fn(() => 'true');
    window._atak = createMockBridge({
      addShape: () => 'to-remove',
      removeShape: spy,
    });
    const { addShape, removeShape, getManagedShapeUids } =
      await loadModules();

    addShape({ points: [{ lat: 0, lng: 0 }] });
    expect(getManagedShapeUids().has('to-remove')).toBe(true);

    const result = removeShape('to-remove');

    expect(spy).toHaveBeenCalledWith('to-remove');
    expect(result).toBe(true);
    expect(getManagedShapeUids().has('to-remove')).toBe(false);
  });
});

describe('getPluginShapes', () => {
  it('returns parsed array from bridge', async () => {
    const items = [{ uid: 's1', type: 'u-d-f' }];
    window._atak = createMockBridge({
      getPluginShapes: () => JSON.stringify(items),
    });
    const { getPluginShapes } = await loadModules();

    expect(getPluginShapes()).toEqual(items);
  });

  it('returns empty array when bridge returns []', async () => {
    window._atak = createMockBridge();
    const { getPluginShapes } = await loadModules();

    expect(getPluginShapes()).toEqual([]);
  });
});
