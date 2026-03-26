package com.atakmap.android.reactive.bridge;

import com.atakmap.coremap.maps.assets.Icon;
import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.Marker;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MarkerManager {

    private static final String TAG = "MarkerManager";

    private final MapView mapView;
    private final Map<String, Marker> managedMarkers = new ConcurrentHashMap<>();

    public MarkerManager(MapView mapView) {
        this.mapView = mapView;
    }

    public String addMarker(JSONObject opts) {
        String uid = opts.optString("uid", java.util.UUID.randomUUID().toString());
        String title = opts.optString("title", "Marker");
        String type = opts.optString("type", "a-u-G");
        double lat = opts.optDouble("lat");
        double lng = opts.optDouble("lng");
        String groupName = opts.optString("group", null);
        String iconUri = opts.optString("iconUri", null);
        int iconColor = opts.optInt("iconColor", 0);

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

        if (iconUri != null) {
            applyIcon(marker, iconUri, iconColor);
        }

        mapView.post(() -> {
            MapGroup group = resolveGroup(groupName);
            group.addItem(marker);
        });

        managedMarkers.put(uid, marker);
        Log.d(TAG, "Added marker: " + uid + " (" + title + ")");
        return uid;
    }

    public boolean updateMarker(String uid, JSONObject opts) {
        Marker marker = findMarker(uid);
        if (marker == null) return false;

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
            if (opts.has("iconUri")) {
                applyIcon(m, opts.optString("iconUri"),
                        opts.optInt("iconColor", 0));
            }
        });

        return true;
    }

    public boolean setMarkerIcon(String uid, JSONObject opts) {
        Marker marker = findMarker(uid);
        if (marker == null) return false;

        String iconUri = opts.optString("iconUri", null);
        if (iconUri == null) return false;

        int iconColor = opts.optInt("iconColor", 0);

        mapView.post(() -> applyIcon(marker, iconUri, iconColor));
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

    public List<String> getMarkerUids() {
        return new ArrayList<>(managedMarkers.keySet());
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

    private Marker findMarker(String uid) {
        Marker marker = managedMarkers.get(uid);
        if (marker != null) return marker;

        MapItem item = mapView.getRootGroup().deepFindUID(uid);
        if (item instanceof Marker) {
            return (Marker) item;
        }
        return null;
    }

    private MapGroup resolveGroup(String groupName) {
        if (groupName != null) {
            MapGroup named = mapView.getRootGroup().findMapGroup(groupName);
            if (named != null) return named;
        }
        MapGroup cot = mapView.getRootGroup().findMapGroup("Cursor on Target");
        if (cot != null) return cot;
        return mapView.getRootGroup();
    }

    private void applyIcon(Marker marker, String iconUri, int iconColor) {
        Icon.Builder builder = new Icon.Builder();
        builder.setImageUri(Icon.STATE_DEFAULT, iconUri);
        if (iconColor != 0) {
            builder.setColor(Icon.STATE_DEFAULT, iconColor);
        }
        marker.setIcon(builder.build());
    }
}
