package com.atakmap.android.reactive.bridge;

import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.Marker;
import com.atakmap.android.routes.Route;
import com.atakmap.android.routes.RouteNavigator;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;
import com.atakmap.coremap.maps.coords.GeoPointMetaData;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class RouteManager {

    private static final String TAG = "RouteManager";

    private final MapView mapView;
    private final Map<String, Route> managedRoutes = new ConcurrentHashMap<>();

    public RouteManager(MapView mapView) {
        this.mapView = mapView;
    }

    public String addRoute(JSONObject opts) {
        try {
            String uid = opts.optString("uid", UUID.randomUUID().toString());
            String title = opts.optString("title", "Route");
            String prefix = opts.optString("prefix", "CP");
            String method = opts.optString("method", "Driving");
            String direction = opts.optString("direction", "Infil");
            int color = MapItemSerializer.hexToColor(opts.optString("color", "#FFFFFFFF"));

            JSONArray waypointsArr = opts.optJSONArray("waypoints");
            if (waypointsArr == null || waypointsArr.length() < 2) {
                Log.w(TAG, "addRoute: requires at least 2 waypoints");
                return "null";
            }

            final Route route = new Route(mapView, title, color, prefix, uid);
            route.setRouteMethod(method);
            route.setRouteDirection(direction);
            route.setMetaBoolean("archive", true);
            route.setMetaBoolean("editable", true);
            route.setMetaBoolean("removable", true);
            route.setMetaString("entry", "user");

            Marker[] waypoints = new Marker[waypointsArr.length()];
            for (int i = 0; i < waypointsArr.length(); i++) {
                JSONObject pt = waypointsArr.getJSONObject(i);
                GeoPoint gp = new GeoPoint(
                        pt.optDouble("lat"), pt.optDouble("lng"),
                        pt.optDouble("alt", GeoPoint.UNKNOWN));
                waypoints[i] = Route.createWayPoint(
                        GeoPointMetaData.wrap(gp), UUID.randomUUID().toString());
            }

            mapView.post(() -> {
                try {
                    route.addMarkers(0, waypoints);
                    MapGroup routeGroup = resolveRouteGroup();
                    routeGroup.addItem(route);
                    route.persist(mapView.getMapEventDispatcher(), null, RouteManager.class);
                } catch (Exception e) {
                    Log.e(TAG, "Error posting route to map", e);
                }
            });

            managedRoutes.put(uid, route);
            Log.d(TAG, "Added route: " + uid + " (" + title + ")");
            return uid;
        } catch (Exception e) {
            Log.e(TAG, "Error adding route", e);
            return "null";
        }
    }

    public boolean updateRoute(String uid, JSONObject opts) {
        Route route = findRoute(uid);
        if (route == null) return false;

        mapView.post(() -> {
            try {
                if (opts.has("title")) {
                    route.setTitle(opts.optString("title"));
                }
                if (opts.has("color")) {
                    route.setColor(MapItemSerializer.hexToColor(opts.optString("color")));
                }
                if (opts.has("method")) {
                    route.setRouteMethod(opts.optString("method"));
                }
                if (opts.has("direction")) {
                    route.setRouteDirection(opts.optString("direction"));
                }
                route.refresh(mapView.getMapEventDispatcher(), null, RouteManager.class);
            } catch (Exception e) {
                Log.e(TAG, "Error updating route: " + uid, e);
            }
        });

        return true;
    }

    public boolean addWaypoint(String routeUid, JSONObject opts) {
        Route route = findRoute(routeUid);
        if (route == null) return false;

        double lat = opts.optDouble("lat");
        double lng = opts.optDouble("lng");
        double alt = opts.optDouble("alt", GeoPoint.UNKNOWN);
        int index = opts.optInt("index", -1);

        GeoPoint gp = new GeoPoint(lat, lng, alt);
        Marker wp = Route.createWayPoint(
                GeoPointMetaData.wrap(gp), UUID.randomUUID().toString());

        if (opts.has("title")) {
            wp.setTitle(opts.optString("title"));
        }

        mapView.post(() -> {
            try {
                int insertAt = index >= 0 ? index : route.getNumPoints();
                route.addMarker(insertAt, wp);
                route.refresh(mapView.getMapEventDispatcher(), null, RouteManager.class);
            } catch (Exception e) {
                Log.e(TAG, "Error adding waypoint to route: " + routeUid, e);
            }
        });

        return true;
    }

    public boolean removeWaypoint(String routeUid, String waypointUid) {
        Route route = findRoute(routeUid);
        if (route == null) return false;

        mapView.post(() -> {
            try {
                MapItem wp = route.deepFindUID(waypointUid);
                if (wp instanceof Marker) {
                    int idx = route.getIndexOfMarker((Marker) wp);
                    if (idx >= 0) {
                        route.removeMarker(idx);
                    }
                }
                route.refresh(mapView.getMapEventDispatcher(), null, RouteManager.class);
            } catch (Exception e) {
                Log.e(TAG, "Error removing waypoint: " + waypointUid, e);
            }
        });

        return true;
    }

    public boolean removeRoute(String uid) {
        Route route = managedRoutes.remove(uid);
        if (route == null) {
            MapItem item = mapView.getRootGroup().deepFindUID(uid);
            if (item instanceof Route) {
                route = (Route) item;
            }
        }
        if (route == null) return false;

        final Route toRemove = route;
        mapView.post(() -> {
            try {
                MapGroup parent = toRemove.getGroup();
                if (parent != null) {
                    parent.removeItem(toRemove);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error removing route: " + uid, e);
            }
        });

        return true;
    }

    public boolean startNavigation(String routeUid, JSONObject opts) {
        try {
            RouteNavigator nav = RouteNavigator.getInstance();
            if (nav == null) return false;

            Route route = findRoute(routeUid);
            if (route == null) return false;

            int startIndex = opts.optInt("startIndex", 0);

            mapView.post(() -> {
                try {
                    nav.startNavigating(route, startIndex);
                } catch (Exception e) {
                    Log.e(TAG, "Error starting navigation", e);
                }
            });

            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error starting navigation", e);
            return false;
        }
    }

    public boolean stopNavigation() {
        try {
            RouteNavigator nav = RouteNavigator.getInstance();
            if (nav == null) return false;

            mapView.post(() -> {
                try {
                    nav.stopNavigating();
                } catch (Exception e) {
                    Log.e(TAG, "Error stopping navigation", e);
                }
            });

            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error stopping navigation", e);
            return false;
        }
    }

    public List<String> getManagedUids() {
        return new ArrayList<>(managedRoutes.keySet());
    }

    public void removeAll() {
        for (Map.Entry<String, Route> entry : managedRoutes.entrySet()) {
            Route route = entry.getValue();
            mapView.post(() -> {
                MapGroup parent = route.getGroup();
                if (parent != null) {
                    parent.removeItem(route);
                }
            });
        }
        managedRoutes.clear();
    }

    private Route findRoute(String uid) {
        Route route = managedRoutes.get(uid);
        if (route != null) return route;

        MapItem item = mapView.getRootGroup().deepFindUID(uid);
        if (item instanceof Route) {
            return (Route) item;
        }
        return null;
    }

    private MapGroup resolveRouteGroup() {
        MapGroup rg = mapView.getRootGroup().findMapGroup("Route");
        if (rg != null) return rg;
        return mapView.getRootGroup();
    }
}
