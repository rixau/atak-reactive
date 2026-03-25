package com.atakmap.android.reactive.bridge;

import android.graphics.Color;

import com.atakmap.android.drawing.mapItems.DrawingCircle;
import com.atakmap.android.drawing.mapItems.DrawingRectangle;
import com.atakmap.android.drawing.mapItems.DrawingShape;
import com.atakmap.android.drawing.mapItems.DrawingEllipse;
import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.maps.Polyline;
import com.atakmap.android.maps.Shape;
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

public class ShapeManager {

    private static final String TAG = "ShapeManager";

    private final MapView mapView;
    private final Map<String, MapItem> managedShapes = new ConcurrentHashMap<>();

    public ShapeManager(MapView mapView) {
        this.mapView = mapView;
    }

    public String addShape(JSONObject opts) {
        try {
            String uid = opts.optString("uid", UUID.randomUUID().toString());
            String title = opts.optString("title", "Shape");
            boolean closed = opts.optBoolean("closed", true);
            boolean editable = opts.optBoolean("editable", true);
            boolean archive = opts.optBoolean("archive", true);
            int strokeColor = MapItemSerializer.hexToColor(opts.optString("strokeColor", "#FFFF0000"));
            int fillColor = MapItemSerializer.hexToColor(opts.optString("fillColor", "#33FF0000"));
            double strokeWeight = opts.optDouble("strokeWeight", 1.0);

            JSONArray pointsArr = opts.optJSONArray("points");
            if (pointsArr == null || pointsArr.length() == 0) {
                Log.w(TAG, "addShape: empty points array");
                return "null";
            }
            GeoPoint[] points = parsePoints(pointsArr);

            final DrawingShape shape = new DrawingShape(mapView, uid);
            shape.setPoints(points);
            shape.setClosed(closed);
            shape.setStrokeColor(strokeColor);
            shape.setFillColor(fillColor);
            shape.setStrokeWeight(strokeWeight);
            shape.setTitle(title);
            shape.setMetaBoolean("editable", editable);
            shape.setMetaBoolean("archive", archive);
            shape.setMetaBoolean("removable", true);
            shape.setMetaBoolean("movable", true);
            shape.setMetaString("entry", "user");

            mapView.post(() -> {
                MapGroup group = resolveDrawingGroup();
                group.addItem(shape);
                if (archive) {
                    shape.persist(mapView.getMapEventDispatcher(), null, ShapeManager.class);
                }
            });

            managedShapes.put(uid, shape);
            Log.d(TAG, "Added shape: " + uid + " (" + title + ")");
            return uid;
        } catch (Exception e) {
            Log.e(TAG, "Error adding shape", e);
            return "null";
        }
    }

    public String addCircle(JSONObject opts) {
        try {
            String uid = opts.optString("uid", UUID.randomUUID().toString());
            String title = opts.optString("title", "Circle");
            double radius = opts.optDouble("radius", 0);
            int rings = opts.optInt("rings", 1);
            boolean editable = opts.optBoolean("editable", true);
            boolean archive = opts.optBoolean("archive", true);
            int strokeColor = MapItemSerializer.hexToColor(opts.optString("strokeColor", "#FFFF0000"));
            int fillColor = MapItemSerializer.hexToColor(opts.optString("fillColor", "#33000000"));

            JSONObject centerObj = opts.optJSONObject("center");
            if (centerObj == null || radius <= 0) {
                Log.w(TAG, "addCircle: invalid center or radius");
                return "null";
            }
            GeoPoint center = new GeoPoint(
                    centerObj.optDouble("lat"), centerObj.optDouble("lng"));

            final DrawingCircle circle = new DrawingCircle(mapView, uid);
            circle.setCenterPoint(GeoPointMetaData.wrap(center));
            circle.setRadius(radius);
            circle.setColor(strokeColor);
            circle.setFillColor(fillColor);
            circle.setTitle(title);
            if (rings > 1) {
                circle.setNumRings(rings);
            }
            circle.setMetaBoolean("editable", editable);
            circle.setMetaBoolean("archive", archive);
            circle.setMetaBoolean("removable", true);
            circle.setMetaString("entry", "user");

            mapView.post(() -> {
                MapGroup group = resolveDrawingGroup();
                group.addItem(circle);
                if (archive) {
                    circle.persist(mapView.getMapEventDispatcher(), null, ShapeManager.class);
                }
            });

            managedShapes.put(uid, circle);
            Log.d(TAG, "Added circle: " + uid + " (" + title + ")");
            return uid;
        } catch (Exception e) {
            Log.e(TAG, "Error adding circle", e);
            return "null";
        }
    }

