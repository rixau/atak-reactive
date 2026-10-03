package com.atakmap.android.reactive;

import android.webkit.WebView;

import com.atakmap.android.reactive.bridge.AtakBridge;
import com.atakmap.android.reactive.bridge.BridgeEventEmitter;

/**
 * Back-press handling shared by ReactiveDropDown and ReactiveWebView. UI thread only.
 */
final class BackPress {

    private BackPress() {
    }

    /**
     * Offer a back press to the page: a mounted useBackHandler first, then the
     * WebView's own history (router navigation).
     *
     * @return true if the press was used; false when there is nowhere left to go
     *         back to and the host should close the panel
     */
    static boolean handle(WebView webView, AtakBridge bridge, BridgeEventEmitter emitter,
            String prodUrl, String devUrl) {
        if (webView == null) return false;
        // The dev loading and error screens are not the app. Nothing on them can
        // use a back press, and history behind them leads nowhere useful.
        if (isPlaceholder(webView.getUrl())) return false;

        if (bridge != null && emitter != null && bridge.isBackHandlerEnabled()) {
            emitter.emit("backPressed", "{}");
            return true;
        }
        // Covers an external page the app navigated to as well: back returns to
        // the app rather than closing the panel.
        if (webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return false;
    }

    /** about:blank before the first load, or one of the data: loading/error screens. */
    static boolean isPlaceholder(String url) {
        return url == null || url.equals("about:blank") || url.startsWith("data:");
    }

    /** Whether the URL is the app itself, as loaded by the container. */
    static boolean isAppUrl(String url, String prodUrl, String devUrl) {
        if (url == null) return false;
        // A ReactiveWebView asset path may carry a hash route; the page may have
        // moved to another route since, so compare up to the fragment.
        int hash = prodUrl.indexOf('#');
        String prodBase = hash >= 0 ? prodUrl.substring(0, hash) : prodUrl;
        return url.startsWith(prodBase) || url.startsWith(devUrl);
    }
}
