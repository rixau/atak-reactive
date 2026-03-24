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

import com.atakmap.android.dropdown.DropDownReceiver;
import com.atakmap.android.navigation.views.NavView;
import com.atakmap.android.ipc.AtakBroadcast;
import android.content.Intent;

import com.atakmap.coremap.conversions.CoordinateFormat;
import com.atakmap.coremap.conversions.CoordinateFormatUtilities;

import com.atakmap.android.reactive.ReactiveDropDown;

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
    private final ShapeManager shapeManager;
    private final RouteManager routeManager;
    private final NavigationRelay navigationRelay;
    private final MapItemEventRelay relay;
    private final CotBridge cotBridge;
    private final IntentBridge intentBridge;
    private final MapGroupBridge mapGroupBridge;
    private final ContactBridge contactBridge;
    private final ChatBridge chatBridge;
    private final GeofenceBridge geofenceBridge;
    private ReactiveDropDown dropDown;

    public AtakBridge(MapView mapView, BridgeEventEmitter emitter) {
        this.mapView = mapView;
        this.emitter = emitter;
        this.markerManager = new MarkerManager(mapView);
        this.shapeManager = new ShapeManager(mapView);
        this.routeManager = new RouteManager(mapView);
        this.navigationRelay = new NavigationRelay(emitter);
        this.relay = new MapItemEventRelay(mapView, emitter);
        this.cotBridge = new CotBridge(emitter);
        this.intentBridge = new IntentBridge(emitter);
        this.mapGroupBridge = new MapGroupBridge(mapView);
        this.contactBridge = new ContactBridge(emitter);
        this.chatBridge = new ChatBridge(mapView, emitter);
        this.geofenceBridge = new GeofenceBridge(mapView, emitter);
        this.navigationRelay.start();
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
            return markerManager.addMarker(opts);
        } catch (JSONException e) {
            Log.e(TAG, "Error adding marker", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String setMarkerIcon(String uid, String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return String.valueOf(markerManager.setMarkerIcon(uid, opts));
        } catch (JSONException e) {
            Log.e(TAG, "Error setting marker icon", e);
            return "false";
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
    public String setPreference(String key, String value) {
        try {
            AtakPreferences.getInstance(mapView.getContext()).set(key, value);
            return "true";
        } catch (Exception e) {
            Log.e(TAG, "Error setting preference: " + key, e);
            return "false";
        }
    }

    @JavascriptInterface
    public String removePreference(String key) {
        try {
            AtakPreferences.getInstance(mapView.getContext()).remove(key);
            return "true";
        } catch (Exception e) {
            Log.e(TAG, "Error removing preference: " + key, e);
            return "false";
        }
    }

    // --- Dropdown sizing ---

    public void setDropDown(ReactiveDropDown dropDown) {
        this.dropDown = dropDown;
    }

    @JavascriptInterface
    public void setDropdownSize(String width, String height) {
        if (dropDown == null) return;
        double w = parseSizeFraction(width);
        double h = parseSizeFraction(height);
        if (w < 0 || h < 0) return;
        mapView.post(() -> dropDown.resize(w, h));
    }

    @JavascriptInterface
    public String getDropdownSize() {
        if (dropDown == null) return "{\"width\":0.5,\"height\":1.0}";
        try {
            JSONObject json = new JSONObject();
            json.put("width", dropDown.getDropDownWidth());
            json.put("height", dropDown.getDropDownHeight());
            return json.toString();
        } catch (JSONException e) {
            return "{\"width\":0.5,\"height\":1.0}";
        }
    }

    // --- Nav visibility ---

    @JavascriptInterface
    public void setNavVisible(boolean visible) {
        mapView.post(() -> {
            try {
                NavView nav = NavView.getInstance();
                if (nav != null && nav.buttonsVisible() != visible) {
                    AtakBroadcast.getInstance().sendBroadcast(
                            new Intent(NavView.TOGGLE_BUTTONS));
                }
            } catch (Exception e) {
                Log.e(TAG, "Error setting nav visibility", e);
            }
        });
    }

    @JavascriptInterface
    public String getNavVisible() {
        try {
            NavView nav = NavView.getInstance();
            if (nav == null) return "true";
            return String.valueOf(nav.buttonsVisible());
        } catch (Exception e) {
            return "true";
        }
    }

    private static double parseSizeFraction(String name) {
        if (name == null) return -1;
        switch (name) {
            case "third": return DropDownReceiver.THIRD_WIDTH;
            case "half":  return DropDownReceiver.HALF_WIDTH;
            case "full":  return DropDownReceiver.FULL_WIDTH;
            default:      return -1;
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
    public String setItemMeta(String uid, String key, String value) {
        MapItem item = mapView.getRootGroup().deepFindUID(uid);
        if (item == null) return "false";
        mapView.post(() -> {
            item.setMetaString(key, value);
            item.refresh(mapView.getMapEventDispatcher(), null, getClass());
        });
        return "true";
    }

    @JavascriptInterface
    public String setItemMetaDouble(String uid, String key, double value) {
        MapItem item = mapView.getRootGroup().deepFindUID(uid);
        if (item == null) return "false";
        mapView.post(() -> {
            item.setMetaDouble(key, value);
            item.refresh(mapView.getMapEventDispatcher(), null, getClass());
        });
        return "true";
    }

    @JavascriptInterface
    public String setItemMetaBool(String uid, String key, boolean value) {
        MapItem item = mapView.getRootGroup().deepFindUID(uid);
        if (item == null) return "false";
        mapView.post(() -> {
            item.setMetaBoolean(key, value);
            item.refresh(mapView.getMapEventDispatcher(), null, getClass());
        });
        return "true";
    }

    @JavascriptInterface
    public String getItemMeta(String uid, String key) {
        MapItem item = mapView.getRootGroup().deepFindUID(uid);
        if (item == null) return "null";
        String value = item.getMetaString(key, null);
        return value != null ? value : "null";
    }

    @JavascriptInterface
    public void startMapItemStream() {
        relay.start();
    }

    @JavascriptInterface
    public void stopMapItemStream() {
        relay.stop();
    }

    @JavascriptInterface
    public String toMGRS(double lat, double lng) {
        try {
            GeoPoint point = new GeoPoint(lat, lng);
            return CoordinateFormatUtilities.formatToString(point, CoordinateFormat.MGRS);
        } catch (Exception e) {
            Log.e(TAG, "Error converting to MGRS", e);
            return "";
        }
    }

    @JavascriptInterface
    public String toUTM(double lat, double lng) {
        try {
            GeoPoint point = new GeoPoint(lat, lng);
            return CoordinateFormatUtilities.formatToString(point, CoordinateFormat.UTM);
        } catch (Exception e) {
            Log.e(TAG, "Error converting to UTM", e);
            return "";
        }
    }

    @JavascriptInterface
    public String fromMGRS(String mgrs) {
        try {
            GeoPoint point = CoordinateFormatUtilities.convert(mgrs, CoordinateFormat.MGRS);
            if (point == null) return "null";
            JSONObject json = new JSONObject();
            json.put("lat", point.getLatitude());
            json.put("lng", point.getLongitude());
            return json.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error converting from MGRS", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String fromUTM(String utm) {
        try {
            GeoPoint point = CoordinateFormatUtilities.convert(utm, CoordinateFormat.UTM);
            if (point == null) return "null";
            JSONObject json = new JSONObject();
            json.put("lat", point.getLatitude());
            json.put("lng", point.getLongitude());
            return json.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error converting from UTM", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String getCoordinateFormat() {
        try {
            AtakPreferences prefs = AtakPreferences.getInstance(
                    mapView.getContext());
            return prefs.get("coordinateFormat", "dd");
        } catch (Exception e) {
            return "dd";
        }
    }

    @JavascriptInterface
    public String formatCoordinate(double lat, double lng) {
        try {
            GeoPoint point = new GeoPoint(lat, lng);
            String format = getCoordinateFormat();
            CoordinateFormat cf;
            switch (format) {
                case "mgrs": cf = CoordinateFormat.MGRS; break;
                case "utm": cf = CoordinateFormat.UTM; break;
                case "dm": cf = CoordinateFormat.DM; break;
                case "dms": cf = CoordinateFormat.DMS; break;
                default: cf = CoordinateFormat.DD; break;
            }
            return CoordinateFormatUtilities.formatToString(point, cf);
        } catch (Exception e) {
            return String.format("%.6f, %.6f", lat, lng);
        }
    }

    @JavascriptInterface
    public String distanceTo(double lat1, double lng1, double lat2, double lng2) {
        try {
            GeoPoint p1 = new GeoPoint(lat1, lng1);
            GeoPoint p2 = new GeoPoint(lat2, lng2);
            double distance = p1.distanceTo(p2);
            double bearing = p1.bearingTo(p2);
            JSONObject json = new JSONObject();
            json.put("distance", distance);
            json.put("bearing", bearing);
            return json.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error calculating distance", e);
            return "null";
        }
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

    // --- CoT delegation ---

    @JavascriptInterface
    public void startCotStream() {
        cotBridge.startCotStream();
    }

    @JavascriptInterface
    public void stopCotStream() {
        cotBridge.stopCotStream();
    }

    @JavascriptInterface
    public String sendCot(String cotJson, String dispatch) {
        return cotBridge.sendCot(cotJson, dispatch);
    }

    @JavascriptInterface
    public String sendCotToContacts(String cotJson, String contactUidsJson) {
        return cotBridge.sendCotToContacts(cotJson, contactUidsJson);
    }

    // --- Map group delegation ---

    @JavascriptInterface
    public String createMapGroup(String name, String parentName) {
        return String.valueOf(mapGroupBridge.createMapGroup(name, parentName));
    }

    @JavascriptInterface
    public String removeMapGroup(String name) {
        return String.valueOf(mapGroupBridge.removeMapGroup(name));
    }

    @JavascriptInterface
    public String setGroupVisible(String name, String visible) {
        return String.valueOf(mapGroupBridge.setGroupVisible(name,
                Boolean.parseBoolean(visible)));
    }

    // --- Intent delegation ---

    @JavascriptInterface
    public void registerAction(String action) {
        intentBridge.registerAction(action);
    }

    @JavascriptInterface
    public void unregisterAction(String action) {
        intentBridge.unregisterAction(action);
    }

    @JavascriptInterface
    public void sendBroadcast(String action, String extrasJson) {
        intentBridge.sendBroadcast(action, extrasJson);
    }

    // --- Shape delegation ---

    @JavascriptInterface
    public String addShape(String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return shapeManager.addShape(opts);
        } catch (JSONException e) {
            Log.e(TAG, "Error adding shape", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String addCircle(String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return shapeManager.addCircle(opts);
        } catch (JSONException e) {
            Log.e(TAG, "Error adding circle", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String addEllipse(String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return shapeManager.addEllipse(opts);
        } catch (JSONException e) {
            Log.e(TAG, "Error adding ellipse", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String addRectangle(String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return shapeManager.addRectangle(opts);
        } catch (JSONException e) {
            Log.e(TAG, "Error adding rectangle", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String updateShape(String uid, String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return String.valueOf(shapeManager.updateShape(uid, opts));
        } catch (JSONException e) {
            Log.e(TAG, "Error updating shape", e);
            return "false";
        }
    }

    @JavascriptInterface
    public String removeShape(String uid) {
        return String.valueOf(shapeManager.removeShape(uid));
    }

    @JavascriptInterface
    public String getPluginShapes() {
        try {
            JSONArray result = new JSONArray();
            List<String> uids = shapeManager.getManagedUids();
            for (String uid : uids) {
                MapItem item = mapView.getRootGroup().deepFindUID(uid);
                if (item != null) {
                    result.put(MapItemSerializer.serialize(item));
                }
            }
            return result.toString();
        } catch (JSONException e) {
            Log.e(TAG, "Error getting plugin shapes", e);
            return "[]";
        }
    }

    // --- Route delegation ---

    @JavascriptInterface
    public String addRoute(String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return routeManager.addRoute(opts);
        } catch (JSONException e) {
            Log.e(TAG, "Error adding route", e);
            return "null";
        }
    }

    @JavascriptInterface
    public String updateRoute(String uid, String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return String.valueOf(routeManager.updateRoute(uid, opts));
        } catch (JSONException e) {
            Log.e(TAG, "Error updating route", e);
            return "false";
        }
    }

    @JavascriptInterface
    public String addWaypoint(String routeUid, String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return String.valueOf(routeManager.addWaypoint(routeUid, opts));
        } catch (JSONException e) {
            Log.e(TAG, "Error adding waypoint", e);
            return "false";
        }
    }

    @JavascriptInterface
    public String removeWaypoint(String routeUid, String waypointUid) {
        return String.valueOf(routeManager.removeWaypoint(routeUid, waypointUid));
    }

    @JavascriptInterface
    public String removeRoute(String uid) {
        return String.valueOf(routeManager.removeRoute(uid));
    }

    @JavascriptInterface
    public String getPluginRoutes() {
        try {
            JSONArray result = new JSONArray();
            List<String> uids = routeManager.getManagedUids();
            for (String uid : uids) {
                MapItem item = mapView.getRootGroup().deepFindUID(uid);
                if (item != null) {
                    result.put(MapItemSerializer.serialize(item));
                }
            }
            return result.toString();
        } catch (JSONException e) {
            Log.e(TAG, "Error getting plugin routes", e);
            return "[]";
        }
    }

    // --- Navigation delegation ---

    @JavascriptInterface
    public String startNavigation(String routeUid, String optionsJson) {
        try {
            JSONObject opts = new JSONObject(optionsJson);
            return String.valueOf(routeManager.startNavigation(routeUid, opts));
        } catch (JSONException e) {
            Log.e(TAG, "Error starting navigation", e);
            return "false";
        }
    }

    @JavascriptInterface
    public String stopNavigation() {
        return String.valueOf(routeManager.stopNavigation());
    }

    @JavascriptInterface
    public String getNavigationState() {
        return navigationRelay.getNavigationState();
    }

    // --- Contact delegation ---

    @JavascriptInterface
    public void subscribeContacts() {
        contactBridge.start();
    }

    @JavascriptInterface
    public void unsubscribeContacts() {
        contactBridge.stop();
    }

    // --- Chat delegation ---

    @JavascriptInterface
    public void subscribeChat() {
        chatBridge.start();
    }

    @JavascriptInterface
    public void unsubscribeChat() {
        chatBridge.stop();
    }

    @JavascriptInterface
    public void sendChatMessage(String conversationId, String text) {
        chatBridge.sendMessage(conversationId, text);
    }

    @JavascriptInterface
    public String getChatHistory(String conversationId, int limit) {
        return chatBridge.getHistory(conversationId, limit);
    }

    @JavascriptInterface
    public String getConversations() {
        return chatBridge.getConversations();
    }

    @JavascriptInterface
    public void openConversation(String contactUid) {
        chatBridge.openConversation(contactUid);
    }

    // --- Geofence delegation ---

    @JavascriptInterface
    public String createGeofence(String optionsJson) {
        return geofenceBridge.createGeofence(optionsJson);
    }

    @JavascriptInterface
    public void removeGeofence(String shapeUid) {
        geofenceBridge.removeGeofence(shapeUid);
    }

    @JavascriptInterface
    public void dismissGeofenceAlert(String fenceUid, String itemUid) {
        geofenceBridge.dismissGeofenceAlert(fenceUid, itemUid);
    }

    public void dispose() {
        markerManager.removeAll();
        shapeManager.removeAll();
        routeManager.removeAll();
        navigationRelay.stop();
        contactBridge.stop();
        chatBridge.stop();
        geofenceBridge.stop();
        relay.dispose();
        cotBridge.dispose();
        intentBridge.dispose();
        mapGroupBridge.dispose();
    }
}
