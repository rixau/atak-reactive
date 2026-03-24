package com.atakmap.android.reactive.bridge;

import android.webkit.JavascriptInterface;

import com.atakmap.android.geofence.data.GeoFence;
import com.atakmap.android.geofence.component.GeoFenceComponent;
import com.atakmap.android.geofence.alert.GeoFenceAlerting;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.coremap.log.Log;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Bridge for geofence alert listening and creation/removal.
 * Listens to GeoFenceAlertListener for entry/exit events.
 * No debounce — alerts are infrequent and time-sensitive.
 */
public class GeofenceBridge implements GeoFenceAlerting.GeoFenceAlertListener {

    private static final String TAG = "GeofenceBridge";

    private final MapView mapView;
    private final BridgeEventEmitter emitter;
    private boolean active = false;

    public GeofenceBridge(MapView mapView, BridgeEventEmitter emitter) {
        this.mapView = mapView;
        this.emitter = emitter;
    }

    public void start() {
        if (active) return;
        active = true;
        try {
            GeoFenceComponent.getInstance().getManager()
                    .getAlerting().addOnGeoFenceAlertListener(this);
        } catch (Exception e) {
            Log.e(TAG, "Error registering geofence listener", e);
        }
    }

    public void stop() {
        if (!active) return;
        active = false;
        try {
            GeoFenceComponent.getInstance().getManager()
                    .getAlerting().removeOnGeoFenceAlertListener(this);
        } catch (Exception e) {
            Log.e(TAG, "Error unregistering geofence listener", e);
        }
    }

    @Override
    public void onAlert(GeoFenceAlerting.Alert alert) {
        try {
            JSONObject obj = serializeAlert(alert);
            emitter.emit("geofenceAlert", obj.toString());
        } catch (Exception e) {
            Log.e(TAG, "Error emitting geofence alert", e);
        }
    }

    @JavascriptInterface
    public String createGeofence(String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            String shapeUid = opts.getString("shapeUid");
            String triggerStr = opts.optString("trigger", "both");
            String monitoredStr = opts.optString("monitoredTypes", "all");
            int rangeKm = opts.optInt("rangeKm", 160);

            MapItem shape = mapView.getRootGroup().deepFindUID(shapeUid);
            if (shape == null) {
                Log.w(TAG, "Shape not found: " + shapeUid);
                return "false";
            }

            GeoFence.Trigger trigger;
            switch (triggerStr) {
                case "entry": trigger = GeoFence.Trigger.Entry; break;
                case "exit": trigger = GeoFence.Trigger.Exit; break;
                default: trigger = GeoFence.Trigger.Both; break;
            }

            GeoFence.MonitoredTypes monitoredTypes;
            switch (monitoredStr) {
                case "friendly": monitoredTypes = GeoFence.MonitoredTypes.Friendly; break;
                case "hostile": monitoredTypes = GeoFence.MonitoredTypes.Hostile; break;
                case "tak_users": monitoredTypes = GeoFence.MonitoredTypes.TAKUsers; break;
                default: monitoredTypes = GeoFence.MonitoredTypes.All; break;
            }

            GeoFence fence = new GeoFence(shape, true, trigger, monitoredTypes, rangeKm);

            if (opts.has("minElevation")) {
                fence.setMinElevation(opts.getDouble("minElevation"));
            }
            if (opts.has("maxElevation")) {
                fence.setMaxElevation(opts.getDouble("maxElevation"));
            }

            GeoFenceComponent.getInstance().dispatch(fence, shape);
            return "true";
        } catch (Exception e) {
            Log.e(TAG, "Error creating geofence", e);
            return "false";
        }
    }

    @JavascriptInterface
    public void removeGeofence(String shapeUid) {
        try {
            GeoFenceComponent.getInstance().removeFence(shapeUid);
        } catch (Exception e) {
            Log.e(TAG, "Error removing geofence", e);
        }
    }

    @JavascriptInterface
    public void dismissGeofenceAlert(String fenceUid, String itemUid) {
        try {
            GeoFenceComponent.getInstance().getManager()
                    .getAlerting().dismissAlert(fenceUid, itemUid);
        } catch (Exception e) {
            Log.e(TAG, "Error dismissing geofence alert", e);
        }
    }

    JSONObject serializeAlert(GeoFenceAlerting.Alert alert) throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("itemUid", alert.getItem().getUID());
        obj.put("itemCallsign", alert.getItem().getMetaString("callsign", ""));
        obj.put("fenceUid", alert.getMonitor().getMapItem().getUID());
        obj.put("fenceTitle", alert.getMonitor().getMapItem().getMetaString("title", ""));
        obj.put("entered", alert.isEntered());
        obj.put("timestamp", alert.getTimestamp());
        obj.put("lat", alert.getDetectedPoint().getLatitude());
        obj.put("lng", alert.getDetectedPoint().getLongitude());
        obj.put("alt", alert.getDetectedPoint().getAltitude());
        return obj;
    }
}
