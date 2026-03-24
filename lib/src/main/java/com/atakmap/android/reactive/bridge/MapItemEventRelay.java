package com.atakmap.android.reactive.bridge;

import android.os.Handler;
import android.os.Looper;

import com.atakmap.android.maps.MapEvent;
import com.atakmap.android.maps.MapEventDispatcher;
import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.Polyline;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.android.maps.Shape;
import com.atakmap.coremap.log.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MapItemEventRelay {

    private static final String TAG = "MapItemEventRelay";
    private static final long DEBOUNCE_MS = 100;

    private final MapView mapView;
    private final BridgeEventEmitter emitter;
    private final Handler debounceHandler = new Handler(Looper.getMainLooper());

    private final Map<String, PointMapItem.OnPointChangedListener> pointListeners = new ConcurrentHashMap<>();
    private final Map<String, WeakReference<PointMapItem>> pointItems = new ConcurrentHashMap<>();

    private final Map<String, Polyline.OnPointsChangedListener> shapeListeners = new ConcurrentHashMap<>();
    private final Map<String, WeakReference<Polyline>> shapeItems = new ConcurrentHashMap<>();

    private PendingUpdate pending = new PendingUpdate();

    private MapEventDispatcher.MapEventDispatchListener itemAddedListener;
    private MapEventDispatcher.MapEventDispatchListener itemRemovedListener;
    private MapEventDispatcher.MapEventDispatchListener itemRefreshListener;

    private int refCount = 0;
    private boolean listening = false;

    public MapItemEventRelay(MapView mapView, BridgeEventEmitter emitter) {
        this.mapView = mapView;
        this.emitter = emitter;
    }

    public synchronized void start() {
        refCount++;
        if (refCount == 1) {
            startListening();
            attachPointListenersForExisting();
        }
    }

    public synchronized void stop() {
        refCount--;
        if (refCount <= 0) {
            refCount = 0;
            stopListening();
            removeAllPointListeners();
        }
    }

    private void startListening() {
        if (listening) return;
        listening = true;

        MapEventDispatcher dispatcher = mapView.getMapEventDispatcher();

        itemAddedListener = event -> {
            MapItem item = event.getItem();
            if (item == null) return;
            onItemAdded(item);
        };
        dispatcher.addMapEventListener(MapEvent.ITEM_ADDED, itemAddedListener);

        itemRemovedListener = event -> {
            MapItem item = event.getItem();
            if (item == null) return;
            onItemRemoved(item);
        };
        dispatcher.addMapEventListener(MapEvent.ITEM_REMOVED, itemRemovedListener);

        itemRefreshListener = event -> {
            MapItem item = event.getItem();
            if (item == null) return;
            onItemUpdated(item);
        };
        dispatcher.addMapEventListener(MapEvent.ITEM_REFRESH, itemRefreshListener);

        Log.d(TAG, "Started listening for map item events");
    }

    private void stopListening() {
        if (!listening) return;
        listening = false;

        MapEventDispatcher dispatcher = mapView.getMapEventDispatcher();

        if (itemAddedListener != null) {
            dispatcher.removeMapEventListener(MapEvent.ITEM_ADDED, itemAddedListener);
        }
        if (itemRemovedListener != null) {
            dispatcher.removeMapEventListener(MapEvent.ITEM_REMOVED, itemRemovedListener);
        }
        if (itemRefreshListener != null) {
            dispatcher.removeMapEventListener(MapEvent.ITEM_REFRESH, itemRefreshListener);
        }

        debounceHandler.removeCallbacksAndMessages(null);
        pending = new PendingUpdate();

        Log.d(TAG, "Stopped listening for map item events");
    }

    private void onItemAdded(MapItem item) {
        try {
            JSONObject serialized = MapItemSerializer.serialize(item);
            pending.added.put(serialized);
            scheduleFlush();

            if (item instanceof PointMapItem) {
                attachPointListener((PointMapItem) item);
            }
            if (item instanceof Polyline) {
                attachShapeListener((Polyline) item);
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error serializing added item", e);
        }
    }

    private void onItemRemoved(MapItem item) {
        String uid = item.getUID();

        PointMapItem.OnPointChangedListener listener = pointListeners.remove(uid);
        WeakReference<PointMapItem> ref = pointItems.remove(uid);
        if (listener != null && ref != null) {
            PointMapItem pmi = ref.get();
            if (pmi != null) {
                pmi.removeOnPointChangedListener(listener);
            }
        }

        Polyline.OnPointsChangedListener shapeListener = shapeListeners.remove(uid);
        WeakReference<Polyline> shapeRef = shapeItems.remove(uid);
        if (shapeListener != null && shapeRef != null) {
            Polyline poly = shapeRef.get();
            if (poly != null) {
                poly.removeOnPointsChangedListener(shapeListener);
            }
        }

        pending.removed.put(uid);
        scheduleFlush();
    }

    private void onItemUpdated(MapItem item) {
        try {
            JSONObject serialized = MapItemSerializer.serialize(item);
            pending.addUpdated(item.getUID(), serialized);
            scheduleFlush();
        } catch (JSONException e) {
            Log.e(TAG, "Error serializing updated item", e);
        }
    }

    private void attachPointListener(PointMapItem item) {
        String uid = item.getUID();
        if (pointListeners.containsKey(uid)) return;

        PointMapItem.OnPointChangedListener listener = changedItem -> {
            onItemUpdated((MapItem) changedItem);
        };

        pointListeners.put(uid, listener);
        pointItems.put(uid, new WeakReference<>(item));
        item.addOnPointChangedListener(listener);
    }

    private void attachShapeListener(Polyline polyline) {
        String uid = polyline.getUID();
        if (shapeListeners.containsKey(uid)) return;

        Polyline.OnPointsChangedListener listener = changedPolyline -> {
            onItemUpdated((MapItem) changedPolyline);
        };

        shapeListeners.put(uid, listener);
        shapeItems.put(uid, new WeakReference<>(polyline));
        polyline.addOnPointsChangedListener(listener);
    }

    private void attachPointListenersForExisting() {
        MapGroup root = mapView.getRootGroup();
        if (root == null) return;
        root.deepForEachItem(new MapGroup.MapItemsCallback() {
            @Override
            public boolean onItemFunction(MapItem item) {
                if (item instanceof PointMapItem) {
                    attachPointListener((PointMapItem) item);
                }
                if (item instanceof Polyline) {
                    attachShapeListener((Polyline) item);
                }
                return false;
            }
        });
    }

    private void removeAllPointListeners() {
        for (Map.Entry<String, PointMapItem.OnPointChangedListener> entry : pointListeners.entrySet()) {
            WeakReference<PointMapItem> ref = pointItems.get(entry.getKey());
            if (ref != null) {
                PointMapItem item = ref.get();
                if (item != null) {
                    item.removeOnPointChangedListener(entry.getValue());
                }
            }
        }
        pointListeners.clear();
        pointItems.clear();

        for (Map.Entry<String, Polyline.OnPointsChangedListener> entry : shapeListeners.entrySet()) {
            WeakReference<Polyline> ref = shapeItems.get(entry.getKey());
            if (ref != null) {
                Polyline poly = ref.get();
                if (poly != null) {
                    poly.removeOnPointsChangedListener(entry.getValue());
                }
            }
        }
        shapeListeners.clear();
        shapeItems.clear();
    }

    private final Runnable flushRunnable = this::flush;

    private void scheduleFlush() {
        debounceHandler.removeCallbacks(flushRunnable);
        debounceHandler.postDelayed(flushRunnable, DEBOUNCE_MS);
    }

    private void flush() {
        PendingUpdate update = pending;
        pending = new PendingUpdate();

        if (update.added.length() == 0 && update.removed.length() == 0
                && update.updatedArray().length() == 0) {
            return;
        }

        emitter.emitMapItemsChanged(update.added, update.removed, update.updatedArray());
    }

    public void dispose() {
        refCount = 0;
        stopListening();
        removeAllPointListeners();
    }

    private static class PendingUpdate {
        final JSONArray added = new JSONArray();
        final JSONArray removed = new JSONArray();
        private final Map<String, JSONObject> updated = new ConcurrentHashMap<>();

        void addUpdated(String uid, JSONObject data) {
            updated.put(uid, data);
        }

        JSONArray updatedArray() {
            JSONArray arr = new JSONArray();
            for (JSONObject obj : updated.values()) {
                arr.put(obj);
            }
            return arr;
        }
    }
}
