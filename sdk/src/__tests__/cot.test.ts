import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createMockBridge } from './setup';
import { makeCotEvent, emitFromNative } from './helpers';

function loadModules() {
  return import('../index');
}

describe('CoT messaging', () => {
  describe('stream lifecycle', () => {
    it('startCotStream called on first useCotStream mount', async () => {
      const startFn = vi.fn();
      window._atak = createMockBridge({ startCotStream: startFn });

      const { useCotStream } = await loadModules();
      renderHook(() => useCotStream());

      expect(startFn).toHaveBeenCalledTimes(1);
    });

    it('stopCotStream called when last useCotStream unmounts', async () => {
      const stopFn = vi.fn();
      window._atak = createMockBridge({ stopCotStream: stopFn });

      const { useCotStream } = await loadModules();
      const { unmount } = renderHook(() => useCotStream());

      unmount();
      expect(stopFn).toHaveBeenCalledTimes(1);
    });

    it('multiple useCotStream hooks share one stream', async () => {
      const startFn = vi.fn();
      const stopFn = vi.fn();
      window._atak = createMockBridge({
        startCotStream: startFn,
        stopCotStream: stopFn,
      });

      const { useCotStream } = await loadModules();
      const hook1 = renderHook(() => useCotStream());
      const hook2 = renderHook(() => useCotStream());

      expect(startFn).toHaveBeenCalledTimes(1);

      hook1.unmount();
      expect(stopFn).not.toHaveBeenCalled();

      hook2.unmount();
      expect(stopFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('receiving', () => {
    it('inbound cotReceived event populates useCotStream', async () => {
      window._atak = createMockBridge();

      const { useCotStream } = await loadModules();
      const { result } = renderHook(() => useCotStream());

      expect(result.current).toHaveLength(0);

      const event = makeCotEvent({ uid: 'unit-1' });
      act(() => {
        emitFromNative('cotReceived', [event]);
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0]!.uid).toBe('unit-1');
    });

    it('second event for same UID updates, does not duplicate', async () => {
      window._atak = createMockBridge();

      const { useCotStream } = await loadModules();
      const { result } = renderHook(() => useCotStream());

      act(() => {
        emitFromNative('cotReceived', [makeCotEvent({ uid: 'unit-1', callsign: 'ALPHA' })]);
      });
      expect(result.current).toHaveLength(1);

      act(() => {
        emitFromNative('cotReceived', [makeCotEvent({ uid: 'unit-1', callsign: 'ALPHA-2' })]);
      });
      expect(result.current).toHaveLength(1);
      expect(result.current[0]!.callsign).toBe('ALPHA-2');
    });

    it('useCotStream with type filter only returns matching CoT', async () => {
      window._atak = createMockBridge();

      const { useCotStream } = await loadModules();
      const { result } = renderHook(() => useCotStream({ type: 'a-f-*' }));

      act(() => {
        emitFromNative('cotReceived', [
          makeCotEvent({ uid: 'friendly', type: 'a-f-G-U-C' }),
          makeCotEvent({ uid: 'hostile', type: 'a-h-G' }),
        ]);
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0]!.uid).toBe('friendly');
    });

    it('useCotStream with no filter returns all CoT', async () => {
      window._atak = createMockBridge();

      const { useCotStream } = await loadModules();
      const { result } = renderHook(() => useCotStream());

      act(() => {
        emitFromNative('cotReceived', [
          makeCotEvent({ uid: 'a' }),
          makeCotEvent({ uid: 'b' }),
        ]);
      });

      expect(result.current).toHaveLength(2);
    });

    it('useCotEvent callback fires for every event', async () => {
      window._atak = createMockBridge();

      const { useCotEvent } = await loadModules();
      const callback = vi.fn();
      renderHook(() => useCotEvent(callback));

      const event1 = makeCotEvent({ uid: 'e1' });
      const event2 = makeCotEvent({ uid: 'e2' });

      act(() => {
        emitFromNative('cotReceived', [event1, event2]);
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls[0]![0].uid).toBe('e1');
      expect(callback.mock.calls[1]![0].uid).toBe('e2');
    });
  });

  describe('sending', () => {
    it('sendCot calls bridge with correct dispatch target', async () => {
      const sendFn = vi.fn(() => 'true');
      window._atak = createMockBridge({ sendCot: sendFn });

      const { sendCot } = await loadModules();
      const event = makeCotEvent();

      sendCot(event, 'external');
      expect(sendFn.mock.calls[0]![1]).toBe('external');

      sendCot(event, 'internal');
      expect(sendFn.mock.calls[1]![1]).toBe('internal');

      sendCot(event, 'both');
      expect(sendFn.mock.calls[2]![1]).toBe('both');
    });

    it('sendCotToContacts calls bridge with UIDs', async () => {
      const sendFn = vi.fn(() => 'true');
      window._atak = createMockBridge({ sendCotToContacts: sendFn });

      const { sendCotToContacts } = await loadModules();
      const event = makeCotEvent();

      sendCotToContacts(event, ['uid-1', 'uid-2']);
      expect(sendFn).toHaveBeenCalledWith(
        JSON.stringify(event),
        JSON.stringify(['uid-1', 'uid-2']),
      );
    });

    it('sendCot returns false on error', async () => {
      window._atak = createMockBridge({ sendCot: () => 'some error message' });

      const { sendCot } = await loadModules();
      expect(sendCot(makeCotEvent(), 'external')).toBe(false);
    });
  });
});
