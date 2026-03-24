import { describe, it, expect, vi } from 'vitest';
import { createMockBridge } from './setup';

function loadModules() {
  return import('../index');
}

describe('map group management', () => {
  it('createMapGroup calls bridge and returns true', async () => {
    const createFn = vi.fn(() => 'true');
    window._atak = createMockBridge({ createMapGroup: createFn });

    const { createMapGroup } = await loadModules();
    const result = createMapGroup('My Layer');

    expect(createFn).toHaveBeenCalledWith('My Layer', '');
    expect(result).toBe(true);
  });

  it('createMapGroup passes parent name when provided', async () => {
    const createFn = vi.fn(() => 'true');
    window._atak = createMockBridge({ createMapGroup: createFn });

    const { createMapGroup } = await loadModules();
    createMapGroup('Sub Layer', 'Parent Layer');

    expect(createFn).toHaveBeenCalledWith('Sub Layer', 'Parent Layer');
  });

  it('createMapGroup returns false on failure', async () => {
    window._atak = createMockBridge({ createMapGroup: () => 'false' });

    const { createMapGroup } = await loadModules();
    expect(createMapGroup('Duplicate')).toBe(false);
  });

  it('removeMapGroup calls bridge and returns true', async () => {
    const removeFn = vi.fn(() => 'true');
    window._atak = createMockBridge({ removeMapGroup: removeFn });

    const { removeMapGroup } = await loadModules();
    const result = removeMapGroup('My Layer');

    expect(removeFn).toHaveBeenCalledWith('My Layer');
    expect(result).toBe(true);
  });

  it('removeMapGroup returns false when group not found', async () => {
    window._atak = createMockBridge({ removeMapGroup: () => 'false' });

    const { removeMapGroup } = await loadModules();
    expect(removeMapGroup('Nonexistent')).toBe(false);
  });

  it('setGroupVisible calls bridge with string boolean', async () => {
    const setVisFn = vi.fn(() => 'true');
    window._atak = createMockBridge({ setGroupVisible: setVisFn });

    const { setGroupVisible } = await loadModules();
    setGroupVisible('My Layer', false);

    expect(setVisFn).toHaveBeenCalledWith('My Layer', 'false');
  });

  it('setGroupVisible returns false when group not found', async () => {
    window._atak = createMockBridge({ setGroupVisible: () => 'false' });

    const { setGroupVisible } = await loadModules();
    expect(setGroupVisible('Nonexistent', true)).toBe(false);
  });
});
