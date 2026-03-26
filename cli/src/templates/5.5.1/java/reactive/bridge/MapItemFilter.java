package com.atakmap.android.reactive.bridge;

import com.atakmap.android.maps.MapGroup;
import com.atakmap.android.maps.MapItem;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

public class MapItemFilter {

    private final String typePattern;
    private final String group;
    private final Boolean visible;
    private final JSONObject meta;

    public MapItemFilter(String filterJson) throws JSONException {
        if (filterJson == null || filterJson.isEmpty() || filterJson.equals("null")) {
            typePattern = null;
            group = null;
            visible = null;
            meta = null;
            return;
        }

        JSONObject json = new JSONObject(filterJson);
        typePattern = json.optString("type", null);
        group = json.optString("group", null);
        visible = json.has("visible") ? json.getBoolean("visible") : null;
        meta = json.has("meta") ? json.getJSONObject("meta") : null;
    }

    public boolean matches(MapItem item) {
        if (typePattern != null && !matchesType(item.getType())) {
            return false;
        }

        if (group != null) {
            MapGroup itemGroup = item.getGroup();
            if (itemGroup == null || !group.equals(itemGroup.getFriendlyName())) {
                return false;
            }
        }

        if (visible != null && item.getVisible() != visible) {
            return false;
        }

        if (meta != null) {
            Iterator<String> keys = meta.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String expected = meta.optString(key, "");
                String actual = item.getMetaString(key, "");
                if (!expected.equals(actual)) {
                    return false;
                }
            }
        }

        return true;
    }

    private boolean matchesType(String itemType) {
        if (itemType == null) return false;
        if (typePattern.endsWith("*")) {
            String prefix = typePattern.substring(0, typePattern.length() - 1);
            return itemType.startsWith(prefix);
        }
        return typePattern.equals(itemType);
    }

    public boolean isPassAll() {
        return typePattern == null && group == null && visible == null && meta == null;
    }
}
