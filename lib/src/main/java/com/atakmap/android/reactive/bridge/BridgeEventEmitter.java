package com.atakmap.android.reactive.bridge;

import android.webkit.WebView;

import com.atakmap.android.maps.MapEvent;
import com.atakmap.android.maps.MapEventDispatcher;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.android.menu.MapMenuEventListener;
import com.atakmap.android.menu.MapMenuReceiver;
import com.atakmap.android.navigation.views.NavView;
import com.atakmap.android.navigation.views.buttons.NavButtonsVisibilityListener;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import org.json.JSONArray;
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
    private NavButtonsVisibilityListener navVisibilityListener;
    private MapMenuEventListener radialMenuListener;

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
            android.graphics.PointF screenPt = event.getPointF();
            if (screenPt == null) return;
            GeoPoint point = mapView.inverse(screenPt.x, screenPt.y, MapView.InverseMode.RayCast).get();
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
            android.graphics.PointF screenPt = event.getPointF();
            if (screenPt == null) return;
            GeoPoint point = mapView.inverse(screenPt.x, screenPt.y, MapView.InverseMode.RayCast).get();
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

        // Nav button visibility. The SDK has always declared a `navVisible` event and
        // shipped a useNavVisible() hook documented as reactive, but nothing ever
        // emitted it — so the hook's value was frozen at whatever it read on mount.
        NavView navView = NavView.getInstance();
        if (navView != null) {
            navVisibilityListener = visible -> {
                if (!subscriptions.contains("navVisible")) return;
                emit("navVisible", String.valueOf(visible));
            };
            navView.addButtonVisibilityListener(navVisibilityListener);
        } else {
            Log.d(TAG, "NavView unavailable — navVisible events will not be emitted");
        }

        // Radial menu open/close. ATAK exposes no generic "any radial button was
        // clicked" hook — buttons dispatch their own broadcast actions, which a
        // plugin observes with registerAction() when it knows the action string.
        // What is observable is which item's menu is open, which is what this
        // reports.
        MapMenuReceiver menuReceiver = MapMenuReceiver.getInstance();
        if (menuReceiver != null) {
            radialMenuListener = new MapMenuEventListener() {
                @Override
                public boolean onShowMenu(MapItem item) {
                    emitRadialMenu(true, item);
                    // Observe, never intercept: a true return suppresses ATAK's own
                    // radial menu, and a plugin panel has no business doing that.
                    return false;
                }

                @Override
                public void onHideMenu(MapItem item) {
                    emitRadialMenu(false, item);
                }
            };
            menuReceiver.addEventListener(radialMenuListener);
        } else {
            Log.d(TAG, "MapMenuReceiver unavailable — radialMenuChanged will not be emitted");
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

        if (radialMenuListener != null) {
            MapMenuReceiver menuReceiver = MapMenuReceiver.getInstance();
            if (menuReceiver != null) {
                menuReceiver.removeEventListener(radialMenuListener);
            }
            radialMenuListener = null;
        }

        if (navVisibilityListener != null) {
            NavView navView = NavView.getInstance();
            if (navView != null) {
                navView.removeButtonVisibilityListener(navVisibilityListener);
            }
            navVisibilityListener = null;
        }

        Log.d(TAG, "Stopped listening for map events");
    }

    /** Radial menu opened or closed, with the item it belongs to. */
    private void emitRadialMenu(boolean open, MapItem item) {
        if (!subscriptions.contains("radialMenuChanged")) return;
        try {
            JSONObject json = new JSONObject();
            json.put("open", open);
            json.put("item", item != null
                    ? MapItemSerializer.serialize(item)
                    : JSONObject.NULL);
            emit("radialMenuChanged", json.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error emitting radialMenuChanged", e);
        }
    }

    public void emitMapItemsChanged(JSONArray added, JSONArray removed,
            JSONArray updated) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("added", added);
            payload.put("removed", removed);
            payload.put("updated", updated);
            emit("mapItemsChanged", payload.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error emitting mapItemsChanged", e);
        }
    }

    public void emit(String eventName, String jsonPayload) {
        String js = "window.__atakBridge && window.__atakBridge.emit('"
                + eventName + "', " + jsonPayload + ")";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}
