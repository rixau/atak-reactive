package com.atakmap.android.reactive;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Build;
import android.webkit.ConsoleMessage;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.LinearLayout.LayoutParams;

import androidx.annotation.RequiresApi;
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
 * In debug mode, tries to load from a Vite dev server for hot-reload.
 * The dev server host defaults to localhost:5173 (reachable via adb reverse
 * over USB). For wireless debugging, set {@code devServerHost} in
 * {@code local.properties}.
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

    private static final String ASSET_BASE = "https://appassets.androidplatform.net/assets/";

    private final String assetPath;
    private final String prodUrl;
    private final String devUrl;
    private final String devHost;
    private final int devPort;
    private final LinearLayout container;
    private final boolean devMode;
    private final Context pluginContext;
    private final Object[] additionalBridges;

    /** Set by disposeImpl(); the WebView is destroyed and must not be loaded again. */
    private volatile boolean disposed = false;

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
        this(mapView, pluginContext, assetPath, isDebugBuild(pluginContext));
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
        this.devHost = resolveDevHost(pluginContext);
        this.devPort = resolveDevPort(pluginContext);
        this.devUrl = "http://" + devHost + ":" + devPort;
        this.pluginContext = pluginContext;
        this.additionalBridges = additionalBridges;

        container = new LinearLayout(pluginContext);
        container.setLayoutParams(new LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
        container.setBackgroundColor(0xFF1a1a2e);

        mapView.post(this::createWebView);
    }

    /**
     * Build the WebView and everything hanging off it. Runs once from the
     * constructor and again after a renderer death, which leaves the old view
     * unusable.
     */
    private void createWebView() {
        MapView mapView = getMapView();
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
        bridge.setDropDown(this);
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
    }

    /**
     * The renderer process behind the WebView is gone. The framework is explicit
     * that the view cannot be used again and must be destroyed, so tear it down,
     * close the panel if it is open, and build a fresh one for the next open.
     *
     * Every WebView on the same renderer is asked; the host process is killed
     * unless all of them report the death handled. ATAK itself holds several
     * WebViews with the default client, so on builds where those still answer
     * false this cannot keep ATAK up by itself — it keeps atak-reactive from
     * being the reason.
     */
    private void onRendererGone(boolean crashed) {
        Log.e(TAG, "WebView renderer " + (crashed ? "crashed" : "was killed by the system")
                + " — closing the panel and rebuilding the WebView");
        if (disposed) return;

        stopDevRetry();
        WebView dead = webView;
        BridgeEventEmitter oldEmitter = eventEmitter;
        AtakBridge oldBridge = bridge;
        webView = null;
        eventEmitter = null;
        bridge = null;

        stopPreferenceListener();
        if (oldEmitter != null) {
            onStopListening(oldEmitter);
            oldEmitter.stopListening();
        }
        if (oldBridge != null) {
            oldBridge.dispose();
        }
        if (dead != null) {
            container.removeView(dead);
            dead.destroy();
        }

        if (!isClosed()) {
            closeDropDown();
        }
        createWebView();
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
            "opacity:0.5;margin-bottom:22px'>atak-reactive dev</div>" +
            "<div style='font-size:14px'>Connecting to dev server...</div>" +
            "</body></html>";

    private static final String DEV_SERVER_ERROR_TEMPLATE =
            "data:text/html;charset=utf-8," +
            "<html><body style='margin:0;background:%231a1a2e;display:flex;" +
            "flex-direction:column;align-items:center;justify-content:center;" +
            "height:100vh;font-family:sans-serif;color:%238d99ae'>" +
            "<div style='font-size:13px;letter-spacing:1px;text-transform:uppercase;" +
            "opacity:0.5;margin-bottom:22px'>atak-reactive dev</div>" +
            "<div style='font-size:14px;color:%23f87171'>Dev server not running</div>" +
            "<div style='font-size:13px;margin-top:7px;font-family:monospace;opacity:0.85'>ADDR</div>" +
            "<div style='font-size:12px;margin-top:24px;opacity:0.7'>Run: npx @atak-reactive/cli dev</div>" +
            "</body></html>";

    /**
     * Show the address that was actually tried. Host and port are both resolved at
     * build time, so when either is wrong the screen otherwise reads as "the server
     * is down" when the plugin was really looking somewhere else.
     */
    private String devServerErrorHtml() {
        return DEV_SERVER_ERROR_TEMPLATE.replace("ADDR", devUrl);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        showDropDown(container, HALF_WIDTH, FULL_HEIGHT,
                FULL_WIDTH, HALF_HEIGHT, false, this);

        if (devMode) {
            webView.loadUrl(LOADING_HTML);

            new Thread(() -> {
                boolean reachable = isDevServerReachable();
                webView.post(() -> {
                    if (disposed) return;
                    if (reachable) {
                        Log.d(TAG, "Dev server reachable, loading from " + devUrl);
                        stopDevRetry();
                        webView.loadUrl(devUrl);
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

        if (eventEmitter != null) {
            eventEmitter.startListening();
            startPreferenceListener();
            onStartListening(eventEmitter);
        }
    }

// ---- dev-only: reconnect when the dev server comes back ----
    // The dev URL is otherwise loaded once, when the panel opens, so restarting the
    // server (or restoring a dropped adb tunnel) does nothing until the panel is
    // closed and reopened. Poll while the error screen is showing.
    private volatile boolean devRetryRunning;

    /**
     * Cancellation token. devRetryRunning cannot serve as one: the poller clears it
     * itself on success. Bumped by every start and stop, main thread only.
     */
    private volatile int devRetryGeneration;

    /**
     * Never runs outside dev mode: guarded here, and both callers already sit inside
     * `if (devMode)` blocks. A polling thread in a release build would be a leak.
     */
    private void startDevRetry() {
        if (!devMode || devRetryRunning) return;
        devRetryRunning = true;
        final int generation = ++devRetryGeneration;
        Thread t = new Thread(() -> {
            while (devRetryRunning && generation == devRetryGeneration) {
                try {
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
                if (!devRetryRunning || generation != devRetryGeneration) return;
                if (isDevServerReachable()) {
                    devRetryRunning = false;
                    final WebView wv = webView;
                    if (wv != null) {
                        wv.post(() -> {
                            // disposeImpl() can land between the probe and this
                            // dispatch; loading a destroyed WebView crashes.
                            if (disposed || generation != devRetryGeneration) return;
                            Log.d(TAG, "Dev server came back — reloading " + devUrl);
                            wv.loadUrl(devUrl);
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
        devRetryGeneration++;
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
        stopDevRetry();
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
        stopDevRetry();
        disposed = true;
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

        /**
         * Returning true is what stops WebView from killing ATAK. Below API 26
         * the callback does not exist and the host dies regardless.
         */
        @RequiresApi(Build.VERSION_CODES.O)
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            onRendererGone(detail.didCrash());
            return true;
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
