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

    /** Wanted for the bridge's whole life; paused while the host is detached. Guarded by {@code this}. */
    private final ListenerState state = new ListenerState();

    public synchronized void start() {
        apply(state.setWanted(true));
    }

    public synchronized void stop() {
        apply(state.setWanted(false));
    }

    /**
     * Unregister from RouteNavigator while the host is detached. Nothing is
     * sent meanwhile; the state is re-read and sent on resume.
     */
    public synchronized void pause() {
        apply(state.pause());
    }

    /**
     * Re-read the navigation state, register again, and send it — whether or
     * not it changed while paused, so the page converges on the current state
     * without having to ask.
     */
    public synchronized void resume() {
        apply(state.resume());
    }

    private void apply(ListenerState.Change change) {
        switch (change) {
            case START:
                startListening();
                break;
            case STOP:
                stopListening();
                break;
            default:
                break;
        }
    }

    private void startListening() {
        RouteNavigator nav = RouteNavigator.getInstance();
        if (nav == null) return;
        nav.registerRouteNavigatorListener(this);
        // Navigation may have started, stopped, or moved on while nothing was
        // listening, so the cached fields are rebuilt from RouteNavigator
        // rather than trusted.
        Route route = nav.isNavigating() ? nav.getRoute() : null;
        if (route != null) {
            boolean sameRoute = route.getUID().equals(currentRouteUid);
            active = true;
            currentRouteUid = route.getUID();
            if (!sameRoute) {
                currentWaypointIndex = 0;
                gpsLost = false;
            }
            registerManagerListener(nav);
            syncWaypointIndex(nav);
        } else {
            active = false;
            currentRouteUid = null;
            currentWaypointIndex = -1;
            gpsLost = false;
        }
        emitState();
    }

    private void stopListening() {
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

    public synchronized void dispose() {
        apply(state.dispose());
        active = false;
        currentRouteUid = null;
    }
}
