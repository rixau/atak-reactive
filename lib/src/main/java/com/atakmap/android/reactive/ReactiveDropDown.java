package com.atakmap.android.reactive;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.LinearLayout.LayoutParams;

import androidx.webkit.WebViewAssetLoader;

import com.atakmap.android.dropdown.DropDown.OnStateListener;
import com.atakmap.android.dropdown.DropDownReceiver;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.navigation.views.NavView;
import com.atakmap.android.preference.AtakPreferences;
import com.atakmap.android.reactive.bridge.AtakBridge;
import com.atakmap.android.reactive.bridge.BridgeEventEmitter;
import com.atakmap.coremap.log.Log;

import android.content.SharedPreferences;

/**
 * A DropDownReceiver that hosts a WebView with a React UI.
 *
 * In debug mode, tries to load from a local Vite dev server (localhost:5173)
 * for hot-reload. Falls back to bundled assets if the dev server isn't running.
 * In release mode, always loads from bundled assets.
 *
 * Usage:
 * <pre>
 *   ReactiveDropDown myScreen = new ReactiveDropDown(mapView, pluginContext, "web/index.html");
 *   DocumentedIntentFilter f = new DocumentedIntentFilter();
 *   f.addAction("com.myplugin.SHOW_SCREEN", "My React screen");
 *   registerDropDownReceiver(myScreen, f);
 * </pre>
 */
public class ReactiveDropDown extends DropDownReceiver implements OnStateListener {

    private static final String TAG = "ReactiveDropDown";

    private static final String DEV_URL = "http://localhost:5173";
    private static final String ASSET_BASE = "https://appassets.androidplatform.net/assets/";

    private final String assetPath;
    private final String prodUrl;
    private final LinearLayout container;
    private final boolean devMode;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private AtakBridge bridge;
    private BridgeEventEmitter eventEmitter;

    private final java.util.List<Object> pendingBridges = new java.util.ArrayList<>();
    private SharedPreferences.OnSharedPreferenceChangeListener prefListener;
    private double currentWidth = HALF_WIDTH;
    private double currentHeight = FULL_HEIGHT;

    /**
     * Create a reactive dropdown.
     *
     * @param mapView       the ATAK MapView
     * @param pluginContext  the plugin's context (for theme/resources)
     * @param assetPath     path to the HTML file relative to assets/ (e.g. "web/index.html")
     */
    public ReactiveDropDown(MapView mapView, Context pluginContext, String assetPath) {
        this(mapView, pluginContext, assetPath, true);
    }

    /**
     * Add a custom bridge that will be accessible from JS as window._className.
     * Call before the dropdown is first shown.
     *
     * @param bridge object with @JavascriptInterface methods
     * @return this, for chaining
     */
    public ReactiveDropDown addBridge(Object bridge) {
        pendingBridges.add(bridge);
        // If WebView is already created, register immediately
        if (webView != null) {
            String name = bridgeName(bridge);
            webView.addJavascriptInterface(bridge, name);
            Log.d(TAG, "Registered bridge: " + name);
        }
        return this;
    }

    private static String bridgeName(Object bridge) {
        String simple = bridge.getClass().getSimpleName();
        return "_" + simple.substring(0, 1).toLowerCase() + simple.substring(1);
    }

