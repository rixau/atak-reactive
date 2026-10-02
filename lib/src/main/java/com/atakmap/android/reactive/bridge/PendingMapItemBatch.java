package com.atakmap.android.reactive.bridge;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * One un-flushed batch of map item changes, coalesced per uid.
 *
 * The JS store applies a batch as removals, then updates, then additions,
 * whatever order the changes happened in. So the batch has to hold the net
 * result per uid, or the store ends up with the wrong state:
 *
 * <ul>
 *   <li>An update to an item added in the same batch replaces the added
 *       entry. Otherwise the store applies the update and then overwrites it
 *       with the stale added snapshot.</li>
 *   <li>A removal drops any pending update or addition for that uid.
 *       Otherwise the store deletes the item and the update or addition puts
 *       it back.</li>
 * </ul>
 *
 * Not thread-safe; MapItemEventRelay guards it with its pending lock.
 * Kept free of Android and ATAK types so it can be unit tested on the JVM.
 */
class PendingMapItemBatch {

    private final Map<String, JSONObject> added = new LinkedHashMap<>();
    private final Set<String> removed = new LinkedHashSet<>();
    private final Map<String, JSONObject> updated = new LinkedHashMap<>();

    void add(String uid, JSONObject data) {
        // A pending update predates this snapshot, so it is stale.
        updated.remove(uid);
        added.put(uid, data);
    }

    void update(String uid, JSONObject data) {
        if (added.containsKey(uid)) {
            added.put(uid, data);
        } else {
            updated.put(uid, data);
        }
    }

    void remove(String uid) {
        added.remove(uid);
        updated.remove(uid);
        removed.add(uid);
    }

    boolean isEmpty() {
        return added.isEmpty() && removed.isEmpty() && updated.isEmpty();
    }

    JSONArray addedArray() {
        return new JSONArray(added.values());
    }

    JSONArray removedArray() {
        return new JSONArray(removed);
    }

    JSONArray updatedArray() {
        return new JSONArray(updated.values());
    }
}
