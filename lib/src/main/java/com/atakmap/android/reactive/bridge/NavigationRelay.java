package com.atakmap.android.reactive.bridge;

import android.util.Pair;

import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.android.routes.Route;
import com.atakmap.android.routes.RouteNavigationManager;
import com.atakmap.android.routes.RouteNavigator;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import org.json.JSONObject;

/**
 * Navigation state relay — bridges RouteNavigator state to JS.
 */
public class NavigationRelay implements
        RouteNavigator.RouteNavigatorListener,
        RouteNavigationManager.RouteNavigationManagerEventListener {

    private static final String TAG = "NavigationRelay";

    private final MapView mapView;
    private final BridgeEventEmitter emitter;
    private boolean active = false;
    private String currentRouteUid = null;
    private int currentWaypointIndex = -1;
    private boolean gpsLost = false;

    public NavigationRelay(MapView mapView, BridgeEventEmitter emitter) {
        this.mapView = mapView;
        this.emitter = emitter;
    }

    public void start() {
        RouteNavigator nav = RouteNavigator.getInstance();
        if (nav != null) {
            nav.registerRouteNavigatorListener(this);
            // If already navigating, sync state
            if (nav.isNavigating()) {
                Route route = nav.getRoute();
                if (route != null) {
                    active = true;
                    currentRouteUid = route.getUID();
                    registerManagerListener(nav);
                    syncWaypointIndex(nav);
                    emitState();
                }
            }
        }
    }

    public void stop() {
        RouteNavigator nav = RouteNavigator.getInstance();
        if (nav != null) {
            unregisterManagerListener(nav);
            nav.unregisterRouteNavigatorListener(this);
        }
    }

    // --- RouteNavigatorListener ---

    @Override
    public void onNavigationStarting(RouteNavigator navigator) {
        // no-op
    }

    @Override
    public void onNavigationStarted(RouteNavigator navigator, Route route) {
        active = true;
        currentRouteUid = route != null ? route.getUID() : null;
        currentWaypointIndex = 0;
        gpsLost = false;
        registerManagerListener(navigator);
        syncWaypointIndex(navigator);
        emitState();
    }

    @Override
    public void onNavigationStopping(RouteNavigator navigator, Route route) {
        unregisterManagerListener(navigator);
    }

    @Override
    public void onNavigationStopped(RouteNavigator navigator) {
        active = false;
        currentRouteUid = null;
        currentWaypointIndex = -1;
        gpsLost = false;
        emitState();
    }

    // --- RouteNavigationManagerEventListener ---

    @Override
    public void onGpsStatusChanged(RouteNavigationManager mgr, boolean found) {
        gpsLost = !found;
        emitState();
    }

    @Override
    public void onLocationChanged(RouteNavigationManager mgr,
            GeoPoint oldLocation, GeoPoint newLocation) {
        // no-op — too chatty for bridge
    }

    @Override
    public void onNavigationObjectiveChanged(RouteNavigationManager mgr,
            PointMapItem newObjective, boolean isFromRouteProgression) {
        Pair<Integer, PointMapItem> obj = mgr.getCurrentObjective();
        if (obj != null) {
            currentWaypointIndex = obj.first;
        }
        emitState();
    }

    @Override
    public void onOffRoute(RouteNavigationManager mgr) {
        emitState();
    }

    @Override
    public void onReturnedToRoute(RouteNavigationManager mgr) {
        emitState();
    }

    @Override
    public void onTriggerEntered(RouteNavigationManager mgr,
            PointMapItem item, int triggerIndex) {
        // no-op
    }

    @Override
    public void onArrivedAtPoint(RouteNavigationManager mgr,
            PointMapItem item) {
        syncWaypointIndex(RouteNavigator.getInstance());
        emitState();
    }

    @Override
    public void onDepartedPoint(RouteNavigationManager mgr,
            PointMapItem item) {
        syncWaypointIndex(RouteNavigator.getInstance());
        emitState();
    }

    // --- Public API ---

    public boolean startNavigation(String routeUid, int startIndex) {
        try {
            RouteNavigator nav = RouteNavigator.getInstance();
            if (nav == null) return false;

            MapItem item = mapView.getRootGroup().deepFindUID(routeUid);
            if (!(item instanceof Route)) return false;

            return nav.startNavigating((Route) item, startIndex);
        } catch (Exception e) {
            Log.e(TAG, "Error starting navigation", e);
            return false;
        }
    }

    public boolean stopNavigation() {
        try {
            RouteNavigator nav = RouteNavigator.getInstance();
            if (nav == null) return false;
            nav.stopNavigating();
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error stopping navigation", e);
            return false;
        }
    }

    public String getNavigationState() {
        try {
            JSONObject json = new JSONObject();
            json.put("active", active);
            json.put("routeUid", currentRouteUid != null
                    ? currentRouteUid : JSONObject.NULL);
            json.put("currentWaypointIndex", currentWaypointIndex);
            json.put("gpsLost", gpsLost);
            return json.toString();
        } catch (Exception e) {
            return "{\"active\":false,\"routeUid\":null,"
                    + "\"currentWaypointIndex\":-1,\"gpsLost\":false}";
        }
    }

    // --- Helpers ---

    private void registerManagerListener(RouteNavigator nav) {
        RouteNavigationManager mgr = nav.getNavManager();
        if (mgr != null) {
            mgr.registerListener(this);
        }
    }

    private void unregisterManagerListener(RouteNavigator nav) {
        RouteNavigationManager mgr = nav.getNavManager();
        if (mgr != null) {
            mgr.unregisterListener(this);
        }
    }

    private void syncWaypointIndex(RouteNavigator nav) {
        if (nav == null) return;
        RouteNavigationManager mgr = nav.getNavManager();
        if (mgr != null) {
            Pair<Integer, PointMapItem> obj = mgr.getCurrentObjective();
            if (obj != null) {
                currentWaypointIndex = obj.first;
            }
        }
    }

    private void emitState() {
        emitter.emit("navigationStateChanged", getNavigationState());
    }

    public void dispose() {
        stop();
        active = false;
        currentRouteUid = null;
    }
}