    public ReactiveDropDown(MapView mapView, Context pluginContext,
            String assetPath, boolean devMode, Object... additionalBridges) {
        super(mapView);
        this.assetPath = assetPath;
        this.prodUrl = ASSET_BASE + assetPath;
        this.devMode = devMode;

        container = new LinearLayout(pluginContext);
        container.setLayoutParams(new LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
        container.setBackgroundColor(0xFF1a1a2e);

        mapView.post(() -> {
            Context appContext = mapView.getContext();

            webView = new WebView(appContext);
            webView.setLayoutParams(new LayoutParams(
                    LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));

            // Use plugin context for assets (web files are in the plugin APK, not ATAK's)
            assetLoader = new WebViewAssetLoader.Builder()
                    .addPathHandler("/assets/",
                            new WebViewAssetLoader.AssetsPathHandler(pluginContext))
                    .build();

            // Dark background from the start — no white flash
            webView.setBackgroundColor(0xFF1a1a2e);

            configureSettings();
            onConfigureWebView(webView, webView.getSettings());

            eventEmitter = new BridgeEventEmitter(webView);
            bridge = new AtakBridge(mapView, eventEmitter);
            bridge.setDropDown(ReactiveDropDown.this);
            webView.addJavascriptInterface(bridge, "_atak");

            // Register bridges passed via constructor varargs (legacy)
            for (Object extra : additionalBridges) {
                String name = bridgeName(extra);
                webView.addJavascriptInterface(extra, name);
                Log.d(TAG, "Registered bridge: " + name);
            }

            // Register bridges added via addBridge()
            for (Object extra : pendingBridges) {
                String name = bridgeName(extra);
                webView.addJavascriptInterface(extra, name);
                Log.d(TAG, "Registered bridge: " + name);
            }

            webView.setWebViewClient(new ReactiveWebViewClient());
            webView.setWebChromeClient(new ReactiveWebChromeClient());
            webView.loadUrl("about:blank");

            container.addView(webView);
        });
    }

    /**
     * Override to customize the WebView after creation.
     */
    protected void onConfigureWebView(WebView webView, WebSettings settings) {
    }

    /**
     * Override to set up additional event listeners when the dropdown opens.
     */
    protected void onStartListening(BridgeEventEmitter emitter) {
    }

    /**
     * Override to clean up additional event listeners when the dropdown closes.
     */
    protected void onStopListening(BridgeEventEmitter emitter) {
    }

    /**
     * Returns the BridgeEventEmitter for subclasses to use.
     */
    protected BridgeEventEmitter getEventEmitter() {
        return eventEmitter;
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

    private static final String LOADING_HTML =
            "data:text/html;charset=utf-8," +
            "<html><body style='margin:0;background:%231a1a2e;display:flex;" +
            "flex-direction:column;align-items:center;justify-content:center;" +
            "height:100vh;font-family:sans-serif;color:%238d99ae'>" +
            "<div style='font-size:13px;letter-spacing:1px;text-transform:uppercase;" +
            "opacity:0.5;margin-bottom:8px'>atak-reactive dev</div>" +
            "<div style='font-size:14px'>Connecting to dev server...</div>" +
            "</body></html>";

    @Override
    public void onReceive(Context context, Intent intent) {
        showDropDown(container, HALF_WIDTH, FULL_HEIGHT,
                FULL_WIDTH, HALF_HEIGHT, false, this);

        if (devMode) {
            // Show loading screen while checking dev server
            webView.loadUrl(LOADING_HTML);

            new Thread(() -> {
                boolean reachable = isDevServerReachable();
                webView.post(() -> {
                    if (reachable) {
                        Log.d(TAG, "Dev server reachable, loading from " + DEV_URL);
                        webView.loadUrl(DEV_URL);
                    } else {
                        Log.d(TAG, "Dev server not running, loading bundled assets");
                        webView.loadUrl(prodUrl);
                    }
                });
            }).start();
        } else {
            webView.loadUrl(prodUrl);
        }

        if (eventEmitter != null) {
            eventEmitter.startListening();
            startPreferenceListener();
            onStartListening(eventEmitter);
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

    @Override
    public void onDropDownVisible(boolean visible) {
        if (webView != null) {
            if (visible) {
                webView.onResume();
            } else {
                webView.onPause();
            }
        }
        if (eventEmitter != null) {
            eventEmitter.emit("dropDownVisible", String.valueOf(visible));
        }
    }

    @Override
    public void onDropDownClose() {
        if (eventEmitter != null) {
            eventEmitter.emit("dropDownClose", "{}");
            stopPreferenceListener();
            onStopListening(eventEmitter);
            eventEmitter.stopListening();
        }
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    public void onDropDownSelectionRemoved() {
    }

    @Override
    public void onDropDownSizeChanged(double width, double height) {
        currentWidth = width;
        currentHeight = height;
        if (eventEmitter != null) {
            eventEmitter.emit("dropDownSizeChanged",
                    "{\"width\":" + width + ",\"height\":" + height + "}");
        }
    }

    /**
     * Evaluate JavaScript in the WebView. Must be called from UI thread.
     */
    public void evaluateJavascript(String script) {
        if (webView != null) {
            webView.post(() -> webView.evaluateJavascript(script, null));
        }
    }

    private void startPreferenceListener() {
        try {
            AtakPreferences prefs = AtakPreferences.getInstance(
                    getMapView().getContext());
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
                        getMapView().getContext());
                prefs.unregisterListener(prefListener);
            } catch (Exception e) {
                Log.e(TAG, "Error stopping preference listener", e);
            }
            prefListener = null;
        }
    }

    // --- Dropdown dimension accessors for AtakBridge ---

    public double getDropDownWidth() {
        return currentWidth;
    }

    public double getDropDownHeight() {
        return currentHeight;
    }

    @Override
    public void disposeImpl() {
        stopPreferenceListener();
        if (eventEmitter != null) {
            eventEmitter.stopListening();
        }
        if (bridge != null) {
            bridge.dispose();
        }
        if (webView != null) {
            webView.destroy();
        }
    }

    private class ReactiveWebViewClient extends WebViewClient {
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
                Log.w(TAG, "Dev server unreachable, falling back to bundled assets");
                view.loadUrl(prodUrl);
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

    private static class ReactiveWebChromeClient extends WebChromeClient {
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
