package com.atakmap.android.reactive.bridge;

import com.atakmap.android.maps.Icon;
import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.Marker;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.android.maps.Polyline;
import com.atakmap.android.maps.Shape;
import com.atakmap.android.drawing.DrawingCircle;
import com.atakmap.android.maps.Ellipse;
import com.atakmap.android.routes.Route;
import com.atakmap.coremap.maps.coords.GeoPoint;
import com.atakmap.coremap.maps.coords.GeoPointMetaData;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class MapItemSerializer {

    public static JSONObject serialize(MapItem item) throws JSONException {
        JSONObject json = new JSONObject();
        json.put("uid", item.getUID());
        json.put("type", item.getType());
        json.put("title", item.getTitle());
        json.put("visible", item.getVisible());

        MapGroup group = item.getGroup();
        json.put("group", group != null ? group.getFriendlyName() : JSONObject.NULL);

        if (item instanceof PointMapItem) {
            GeoPoint point = ((PointMapItem) item).getPoint();
            json.put("lat", safeDouble(point.getLatitude()));
            json.put("lng", safeDouble(point.getLongitude()));
            json.put("alt", safeDouble(point.getAltitude()));
        } else {
            json.put("lat", JSONObject.NULL);
            json.put("lng", JSONObject.NULL);
            json.put("alt", JSONObject.NULL);
        }

        json.put("callsign", item.getMetaString("callsign", ""));
        json.put("team", item.getMetaString("team", ""));
        json.put("how", item.getMetaString("how", ""));
        json.put("remarks", item.getMetaString("remarks", ""));
        json.put("editable", item.getMetaBoolean("editable", false));
        json.put("movable", item.getMetaBoolean("movable", false));
        json.put("speed", safeDouble(item.getMetaDouble("Speed.value", 0)));
        json.put("bearing", safeDouble(item.getMetaDouble("Speed.heading", 0)));

        if (item instanceof Marker) {
            Icon icon = ((Marker) item).getIcon();
            if (icon != null) {
                String iconUri = icon.getImageUri(Icon.STATE_DEFAULT);
                json.put("iconUri", iconUri != null ? iconUri : JSONObject.NULL);
            } else {
                json.put("iconUri", JSONObject.NULL);
            }
        } else {
            json.put("iconUri", JSONObject.NULL);
        }

        // Shape-specific fields
        if (item instanceof Shape) {
            Shape shape = (Shape) item;
            json.put("strokeColor", colorToHex(shape.getStrokeColor()));
            json.put("fillColor", colorToHex(shape.getFillColor()));
            json.put("strokeWeight", shape.getStrokeWeight());
        }
        if (item instanceof Polyline) {
            Polyline p = (Polyline) item;
            GeoPointMetaData[] pointsMeta = p.getMetaDataPoints();
            JSONArray pts = new JSONArray();
            if (pointsMeta != null) {
                for (GeoPointMetaData gpm : pointsMeta) {
                    GeoPoint gp = gpm.get();
                    JSONObject pt = new JSONObject();
                    pt.put("lat", safeDouble(gp.getLatitude()));
                    pt.put("lng", safeDouble(gp.getLongitude()));
                    if (gp.isAltitudeValid()) {
                        pt.put("alt", safeDouble(gp.getAltitude()));
                    }
                    pts.put(pt);
                }
            }
            json.put("points", pts);
            json.put("closed", (p.getStyle() & Polyline.STYLE_CLOSED_MASK) != 0);
        }
        if (item instanceof DrawingCircle) {
            DrawingCircle c = (DrawingCircle) item;
            json.put("radius", c.getRadius());
            json.put("rings", c.getNumRings());
        }
        if (item instanceof Ellipse) {
            Ellipse e = (Ellipse) item;
            json.put("width", e.getWidth());
            json.put("length", e.getLength());
            json.put("angle", e.getAngle());
        }
        if (item instanceof Route) {
            Route r = (Route) item;
            json.put("routeMethod", r.getRouteMethod());
            json.put("routeDirection", r.getRouteDirection());
            json.put("routeType", r.getRouteType());
        }

        return json;
    }

    private static Object safeDouble(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return JSONObject.NULL;
        }
        return value;
    }

    public static String colorToHex(int color) {
        return String.format("#%08X", color);
    }

    public static int hexToColor(String hex) {
        if (hex == null || hex.isEmpty()) return 0;
        if (hex.charAt(0) == '#') hex = hex.substring(1);
        if (hex.length() == 6) {
            // #RRGGBB -> alpha FF
            return (int) (0xFF000000L | Long.parseLong(hex, 16));
        } else if (hex.length() == 8) {
            // #AARRGGBB
            return (int) Long.parseLong(hex, 16);
        }
        return 0;
    }
}
