package com.atakmap.android.plugintemplate;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.Marker;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import java.util.ArrayList;
import java.util.List;

/**
 * Moves N markers at a fixed rate from native code, with no WebView involved.
 *
 * The Perf tab can only drive a load while its panel is open: closing the
 * dropdown calls {@code WebView.onPause()}, which suspends JS timers. That
 * makes it impossible to put an identical load under a *native* panel for
 * comparison. This receiver produces the same load independently of any panel,
 * so Overlay Manager and the React panel can be measured against one baseline.
 *
 * It deliberately mirrors what {@code MarkerManager.updateMarker} does — one
 * {@code mapView.post()} per marker per tick, calling {@code setPoint} — so the
 * numbers line up with the Perf tab's churn phases.
 *
 * Driven from adb, so no UI interaction is needed while measuring:
 * <pre>
 * adb shell am broadcast -p com.atakmap.app.civ \
 *     -a com.atakmap.android.plugintemplate.NATIVE_CHURN \
 *     --es op start --ei count 200 --ei hz 1
 * adb shell am broadcast -p com.atakmap.app.civ \
 *     -a com.atakmap.android.plugintemplate.NATIVE_CHURN --es op stop
 * </pre>
 */
public class NativeChurnReceiver extends BroadcastReceiver {

    private static final String TAG = "NativeChurn";
    public static final String ACTION = "com.atakmap.android.plugintemplate.NATIVE_CHURN";
    private static final String UID_PREFIX = "PERFLOAD-";

    private final MapView mapView;
    private final List<Marker> markers = new ArrayList<>();
    private Thread worker;
    private volatile boolean running;

    public NativeChurnReceiver(MapView mapView) {
        this.mapView = mapView;
    }

    public void register(Context appContext) {
        IntentFilter filter = new IntentFilter(ACTION);
        // Registered on the Android context rather than AtakBroadcast: this has
        // to be reachable from `adb shell am broadcast`, and AtakBroadcast is
        // process-local.
        if (Build.VERSION.SDK_INT >= 33) {
            appContext.registerReceiver(this, filter, Context.RECEIVER_EXPORTED);
        } else {
            appContext.registerReceiver(this, filter);
        }
        Log.d(TAG, "registered for " + ACTION);
    }

    public void unregister(Context appContext) {
        stop();
        try {
            appContext.unregisterReceiver(this);
        } catch (IllegalArgumentException ignored) {
            // never registered
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String op = intent.getStringExtra("op");
        if (op == null) op = "start";
        switch (op) {
            case "start":
                start(intent.getIntExtra("count", 200),
                        intent.getIntExtra("hz", 1));
                break;
            case "stop":
                stop();
                break;
            case "clear":
                stop();
                clear();
                break;
            default:
                Log.w(TAG, "unknown op: " + op);
        }
    }

    private void start(final int count, final int hz) {
        stop();
        create(count);
        final long periodMs = Math.max(1, 1000 / Math.max(1, hz));
        running = true;
        worker = new Thread(() -> {
            Log.d(TAG, "churn start: " + count + " markers at " + hz + " Hz");
            long tick = 0;
            while (running) {
                long began = System.currentTimeMillis();
                int n = markers.size();
                // Spread the updates across the tick rather than posting all N
                // at once. A burst of N runnables blocks the UI thread long
                // enough to ANR at N=200, and it is not what a real CoT feed
                // looks like anyway — those arrive spread over the interval.
                // Paced by target time, not a per-item gap: an integer gap
                // rounds to zero once N exceeds the period in ms and the tick
                // silently turns back into a burst.
                for (int i = 0; i < n; i++) {
                    final Marker m = markers.get(i);
                    final double lat = 35.0 + 0.02 * Math.sin(tick * 0.02 + i)
                            + (i % 10) * 0.001;
                    final double lng = -106.0 + 0.02 * Math.cos(tick * 0.02 + i)
                            + (i / 10) * 0.001;
                    mapView.post(() -> m.setPoint(new GeoPoint(lat, lng)));
                    long due = began + (i + 1) * periodMs / n;
                    long wait = due - System.currentTimeMillis();
                    if (wait > 0) {
                        try {
                            Thread.sleep(wait);
                        } catch (InterruptedException e) {
                            return;
                        }
                    }
                }
                tick++;
                long left = periodMs - (System.currentTimeMillis() - began);
                if (left > 0) {
                    try {
                        Thread.sleep(left);
                    } catch (InterruptedException e) {
                        break;
                    }
                }
            }
            Log.d(TAG, "churn stopped after " + tick + " ticks");
        }, "native-churn");
        worker.start();
    }

    private void stop() {
        running = false;
        if (worker != null) {
            worker.interrupt();
            worker = null;
        }
    }

    private void create(int count) {
        if (markers.size() == count) return;
        clear();
        MapGroup group = mapView.getRootGroup().findMapGroup("Cursor on Target");
        if (group == null) group = mapView.getRootGroup();
        final MapGroup target = group;
        for (int i = 0; i < count; i++) {
            Marker m = new Marker(UID_PREFIX + i);
            m.setPoint(new GeoPoint(35.0 + (i % 10) * 0.001, -106.0 + (i / 10) * 0.001));
            m.setTitle("LOAD-" + i);
            m.setType("a-f-G-U-C");
            m.setMetaBoolean("readiness", true);
            m.setMetaBoolean("archive", false);
            m.setMetaString("how", "h-g-i-g-o");
            m.setMetaBoolean("removable", true);
            m.setMetaString("entry", "user");
            markers.add(m);
            mapView.post(() -> target.addItem(m));
        }
        Log.d(TAG, "created " + count + " markers");
    }

    private void clear() {
        for (final Marker m : markers) {
            mapView.post(m::removeFromGroup);
        }
        markers.clear();
    }
}
