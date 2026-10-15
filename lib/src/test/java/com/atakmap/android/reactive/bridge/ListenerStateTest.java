package com.atakmap.android.reactive.bridge;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.atakmap.android.reactive.bridge.ListenerState.Change;

import org.junit.Test;

public class ListenerStateTest {

    @Test
    public void referenceCountStartsOnFirstAndStopsOnLast() {
        ListenerState s = new ListenerState();
        assertEquals(Change.START, s.acquire());
        assertEquals(Change.NONE, s.acquire());
        assertEquals(Change.NONE, s.release());
        assertEquals(Change.STOP, s.release());
        assertEquals("a stray release stays at zero", Change.NONE, s.release());
        assertEquals(0, s.demand());
    }

    @Test
    public void pauseStopsAndResumeRestartsWithoutTouchingDemand() {
        ListenerState s = new ListenerState();
        s.acquire();
        s.acquire();
        assertEquals(Change.STOP, s.pause());
        assertFalse(s.isActive());
        assertEquals(2, s.demand());
        assertEquals(Change.START, s.resume());
        assertTrue(s.isActive());
        assertEquals(2, s.demand());
    }

    @Test
    public void repeatedPauseAndResumeAreIdempotent() {
        // Attach/detach round trips happen on every close, reopen, and every
        // drop-down opened over a retained panel.
        ListenerState s = new ListenerState();
        s.acquire();
        for (int i = 0; i < 5; i++) {
            assertEquals(Change.STOP, s.pause());
            assertEquals(Change.NONE, s.pause());
            assertEquals(Change.START, s.resume());
            assertEquals(Change.NONE, s.resume());
        }
        assertTrue(s.isActive());
    }

    @Test
    public void pauseOrResumeWithoutDemandDoesNothing() {
        ListenerState s = new ListenerState();
        assertEquals(Change.NONE, s.pause());
        assertEquals(Change.NONE, s.resume());
        assertFalse(s.isActive());
    }

    @Test
    public void subscribingWhilePausedWaitsForResume() {
        ListenerState s = new ListenerState();
        s.pause();
        assertEquals(Change.NONE, s.acquire());
        assertFalse(s.isActive());
        assertEquals(Change.START, s.resume());
    }

    @Test
    public void unsubscribingWhilePausedLeavesNothingToResume() {
        ListenerState s = new ListenerState();
        s.acquire();
        s.pause();
        assertEquals("already stopped by the pause", Change.NONE, s.release());
        assertEquals(Change.NONE, s.resume());
        assertFalse(s.isActive());
    }

    @Test
    public void setWantedIsOnOff() {
        ListenerState s = new ListenerState();
        assertEquals(Change.START, s.setWanted(true));
        assertEquals(Change.NONE, s.setWanted(true));
        assertEquals(Change.STOP, s.pause());
        assertEquals(Change.START, s.resume());
        assertEquals(Change.STOP, s.setWanted(false));
        assertEquals(Change.NONE, s.setWanted(false));
    }

    @Test
    public void disposeStopsAndNothingRestartsAfterIt() {
        ListenerState s = new ListenerState();
        s.acquire();
        assertEquals(Change.STOP, s.dispose());
        assertEquals(Change.NONE, s.resume());
        assertEquals(Change.NONE, s.acquire());
        assertEquals(Change.NONE, s.setWanted(true));
        assertEquals(Change.NONE, s.pause());
        assertEquals(Change.NONE, s.resume());
        assertFalse(s.isActive());
    }

    @Test
    public void disposeWhilePausedReportsNoSecondStop() {
        ListenerState s = new ListenerState();
        s.acquire();
        s.pause();
        assertEquals(Change.NONE, s.dispose());
        assertEquals(Change.NONE, s.resume());
    }
}
