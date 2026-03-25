package com.atakmap.android.reactive.bridge;

import com.atakmap.android.geofence.alert.GeoFenceAlerting;
import com.atakmap.android.geofence.component.GeoFenceComponent;
import com.atakmap.android.geofence.data.GeoFence;
import com.atakmap.android.geofence.monitor.GeoFenceManager;
import com.atakmap.android.geofence.monitor.GeoFenceMonitor;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import org.json.JSONObject;

import java.util.List;

/**
 * Geofence bridge — emits alerts and exposes create/remove.
 */
public class GeofenceBridge {

    private static final String TAG = "GeofenceBridge";

    private final MapView mapView;
    private final BridgeEventEmitter emitter;
    private GeoFenceAlerting.GeoFenceAlertListener alertListener;

    public GeofenceBridge(MapView mapView, BridgeEventEmitter emitter) {
        this.mapView = mapView;
        this.emitter = emitter;
    }

    public void start() {
        GeoFenceComponent comp = GeoFenceComponent.getInstance();
        if (comp == null) {
            Log.w(TAG, "GeoFenceComponent not available");
            return;
        }

        alertListener = alert -> {
            try {
                JSONObject json = new JSONObject();

                PointMapItem item = alert.getItem();
                json.put("itemUid", item != null ? item.getUID() : "");
                json.put("itemCallsign", item != null
                        ? item.getMetaString("callsign", "") : "");

                MapItem monitorItem = alert.getMonitorItem();
                json.put("fenceUid", monitorItem != null
                        ? monitorItem.getUID() : "");
                json.put("fenceTitle", monitorItem != null
                        ? monitorItem.getTitle() : "");

                json.put("entered", alert.isEntered());
                json.put("timestamp", alert.getTimestamp());

                GeoPoint pt = alert.getDetectedPoint();
                if (pt != null) {
                    json.put("lat", pt.getLatitude());
                    json.put("lng", pt.getLongitude());
                    json.put("alt", pt.getAltitude());
                } else {
                    json.put("lat", 0);
                    json.put("lng", 0);
                    json.put("alt", 0);
                }

                emitter.emit("geofenceAlert", json.toString());
            } catch (Exception e) {
                Log.e(TAG, "Error emitting geofence alert", e);
            }
        };

        comp.getManager().getAlerting().addOnGeoFenceAlertListener(alertListener);
    }

    public void stop() {
        if (alertListener == null) return;
        GeoFenceComponent comp = GeoFenceComponent.getInstance();
        if (comp != null) {
            comp.getManager().getAlerting().removeOnGeoFenceAlertListener(alertListener);
        }
        alertListener = null;
    }

    public String createGeofence(String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            String shapeUid = opts.getString("shapeUid");

            MapItem item = mapView.getRootGroup().deepFindUID(shapeUid);
            if (item == null) {
                Log.w(TAG, "Shape not found: " + shapeUid);
                return "false";
            }

            GeoFence.Trigger trigger = parseTrigger(
                    opts.optString("trigger", "both"));
            GeoFence.MonitoredTypes monitoredTypes = parseMonitoredTypes(
                    opts.optString("monitoredTypes", "all"));
            int rangeKm = opts.optInt("rangeKm",
                    GeoFence.DEFAULT_ENTRY_RADIUS_KM);

            GeoFence gf = new GeoFence(item, true, trigger,
                    monitoredTypes, rangeKm);

            GeoFenceComponent.getInstance().dispatch(gf, item);
            return "true";
        } catch (Exception e) {
            Log.e(TAG, "Error creating geofence", e);
            return "false";
        }
    }

    public void removeGeofence(String shapeUid) {
        try {
            GeoFenceComponent comp = GeoFenceComponent.getInstance();
            if (comp != null) {
                comp.getManager().deleteMonitor(shapeUid);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error removing geofence", e);
        }
    }

    public void dismissGeofenceAlert(String fenceUid, String itemUid) {
        try {
            GeoFenceComponent comp = GeoFenceComponent.getInstance();
            if (comp == null) return;

            GeoFenceManager mgr = comp.getManager();
            GeoFenceMonitor monitor = mgr.getMonitor(fenceUid);
            if (monitor == null) return;

            GeoFenceAlerting alerting = comp.getManager().getAlerting();
            List<GeoFenceAlerting.Alert> alerts = alerting.getAlerts(fenceUid);
            if (alerts == null) return;

            for (GeoFenceAlerting.Alert alert : alerts) {
                PointMapItem alertItem = alert.getItem();
                if (alertItem != null && itemUid.equals(alertItem.getUID())) {
                    mgr.dismiss(monitor, alert, false);
                    return;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error dismissing geofence alert", e);
        }
    }

    private GeoFence.Trigger parseTrigger(String value) {
        switch (value.toLowerCase()) {
            case "entry": return GeoFence.Trigger.Entry;
            case "exit": return GeoFence.Trigger.Exit;
            default: return GeoFence.Trigger.Both;
        }
    }

    private GeoFence.MonitoredTypes parseMonitoredTypes(String value) {
        switch (value.toLowerCase()) {
            case "tak_users": return GeoFence.MonitoredTypes.TAKUsers;
            case "friendly": return GeoFence.MonitoredTypes.Friendly;
            case "hostile": return GeoFence.MonitoredTypes.Hostile;
            case "custom": return GeoFence.MonitoredTypes.Custom;
            default: return GeoFence.MonitoredTypes.All;
        }
    }

    public void dispose() {
        stop();
    }
}
