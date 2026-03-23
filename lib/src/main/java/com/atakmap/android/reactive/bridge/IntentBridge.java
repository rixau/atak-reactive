package com.atakmap.android.reactive.bridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import android.content.IntentFilter;

import com.atakmap.android.ipc.AtakBroadcast;
import com.atakmap.coremap.log.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class IntentBridge {

    private static final String TAG = "IntentBridge";

    private final BridgeEventEmitter emitter;
    private final Map<String, BroadcastReceiver> receivers = new ConcurrentHashMap<>();

    public IntentBridge(BridgeEventEmitter emitter) {
        this.emitter = emitter;
    }

    @JavascriptInterface
    public void registerAction(String action) {
        if (receivers.containsKey(action)) return;

        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                try {
                    JSONObject json = new JSONObject();
                    json.put("action", intent.getAction());
                    json.put("extras", bundleToJson(intent.getExtras()));
                    emitter.emit("intentReceived", json.toString());
                } catch (JSONException e) {
                    Log.e(TAG, "Error serializing intent", e);
                }
            }
        };

        AtakBroadcast.DocumentedIntentFilter filter =
                new AtakBroadcast.DocumentedIntentFilter(action);
        AtakBroadcast.getInstance().registerReceiver(receiver, filter);
        receivers.put(action, receiver);
    }

    @JavascriptInterface
    public void unregisterAction(String action) {
        BroadcastReceiver receiver = receivers.remove(action);
        if (receiver != null) {
            AtakBroadcast.getInstance().unregisterReceiver(receiver);
        }
    }

    @JavascriptInterface
    public void sendBroadcast(String action, String extrasJson) {
        try {
            Intent intent = new Intent(action);
            if (extrasJson != null && !extrasJson.isEmpty() && !extrasJson.equals("null")) {
                JSONObject extras = new JSONObject(extrasJson);
                java.util.Iterator<String> keys = extras.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object value = extras.get(key);
                    if (value instanceof String) {
                        intent.putExtra(key, (String) value);
                    } else if (value instanceof Integer) {
                        intent.putExtra(key, (int) value);
                    } else if (value instanceof Double) {
                        intent.putExtra(key, (double) value);
                    } else if (value instanceof Boolean) {
                        intent.putExtra(key, (boolean) value);
                    } else {
                        intent.putExtra(key, value.toString());
                    }
                }
            }
            AtakBroadcast.getInstance().sendBroadcast(intent);
        } catch (JSONException e) {
            Log.e(TAG, "Error sending broadcast", e);
        }
    }

    public void dispose() {
        for (Map.Entry<String, BroadcastReceiver> entry : receivers.entrySet()) {
            try {
                AtakBroadcast.getInstance().unregisterReceiver(entry.getValue());
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering receiver: " + entry.getKey(), e);
            }
        }
        receivers.clear();
    }

    private static JSONObject bundleToJson(Bundle bundle) throws JSONException {
        JSONObject json = new JSONObject();
        if (bundle == null) return json;
        for (String key : bundle.keySet()) {
            Object value = bundle.get(key);
            if (value instanceof String) {
                json.put(key, (String) value);
            } else if (value instanceof Integer) {
                json.put(key, (int) value);
            } else if (value instanceof Long) {
                json.put(key, (long) value);
            } else if (value instanceof Double) {
                json.put(key, (double) value);
            } else if (value instanceof Float) {
                json.put(key, (double) (float) value);
            } else if (value instanceof Boolean) {
                json.put(key, (boolean) value);
            } else if (value != null) {
                json.put(key, value.toString());
            }
        }
        return json;
    }
}
