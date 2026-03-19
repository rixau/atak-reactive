package com.atakmap.android.reactive.bridge;

import android.webkit.JavascriptInterface;

import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.Marker;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.android.preference.AtakPreferences;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.UUID;

public class AtakBridge {

    private static final String TAG = "AtakBridge";

    private final MapView mapView;
    private final BridgeEventEmitter emitter;
    private final MarkerManager markerManager;

    public AtakBridge(MapView mapView, BridgeEventEmitter emitter) {
        this.mapView = mapView;
        this.emitter = emitter;
        this.markerManager = new MarkerManager(mapView);
    }

    @JavascriptInterface
    public String getSelfLocation() {
        try {
            PointMapItem self = mapView.getSelfMarker();
            if (self == null) return "null";

            GeoPoint point = self.getPoint();
            JSONObject json = new JSONObject();
            json.put("lat", point.getLatitude());
            json.put("lng", point.getLongitude());
            json.put("alt", point.getAltitude());
            json.put("bearing", self.getMetaDouble("Speed.heading", 0));
            json.put("speed", self.getMetaDouble("Speed.value", 0));
            return json.toString();
        } catch (JSONException e) {
            Log.e(TAG, "Error getting self location", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String getMapCenter() {
        try {
            GeoPoint center = mapView.getCenterPoint().get();
            JSONObject json = new JSONObject();
            json.put("lat", center.getLatitude());
            json.put("lng", center.getLongitude());
            return json.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error getting map center", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String addMarker(String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            double lat = opts.getDouble("lat");
            double lng = opts.getDouble("lng");
            String title = opts.optString("title", "Marker");
            String type = opts.optString("type", "a-u-G");
            String uid = opts.optString("uid", UUID.randomUUID().toString());

            return markerManager.addMarker(uid, title, type, lat, lng);
        } catch (JSONException e) {
            Log.e(TAG, "Error adding marker", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String updateMarker(String uid, String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return String.valueOf(markerManager.updateMarker(uid, opts));
        } catch (JSONException e) {
            Log.e(TAG, "Error updating marker", e);
            return "false";
        }
    }

    @JavascriptInterface
    public String removeMarker(String uid) {
        return String.valueOf(markerManager.removeMarker(uid));
    }

    @JavascriptInterface
    public void panTo(double lat, double lng, double zoom) {
        mapView.post(() -> {
            GeoPoint point = new GeoPoint(lat, lng);
            if (zoom > 0) {
                mapView.getMapController().panTo(point, true);
                mapView.getMapController().zoomTo(zoom, true);
            } else {
                mapView.getMapController().panTo(point, true);
            }
        });
    }

    @JavascriptInterface
    public String getPreference(String key) {
        try {
            AtakPreferences prefs = AtakPreferences.getInstance(
                    mapView.getContext());
            return prefs.get(key, null);
        } catch (Exception e) {
            Log.e(TAG, "Error getting preference: " + key, e);
            return "null";
        }
    }

    @JavascriptInterface
    public void subscribe(String eventName) {
        emitter.subscribe(eventName);
    }

    @JavascriptInterface
    public void unsubscribe(String eventName) {
        emitter.unsubscribe(eventName);
    }

    public void dispose() {
        markerManager.removeAll();
    }
}
