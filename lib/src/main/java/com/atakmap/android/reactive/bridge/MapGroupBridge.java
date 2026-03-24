package com.atakmap.android.reactive.bridge;

import com.atakmap.android.maps.DefaultMapGroup;
import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.hierarchy.maps.DefaultMapGroupOverlay;
import com.atakmap.coremap.log.Log;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MapGroupBridge {

    private static final String TAG = "MapGroupBridge";

    private final MapView mapView;
    private final Map<String, MapGroup> managedGroups = new ConcurrentHashMap<>();
    private final Map<String, DefaultMapGroupOverlay> managedOverlays = new ConcurrentHashMap<>();

    public MapGroupBridge(MapView mapView) {
        this.mapView = mapView;
    }

    public boolean createMapGroup(String name, String parentName) {
        if (name == null || managedGroups.containsKey(name)) return false;

        MapGroup parent;
        if (parentName != null && !parentName.isEmpty()) {
            parent = mapView.getRootGroup().findMapGroup(parentName);
            if (parent == null) {
                Log.w(TAG, "Parent group not found: " + parentName);
                return false;
            }
        } else {
            parent = mapView.getRootGroup();
        }

        DefaultMapGroup group = new DefaultMapGroup(name);
        DefaultMapGroupOverlay overlay = new DefaultMapGroupOverlay(
                mapView, group, null);

        mapView.post(() -> {
            parent.addGroup(group);
            mapView.getMapOverlayManager().addOverlay(overlay);
        });

        managedGroups.put(name, group);
        managedOverlays.put(name, overlay);
        Log.d(TAG, "Created map group: " + name);
        return true;
    }

    public boolean removeMapGroup(String name) {
        MapGroup group = managedGroups.remove(name);
        DefaultMapGroupOverlay overlay = managedOverlays.remove(name);
        if (group == null) return false;

        mapView.post(() -> {
            if (overlay != null) {
                mapView.getMapOverlayManager().removeOverlay(overlay);
            }
            MapGroup parent = group.getParentGroup();
            if (parent != null) {
                parent.removeGroup(group);
            }
        });

        Log.d(TAG, "Removed map group: " + name);
        return true;
    }

    public boolean setGroupVisible(String name, boolean visible) {
        MapGroup group = managedGroups.get(name);
        if (group == null) {
            group = mapView.getRootGroup().findMapGroup(name);
        }
        if (group == null) return false;

        final MapGroup g = group;
        mapView.post(() -> g.setVisible(visible));
        return true;
    }

    public void dispose() {
        for (String name : managedGroups.keySet()) {
            removeMapGroup(name);
        }
    }
}
