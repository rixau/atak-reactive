package com.atakmap.android.reactive.bridge;

import com.atakmap.coremap.log.Log;

/**
 * Geofence bridge — emits alerts and exposes create/remove.
 *
 * TODO: Fix GeoFenceComponent, GeoFenceManager, and GeoFenceAlerting
 * API calls against actual ATAK 5.6.0 SDK.
 */
public class GeofenceBridge {

    private static final String TAG = "GeofenceBridge";

    private final com.atakmap.android.maps.MapView mapView;
    private final BridgeEventEmitter emitter;

    public GeofenceBridge(com.atakmap.android.maps.MapView mapView, BridgeEventEmitter emitter) {
        this.mapView = mapView;
        this.emitter = emitter;
    }

    public void start() {
        Log.d(TAG, "Geofence bridge started (stub)");
    }

    public void stop() {
        Log.d(TAG, "Geofence bridge stopped (stub)");
    }

    public String createGeofence(String optionsJson) {
        Log.w(TAG, "createGeofence not yet implemented");
        return "false";
    }

    public void removeGeofence(String shapeUid) {
        Log.w(TAG, "removeGeofence not yet implemented");
    }

    public void dismissGeofenceAlert(String fenceUid, String itemUid) {
        Log.w(TAG, "dismissGeofenceAlert not yet implemented");
    }

    public void dispose() {
        stop();
    }
}
