package com.atakmap.android.reactive.bridge;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.atakmap.android.contact.Connector;
import com.atakmap.android.contact.Contact;
import com.atakmap.android.contact.Contacts;
import com.atakmap.android.contact.IndividualContact;
import com.atakmap.android.maps.PointMapItem;
import com.atakmap.coremap.log.Log;
import com.atakmap.coremap.maps.coords.GeoPoint;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Collection;
import java.util.List;

/**
 * Contact bridge — serializes contact list and emits changes to JS.
 */
public class ContactBridge implements Contacts.OnContactsChangedListener {

    private static final String TAG = "ContactBridge";
    private static final long DEBOUNCE_MS = 250;

    private final BridgeEventEmitter emitter;
    private final Handler debounceHandler = new Handler(Looper.getMainLooper());
    private boolean listening = false;
    private final Runnable debounceRunnable = this::emitAll;

    public ContactBridge(BridgeEventEmitter emitter) {
        this.emitter = emitter;
    }

    public void start() {
        if (listening) return;
        listening = true;
        try {
            Contacts contacts = Contacts.getInstance();
            if (contacts != null) {
                contacts.addListener(this);
                emitAll();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting contact bridge", e);
        }
    }

    public void stop() {
        listening = false;
        debounceHandler.removeCallbacksAndMessages(null);
        try {
            Contacts contacts = Contacts.getInstance();
            if (contacts != null) {
                contacts.removeListener(this);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping contact bridge", e);
        }
    }

    @Override
    public void onContactsSizeChange(Contacts contacts) {
        scheduleEmit();
    }

    @Override
    public void onContactChanged(String uuid) {
        scheduleEmit();
    }

    private void scheduleEmit() {
        if (!listening) return;
        debounceHandler.removeCallbacks(debounceRunnable);
        debounceHandler.postDelayed(debounceRunnable, DEBOUNCE_MS);
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
            json.put("uid", c.getUid());
            json.put("name", c.getName());

            boolean isIndividual = c instanceof IndividualContact;
            json.put("type", isIndividual ? "individual" : "group");

            // Status from enum
            Contact.UpdateStatus status = c.getUpdateStatus();
            json.put("status", status != null ? status.name().toLowerCase() : "na");

            // Team and role from extras
            Bundle extras = c.getExtras();
            if (extras != null) {
                String team = extras.getString("team");
                String role = extras.getString("role");
                json.put("team", team != null ? team : JSONObject.NULL);
                json.put("role", role != null ? role : JSONObject.NULL);
            } else {
                json.put("team", JSONObject.NULL);
                json.put("role", JSONObject.NULL);
            }

            json.put("unreadCount", c.getUnreadCount());

            if (isIndividual) {
                IndividualContact ic = (IndividualContact) c;
                boolean hasLoc = ic.hasLocation();
                json.put("hasLocation", hasLoc);
                if (hasLoc && ic.getMapItem() instanceof PointMapItem) {
                    GeoPoint pt = ((PointMapItem) ic.getMapItem()).getPoint();
                    if (pt != null) {
                        json.put("lat", pt.getLatitude());
                        json.put("lng", pt.getLongitude());
                    }
                }

                // Connector types
                JSONArray connArr = new JSONArray();
                Collection<Connector> connectors = ic.getConnectors(false);
                if (connectors != null) {
                    for (Connector conn : connectors) {
                        connArr.put(conn.getConnectionType());
                    }
                }
                json.put("connectorTypes", connArr);
            } else {
                json.put("hasLocation", false);
                json.put("connectorTypes", new JSONArray());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error serializing contact: " + c.getUid(), e);
        }
        return json;
    }

    public void dispose() {
        stop();
    }
}
