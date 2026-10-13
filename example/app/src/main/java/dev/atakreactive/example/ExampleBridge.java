package dev.atakreactive.example;

import android.webkit.JavascriptInterface;

import com.atakmap.android.reactive.ReactiveDropDown;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * A minimal custom bridge, registered as {@code window._example}. The Test page
 * uses it to check that a custom bridge keeps its explicit name (including in
 * the minified release build), that calls reach it, and that events it sends
 * through {@link ReactiveDropDown#emit} arrive in JS.
 *
 * It holds the view, not a BridgeEventEmitter: the emitter is replaced when the
 * WebView is rebuilt, the view is not.
 */
public class ExampleBridge {

    public static final String PING_EVENT = "exampleBridgePing";

    private final ReactiveDropDown view;

    public ExampleBridge(ReactiveDropDown view) {
        this.view = view;
    }

    @JavascriptInterface
    public String echo(String value) {
        return value;
    }

    /** Emits {@link #PING_EVENT} with {@code {"token": token}}. */
    @JavascriptInterface
    public void ping(String token) {
        try {
            view.emit(PING_EVENT, new JSONObject().put("token", token).toString());
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }
}
