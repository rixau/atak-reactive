package com.atakmap.android.reactive.bridge;

import com.atakmap.android.routes.Route;
import com.atakmap.android.routes.RouteNavigator;
import com.atakmap.android.routes.nav.RouteNavigationManager;
import com.atakmap.coremap.log.Log;

import org.json.JSONObject;

public class NavigationRelay implements RouteNavigator.RouteNavigatorListener {

    private static final String TAG = "NavigationRelay";

    private final BridgeEventEmitter emitter;
    private RouteNavigationManager navManager;
    private boolean active = false;
    private String currentRouteUid = null;
    private int currentWaypointIndex = -1;
    private boolean gpsLost = false;

    private final RouteNavigationManager.RouteNavigationManagerEventListener navManagerListener =
            new RouteNavigationManager.RouteNavigationManagerEventListener() {
                @Override
                public void onWaypointReached(int index, RouteNavigationManager.NavWaypoint waypoint) {
                    currentWaypointIndex = index;
                    emitState();
                }

                @Override
                public void onGpsStatusChanged(boolean lost) {
                    gpsLost = lost;
                    emitState();
                }

                @Override
                public void onNavigationObjectiveChanged(
                        RouteNavigationManager.NavWaypoint waypoint, boolean approached) {
                    // Optional: could emit more detailed state
                }

                @Override
                public void onOffRoute() {
                    // Optional: could add an offRoute field
                }

                @Override
                public void onReturnedToRoute() {
                    // Optional: could clear offRoute state
                }
            };

    public NavigationRelay(BridgeEventEmitter emitter) {
        this.emitter = emitter;
    }

    public void start() {
        try {
            RouteNavigator nav = RouteNavigator.getInstance();
            if (nav != null) {
                nav.registerRouteNavigatorListener(this);
                Log.d(TAG, "Registered with RouteNavigator");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting NavigationRelay", e);
        }
    }

    public void stop() {
        try {
            if (navManager != null) {
                navManager.unregisterListener(navManagerListener);
                navManager = null;
            }
            RouteNavigator nav = RouteNavigator.getInstance();
            if (nav != null) {
                nav.unregisterRouteNavigatorListener(this);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping NavigationRelay", e);
        }
        active = false;
        currentRouteUid = null;
        currentWaypointIndex = -1;
        gpsLost = false;
    }

    @Override
    public void onNavigationStarted(RouteNavigator nav, Route route) {
        active = true;
        currentRouteUid = route != null ? route.getUID() : null;
        currentWaypointIndex = 0;
        gpsLost = false;

        navManager = nav.getNavManager();
        if (navManager != null) {
            navManager.registerListener(navManagerListener);
        }

        emitState();
    }

    @Override
    public void onNavigationStopped(RouteNavigator nav) {
        if (navManager != null) {
            navManager.unregisterListener(navManagerListener);
            navManager = null;
        }

        active = false;
        currentRouteUid = null;
        currentWaypointIndex = -1;
        gpsLost = false;

        emitState();
    }

    public String getNavigationState() {
        try {
            return buildStateJson().toString();
        } catch (Exception e) {
            Log.e(TAG, "Error getting navigation state", e);
            return "{\"active\":false,\"routeUid\":null,\"currentWaypointIndex\":-1,\"gpsLost\":false}";
        }
    }

    private void emitState() {
        try {
            emitter.emit("navigationStateChanged", buildStateJson().toString());
        } catch (Exception e) {
            Log.e(TAG, "Error emitting navigation state", e);
        }
    }

    private JSONObject buildStateJson() throws Exception {
        JSONObject state = new JSONObject();
        state.put("active", active);
        state.put("routeUid", currentRouteUid != null ? currentRouteUid : JSONObject.NULL);
        state.put("currentWaypointIndex", currentWaypointIndex);
        state.put("gpsLost", gpsLost);
        return state;
    }
}
