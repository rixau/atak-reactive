package com.atakmap.android.reactive;

import android.os.Handler;
import android.os.Looper;

import com.atak.plugins.impl.AtakPluginRegistry;
import com.atakmap.coremap.log.Log;

/**
 * Utility for reloading a plugin without restarting ATAK.
 * Debug use only — static state in the plugin may leak.
 *
 * Usage from ADB:
 *   adb shell am broadcast -a com.yourplugin.DEV_RELOAD
 *
 * In your MapComponent, register a receiver that calls:
 *   DevReloadHelper.reload("com.yourplugin.package.name");
 */
public final class DevReloadHelper {

    private static final String TAG = "DevReloadHelper";
    private static final long RELOAD_DELAY_MS = 500;

    private DevReloadHelper() {
    }

    /**
     * Schedule a plugin unload/reload after a short delay.
     * The delay ensures the calling code has returned before
     * the classloader is torn down.
     *
     * @param packageName the plugin's package name
     */
    public static void reload(String packageName) {
        Log.d(TAG, "Scheduling reload of " + packageName
                + " in " + RELOAD_DELAY_MS + "ms");

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                AtakPluginRegistry registry = AtakPluginRegistry.get();
                if (registry == null) {
                    Log.e(TAG, "Plugin registry not available");
                    return;
                }

                Log.d(TAG, "Unloading: " + packageName);
                boolean unloaded = registry.unloadPlugin(packageName);
                Log.d(TAG, "Unload result: " + unloaded);

                Log.d(TAG, "Loading: " + packageName);
                boolean loaded = registry.loadPlugin(packageName);
                Log.d(TAG, "Load result: " + loaded);
            } catch (Exception e) {
                Log.e(TAG, "Error during reload", e);
            }
        }, RELOAD_DELAY_MS);
    }
}
