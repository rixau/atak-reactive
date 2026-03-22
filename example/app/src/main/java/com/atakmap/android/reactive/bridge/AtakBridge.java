package com.atakmap.android.reactive.bridge;

import android.webkit.JavascriptInterface;

import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.Marker;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.android.preference.AtakPreferences;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;
import java.util.UUID;

public class AtakBridge {

    private static final String TAG = "AtakBridge";

    private final MapView mapView;
    private final BridgeEventEmitter emitter;
    private final MarkerManager markerManager;
    private final MapItemEventRelay relay;

    public AtakBridge(MapView mapView, BridgeEventEmitter emitter) {
        this.mapView = mapView;
        this.emitter = emitter;
        this.markerManager = new MarkerManager(mapView);
        this.relay = new MapItemEventRelay(mapView, emitter);
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

    @JavascriptInterface
    public String getMapItemsSnapshot() {
        try {
            JSONArray result = new JSONArray();
            MapGroup root = mapView.getRootGroup();
            if (root == null) return "[]";
            root.deepForEachItem(new MapGroup.MapItemsCallback() {
                @Override
                public boolean onItemFunction(MapItem item) {
                    try {
                        result.put(MapItemSerializer.serialize(item));
                    } catch (JSONException e) {
                        Log.e(TAG, "Error serializing item in snapshot", e);
                    }
                    return false;
                }
            });
            return result.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error getting map items snapshot", e);
            return "[]";
        }
    }

    @JavascriptInterface
    public String getMapItem(String uid) {
        try {
            MapItem item = mapView.getRootGroup().deepFindUID(uid);
            if (item == null) return "null";
            return MapItemSerializer.serialize(item).toString();
        } catch (JSONException e) {
            Log.e(TAG, "Error getting map item: " + uid, e);
            return "null";
        }
    }

    @JavascriptInterface
    public String getMapGroups() {
        try {
            MapGroup root = mapView.getRootGroup();
            JSONArray result = new JSONArray();
            for (MapGroup child : root.getChildGroups()) {
                result.put(serializeGroup(child));
            }
            return result.toString();
        } catch (JSONException e) {
            Log.e(TAG, "Error getting map groups", e);
            return "[]";
        }
    }

    @JavascriptInterface
    public String getPluginMarkers() {
        try {
            JSONArray result = new JSONArray();
            List<String> uids = markerManager.getMarkerUids();
            for (String uid : uids) {
                MapItem item = mapView.getRootGroup().deepFindUID(uid);
                if (item != null) {
                    result.put(MapItemSerializer.serialize(item));
                }
            }
            return result.toString();
        } catch (JSONException e) {
            Log.e(TAG, "Error getting plugin markers", e);
            return "[]";
        }
    }

    @JavascriptInterface
    public void startMapItemStream() {
        relay.start();
    }

    @JavascriptInterface
    public void stopMapItemStream() {
        relay.stop();
    }

    private JSONObject serializeGroup(MapGroup group) throws JSONException {
        JSONObject json = new JSONObject();
        json.put("name", group.getFriendlyName());
        json.put("itemCount", group.getItemCount());

        JSONArray children = new JSONArray();
        for (MapGroup child : group.getChildGroups()) {
            children.put(serializeGroup(child));
        }
        json.put("childGroups", children);

        return json;
    }

    public void dispose() {
        markerManager.removeAll();
        relay.dispose();
    }
}
