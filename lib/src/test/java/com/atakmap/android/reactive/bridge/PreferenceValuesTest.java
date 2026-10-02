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
        // These two cannot fail here: the JVM org.json escapes U+2028/U+2029
        // by itself. Android's does not, so on a device escapeLineSeparators is
        // the only thing that removes them - see the tests below.
        assertFalse(json.contains(" "));
        assertFalse(json.contains(" "));
        assertFalse(json.contains("\u0000"));
    }

    // --- escapeLineSeparators, tested directly ---
    //
    // The JVM and Android ship different org.json implementations. The one these
    // tests run against (org.json:json) escapes U+2000-U+20FF on its own, so a
    // check on changedPayload's output passes even with escapeLineSeparators
    // deleted. Android's built-in org.json leaves U+2028/U+2029 raw, and an older
    // WebView (minSdk is 21) treats them as line terminators: the script fails to
    // parse and the event is dropped silently. Only a direct test of the helper
    // can catch a regression in it.

    @Test
    public void escapesLineSeparator() throws Exception {
        assertEquals("\"a\\u2028b\"",
                PreferenceValues.escapeLineSeparators("\"a\u2028b\""));
    }

    @Test
    public void escapesParagraphSeparator() throws Exception {
        assertEquals("\"a\\u2029b\"",
                PreferenceValues.escapeLineSeparators("\"a\u2029b\""));
    }

    @Test
    public void escapesEveryOccurrence() throws Exception {
        assertEquals("\\u2028\\u2029\\u2028",
                PreferenceValues.escapeLineSeparators("\u2028\u2029\u2028"));
    }

    @Test
    public void leavesOtherTextAlone() throws Exception {
        // Already-escaped separators and ordinary escapes pass through as they are.
        String json = "{\"key\":\"k\",\"value\":\"a\\u2028 \\n\\\"\"}";
        assertEquals(json, PreferenceValues.escapeLineSeparators(json));
    }
}
