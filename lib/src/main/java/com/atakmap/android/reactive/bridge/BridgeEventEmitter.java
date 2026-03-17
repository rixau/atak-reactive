package com.atakmap.android.reactive.bridge;

import android.webkit.WebView;

import com.atakmap.android.maps.MapEvent;
import com.atakmap.android.maps.MapEventDispatcher;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class BridgeEventEmitter {

    private static final String TAG = "BridgeEventEmitter";

    private final WebView webView;
    private final Set<String> subscriptions = ConcurrentHashMap.newKeySet();

    private MapEventDispatcher.MapEventDispatchListener mapClickListener;
    private MapEventDispatcher.MapEventDispatchListener mapLongPressListener;
    private MapEventDispatcher.MapEventDispatchListener itemClickListener;
    private PointMapItem.OnPointChangedListener selfLocationListener;

    private boolean listening = false;

    public BridgeEventEmitter(WebView webView) {
        this.webView = webView;
    }

    public void subscribe(String eventName) {
        subscriptions.add(eventName);
    }

    public void unsubscribe(String eventName) {
        subscriptions.remove(eventName);
    }

    public void startListening() {
        if (listening) return;
        listening = true;

        MapView mapView = MapView.getMapView();
        if (mapView == null) return;

        MapEventDispatcher dispatcher = mapView.getMapEventDispatcher();

        mapClickListener = event -> {
            if (!subscriptions.contains("mapClick")) return;
            GeoPoint point = event.getPoint();
            if (point == null) return;
            try {
                JSONObject json = new JSONObject();
                json.put("lat", point.getLatitude());
                json.put("lng", point.getLongitude());
                emit("mapClick", json.toString());
            } catch (JSONException e) {
                Log.e(TAG, "Error emitting mapClick", e);
            }
        };
        dispatcher.addMapEventListener(MapEvent.MAP_CLICK, mapClickListener);

        mapLongPressListener = event -> {
            if (!subscriptions.contains("mapLongPress")) return;
            GeoPoint point = event.getPoint();
            if (point == null) return;
            try {
                JSONObject json = new JSONObject();
                json.put("lat", point.getLatitude());
                json.put("lng", point.getLongitude());
                emit("mapLongPress", json.toString());
            } catch (JSONException e) {
                Log.e(TAG, "Error emitting mapLongPress", e);
            }
        };
        dispatcher.addMapEventListener(MapEvent.MAP_LONG_PRESS, mapLongPressListener);

        itemClickListener = event -> {
            if (!subscriptions.contains("itemSelected")) return;
            MapItem item = event.getItem();
            if (item == null) return;
            try {
                JSONObject json = new JSONObject();
                json.put("uid", item.getUID());
                json.put("type", item.getType());
                json.put("title", item.getTitle());
                if (item instanceof PointMapItem) {
                    GeoPoint point = ((PointMapItem) item).getPoint();
                    json.put("lat", point.getLatitude());
                    json.put("lng", point.getLongitude());
                }
                emit("itemSelected", json.toString());
            } catch (JSONException e) {
                Log.e(TAG, "Error emitting itemSelected", e);
            }
        };
        dispatcher.addMapEventListener(MapEvent.ITEM_CLICK, itemClickListener);

        // Self location updates
        PointMapItem self = mapView.getSelfMarker();
        if (self != null) {
            selfLocationListener = item -> {
                if (!subscriptions.contains("selfLocationChanged")) return;
                GeoPoint point = item.getPoint();
                try {
                    JSONObject json = new JSONObject();
                    json.put("lat", point.getLatitude());
                    json.put("lng", point.getLongitude());
                    json.put("alt", point.getAltitude());
                    json.put("bearing", item.getMetaDouble("Speed.heading", 0));
                    json.put("speed", item.getMetaDouble("Speed.value", 0));
                    emit("selfLocationChanged", json.toString());
                } catch (JSONException e) {
                    Log.e(TAG, "Error emitting selfLocationChanged", e);
                }
            };
            self.addOnPointChangedListener(selfLocationListener);
        }

        Log.d(TAG, "Started listening for map events");
    }

    public void stopListening() {
        if (!listening) return;
        listening = false;

        MapView mapView = MapView.getMapView();
        if (mapView == null) return;

        MapEventDispatcher dispatcher = mapView.getMapEventDispatcher();

        if (mapClickListener != null) {
            dispatcher.removeMapEventListener(MapEvent.MAP_CLICK, mapClickListener);
        }
        if (mapLongPressListener != null) {
            dispatcher.removeMapEventListener(MapEvent.MAP_LONG_PRESS, mapLongPressListener);
        }
        if (itemClickListener != null) {
            dispatcher.removeMapEventListener(MapEvent.ITEM_CLICK, itemClickListener);
        }
        if (selfLocationListener != null) {
            PointMapItem self = mapView.getSelfMarker();
            if (self != null) {
                self.removeOnPointChangedListener(selfLocationListener);
            }
        }

        Log.d(TAG, "Stopped listening for map events");
    }

    private void emit(String eventName, String jsonPayload) {
        String js = "window.__atakBridge && window.__atakBridge.emit('"
                + eventName + "', " + jsonPayload + ")";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}
