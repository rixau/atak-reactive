package com.atakmap.android.reactive.bridge;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public class DeliveryGateTest {

    @Test
    public void deliversWhileOpen() {
        DeliveryGate gate = new DeliveryGate(true);
        AtomicInteger runs = new AtomicInteger();
        assertTrue(gate.deliver("mapItemsChanged", runs::incrementAndGet));
        assertEquals(1, runs.get());
        assertTrue(gate.takeDropped().isEmpty());
    }

    @Test
    public void dropsWhileClosedWithoutRunningAnything() {
        // The leak in #88 was the delivery itself: View.post() on a detached
        // view queues the runnable. A closed gate must not run it at all.
        DeliveryGate gate = new DeliveryGate(true);
        gate.setOpen(false);
        AtomicInteger runs = new AtomicInteger();
        for (int i = 0; i < 272; i++) {
            assertFalse(gate.deliver("mapItemsChanged", runs::incrementAndGet));
        }
        assertFalse(gate.deliver("cotReceived", runs::incrementAndGet));
        assertEquals(0, runs.get());

        Map<String, Integer> dropped = gate.takeDropped();
        assertEquals(Integer.valueOf(272), dropped.get("mapItemsChanged"));
        assertEquals(Integer.valueOf(1), dropped.get("cotReceived"));
        assertTrue("count resets once taken", gate.takeDropped().isEmpty());
    }

    @Test
    public void startsInTheGivenState() {
        DeliveryGate gate = new DeliveryGate(false);
        assertFalse(gate.isOpen());
        assertFalse(gate.deliver("x", () -> { }));
    }

    @Test
    public void reopeningDeliversAgainAndRepeatsAreNoOps() {
        DeliveryGate gate = new DeliveryGate(true);
        assertFalse("already open", gate.setOpen(true));
        assertTrue(gate.setOpen(false));
        assertFalse("already closed", gate.setOpen(false));
        assertTrue(gate.setOpen(true));
        AtomicInteger runs = new AtomicInteger();
        assertTrue(gate.deliver("x", runs::incrementAndGet));
        assertEquals(1, runs.get());
    }

    @Test
    public void nothingIsDeliveredOnceCloseHasReturned() throws Exception {
        // Producers emit from ATAK's threads while detach happens on the main
        // thread. A check-then-post race would let a delivery land after the
        // view detached; under the gate's lock none can.
        DeliveryGate gate = new DeliveryGate(true);
        AtomicBoolean closed = new AtomicBoolean(false);
        AtomicBoolean stop = new AtomicBoolean(false);
        AtomicInteger lateDeliveries = new AtomicInteger();
        AtomicInteger delivered = new AtomicInteger();
        CountDownLatch running = new CountDownLatch(4);

        List<Thread> producers = new ArrayList<>();
        for (int t = 0; t < 4; t++) {
            Thread th = new Thread(() -> {
                running.countDown();
                while (!stop.get()) {
                    gate.deliver("e", () -> {
                        if (closed.get()) lateDeliveries.incrementAndGet();
                        delivered.incrementAndGet();
                    });
                }
            });
            producers.add(th);
            th.start();
        }
        running.await();
        Thread.sleep(20);
        gate.setOpen(false);
        closed.set(true);
        Thread.sleep(50);
        stop.set(true);
        for (Thread th : producers) th.join();

        assertTrue("producers ran before the close", delivered.get() > 0);
        assertEquals(0, lateDeliveries.get());
        assertTrue(gate.takeDropped().get("e") > 0);
    }
}
