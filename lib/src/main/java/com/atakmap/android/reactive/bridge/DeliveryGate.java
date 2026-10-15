package com.atakmap.android.reactive.bridge;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Decides whether an event may be handed to the WebView, based on whether the
 * host view is attached to a window.
 *
 * Delivery is View.post(), and a view with no window does not run what is
 * posted to it: the runnable goes into the view's pending queue and runs only
 * on the next attach. With producers emitting from other threads, that queue
 * grew without bound for as long as a panel stayed closed, then replayed in one
 * burst on reopen (#88). While the gate is closed an event is dropped instead,
 * and counted so the drop is visible in logcat.
 *
 * The check and the delivery run under one lock, and so does closing the gate.
 * Once {@link #setOpen(boolean) setOpen(false)} has returned, no delivery can
 * still be in flight, so nothing slips onto the detached view between a
 * producer's check on one thread and the detach on the main thread.
 *
 * Kept free of Android and ATAK types so it can be unit tested on the JVM.
 */
final class DeliveryGate {

    private final Object lock = new Object();
    private boolean open;
    private final Map<String, Integer> dropped = new LinkedHashMap<>();

    DeliveryGate(boolean open) {
        this.open = open;
    }

    boolean isOpen() {
        synchronized (lock) {
            return open;
        }
    }

    /**
     * Opens or closes the gate.
     *
     * @return true if this changed the state, false for a repeat call
     */
    boolean setOpen(boolean open) {
        synchronized (lock) {
            if (this.open == open) return false;
            this.open = open;
            return true;
        }
    }

    /**
     * Runs {@code delivery} if the gate is open, otherwise counts a drop for
     * {@code eventName}. The delivery runs while the lock is held, so it must be
     * quick and must not call back into the gate's owner.
     *
     * @return true if the event was delivered
     */
    boolean deliver(String eventName, Runnable delivery) {
        synchronized (lock) {
            if (!open) {
                Integer n = dropped.get(eventName);
                dropped.put(eventName, n == null ? 1 : n + 1);
                return false;
            }
            delivery.run();
            return true;
        }
    }

    /** Drops counted per event name since the last call, then resets the count. */
    Map<String, Integer> takeDropped() {
        synchronized (lock) {
            Map<String, Integer> copy = new LinkedHashMap<>(dropped);
            dropped.clear();
            return copy;
        }
    }
}
