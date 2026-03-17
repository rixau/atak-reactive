package com.atakmap.android.reactive.bridge;

import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.Marker;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import org.json.JSONObject;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MarkerManager {

    private static final String TAG = "MarkerManager";

    private final MapView mapView;
    private final Map<String, Marker> managedMarkers = new ConcurrentHashMap<>();

    public MarkerManager(MapView mapView) {
        this.mapView = mapView;
    }

    public String addMarker(String uid, String title, String type,
            double lat, double lng) {
        final Marker marker = new Marker(uid);
        marker.setPoint(new GeoPoint(lat, lng));
        marker.setTitle(title);
        marker.setType(type);
        marker.setMetaBoolean("readiness", true);
        marker.setMetaBoolean("archive", false);
        marker.setMetaString("how", "h-g-i-g-o");
        marker.setMetaBoolean("editable", true);
        marker.setMetaBoolean("movable", true);
        marker.setMetaBoolean("removable", true);
        marker.setMetaString("entry", "user");

        mapView.post(() -> {
            MapGroup group = mapView.getRootGroup()
                    .findMapGroup("Cursor on Target");
            if (group != null) {
                group.addItem(marker);
            } else {
                mapView.getRootGroup().addItem(marker);
            }
        });

        managedMarkers.put(uid, marker);
        Log.d(TAG, "Added marker: " + uid + " (" + title + ")");
        return uid;
    }

    public boolean updateMarker(String uid, JSONObject opts) {
        Marker marker = managedMarkers.get(uid);
        if (marker == null) {
            MapItem item = mapView.getRootGroup().deepFindUID(uid);
            if (item instanceof Marker) {
                marker = (Marker) item;
            } else {
                return false;
            }
        }

        final Marker m = marker;
        mapView.post(() -> {
            if (opts.has("lat") && opts.has("lng")) {
                m.setPoint(new GeoPoint(
                        opts.optDouble("lat"), opts.optDouble("lng")));
            }
            if (opts.has("title")) {
                m.setTitle(opts.optString("title"));
            }
            if (opts.has("type")) {
                m.setType(opts.optString("type"));
            }
        });

        return true;
    }

    public boolean removeMarker(String uid) {
        Marker marker = managedMarkers.remove(uid);
        if (marker != null) {
            mapView.post(() -> {
                MapGroup parent = marker.getGroup();
                if (parent != null) {
                    parent.removeItem(marker);
                }
            });
            return true;
        }

        // Try to find it in the map even if we don't manage it
        MapItem item = mapView.getRootGroup().deepFindUID(uid);
        if (item != null) {
            mapView.post(() -> {
                MapGroup parent = item.getGroup();
                if (parent != null) {
                    parent.removeItem(item);
                }
            });
            return true;
        }

        return false;
    }

    public void removeAll() {
        for (Map.Entry<String, Marker> entry : managedMarkers.entrySet()) {
            Marker marker = entry.getValue();
            mapView.post(() -> {
                MapGroup parent = marker.getGroup();
                if (parent != null) {
                    parent.removeItem(marker);
                }
            });
        }
        managedMarkers.clear();
    }
}
