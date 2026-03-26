package com.atakmap.android.reactive.bridge;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

import com.atakmap.android.cot.CotMapComponent;
import com.atakmap.comms.CotDispatcher;
import com.atakmap.comms.DispatchFlags;
import com.atakmap.coremap.cot.event.CotAttribute;
import com.atakmap.coremap.cot.event.CotDetail;
import com.atakmap.coremap.cot.event.CotEvent;
import com.atakmap.coremap.cot.event.CotPoint;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.time.CoordinatedTime;
import com.atakmap.comms.CotServiceRemote;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class CotBridge {

    private static final String TAG = "CotBridge";
    private static final long DEBOUNCE_MS = 200;

    private final BridgeEventEmitter emitter;
    private final Handler debounceHandler = new Handler(Looper.getMainLooper());
    private final Map<String, JSONObject> pendingCot = new ConcurrentHashMap<>();

    private CotServiceRemote cotService;
    private CotServiceRemote.CotEventListener cotListener;
    private int refCount = 0;
    private boolean streaming = false;

    public CotBridge(BridgeEventEmitter emitter) {
        this.emitter = emitter;
    }

    @JavascriptInterface
    public void startCotStream() {
        refCount++;
        if (refCount == 1) {
            startListening();
        }
    }

    @JavascriptInterface
    public void stopCotStream() {
        refCount--;
        if (refCount <= 0) {
            refCount = 0;
            stopListening();
        }
    }

    @JavascriptInterface
    public String sendCot(String cotJson, String dispatch) {
        try {
            JSONObject json = new JSONObject(cotJson);
            CotEvent event = buildCotEvent(json);
            if (event == null || !event.isValid()) {
                return "invalid CoT event";
            }

            CotMapComponent cmc = CotMapComponent.getInstance();
            if (cmc == null) return "CotMapComponent not available";

            switch (dispatch) {
                case "external":
                    cmc.getExternalDispatcher().dispatch(event);
                    break;
                case "internal":
                    cmc.getInternalDispatcher().dispatch(event);
                    break;
                case "both":
                    cmc.getExternalDispatcher().dispatch(event);
                    cmc.getInternalDispatcher().dispatch(event);
                    break;
                default:
                    return "invalid dispatch target: " + dispatch;
            }

            return "true";
        } catch (JSONException e) {
            Log.e(TAG, "Error sending CoT", e);
            return e.getMessage();
        }
    }

    @JavascriptInterface
    public String sendCotToContacts(String cotJson, String contactUidsJson) {
        try {
            JSONObject json = new JSONObject(cotJson);
            CotEvent event = buildCotEvent(json);
            if (event == null || !event.isValid()) {
                return "invalid CoT event";
            }

            JSONArray uids = new JSONArray(contactUidsJson);
            String[] uidArray = new String[uids.length()];
            for (int i = 0; i < uids.length(); i++) {
                uidArray[i] = uids.getString(i);
            }

            Bundle data = new Bundle();
            data.putStringArray("toUIDs", uidArray);

            CotMapComponent cmc = CotMapComponent.getInstance();
            if (cmc == null) return "CotMapComponent not available";

            cmc.getExternalDispatcher().dispatch(event, data);
            return "true";
        } catch (JSONException e) {
            Log.e(TAG, "Error sending CoT to contacts", e);
            return e.getMessage();
        }
    }

    private void startListening() {
        if (streaming) return;
        streaming = true;

        cotService = new CotServiceRemote();
        cotService.connect(new CotServiceRemote.ConnectionListener() {
            @Override
            public void onCotServiceConnected(Bundle fullServiceState) {
                cotListener = (event, extra) -> {
                    onCotReceived(event);
                };
                cotService.setCotEventListener(cotListener);
                Log.d(TAG, "CoT stream started");
            }

            @Override
            public void onCotServiceDisconnected() {
                Log.d(TAG, "CoT service disconnected");
            }
        });
    }

    private void stopListening() {
        if (!streaming) return;
        streaming = false;

        if (cotService != null) {
            cotService.setCotEventListener(null);
            cotService = null;
        }
        cotListener = null;

        debounceHandler.removeCallbacksAndMessages(null);
        pendingCot.clear();

        Log.d(TAG, "CoT stream stopped");
    }

    private void onCotReceived(CotEvent event) {
        if (event == null || !event.isValid()) return;
        try {
            JSONObject json = serializeCotEvent(event);
            pendingCot.put(event.getUID(), json);
            scheduleFlush();
        } catch (JSONException e) {
            Log.e(TAG, "Error serializing inbound CoT", e);
        }
    }

    private final Runnable flushRunnable = this::flush;

    private void scheduleFlush() {
        debounceHandler.removeCallbacks(flushRunnable);
        debounceHandler.postDelayed(flushRunnable, DEBOUNCE_MS);
    }

    private void flush() {
        if (pendingCot.isEmpty()) return;

        JSONArray batch = new JSONArray();
        for (JSONObject cot : pendingCot.values()) {
            batch.put(cot);
        }
        pendingCot.clear();

        emitter.emit("cotReceived", batch.toString());
    }

    private static JSONObject serializeCotEvent(CotEvent event) throws JSONException {
        JSONObject json = new JSONObject();
        json.put("uid", event.getUID());
        json.put("type", event.getType());
        json.put("how", event.getHow());

        CotPoint point = event.getCotPoint();
        if (point != null) {
            json.put("lat", point.getLat());
            json.put("lng", point.getLon());
            double alt = point.getHae();
            json.put("alt", Double.isNaN(alt) ? JSONObject.NULL : alt);
        }

        CoordinatedTime time = event.getTime();
        json.put("time", time != null ? time.getMilliseconds() : 0);

        CoordinatedTime stale = event.getStale();
        json.put("stale", stale != null ? stale.getMilliseconds() : 0);

        // Extract common detail fields
        CotDetail detail = event.getDetail();
        String callsign = "";
        String team = "";

        if (detail != null) {
            CotDetail contact = detail.getChild("contact");
            if (contact != null) {
                callsign = contact.getAttribute("callsign");
                if (callsign == null) callsign = "";
            }

            CotDetail group = detail.getChild("__group");
            if (group != null) {
                team = group.getAttribute("name");
                if (team == null) team = "";
            }
        }

        json.put("callsign", callsign);
        json.put("team", team);

        // Serialize full detail tree as nested object
        json.put("detail", detail != null ? serializeDetail(detail) : new JSONObject());

        return json;
    }

    private static JSONObject serializeDetail(CotDetail detail) throws JSONException {
        JSONObject json = new JSONObject();

        // Attributes
        CotAttribute[] attrs = detail.getAttributes();
        if (attrs != null) {
            for (CotAttribute attr : attrs) {
                json.put(attr.getName(), attr.getValue());
            }
        }

        // Child elements
        for (int i = 0; i < detail.childCount(); i++) {
            CotDetail child = detail.getChild(i);
            String name = child.getElementName();
            if (name != null) {
                json.put(name, serializeDetail(child));
            }
        }

        // Inner text
        String text = detail.getInnerText();
        if (text != null && !text.isEmpty()) {
            json.put("_text", text);
        }

        return json;
    }

    private static CotEvent buildCotEvent(JSONObject json) throws JSONException {
        CotEvent event = new CotEvent();
        event.setVersion("2.0");
        event.setUID(json.getString("uid"));
        event.setType(json.getString("type"));
        event.setHow(json.optString("how", "h-g-i-g-o"));

        double lat = json.getDouble("lat");
        double lng = json.getDouble("lng");
        double alt = json.optDouble("alt", 0);
        if (Double.isNaN(alt)) alt = 0;
        event.setPoint(new CotPoint(lat, lng, alt,
                CotPoint.UNKNOWN, CotPoint.UNKNOWN));

        CoordinatedTime now = new CoordinatedTime();
        event.setTime(now);
        event.setStart(now);

        int staleSeconds = json.optInt("stale", 300);
        event.setStale(new CoordinatedTime(now.getMilliseconds() + staleSeconds * 1000L));

        // Build detail
        CotDetail detail = new CotDetail("detail");

        JSONObject detailJson = json.optJSONObject("detail");
        if (detailJson != null) {
            // Contact
            JSONObject contactJson = detailJson.optJSONObject("contact");
            if (contactJson != null) {
                CotDetail contact = new CotDetail("contact");
                Iterator<String> keys = contactJson.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    contact.setAttribute(key, contactJson.optString(key));
                }
                detail.addChild(contact);
            }

            // Group
            JSONObject groupJson = detailJson.optJSONObject("__group");
            if (groupJson != null) {
                CotDetail group = new CotDetail("__group");
                Iterator<String> keys = groupJson.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    group.setAttribute(key, groupJson.optString(key));
                }
                detail.addChild(group);
            }
        }

        event.setDetail(detail);
        return event;
    }

    public void dispose() {
        refCount = 0;
        stopListening();
    }
}