    public String addEllipse(JSONObject opts) {
        try {
            String uid = opts.optString("uid", UUID.randomUUID().toString());
            String title = opts.optString("title", "Ellipse");
            double width = opts.optDouble("width", 0);
            double length = opts.optDouble("length", 0);
            double angle = opts.optDouble("angle", 0);
            boolean editable = opts.optBoolean("editable", true);
            boolean archive = opts.optBoolean("archive", true);
            int strokeColor = MapItemSerializer.hexToColor(opts.optString("strokeColor", "#FF00FF00"));
            int fillColor = MapItemSerializer.hexToColor(opts.optString("fillColor", "#33FFFF00"));

            JSONObject centerObj = opts.optJSONObject("center");
            if (centerObj == null || width <= 0 || length <= 0) {
                Log.w(TAG, "addEllipse: invalid center, width, or length");
                return "null";
            }
            GeoPoint center = new GeoPoint(
                    centerObj.optDouble("lat"), centerObj.optDouble("lng"));

            final DrawingEllipse ellipse = new DrawingEllipse(mapView, uid);
            ellipse.setCenterPoint(GeoPointMetaData.wrap(center));
            ellipse.setWidth(width);
            ellipse.setLength(length);
            ellipse.setAngle(angle);
            ellipse.setColor(strokeColor);
            ellipse.setFillColor(fillColor);
            ellipse.setTitle(title);
            ellipse.setMetaBoolean("editable", editable);
            ellipse.setMetaBoolean("archive", archive);
            ellipse.setMetaBoolean("removable", true);
            ellipse.setMetaString("entry", "user");

            mapView.post(() -> {
                MapGroup group = resolveDrawingGroup();
                group.addItem(ellipse);
                if (archive) {
                    ellipse.persist(mapView.getMapEventDispatcher(), null, ShapeManager.class);
                }
            });

            managedShapes.put(uid, ellipse);
            Log.d(TAG, "Added ellipse: " + uid + " (" + title + ")");
            return uid;
        } catch (Exception e) {
            Log.e(TAG, "Error adding ellipse", e);
            return "null";
        }
    }

    public String addRectangle(JSONObject opts) {
        try {
            String uid = opts.optString("uid", UUID.randomUUID().toString());
            String title = opts.optString("title", "Rectangle");
            boolean editable = opts.optBoolean("editable", true);
            boolean archive = opts.optBoolean("archive", true);
            int strokeColor = MapItemSerializer.hexToColor(opts.optString("strokeColor", "#FFFFFFFF"));
            int fillColor = MapItemSerializer.hexToColor(opts.optString("fillColor", "#00000000"));

            JSONArray pointsArr = opts.optJSONArray("points");
            if (pointsArr == null || pointsArr.length() != 4) {
                Log.w(TAG, "addRectangle: requires exactly 4 corner points");
                return "null";
            }

            GeoPointMetaData[] corners = new GeoPointMetaData[4];
            for (int i = 0; i < 4; i++) {
                JSONObject pt = pointsArr.getJSONObject(i);
                corners[i] = GeoPointMetaData.wrap(
                        new GeoPoint(pt.optDouble("lat"), pt.optDouble("lng")));
            }

            MapGroup doGroup = resolveDrawingGroup();
            MapGroup childGroup = doGroup.addGroup(title);

            final DrawingRectangle rect = new DrawingRectangle(childGroup,
                    corners[0], corners[1], corners[2], corners[3], uid);
            rect.setStrokeColor(strokeColor);
            rect.setFillColor(fillColor);
            rect.setTitle(title);
            rect.setMetaString("shape_name", title);
            rect.setMetaBoolean("editable", editable);
            rect.setMetaBoolean("archive", archive);
            rect.setMetaBoolean("removable", true);
            rect.setMetaString("entry", "user");

            mapView.post(() -> {
                doGroup.addItem(rect);
                if (archive) {
                    rect.persist(mapView.getMapEventDispatcher(), null, ShapeManager.class);
                }
            });

            managedShapes.put(uid, rect);
            Log.d(TAG, "Added rectangle: " + uid + " (" + title + ")");
            return uid;
        } catch (Exception e) {
            Log.e(TAG, "Error adding rectangle", e);
            return "null";
        }
    }

