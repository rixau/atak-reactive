package com.atakmap.android.reactive;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The custom bridges registered on one ReactiveDropDown or ReactiveWebView, by
 * JS name, in registration order.
 *
 * WebView.addJavascriptInterface silently replaces an object already injected
 * under the same name, so every name is checked here first: a name taken by
 * another bridge on the same view, or the built-in {@code _atak}, is refused
 * with an exception rather than shadowing what is already there (#81). The
 * view re-registers exactly these entries, after {@code _atak}, whenever it
 * builds a WebView.
 *
 * No Android dependencies, so it can be unit tested on the JVM. Not thread
 * safe: the views use it from the UI thread.
 */
final class BridgeRegistry {

    /** The name of the built-in bridge, {@code window._atak}. */
    static final String RESERVED_NAME = "atak";

    private static final Pattern VALID_NAME = Pattern.compile("[A-Za-z][A-Za-z0-9_]*");

    /** JS name ("_" + name) to bridge, in registration order. */
    private final Map<String, Object> bridges = new LinkedHashMap<>();

    /** The JS global a bridge registered under {@code name} is reachable as. */
    static String jsName(String name) {
        return "_" + name;
    }

    /**
     * The name the deprecated addBridge(Object) has always used: the class's
     * simple name with its first letter lower-cased. The package is ignored, and
     * a minified build renames the class, so this is not stable.
     */
    static String derivedName(Object bridge) {
        if (bridge == null) {
            throw new IllegalArgumentException("Bridge must not be null");
        }
        String simple = bridge.getClass().getSimpleName();
        if (simple.isEmpty()) {
            // Anonymous classes have no simple name.
            return simple;
        }
        return simple.substring(0, 1).toLowerCase(java.util.Locale.ROOT) + simple.substring(1);
    }

    /** Throws unless {@code name} is a usable bridge name. */
    static void validateName(String name) {
        if (name == null) {
            throw new IllegalArgumentException("Bridge name must not be null");
        }
        if (!VALID_NAME.matcher(name).matches()) {
            throw new IllegalArgumentException("Invalid bridge name \"" + name
                    + "\": it must start with a letter and contain only letters,"
                    + " digits and underscores");
        }
    }

    /**
     * Record {@code bridge} under {@code name}.
     *
     * @return the JS name, {@code "_" + name}
     * @throws IllegalArgumentException if the bridge is null, the name is
     *         invalid or reserved, or another bridge on this view already has it
     */
    String add(String name, Object bridge) {
        if (bridge == null) {
            throw new IllegalArgumentException("Bridge must not be null");
        }
        validateName(name);
        String js = jsName(name);
        if (RESERVED_NAME.equals(name)) {
            throw new IllegalArgumentException("Bridge name \"" + js
                    + "\" is reserved for the built-in atak-reactive bridge; cannot register "
                    + bridge.getClass().getName() + " under it. Pass a different name to"
                    + " addBridge(String, Object).");
        }
        Object existing = bridges.get(js);
        if (existing != null) {
            throw new IllegalArgumentException("Bridge name \"" + js
                    + "\" is already used by " + existing.getClass().getName()
                    + "; cannot also register " + bridge.getClass().getName()
                    + ". Give each bridge a distinct name with addBridge(String, Object).");
        }
        bridges.put(js, bridge);
        return js;
    }

    /** JS name to bridge, in registration order. Read-only view. */
    Map<String, Object> entries() {
        return Collections.unmodifiableMap(bridges);
    }
}
