package com.atakmap.android.reactive;

import android.content.Context;
import android.graphics.Bitmap;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

import com.atakmap.android.maps.MapView;
import com.atakmap.android.reactive.bridge.AtakBridge;
import com.atakmap.android.reactive.bridge.BridgeEventEmitter;
import com.atakmap.coremap.log.Log;

import android.content.SharedPreferences;
import com.atakmap.android.preference.AtakPreferences;

/**
 * A standalone WebView wrapper with the full atak-reactive bridge, designed
 * to be embedded as a child view in any native layout.
 *
 * Same bridge, same SDK, same hooks as ReactiveDropDown — different container.
 * Use this when you want to replace one tab or section of an existing native
 * dropdown with React, rather than taking over the entire panel.
 *
 * Usage:
 * <pre>
 *   // Inside your existing DropDownReceiver layout
 *   ReactiveWebView reactTab = new ReactiveWebView(mapView, pluginContext, "web/index.html");
 *   myTabContainer.addView(reactTab);
 * </pre>
 */
public class ReactiveWebView extends FrameLayout {

    private static final String TAG = "ReactiveWebView";

    private static final String DEV_URL = "http://localhost:5173";
    private static final String ASSET_BASE = "https://appassets.androidplatform.net/assets/";

    private final MapView mapView;
    private final String assetPath;
    private final String prodUrl;
    private final boolean devMode;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private AtakBridge bridge;
    private BridgeEventEmitter eventEmitter;

    private final java.util.List<Object> pendingBridges = new java.util.ArrayList<>();
    private SharedPreferences.OnSharedPreferenceChangeListener prefListener;
    private boolean destroyed = false;
    private boolean loaded = false;

    /**
     * Create a reactive web view.
     *
     * @param mapView       the ATAK MapView
     * @param pluginContext  the plugin's context (for theme/resources)
     * @param assetPath     path to the HTML file relative to assets/ (e.g. "web/index.html")
     */
    public ReactiveWebView(MapView mapView, Context pluginContext, String assetPath) {
        this(mapView, pluginContext, assetPath, isDebugBuild(pluginContext));
    }

    public ReactiveWebView(MapView mapView, Context pluginContext,
            String assetPath, boolean devMode) {
        super(pluginContext);
        this.mapView = mapView;
        this.assetPath = assetPath;
        this.prodUrl = ASSET_BASE + assetPath;
        this.devMode = devMode;

        setBackgroundColor(0xFF1a1a2e);

        mapView.post(() -> {
            if (destroyed) return;

            Context appContext = mapView.getContext();

            webView = new WebView(appContext);
            webView.setLayoutParams(new FrameLayout.LayoutParams(
                    LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));

            assetLoader = new WebViewAssetLoader.Builder()
                    .addPathHandler("/assets/",
                            new WebViewAssetLoader.AssetsPathHandler(pluginContext))
                    .build();

            webView.setBackgroundColor(0xFF1a1a2e);

            configureSettings();

            eventEmitter = new BridgeEventEmitter(webView);
            bridge = new AtakBridge(mapView, eventEmitter);
            // No setDropDown() — dropdown sizing hooks will no-op/return defaults
            webView.addJavascriptInterface(bridge, "_atak");

            for (Object extra : pendingBridges) {
                String name = bridgeName(extra);
                webView.addJavascriptInterface(extra, name);
                Log.d(TAG, "Registered bridge: " + name);
            }

            webView.setWebViewClient(new EmbeddedWebViewClient());
            webView.setWebChromeClient(new EmbeddedWebChromeClient());
            webView.loadUrl("about:blank");

            addView(webView);
        });
    }

    /**
     * Add a custom bridge accessible from JS as window._className.
     * Call before the view is attached, or at any time after.
     *
     * @param bridge object with @JavascriptInterface methods
     * @return this, for chaining
     */
    public ReactiveWebView addBridge(Object bridge) {
        pendingBridges.add(bridge);
        if (webView != null) {
            String name = bridgeName(bridge);
            webView.addJavascriptInterface(bridge, name);
            Log.d(TAG, "Registered bridge: " + name);
        }
        return this;
    }

    /**
     * Load the web content and start the bridge. Call when the view becomes
     * visible (e.g. when the tab is selected or the dropdown opens).
     */
    public void onResume() {
        if (destroyed) return;

        if (!loaded && webView != null) {
            loaded = true;
            loadContent();
        }

        if (webView != null) {
            webView.onResume();
        }

        if (eventEmitter != null) {
            eventEmitter.startListening();
            startPreferenceListener();
        }
    }

    /**
     * Pause the web view. Call when the view is hidden (e.g. tab switched away).
     */
    public void onPause() {
        if (destroyed) return;

        if (webView != null) {
            webView.onPause();
        }
    }

    /**
     * Destroy the web view and clean up all bridge resources.
     * Safe to call multiple times (subsequent calls are no-ops).
     */
    public void destroy() {
        if (destroyed) return;
        destroyed = true;

        stopPreferenceListener();

        if (eventEmitter != null) {
            eventEmitter.stopListening();
        }
        if (bridge != null) {
            bridge.dispose();
        }
        if (webView != null) {
            removeView(webView);
            webView.destroy();
        }
    }

    /**
     * Returns the AtakBridge for direct access if needed.
     */
    public AtakBridge getBridge() {
        return bridge;
    }

    /**
     * Returns the BridgeEventEmitter for direct access if needed.
     */
    public BridgeEventEmitter getEmitter() {
        return eventEmitter;
    }

