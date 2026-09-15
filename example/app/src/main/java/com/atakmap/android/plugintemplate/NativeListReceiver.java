package com.atakmap.android.plugintemplate;

import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import com.atakmap.android.dropdown.DropDown.OnStateListener;
import com.atakmap.android.dropdown.DropDownReceiver;
import com.atakmap.android.maps.MapEvent;
import com.atakmap.android.maps.MapEventDispatcher;
import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Benchmark-only: the smallest native panel that does what the React "Map
 * Items" page does, so the two can be measured against each other under the
 * same load.
 *
 * Same job on purpose: every visible point item, three fields per row
 * (title, lat/lon, type), rows recycled by a plain ListView. Same update
 * strategy on purpose too — the relay's listener set (ITEM_ADDED / REMOVED /
 * REFRESH plus a per-item OnPointChangedListener), changes coalesced by uid,
 * a 100 ms trailing debounce with a 500 ms deadline. Fields are read off the
 * MapItem at flush time rather than serialized per change.
 *
 * That makes it a fair floor: whatever this costs is what a native panel with
 * the same design pays, and the difference to the React panel is the WebView.
 */
public class NativeListReceiver extends DropDownReceiver implements OnStateListener {

    private static final String TAG = "NativeList";
    public static final String SHOW = "com.atakmap.android.plugintemplate.SHOW_NATIVE_LIST";

    private static final long DEBOUNCE_MS = 100;
    private static final long MAX_FLUSH_DELAY_MS = 500;

    private static final int BG_DARK = 0xFF0f0f23;
    private static final int BG_CARD = 0xFF16213e;
    private static final int TEXT_DIM = 0xFF8d99ae;
    private static final int TEXT_BRIGHT = 0xFFedf2f4;

    private static final class Row {
        String title;
        String type;
        double lat;
        double lng;
    }

    private final Context pluginContext;
    private final Handler handler = new Handler(Looper.getMainLooper());

    // Written from whichever thread changes an item, drained on main.
    private final Object lock = new Object();
    private Set<String> dirty = new HashSet<>();
    private Set<String> gone = new HashSet<>();
    private long oldestPendingAt = 0;

    // Main thread only.
    private final Map<String, Row> rows = new LinkedHashMap<>();
    private final List<Row> rowList = new ArrayList<>();
    private BaseAdapter adapter;

    private final Map<String, PointMapItem.OnPointChangedListener> pointListeners = new ConcurrentHashMap<>();
    private final Map<String, WeakReference<PointMapItem>> pointItems = new ConcurrentHashMap<>();
    private MapEventDispatcher.MapEventDispatchListener addedListener;
    private MapEventDispatcher.MapEventDispatchListener removedListener;
    private MapEventDispatcher.MapEventDispatchListener refreshListener;
    private boolean listening = false;

    public NativeListReceiver(MapView mapView, Context pluginContext) {
        super(mapView);
        this.pluginContext = pluginContext;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        LinearLayout root = new LinearLayout(pluginContext);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG_DARK);

        TextView header = new TextView(pluginContext);
        header.setText("native list");
        header.setTextColor(TEXT_BRIGHT);
        header.setTextSize(22);
        header.setTypeface(null, Typeface.BOLD);
        header.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(header);

