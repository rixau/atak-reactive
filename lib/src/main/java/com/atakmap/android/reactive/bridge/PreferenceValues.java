package com.atakmap.android.reactive.bridge;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collection;

/**
 * Serializes ATAK preference values for the bridge.
 *
 * ATAK stores preferences as String, Boolean, Integer, Long, Float and
 * Set&lt;String&gt;. The bridge's contract is narrower: every preference
 * crosses as a string (or null when absent), which is what getPreference,
 * usePreference and the preferenceChanged event all promise on the JS side.
 * Reading every key through the String getter threw a ClassCastException on
 * each non-string one — a stack trace in the log on every plugin load, and
 * null delivered to JS in place of the value.
 *
 * Both preference listeners and AtakBridge.getPreference go through here so
 * the three cannot drift apart again.
 */
public final class PreferenceValues {

    private PreferenceValues() {
    }

    /**
     * @param raw the value as stored, i.e. straight out of
     *            {@code SharedPreferences.getAll()}
     * @return the value as the bridge reports it: numbers and booleans in their
     *         decimal/true-false form, a string set as a JSON array, null when
     *         the key is absent
     */
    public static String toBridgeString(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Collection) {
            return new JSONArray((Collection<?>) raw).toString();
        }
        return String.valueOf(raw);
    }

    /**
     * The {@code preferenceChanged} payload: {@code {"key":..., "value":...}}.
     *
     * The payload is pasted into JavaScript source by BridgeEventEmitter.emit,
     * so it must be built by a real JSON encoder: the hand-rolled version only
     * escaped double quotes, which let a value containing a backslash break the
     * script — or, with a little care, run code in the WebView.
     */
    public static String changedPayload(String key, Object raw) {
        String value = toBridgeString(raw);
        JSONObject payload = new JSONObject();
        try {
            payload.put("key", key);
            payload.put("value", value == null ? JSONObject.NULL : value);
        } catch (JSONException e) {
            // Only thrown for a null key or a non-finite number; neither can
            // reach here.
            throw new IllegalStateException(e);
        }
        return escapeLineSeparators(payload.toString());
    }

    /**
     * org.json leaves U+2028 and U+2029 unescaped. They are legal JSON, and
     * legal inside JavaScript string literals since ES2019, but older WebViews
     * treat them as line terminators and fail to parse the script. Escaping
     * them is harmless everywhere.
     */
    static String escapeLineSeparators(String json) {
        return json.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029");
    }
}