    /**
     * Evaluate JavaScript in the WebView. Must be called from UI thread.
     */
    public void evaluateJavascript(String script) {
        if (webView != null && !destroyed) {
            webView.post(() -> webView.evaluateJavascript(script, null));
        }
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        destroy();
    }

    // --- Private helpers ---

    private void loadContent() {
        if (devMode) {
            webView.loadUrl(LOADING_HTML);

            new Thread(() -> {
                boolean reachable = isDevServerReachable();
                webView.post(() -> {
                    if (destroyed) return;
                    if (reachable) {
                        Log.d(TAG, "Dev server reachable, loading from " + DEV_URL);
                        String url = DEV_URL;
                        // Preserve hash fragment for route-based multi-view setups
                        int hashIndex = assetPath.indexOf('#');
                        if (hashIndex >= 0) {
                            url += "/" + assetPath.substring(hashIndex);
                        }
                        webView.loadUrl(url);
                    } else {
                        Log.w(TAG, "Dev server not running — run: npx @atak-reactive/cli dev");
                        webView.loadUrl(DEV_SERVER_ERROR_HTML);
                    }
                });
            }).start();
        } else {
            webView.loadUrl(prodUrl);
        }
    }

    private void configureSettings() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);

        if (devMode) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }

    private void startPreferenceListener() {
        try {
            AtakPreferences prefs = AtakPreferences.getInstance(
                    mapView.getContext());
            prefListener = (sp, key) -> {
                if (key == null || eventEmitter == null) return;
                String value = prefs.get(key, (String) null);
                String payload = "{\"key\":\"" + key.replace("\"", "\\\"")
                        + "\",\"value\":"
                        + (value == null ? "null"
                                : "\"" + value.replace("\"", "\\\"") + "\"")
                        + "}";
                eventEmitter.emit("preferenceChanged", payload);
            };
            prefs.registerListener(prefListener);
        } catch (Exception e) {
            Log.e(TAG, "Error starting preference listener", e);
        }
    }

    private void stopPreferenceListener() {
        if (prefListener != null) {
            try {
                AtakPreferences prefs = AtakPreferences.getInstance(
                        mapView.getContext());
                prefs.unregisterListener(prefListener);
            } catch (Exception e) {
                Log.e(TAG, "Error stopping preference listener", e);
            }
            prefListener = null;
        }
    }

    private static boolean isDebugBuild(Context context) {
        try {
            return (context.getApplicationInfo().flags
                    & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isDevServerReachable() {
        try {
            java.net.Socket socket = new java.net.Socket();
            socket.connect(new java.net.InetSocketAddress("localhost", 5173), 500);
            socket.close();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static String bridgeName(Object bridge) {
        String simple = bridge.getClass().getSimpleName();
        return "_" + simple.substring(0, 1).toLowerCase() + simple.substring(1);
    }

    private static final String LOADING_HTML =
            "data:text/html;charset=utf-8," +
            "<html><body style='margin:0;background:%231a1a2e;display:flex;" +
            "flex-direction:column;align-items:center;justify-content:center;" +
            "height:100vh;font-family:sans-serif;color:%238d99ae'>" +
            "<div style='font-size:13px;letter-spacing:1px;text-transform:uppercase;" +
            "opacity:0.5;margin-bottom:8px'>atak-reactive dev</div>" +
            "<div style='font-size:14px'>Connecting to dev server...</div>" +
            "</body></html>";

    private static final String DEV_SERVER_ERROR_HTML =
            "data:text/html;charset=utf-8," +
            "<html><body style='margin:0;background:%231a1a2e;display:flex;" +
            "flex-direction:column;align-items:center;justify-content:center;" +
            "height:100vh;font-family:sans-serif;color:%238d99ae'>" +
            "<div style='font-size:13px;letter-spacing:1px;text-transform:uppercase;" +
            "opacity:0.5;margin-bottom:8px'>atak-reactive dev</div>" +
            "<div style='font-size:14px;color:%23f87171'>Dev server not running</div>" +
            "<div style='font-size:12px;margin-top:12px;opacity:0.7'>Run: npx @atak-reactive/cli dev</div>" +
            "</body></html>";

    private class EmbeddedWebViewClient extends WebViewClient {
        private boolean devFallbackTriggered = false;

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view,
                WebResourceRequest request) {
            if (assetLoader != null) {
                WebResourceResponse response = assetLoader
                        .shouldInterceptRequest(request.getUrl());
                if (response != null) {
                    return response;
                }
            }
            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request,
                WebResourceError error) {
            if (devMode && !devFallbackTriggered && request.isForMainFrame()) {
                devFallbackTriggered = true;
                Log.w(TAG, "Dev server connection lost");
                view.loadUrl(DEV_SERVER_ERROR_HTML);
                return;
            }
            super.onReceivedError(view, request, error);
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            Log.d(TAG, "Loading: " + url);
            super.onPageStarted(view, url, favicon);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            Log.d(TAG, "Loaded: " + url);
            if (url.equals(prodUrl) || url.startsWith(DEV_URL)) {
                devFallbackTriggered = false;
            }
            super.onPageFinished(view, url);
        }
    }

    private static class EmbeddedWebChromeClient extends WebChromeClient {
        @Override
        public boolean onConsoleMessage(ConsoleMessage msg) {
            String level;
            switch (msg.messageLevel()) {
                case ERROR: level = "ERROR"; break;
                case WARNING: level = "WARN"; break;
                default: level = "LOG";
            }
            Log.d(TAG, "[JS " + level + "] " + msg.message()
                    + " (" + msg.sourceId() + ":" + msg.lineNumber() + ")");
            return true;
        }
    }
}