        ListView list = new ListView(pluginContext);
        list.setBackgroundColor(BG_DARK);
        list.setDivider(null);
        adapter = new BaseAdapter() {
            @Override public int getCount() { return rowList.size(); }
            @Override public Object getItem(int i) { return rowList.get(i); }
            @Override public long getItemId(int i) { return i; }
            @Override public View getView(int i, View convertView, ViewGroup parent) {
                LinearLayout v;
                TextView title, sub;
                if (convertView == null) {
                    v = new LinearLayout(pluginContext);
                    v.setOrientation(LinearLayout.VERTICAL);
                    v.setBackgroundColor(BG_CARD);
                    v.setPadding(dp(12), dp(10), dp(12), dp(10));
                    title = new TextView(pluginContext);
                    title.setTextColor(TEXT_BRIGHT);
                    title.setTextSize(16);
                    title.setTypeface(null, Typeface.BOLD);
                    sub = new TextView(pluginContext);
                    sub.setTextColor(TEXT_DIM);
                    sub.setTextSize(13);
                    sub.setTypeface(Typeface.MONOSPACE);
                    v.addView(title);
                    v.addView(sub);
                    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                    lp.setMargins(dp(8), dp(3), dp(8), dp(3));
                    v.setLayoutParams(lp);
                } else {
                    v = (LinearLayout) convertView;
                    title = (TextView) v.getChildAt(0);
                    sub = (TextView) v.getChildAt(1);
                }
                Row r = rowList.get(i);
                title.setText(r.title);
                sub.setText(String.format(Locale.US, "%.4f, %.4f · %s", r.lat, r.lng, r.type));
                return v;
            }
        };
        list.setAdapter(adapter);
        root.addView(list, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        start();
        showDropDown(root, HALF_WIDTH, FULL_HEIGHT, FULL_WIDTH, HALF_HEIGHT, false, this);
    }

    // ---- lifecycle ------------------------------------------------------------

    private void start() {
        if (listening) return;
        listening = true;
        rows.clear();
        MapGroup root = getMapView().getRootGroup();
        if (root != null) {
            root.deepForEachItem(item -> {
                if (item instanceof PointMapItem) {
                    attach((PointMapItem) item);
                    put((PointMapItem) item);
                }
                return false;
            });
        }
        rebuild();

        MapEventDispatcher d = getMapView().getMapEventDispatcher();
        addedListener = e -> {
            MapItem item = e.getItem();
            if (item instanceof PointMapItem) {
                attach((PointMapItem) item);
                markDirty(item.getUID());
            }
        };
        removedListener = e -> {
            MapItem item = e.getItem();
            if (item != null) onRemoved(item.getUID());
        };
        refreshListener = e -> {
            MapItem item = e.getItem();
            if (item != null) { probe("listener", item); markDirty(item.getUID()); }
        };
        d.addMapEventListener(MapEvent.ITEM_ADDED, addedListener);
        d.addMapEventListener(MapEvent.ITEM_REMOVED, removedListener);
        d.addMapEventListener(MapEvent.ITEM_REFRESH, refreshListener);
        Log.d(TAG, "listening, " + rows.size() + " rows");
    }

    private void stop() {
        if (!listening) return;
        listening = false;
        MapEventDispatcher d = getMapView().getMapEventDispatcher();
        d.removeMapEventListener(MapEvent.ITEM_ADDED, addedListener);
        d.removeMapEventListener(MapEvent.ITEM_REMOVED, removedListener);
        d.removeMapEventListener(MapEvent.ITEM_REFRESH, refreshListener);
        for (Map.Entry<String, PointMapItem.OnPointChangedListener> en : pointListeners.entrySet()) {
            WeakReference<PointMapItem> ref = pointItems.get(en.getKey());
            PointMapItem pmi = ref != null ? ref.get() : null;
            if (pmi != null) pmi.removeOnPointChangedListener(en.getValue());
        }
        pointListeners.clear();
        pointItems.clear();
        synchronized (lock) {
            handler.removeCallbacksAndMessages(null);
            dirty = new HashSet<>();
            gone = new HashSet<>();
            oldestPendingAt = 0;
        }
        Log.d(TAG, "stopped");
    }

    /**
     * The native half of the latency probe (see web/src/perf/latencyProbe.ts).
     * lat-probe.sh encodes the device-clock millisecond of the send in the
     * callsign, so this splits the native side of the path: "listener" is how
     * long ATAK took to hand the event to a MapItem listener (CoT parse plus
     * the CotDispatcher hop), "flush" adds this panel's batching. Since that
     * batching is the same 100 ms / 500 ms the relay uses, the gap between
     * these numbers and the React panel's is the WebView hop.
     */
    private void probe(String stage, MapItem item) {
        String t = item.getTitle();
        if (t == null || !t.startsWith("LAT-")) return;
        try {
            Log.d(TAG, "LATNATIVE " + stage + "=" + (System.currentTimeMillis() - Long.parseLong(t.substring(4))));
        } catch (NumberFormatException ignored) {
            // not a probe marker after all
        }
    }

