package com.atakmap.android.reactive.bridge;

/**
 * Whether a producer's ATAK listeners should be registered, kept apart from why.
 *
 * Two things decide it, and they must not be mixed up:
 * <ul>
 *   <li>Demand: how many times the page asked for the stream (a reference
 *       count, or 0/1 for producers that are simply on or off).</li>
 *   <li>Pause: whether the host view is detached from its window. A paused
 *       producer keeps its demand, so resuming restores exactly what the page
 *       had subscribed, without the page doing anything.</li>
 * </ul>
 * The listeners are on exactly when there is demand, the producer is not
 * paused, and it has not been disposed. Every method returns the transition the
 * caller has to carry out, so a repeated pause or resume — and attach/detach
 * round trips are frequent — is a no-op rather than a second registration.
 *
 * Not thread-safe: the owning producer holds its own lock across the call and
 * the work it returns. Kept free of Android and ATAK types so it can be unit
 * tested on the JVM.
 */
final class ListenerState {

    enum Change { NONE, START, STOP }

    private int demand = 0;
    private boolean paused = false;
    private boolean disposed = false;
    private boolean active = false;

    /** The page asked for the stream once more. */
    Change acquire() {
        if (disposed) return Change.NONE;
        demand++;
        return reconcile();
    }

    /** The page dropped one request for the stream. */
    Change release() {
        if (demand > 0) demand--;
        return reconcile();
    }

    /** On/off demand, for producers that do not reference-count. */
    Change setWanted(boolean wanted) {
        if (disposed) return Change.NONE;
        demand = wanted ? 1 : 0;
        return reconcile();
    }

    Change pause() {
        paused = true;
        return reconcile();
    }

    Change resume() {
        paused = false;
        return reconcile();
    }

    /** Final: demand is cleared and nothing can start the listeners again. */
    Change dispose() {
        disposed = true;
        demand = 0;
        return reconcile();
    }

    boolean isActive() {
        return active;
    }

    boolean isPaused() {
        return paused;
    }

    int demand() {
        return demand;
    }

    private Change reconcile() {
        boolean want = demand > 0 && !paused && !disposed;
        if (want == active) return Change.NONE;
        active = want;
        return want ? Change.START : Change.STOP;
    }
}
