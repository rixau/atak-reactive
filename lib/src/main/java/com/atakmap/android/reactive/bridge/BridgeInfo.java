package com.atakmap.android.reactive.bridge;

/**
 * Build-time identity of this bridge, resolved reflectively from the :bridge
 * module's generated BuildConfig.
 *
 * Reflection rather than an import, deliberately: several builds compile these
 * sources directly into another module via {@code java.srcDirs} (the example
 * app, and any project the CLI detects as a "source" install). Those builds
 * generate their own BuildConfig under their own namespace, so a compile-time
 * reference to com.atakmap.android.reactive.BuildConfig cannot resolve there
 * and would break the build. In a source build both fields resolve to
 * "unknown", which the SDK's version check deliberately skips — a source build
 * has no published version to be in or out of sync with.
 *
 * A consumer ProGuard rule (consumer-rules.pro) keeps the BuildConfig class in
 * minified plugin builds; without it, R8 sees no compile-time reference here
 * and would strip the class, degrading AAR installs to "unknown" too.
 */
final class BridgeInfo {

    static final String BRIDGE_VERSION = read("BRIDGE_VERSION");
    static final String ATAK_VERSION = read("ATAK_VERSION");

    private BridgeInfo() {
    }

    private static String read(String field) {
        try {
            Class<?> cfg = Class.forName("com.atakmap.android.reactive.BuildConfig");
            Object value = cfg.getField(field).get(null);
            if (value instanceof String && !((String) value).isEmpty()) {
                return (String) value;
            }
        } catch (Throwable ignored) {
            // Source-include build: no such class. Fall through.
        }
        return "unknown";
    }
}
