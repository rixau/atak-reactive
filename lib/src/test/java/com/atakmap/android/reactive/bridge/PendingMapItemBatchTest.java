package com.atakmap.android.reactive.bridge;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public class PendingMapItemBatchTest {

    private static JSONObject item(String uid, String title) throws Exception {
        return new JSONObject().put("uid", uid).put("title", title);
    }

    @Test
    public void startsEmpty() {
        PendingMapItemBatch batch = new PendingMapItemBatch();
        assertTrue(batch.isEmpty());
        assertEquals(0, batch.addedArray().length());
        assertEquals(0, batch.removedArray().length());
        assertEquals(0, batch.updatedArray().length());
    }

    @Test
    public void updateOfItemAddedInSameBatchReplacesTheAddedEntry() throws Exception {
        // addMarker then updateMarker inside one flush window. The store applies
        // updates before additions, so an update left in `updated` would be
        // overwritten by the stale added snapshot.
        PendingMapItemBatch batch = new PendingMapItemBatch();
        batch.add("m1", item("m1", "Marker"));
        batch.update("m1", item("m1", "UPDATED_MARKER"));

        JSONArray added = batch.addedArray();
        assertEquals(1, added.length());
        assertEquals("UPDATED_MARKER", added.getJSONObject(0).getString("title"));
        assertEquals(0, batch.updatedArray().length());
    }

    @Test
    public void removalDropsPendingUpdate() throws Exception {
        // update then remove inside one flush window. The store applies removals
        // before updates, so a surviving update would bring the item back.
        PendingMapItemBatch batch = new PendingMapItemBatch();
        batch.update("m1", item("m1", "UPDATED_MARKER"));
        batch.remove("m1");

        assertEquals(0, batch.updatedArray().length());
        assertEquals(0, batch.addedArray().length());
        assertEquals("m1", batch.removedArray().getString(0));
    }

    @Test
    public void removalDropsPendingAddition() throws Exception {
        PendingMapItemBatch batch = new PendingMapItemBatch();
        batch.add("m1", item("m1", "Marker"));
        batch.remove("m1");

        assertEquals(0, batch.addedArray().length());
        assertEquals(0, batch.updatedArray().length());
        assertEquals(1, batch.removedArray().length());
    }

    @Test
    public void reAddAfterRemovalKeepsBothSoTheStoreEndsWithTheItem() throws Exception {
        PendingMapItemBatch batch = new PendingMapItemBatch();
        batch.remove("m1");
        batch.add("m1", item("m1", "Again"));

        assertEquals(1, batch.removedArray().length());
        assertEquals("Again", batch.addedArray().getJSONObject(0).getString("title"));
    }

    @Test
    public void additionSupersedesEarlierUpdate() throws Exception {
        PendingMapItemBatch batch = new PendingMapItemBatch();
        batch.update("m1", item("m1", "old"));
        batch.add("m1", item("m1", "new"));

        assertEquals(0, batch.updatedArray().length());
        assertEquals("new", batch.addedArray().getJSONObject(0).getString("title"));
    }

    @Test
    public void repeatedUpdatesKeepOnlyTheLatest() throws Exception {
        PendingMapItemBatch batch = new PendingMapItemBatch();
        batch.update("m1", item("m1", "a"));
        batch.update("m2", item("m2", "x"));
        batch.update("m1", item("m1", "b"));

        JSONArray updated = batch.updatedArray();
        assertEquals(2, updated.length());
        assertEquals("b", updated.getJSONObject(0).getString("title"));
        assertEquals("x", updated.getJSONObject(1).getString("title"));
        assertFalse(batch.isEmpty());
    }

    @Test
    public void duplicateRemovalsAreReportedOnce() {
        PendingMapItemBatch batch = new PendingMapItemBatch();
        batch.remove("m1");
        batch.remove("m1");
        assertEquals(1, batch.removedArray().length());
    }
}
