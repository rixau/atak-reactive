package com.atakmap.android.reactive.bridge;

import com.atakmap.android.maps.Icon;
import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.Marker;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.coremap.maps.coords.GeoPoint;

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

        return json;
    }

    private static Object safeDouble(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return JSONObject.NULL;
        }
        return value;
    }
}
