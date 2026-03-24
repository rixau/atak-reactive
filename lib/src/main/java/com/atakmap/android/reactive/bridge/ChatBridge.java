package com.atakmap.android.reactive.bridge;

import android.os.Bundle;
import android.webkit.JavascriptInterface;

import com.atakmap.android.chat.ChatDatabase;
import com.atakmap.android.chat.ChatManagerMapComponent;
import com.atakmap.android.contact.Contact;
import com.atakmap.android.contact.Contacts;
import com.atakmap.android.contact.IndividualContact;
import com.atakmap.android.maps.MapView;
import com.atakmap.coremap.log.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;
import java.util.UUID;

/**
 * Bridge for chat message send/receive and history.
 * Listens to ChatMessageListener for live messages.
 * Exposes send, history, and conversation methods via JavascriptInterface.
 */
public class ChatBridge implements ChatManagerMapComponent.ChatMessageListener {

    private static final String TAG = "ChatBridge";

    private final BridgeEventEmitter emitter;
    private final MapView mapView;
    private boolean active = false;

    public ChatBridge(MapView mapView, BridgeEventEmitter emitter) {
        this.mapView = mapView;
        this.emitter = emitter;
    }

    public void start() {
        if (active) return;
        active = true;
        ChatManagerMapComponent.getInstance().addChatMessageListener(this);
    }

    public void stop() {
        if (!active) return;
        active = false;
        ChatManagerMapComponent.getInstance().removeChatMessageListener(this);
    }

    @Override
    public void chatMessageReceived(Bundle bundle) {
        try {
            JSONObject msg = serializeMessage(bundle);
            emitter.emit("chatMessage", msg.toString());
        } catch (Exception e) {
            Log.e(TAG, "Error emitting chat message", e);
        }
    }

    @JavascriptInterface
    public String getHistory(String conversationId, int limit) {
        try {
            List<Bundle> history = ChatDatabase.getInstance(mapView.getContext())
                    .getHistory(conversationId, limit, false);
            JSONArray arr = new JSONArray();
            for (Bundle b : history) {
                arr.put(serializeMessage(b));
            }
            return arr.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error getting chat history", e);
            return "[]";
        }
    }

    @JavascriptInterface
    public void sendMessage(String conversationId, String text) {
        try {
            Contact contact = Contacts.getInstance().getContactByUuid(conversationId);
            if (contact instanceof IndividualContact) {
                Bundle msgBundle = new Bundle();
                msgBundle.putString("message", text);
                msgBundle.putString("conversationId", conversationId);
                msgBundle.putString("messageId", UUID.randomUUID().toString());

                com.atakmap.android.chat.GeoChatService.getInstance()
                        .sendMessage(msgBundle, (IndividualContact) contact);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending chat message", e);
        }
    }

    @JavascriptInterface
    public String getConversations() {
        try {
            ChatDatabase db = ChatDatabase.getInstance(mapView.getContext());
            List<String> ids = db.getPersistedConversationIds();
            JSONArray arr = new JSONArray();
            for (String id : ids) {
                JSONObject info = new JSONObject();
                info.put("conversationId", id);
                Contact c = Contacts.getInstance().getContactByUuid(id);
                info.put("conversationName", c != null ? c.getName() : id);
                info.put("unreadCount", 0);
                arr.put(info);
            }
            return arr.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error getting conversations", e);
            return "[]";
        }
    }

    @JavascriptInterface
    public void openConversation(String contactUid) {
        try {
            android.content.Intent intent = new android.content.Intent(
                    "com.atakmap.android.maps.OPEN_CHAT");
            intent.putExtra("targetUID", contactUid);
            com.atakmap.android.ipc.AtakBroadcast.getInstance().sendBroadcast(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error opening conversation", e);
        }
    }

    JSONObject serializeMessage(Bundle b) throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("conversationId", b.getString("conversationId", ""));
        obj.put("conversationName", b.getString("conversationName", ""));
        obj.put("messageId", b.getString("messageId", ""));
        obj.put("message", b.getString("message", ""));
        obj.put("senderUid", b.getString("senderUid", ""));
        obj.put("senderName", b.getString("senderCallsign",
                b.getString("senderName", "")));
        obj.put("timeSent", b.getLong("sentTime", 0));
        obj.put("timeReceived", b.getLong("receiveTime", System.currentTimeMillis()));

        String status = b.getString("status", "none");
        obj.put("status", status != null ? status.toLowerCase() : "none");

        // Sender location if available
        if (b.containsKey("lat") && b.containsKey("lon")) {
            obj.put("lat", b.getDouble("lat"));
            obj.put("lng", b.getDouble("lon"));
        }

        return obj;
    }
}
