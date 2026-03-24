package com.atakmap.android.reactive.bridge;

import android.os.Handler;
import android.os.Looper;

import com.atakmap.android.contact.Contact;
import com.atakmap.android.contact.Contacts;
import com.atakmap.android.contact.IndividualContact;
import com.atakmap.coremap.log.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

/**
 * Contact bridge — serializes contact list and emits changes to JS.
 *
 * TODO: Fix getConnectors() and extras access against actual ATAK 5.6.0 SDK API.
 */
public class ContactBridge {

    private static final String TAG = "ContactBridge";
    private static final long DEBOUNCE_MS = 250;

    private final BridgeEventEmitter emitter;
    private final Handler debounceHandler = new Handler(Looper.getMainLooper());
    private boolean listening = false;

    public ContactBridge(BridgeEventEmitter emitter) {
        this.emitter = emitter;
    }

    public void start() {
        if (listening) return;
        listening = true;
        try {
            Contacts contacts = Contacts.getInstance();
            if (contacts != null) {
                emitAll();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting contact bridge", e);
        }
    }

    public void stop() {
        listening = false;
        debounceHandler.removeCallbacksAndMessages(null);
    }

    private void emitAll() {
        try {
            Contacts contacts = Contacts.getInstance();
            if (contacts == null) return;

            List<Contact> all = contacts.getAllContacts();
            JSONArray arr = new JSONArray();
            for (Contact c : all) {
                arr.put(serializeContact(c));
            }
            emitter.emit("contactsChanged", arr.toString());
        } catch (Exception e) {
            Log.e(TAG, "Error serializing contacts", e);
        }
    }

    private JSONObject serializeContact(Contact c) {
        JSONObject json = new JSONObject();
        try {
            json.put("uid", c.getUID());
            json.put("name", c.getName());
            json.put("type", c instanceof IndividualContact ? "individual" : "group");
            json.put("status", "na");
            json.put("team", JSONObject.NULL);
            json.put("role", JSONObject.NULL);
            json.put("unreadCount", 0);
            json.put("hasLocation", false);
            json.put("connectorTypes", new JSONArray());
        } catch (Exception e) {
            Log.e(TAG, "Error serializing contact: " + c.getUID(), e);
        }
        return json;
    }

    public void dispose() {
        stop();
    }
}
