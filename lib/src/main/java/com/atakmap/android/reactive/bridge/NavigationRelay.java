package com.atakmap.android.reactive.bridge;

import com.atakmap.android.routes.Route;
import com.atakmap.android.routes.RouteNavigator;
import com.atakmap.coremap.log.Log;

import org.json.JSONObject;

/**
 * Navigation state relay — bridges RouteNavigator state to JS.
 *
 * TODO: Fix RouteNavigatorListener and RouteNavigationManagerEventListener
 * method signatures against actual ATAK 5.6.0 SDK API.
 */
public class NavigationRelay {

    private static final String TAG = "NavigationRelay";

    private final BridgeEventEmitter emitter;
    private boolean active = false;
    private String currentRouteUid = null;

    public NavigationRelay(BridgeEventEmitter emitter) {
        this.emitter = emitter;
    }

    public void start() {
        // TODO: Register RouteNavigatorListener when API is verified
    }

    public void stop() {
        // TODO: Unregister listener
    }

    public boolean startNavigation(String routeUid, int startIndex) {
        try {
            RouteNavigator nav = RouteNavigator.getInstance();
            if (nav == null) return false;

            // Find route
            Route route = null;
            // TODO: resolve route from UID
            if (route == null) return false;

            boolean started = nav.startNavigating(route, startIndex);
            if (started) {
                active = true;
                currentRouteUid = routeUid;
                emitState();
            }
            return started;
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
            active = false;
            currentRouteUid = null;
            emitState();
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
            json.put("routeUid", currentRouteUid != null ? currentRouteUid : JSONObject.NULL);
            json.put("currentWaypointIndex", -1);
            json.put("gpsLost", false);
            return json.toString();
        } catch (Exception e) {
            return "{\"active\":false,\"routeUid\":null,\"currentWaypointIndex\":-1,\"gpsLost\":false}";
        }
    }

    private void emitState() {
        emitter.emit("navigationStateChanged", getNavigationState());
    }

    public void dispose() {
        active = false;
        currentRouteUid = null;
    }
}
