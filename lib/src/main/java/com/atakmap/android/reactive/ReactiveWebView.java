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

    private static final String ASSET_BASE = "https://appassets.androidplatform.net/assets/";

    private final MapView mapView;
    private final String assetPath;
    private final String prodUrl;
    private final String devUrl;
    private final String devHost;
    private final int devPort;
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
     * Set when onResume() is called before the deferred WebView initialization has
     * run. Without this, an early onResume() silently no-ops forever and the view
     * stays on about:blank — see the mapView.post(...) block in the constructor.
     */
    private boolean pendingResume = false;

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
        this.devHost = resolveDevHost(pluginContext);
        this.devPort = resolveDevPort(pluginContext);
        this.devUrl = "http://" + devHost + ":" + devPort;

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

            // Replay an onResume() that arrived before this runnable executed.
            if (pendingResume) {
                pendingResume = false;
                onResume();
            }
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

        // WebView creation is deferred to mapView.post(...) in the constructor, so a
        // caller that resumes immediately after construction arrives before it exists.
        // Remember the request and replay it once initialization completes.
        if (webView == null) {
            pendingResume = true;
            return;
        }

        if (!loaded) {
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
        stopDevRetry();
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
        stopDevRetry();
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
                        Log.d(TAG, "Dev server reachable, loading from " + devUrl);
                        stopDevRetry();
                        webView.loadUrl(devUrlForAsset());
                    } else {
                        Log.w(TAG, "Dev server not running — run: npx @atak-reactive/cli dev");
                        webView.loadUrl(devServerErrorHtml());
                        startDevRetry();
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

    private static String resolveDevHost(Context context) {
        try {
            int resId = context.getResources().getIdentifier(
                    "atak_reactive_dev_host", "string", context.getPackageName());
            if (resId != 0) {
                String host = context.getString(resId);
                if (host != null && !host.isEmpty()) {
                    if (!"localhost".equals(host)) {
                        Log.d(TAG, "Dev server host: " + host);
                    }
                    return host;
                }
            }
        } catch (Exception e) {
            // Fall through to default
        }
        Log.d(TAG, "atak_reactive_dev_host resource not detected — using localhost. "
                + "WiFi debugging requires this resValue in your debug build type. See README.");
        return "localhost";
    }

    /**
     * The dev server port, compiled in via the atak_reactive_dev_port resValue so
     * each plugin can hold its own and two can run in dev at the same time. Falls
     * back to 5173 when the resource is absent.
     */
    private static int resolveDevPort(Context context) {
        // Every failure below is logged. A silent fallback here is indistinguishable
        // from "the port really is 5173", which makes a misconfigured or missing
        // resource impossible to diagnose from the device.
        try {
            String pkg = context.getPackageName();
            int resId = context.getResources().getIdentifier(
                    "atak_reactive_dev_port", "string", pkg);
            if (resId == 0) {
                Log.w(TAG, "atak_reactive_dev_port not found in package " + pkg
                        + " — using 5173. Run 'atak-reactive init' to add the resValue.");
                return 5173;
            }
            String raw = context.getString(resId);
            if (raw == null || raw.isEmpty()) {
                Log.w(TAG, "atak_reactive_dev_port is empty — using 5173");
                return 5173;
            }
            int port = Integer.parseInt(raw.trim());
            if (port <= 0 || port >= 65536) {
                Log.w(TAG, "Invalid atak_reactive_dev_port \"" + raw + "\" — using 5173");
                return 5173;
            }
            Log.d(TAG, "Dev server port: " + port + " (from " + pkg + ")");
            return port;
        } catch (Exception e) {
            Log.w(TAG, "Could not read atak_reactive_dev_port — using 5173", e);
            return 5173;
        }
    }

// ---- dev-only: reconnect when the dev server comes back ----
    // The dev URL is otherwise loaded once, when the panel opens, so restarting the
    // server (or restoring a dropped adb tunnel) does nothing until the panel is
    // closed and reopened. Poll while the error screen is showing.
    private volatile boolean devRetryRunning;

    /**
     * Never runs outside dev mode: guarded here, and both callers already sit inside
     * `if (devMode)` blocks. A polling thread in a release build would be a leak.
     */
    private void startDevRetry() {
        if (!devMode || devRetryRunning) return;
        devRetryRunning = true;
        Thread t = new Thread(() -> {
            while (devRetryRunning) {
                try {
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
                if (!devRetryRunning) return;
                if (isDevServerReachable()) {
                    devRetryRunning = false;
                    final WebView wv = webView;
                    if (wv != null) {
                        wv.post(() -> {
                            if (!devRetryRunning) {
                                Log.d(TAG, "Dev server came back — reloading " + devUrl);
                                wv.loadUrl(devUrl);
                            }
                        });
                    }
                    return;
                }
            }
        }, "atak-reactive-dev-retry");
        t.setDaemon(true);
        t.start();
    }

    private void stopDevRetry() {
        devRetryRunning = false;
    }

    /** Dev URL including the hash fragment, for route-based multi-view setups. */
    private String devUrlForAsset() {
        int hashIndex = assetPath.indexOf('#');
        return hashIndex >= 0 ? devUrl + "/" + assetPath.substring(hashIndex) : devUrl;
    }

    private boolean isDevServerReachable() {
        try {
            java.net.Socket socket = new java.net.Socket();
            socket.connect(new java.net.InetSocketAddress(devHost, devPort), 500);
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

    private static final String DEV_SERVER_ERROR_TEMPLATE =
            "data:text/html;charset=utf-8," +
            "<html><body style='margin:0;background:%231a1a2e;display:flex;" +
            "flex-direction:column;align-items:center;justify-content:center;" +
            "height:100vh;font-family:sans-serif;color:%238d99ae'>" +
            "<div style='font-size:13px;letter-spacing:1px;text-transform:uppercase;" +
            "opacity:0.5;margin-bottom:8px'>atak-reactive dev</div>" +
            "<div style='font-size:14px;color:%23f87171'>Dev server not running</div>" +
            "<div style='font-size:13px;margin-top:6px;font-family:monospace;opacity:0.85'>ADDR</div>" +
            "<div style='font-size:12px;margin-top:12px;opacity:0.7'>Run: npx @atak-reactive/cli dev</div>" +
            "</body></html>";

    /** The port is resolved at build time, so show which one we actually looked for. */
    /**
     * Show the address that was actually tried. Host and port are both resolved at
     * build time, so when either is wrong the screen otherwise reads as "the server
     * is down" when the plugin was really looking somewhere else.
     */
    private String devServerErrorHtml() {
        return DEV_SERVER_ERROR_TEMPLATE.replace("ADDR", devUrl);
    }

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
                view.loadUrl(devServerErrorHtml());
                startDevRetry();
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
            if (url.equals(prodUrl) || url.startsWith(devUrl)) {
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