    public boolean updateShape(String uid, JSONObject opts) {
        MapItem item = findShape(uid);
        if (item == null) return false;

        mapView.post(() -> {
            try {
                // Style updates (common to all shapes)
                if (item instanceof Shape) {
                    Shape shape = (Shape) item;
                    if (opts.has("strokeColor")) {
                        shape.setStrokeColor(MapItemSerializer.hexToColor(opts.optString("strokeColor")));
                    }
                    if (opts.has("fillColor")) {
                        shape.setFillColor(MapItemSerializer.hexToColor(opts.optString("fillColor")));
                    }
                    if (opts.has("strokeWeight")) {
                        shape.setStrokeWeight(opts.optDouble("strokeWeight"));
                    }
                }
                if (opts.has("title")) {
                    item.setTitle(opts.optString("title"));
                }

                // Polyline-specific (DrawingShape, polygon/polyline)
                if (item instanceof DrawingShape) {
                    DrawingShape ds = (DrawingShape) item;
                    if (opts.has("points")) {
                        GeoPoint[] pts = parsePoints(opts.getJSONArray("points"));
                        ds.setPoints(pts);
                    }
                    if (opts.has("closed")) {
                        ds.setClosed(opts.optBoolean("closed"));
                    }
                }

                // Circle-specific
                if (item instanceof DrawingCircle) {
                    DrawingCircle dc = (DrawingCircle) item;
                    if (opts.has("center")) {
                        JSONObject c = opts.getJSONObject("center");
                        dc.setCenterPoint(GeoPointMetaData.wrap(
                                new GeoPoint(c.optDouble("lat"), c.optDouble("lng"))));
                    }
                    if (opts.has("radius")) {
                        dc.setRadius(opts.optDouble("radius"));
                    }
                    if (opts.has("rings")) {
                        dc.setNumRings(opts.optInt("rings"));
                    }
                }

                // Ellipse-specific
                if (item instanceof DrawingEllipse) {
                    DrawingEllipse e = (DrawingEllipse) item;
                    if (opts.has("center")) {
                        JSONObject c = opts.getJSONObject("center");
                        e.setCenterPoint(GeoPointMetaData.wrap(
                                new GeoPoint(c.optDouble("lat"), c.optDouble("lng"))));
                    }
                    if (opts.has("width")) {
                        e.setWidth(opts.optDouble("width"));
                    }
                    if (opts.has("length")) {
                        e.setLength(opts.optDouble("length"));
                    }
                    if (opts.has("angle")) {
                        e.setAngle(opts.optDouble("angle"));
                    }
                }

                // Rectangle-specific
                if (item instanceof DrawingRectangle) {
                    DrawingRectangle dr = (DrawingRectangle) item;
                    if (opts.has("points")) {
                        JSONArray arr = opts.getJSONArray("points");
                        if (arr.length() == 4) {
                            GeoPointMetaData[] corners = new GeoPointMetaData[4];
                            for (int i = 0; i < 4; i++) {
                                JSONObject pt = arr.getJSONObject(i);
                                corners[i] = GeoPointMetaData.wrap(
                                        new GeoPoint(pt.optDouble("lat"), pt.optDouble("lng")));
                            }
                            dr.setPoints(corners[0], corners[1], corners[2], corners[3]);
                        }
                    }
                }

                item.refresh(mapView.getMapEventDispatcher(), null, ShapeManager.class);
            } catch (Exception e) {
                Log.e(TAG, "Error updating shape: " + uid, e);
            }
        });

        return true;
    }

    public boolean removeShape(String uid) {
        MapItem item = managedShapes.remove(uid);
        if (item == null) {
            item = mapView.getRootGroup().deepFindUID(uid);
        }
        if (item == null) return false;

        final MapItem toRemove = item;
        mapView.post(() -> {
            try {
                MapGroup parent = toRemove.getGroup();
                if (parent != null) {
                    parent.removeItem(toRemove);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error removing shape: " + uid, e);
            }
        });

        return true;
    }

    public List<String> getManagedUids() {
        return new ArrayList<>(managedShapes.keySet());
    }

    public void removeAll() {
        for (Map.Entry<String, MapItem> entry : managedShapes.entrySet()) {
            MapItem item = entry.getValue();
            mapView.post(() -> {
                MapGroup parent = item.getGroup();
                if (parent != null) {
                    parent.removeItem(item);
                }
            });
        }
        managedShapes.clear();
    }

    private MapItem findShape(String uid) {
        MapItem item = managedShapes.get(uid);
        if (item != null) return item;

        item = mapView.getRootGroup().deepFindUID(uid);
        if (item instanceof Shape) return item;
        return null;
    }

    private MapGroup resolveDrawingGroup() {
        MapGroup doGroup = mapView.getRootGroup().findMapGroup("Drawing Objects");
        if (doGroup != null) return doGroup;
        return mapView.getRootGroup();
    }

    private static GeoPoint[] parsePoints(JSONArray arr) throws Exception {
        GeoPoint[] points = new GeoPoint[arr.length()];
        for (int i = 0; i < arr.length(); i++) {
            JSONObject pt = arr.getJSONObject(i);
            double lat = pt.optDouble("lat");
            double lng = pt.optDouble("lng");
            double alt = pt.optDouble("alt", GeoPoint.UNKNOWN);
            points[i] = new GeoPoint(lat, lng, alt);
        }
        return points;
    }
}
