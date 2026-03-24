package com.atakmap.android.reactive.bridge;

import android.os.Handler;
import android.os.Looper;

import com.atakmap.android.contact.Contact;
import com.atakmap.android.contact.Contacts;
import com.atakmap.android.contact.GroupContact;
import com.atakmap.android.contact.IndividualContact;
import com.atakmap.android.maps.MapItem;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.coremap.log.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;

/**
 * Bridge for reactive contact list subscription.
 * Listens to Contacts.OnContactsChangedListener and emits full contact list
 * to JavaScript on each change (debounced at 250ms).
 */
public class ContactBridge implements Contacts.OnContactsChangedListener {

    private static final String TAG = "ContactBridge";
    private static final long DEBOUNCE_MS = 250;

    private final BridgeEventEmitter emitter;
    private final Handler debounceHandler = new Handler(Looper.getMainLooper());
    private Runnable pendingEmit;
    private boolean active = false;

    public ContactBridge(BridgeEventEmitter emitter) {
        this.emitter = emitter;
    }

    public void start() {
        if (active) return;
        active = true;
        Contacts.getInstance().addListener(this);
        emitAll();
    }

    public void stop() {
        if (!active) return;
        active = false;
        Contacts.getInstance().removeListener(this);
        if (pendingEmit != null) {
            debounceHandler.removeCallbacks(pendingEmit);
            pendingEmit = null;
        }
    }

    @Override
    public void onContactsSizeChange(Contacts contacts) {
        debounceEmit();
    }

    @Override
    public void onContactChanged(String uuid) {
        debounceEmit();
    }

    private void debounceEmit() {
        if (pendingEmit != null) {
            debounceHandler.removeCallbacks(pendingEmit);
        }
        pendingEmit = () -> {
            pendingEmit = null;
            emitAll();
        };
        debounceHandler.postDelayed(pendingEmit, DEBOUNCE_MS);
    }

    private void emitAll() {
        try {
            List<Contact> all = Contacts.getInstance().getAllContacts();
            JSONArray arr = new JSONArray();
            for (Contact c : all) {
                arr.put(serializeContact(c));
            }
            emitter.emit("contactsChanged", arr.toString());
        } catch (Exception e) {
            Log.e(TAG, "Error emitting contacts", e);
        }
    }

    JSONObject serializeContact(Contact c) throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("uid", c.getUID());
        obj.put("name", c.getName());

        if (c instanceof IndividualContact) {
            IndividualContact ic = (IndividualContact) c;
            obj.put("type", "individual");

            // Status
            String status = "na";
            if (ic.getExtras() != null && ic.getExtras().containsKey("updateStatus")) {
                Object s = ic.getExtras().get("updateStatus");
                if (s != null) {
                    status = s.toString().toLowerCase();
                }
            }
            obj.put("status", status);

            // Team and role from extras
            String team = ic.getExtras() != null ? ic.getExtras().getString("team") : null;
            String role = ic.getExtras() != null ? ic.getExtras().getString("role") : null;
            obj.put("team", team != null ? team : JSONObject.NULL);
            obj.put("role", role != null ? role : JSONObject.NULL);

            // Connector types
            JSONArray connTypes = new JSONArray();
            if (ic.getConnectors() != null) {
                for (Object connKey : ic.getConnectors().keySet()) {
                    connTypes.put(connKey.toString());
                }
            }
            obj.put("connectorTypes", connTypes);

            // Unread count
            int unread = 0;
            if (ic.getExtras() != null) {
                unread = ic.getExtras().getInt("unreadMessageCount", 0);
            }
            obj.put("unreadCount", unread);

            // Location from associated map item
            MapItem mi = ic.getMapItem();
            if (mi instanceof PointMapItem) {
                PointMapItem pmi = (PointMapItem) mi;
                obj.put("hasLocation", true);
                obj.put("lat", pmi.getPoint().getLatitude());
                obj.put("lng", pmi.getPoint().getLongitude());
            } else {
                obj.put("hasLocation", false);
            }
        } else if (c instanceof GroupContact) {
            GroupContact gc = (GroupContact) c;
            obj.put("type", "group");
            obj.put("status", "na");
            obj.put("team", JSONObject.NULL);
            obj.put("role", JSONObject.NULL);
            obj.put("connectorTypes", new JSONArray());
            obj.put("unreadCount", gc.getUnreadCount());
            obj.put("hasLocation", false);
        }

        return obj;
    }
}
