package com.atakmap.android.reactive.bridge;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

public class PreferenceValuesTest {

    // --- toBridgeString: one case per type SharedPreferences can store ---

    @Test
    public void stringPassesThrough() throws Exception {
        assertEquals("meters", PreferenceValues.toBridgeString("meters"));
    }

    @Test
    public void booleanBecomesTrueOrFalse() throws Exception {
        assertEquals("true", PreferenceValues.toBridgeString(Boolean.TRUE));
        assertEquals("false", PreferenceValues.toBridgeString(Boolean.FALSE));
    }

    @Test
    public void integerAndLongBecomeDecimal() throws Exception {
        assertEquals("42", PreferenceValues.toBridgeString(42));
        assertEquals("-9000000000", PreferenceValues.toBridgeString(-9000000000L));
    }

    @Test
    public void floatBecomesDecimal() throws Exception {
        assertEquals("1.5", PreferenceValues.toBridgeString(1.5f));
    }

    @Test
    public void stringSetBecomesJsonArray() throws Exception {
        Set<String> set = new LinkedHashSet<>(Arrays.asList("a", "b\"c"));
        JSONArray parsed = new JSONArray(PreferenceValues.toBridgeString(set));
        assertEquals(2, parsed.length());
        assertEquals("a", parsed.getString(0));
        assertEquals("b\"c", parsed.getString(1));
    }

    @Test
    public void absentIsNull() throws Exception {
        assertNull(PreferenceValues.toBridgeString(null));
    }

    // --- changedPayload: the shape the SDK's preferenceChanged handler reads ---

    @Test
    public void payloadCarriesKeyAndStringValue() throws Exception {
        JSONObject p = new JSONObject(
                PreferenceValues.changedPayload("unit", "feet"));
        assertEquals("unit", p.getString("key"));
        assertEquals("feet", p.getString("value"));
    }

    @Test
    public void payloadCarriesBooleanAsString() throws Exception {
        JSONObject p = new JSONObject(
                PreferenceValues.changedPayload("shouldLoad-x", Boolean.TRUE));
        assertEquals("true", p.get("value"));
    }

    @Test
    public void payloadCarriesAbsentAsJsonNull() throws Exception {
        JSONObject p = new JSONObject(
                PreferenceValues.changedPayload("gone", null));
        assertTrue(p.has("value"));
        assertTrue(p.isNull("value"));
    }

    // The payload is evaluated as JavaScript source, so every character that
    // could end the string literal, the object, or the line must round-trip.
    @Test
    public void payloadRoundTripsHostileCharacters() throws Exception {
        String hostile = "a\\\"+alert(1)})//\n\r\t\u0000  '`</script>";
        String json = PreferenceValues.changedPayload("k\"ey\\", hostile);

        JSONObject p = new JSONObject(json);
        assertEquals("k\"ey\\", p.getString("key"));
        assertEquals(hostile, p.getString("value"));

        // Nothing that terminates a JS string or statement survives unescaped.
        assertFalse(json.contains("\n"));
        assertFalse(json.contains("\r"));
        assertFalse(json.contains(" "));
        assertFalse(json.contains(" "));
        assertFalse(json.contains("\u0000"));
    }
}