    private void attach(PointMapItem item) {
        String uid = item.getUID();
        if (pointListeners.containsKey(uid)) return;
        PointMapItem.OnPointChangedListener l = changed -> markDirty(changed.getUID());
        pointListeners.put(uid, l);
        pointItems.put(uid, new WeakReference<>(item));
        item.addOnPointChangedListener(l);
    }

    // ---- batching (mirrors MapItemEventRelay) ---------------------------------

    private final Runnable flushRunnable = this::flush;
    private final Runnable deadlineRunnable = this::flush;

    private void markDirty(String uid) {
        synchronized (lock) {
            dirty.add(uid);
            scheduleFlush();
        }
    }

    private void onRemoved(String uid) {
        PointMapItem.OnPointChangedListener l = pointListeners.remove(uid);
        WeakReference<PointMapItem> ref = pointItems.remove(uid);
        PointMapItem pmi = ref != null ? ref.get() : null;
        if (l != null && pmi != null) pmi.removeOnPointChangedListener(l);
        synchronized (lock) {
            dirty.remove(uid);
            gone.add(uid);
            scheduleFlush();
        }
    }

    /** Caller holds {@link #lock}. */
    private void scheduleFlush() {
        if (oldestPendingAt == 0) {
            oldestPendingAt = SystemClock.uptimeMillis();
            handler.postDelayed(deadlineRunnable, MAX_FLUSH_DELAY_MS);
        }
        handler.removeCallbacks(flushRunnable);
        handler.postDelayed(flushRunnable, DEBOUNCE_MS);
    }

    private void flush() {
        Set<String> d, g;
        synchronized (lock) {
            handler.removeCallbacks(flushRunnable);
            handler.removeCallbacks(deadlineRunnable);
            d = dirty; dirty = new HashSet<>();
            g = gone; gone = new HashSet<>();
            oldestPendingAt = 0;
        }
        if (d.isEmpty() && g.isEmpty()) return;
        for (String uid : g) rows.remove(uid);
        for (String uid : d) {
            WeakReference<PointMapItem> ref = pointItems.get(uid);
            PointMapItem pmi = ref != null ? ref.get() : null;
            if (pmi == null) { rows.remove(uid); } else { probe("flush", pmi); put(pmi); }
        }
        rebuild();
    }

    /** Main thread. Reads the item's current state into its row. */
    private void put(PointMapItem item) {
        GeoPoint p = item.getPoint();
        if (!item.getVisible() || p == null) {
            rows.remove(item.getUID());
            return;
        }
        Row r = rows.get(item.getUID());
        if (r == null) {
            r = new Row();
            rows.put(item.getUID(), r);
        }
        String title = item.getTitle();
        r.title = title != null ? title : item.getUID();
        r.type = item.getType();
        r.lat = p.getLatitude();
        r.lng = p.getLongitude();
    }

    private void rebuild() {
        rowList.clear();
        rowList.addAll(rows.values());
        if (adapter != null) adapter.notifyDataSetChanged();
    }

    private int dp(int v) {
        return (int) (v * pluginContext.getResources().getDisplayMetrics().density + 0.5f);
    }

    // ---- DropDown callbacks ---------------------------------------------------

    @Override public void onDropDownSelectionRemoved() { }
    @Override public void onDropDownVisible(boolean v) { }
    @Override public void onDropDownSizeChanged(double w, double h) { }

    @Override
    public void onDropDownClose() {
        stop();
    }

    @Override
    public void disposeImpl() {
        stop();
    }
}
