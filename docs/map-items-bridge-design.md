# Map Items Bridge — Design Document

## Goal

Give React developers a reactive view into ATAK's map state. Items on the map should be queryable, filterable, and auto-updating — like a read-only store that stays in sync with the map.

## Target API (React-first)

```tsx
// All items on the map
const items = useMapItems();

// Filtered by CoT type prefix
const friendlies = useMapItems({ type: 'a-f-*' });
const hostiles = useMapItems({ type: 'a-h-*' });

// Filtered by group
const waypoints = useMapItems({ group: 'Waypoint' });

// Filtered by metadata
const redTeam = useMapItems({ meta: { team: 'red' } });

// Combined filters
const nearbyFriendlies = useMapItems({
  type: 'a-f-*',
  near: { lat: 38.89, lng: -77.03, radius: 5000 },
});

// Single item by UID (reactive — updates on move/change)
const item = useMapItem('some-uid');

// Markers created by this plugin
const myMarkers = usePluginMarkers();
```

## ATAK Map Item System (Summary)

### Hierarchy
```
MapItem (abstract)
  └── PointMapItem (abstract)
      └── Marker (final)
```

### Group Tree
```
Root
├── Cursor on Target
│   ├── Friendly
│   ├── Hostile
│   ├── Neutral
│   ├── Unknown
│   └── Waypoint
├── Emergency
├── Drawing Objects
├── Route
├── SPIs
├── Other
└── [Plugin-created groups]
```

### Key Properties Per Item
| Property | Source | Notes |
|----------|--------|-------|
| uid | `getUID()` | Unique, O(1) lookup via RootMapGroup index |
| type | `getType()` | CoT type string (e.g. `a-f-G-U-C-I`) |
| title | `getTitle()` | Display name |
| lat/lng/alt | `getPoint()` | Geographic position (PointMapItem only) |
| visible | `getVisible()` | Draw visibility |
| group | `getGroup().getFriendlyName()` | Parent group name |
| callsign | `getMetaString("callsign", "")` | Unit callsign |
| team | `getMetaString("team", "")` | Team/side |
| how | `getMetaString("how", "")` | Creation method |
| remarks | `getMetaString("remarks", "")` | Notes |
| editable | `getMetaBoolean("editable", false)` | Can be edited |
| movable | `getMetaBoolean("movable", false)` | Can be moved |
| speed | `getMetaDouble("Speed.value", 0)` | Speed m/s |
| bearing | `getMetaDouble("Speed.heading", 0)` | Heading degrees |

### Available Events
| Event | Fires When |
|-------|-----------|
| `ITEM_ADDED` | Item added to any group |
| `ITEM_REMOVED` | Item removed from any group |
| `ITEM_REFRESH` | Item data changed |
| `ITEM_CLICK` | Item tapped |
| `ITEM_LONG_PRESS` | Item long-pressed |
| `ITEM_DRAG_DROPPED` | Item drag finished |

### Per-Item Listeners
| Listener | Fires When |
|----------|-----------|
| `OnPointChangedListener` | Location changed |
| `OnVisibleChangedListener` | Visibility changed |
| `OnMetadataChangedListener` | Specific metadata key changed |
| `OnTypeChangedListener` | Type changed |
| `OnGroupChangedListener` | Moved between groups |

## Architecture

### Bridge Layer (Java)

```
AtakBridge.java (existing)
  + getMapItems(filterJson) → JSON array
  + getMapItem(uid) → JSON object
  + getMapGroups() → JSON array of group names

MapItemQueryEngine.java (new)
  - Handles filter parsing and efficient queries
  - Uses RootMapGroup.deepFindUID() for single lookups (O(1))
  - Uses deepForEachItem with callbacks for filtered queries
  - Caches results with TTL to avoid repeated traversals

MapItemEventRelay.java (new)
  - Listens to ITEM_ADDED, ITEM_REMOVED, ITEM_REFRESH globally
  - Tracks per-item OnPointChangedListener for subscribed items
  - Debounces rapid updates (GPS updates come every second)
  - Pushes deltas to JS via BridgeEventEmitter
```

### SDK Layer (TypeScript)

```
mapItems.ts (new)
  - getMapItems(filter?) → MapItemData[]
  - getMapItem(uid) → MapItemData | null
  - getMapGroups() → string[]

mapItemEvents.ts (new)
  - Subscribe/unsubscribe for item change events
  - Delta-based updates (added/removed/changed)

hooks.ts (extend)
  + useMapItems(filter?) → MapItemData[]
  + useMapItem(uid) → MapItemData | null
  + usePluginMarkers() → MapItemData[]
  + useMapGroups() → string[]
```

### Data Flow

```
ATAK Map State
    │
    │ ITEM_ADDED / ITEM_REMOVED / OnPointChanged
    ▼
MapItemEventRelay (Java)
    │
    │ Debounce (100ms)
    │ Filter by active subscriptions
    ▼
BridgeEventEmitter
    │
    │ evaluateJavascript("window.__atakBridge.emit(...)")
    ▼
mapItemEvents.ts
    │
    │ Update internal store
    ▼
useMapItems() hook
    │
    │ React re-render
    ▼
UI
```

## Performance Considerations

### Problem: Scale
ATAK can have thousands of items. Serializing all of them to JSON on every change is not viable.

### Solution: Subscription-Based Updates

1. **Initial load**: `getMapItems(filter)` returns full snapshot (paginated if needed)
2. **Live updates**: Only push deltas — `{added: [...], removed: [...], updated: [...]}`
3. **Subscriptions are filtered**: Java side only pushes items matching the active filter
4. **Debouncing**: GPS updates come every ~1s per item. Batch updates every 100ms.
5. **Pagination**: `getMapItems` accepts `limit` and `offset` for large result sets

### Memory
- Java side: No extra storage — queries run against existing MapGroup tree
- JS side: Store only items matching active subscriptions
- Cleanup: Unsubscribe removes listeners and clears JS cache

### Thread Safety
- `getMapItems()` runs on WebView's JavaBridge thread
- Must post to UI thread for map operations (`mapView.post()`)
- Event listeners fire on the event dispatch thread (usually main)
- JSON serialization should happen off-main-thread for large sets

## Filter Format

```json
{
  "type": "a-f-*",
  "group": "Cursor on Target",
  "visible": true,
  "meta": {
    "team": "red",
    "editable": "true"
  },
  "near": {
    "lat": 38.89,
    "lng": -77.03,
    "radius": 5000
  },
  "limit": 100,
  "offset": 0
}
```

All fields optional. Omitted fields = no filter on that dimension. `type` supports wildcard suffix (`a-f-*` matches any type starting with `a-f-`).

## Serialized Item Format

```json
{
  "uid": "abc-123",
  "type": "a-f-G-U-C-I",
  "title": "Alpha 1",
  "lat": 38.8977,
  "lng": -77.0365,
  "alt": 15.0,
  "visible": true,
  "group": "Friendly",
  "callsign": "ALPHA-1",
  "team": "red",
  "speed": 2.5,
  "bearing": 45.0,
  "remarks": "",
  "how": "h-g-i-g-o",
  "editable": false,
  "movable": false
}
```

Fixed set of common fields. Plugins can access additional metadata via `getMapItemMeta(uid, key)` bridge method.

## Update Event Format

Events push full item objects — no partial deltas. Simpler SDK, no merge logic, no cache synchronization edge cases. Each update is self-contained.

```json
{
  "type": "mapItemsChanged",
  "subscriptionId": "sub_1",
  "added": [ { ...full item... } ],
  "removed": [ "uid-1", "uid-2" ],
  "updated": [ { ...full item... } ]
}
```

- `added`: Full item objects for new items matching the filter
- `removed`: UIDs of items that no longer match (removed from map or no longer pass filter)
- `updated`: Full item objects for items whose properties changed

Tradeoff: more bandwidth than partial updates, but eliminates the need for a client-side cache with merge logic. For typical plugin use (dozens of tracked items), this is fine. Can optimize to partials later if performance demands it.

## Reactive Model (No Polling)

Hooks are fully reactive — no polling, no manual refresh. Data flows from ATAK → Java → JS → React re-render.

1. Hook mounts → bridge call for initial snapshot
2. Java registers listeners for matching changes (ITEM_ADDED, ITEM_REMOVED, OnPointChanged, etc.)
3. Changes push full items to JS via `evaluateJavascript`
4. Hook state updates → React re-renders
5. Hook unmounts → Java unregisters listeners

Same pattern as `useSelfLocation()` which already works. The developer sees:

```tsx
const items = useMapItems({ type: 'a-f-*' });
// Always current. No refresh needed. Cleans up on unmount.
```

## Implementation Phases

### Phase 1: Queries + Subscriptions
- `MapItemQueryEngine.java` — filter parsing, efficient queries against MapGroup tree
- `MapItemEventRelay.java` — global listeners for ITEM_ADDED/REMOVED/REFRESH, per-item OnPointChanged tracking
- `getMapItems(filter)`, `getMapItem(uid)`, `getMapGroups()` bridge methods
- `subscribeMapItems(filter)`, `unsubscribeMapItems(id)` bridge methods
- SDK: `useMapItems(filter?)`, `useMapItem(uid)`, `useMapGroups()` hooks
- SDK: `usePluginMarkers()` hook (items created by this plugin)
- Debouncing (100ms batches) to prevent event floods from GPS updates

### Phase 2: Advanced Queries
- Geo-radius search (`near` filter)
- Pagination (`limit`/`offset`) for large result sets
- Group tree hierarchy via `useMapGroups()` returning nested structure

### Phase 3: Write Operations
- `updateMapItem(uid, changes)` — update existing items (not just plugin-created ones)
- Optimistic updates in the SDK — update local state immediately, reconcile with Java response

## Design Decisions

### 1. No default group filter
`useMapItems()` with no filter returns ALL items from all groups. Use `{ group: 'Cursor on Target' }` to narrow. The developer queries what they need — no hidden assumptions about ATAK's group structure.

### 2. Group tree is exposed
Groups are part of ATAK's data model — expose them as-is. `useMapGroups()` returns the hierarchy. Consistent with ATAK, not a simplified abstraction over it.

### 3. Full items in updates (not partials)
Each update event includes full item objects. No client-side cache merging. Simpler SDK, no sync edge cases. Trade bandwidth for simplicity.

### 4. Items without position are included
Non-PointMapItem items (routes, drawing objects) have `lat: null, lng: null`. Included by default, filterable by the developer. Consistent with ATAK's model where not all map items are points.

### 5. No subscription limits
Let the developer manage their own subscriptions. The hook lifecycle handles cleanup — subscriptions are removed when components unmount. No artificial caps.

## Risks

1. **Performance on large maps**: Serializing 1000+ items to JSON is expensive. Mitigated by filters — developers should always filter, not query everything.
2. **Event flood**: Rapid GPS updates for many tracked items. Mitigated by debouncing (100ms batches).
3. **Thread contention**: Bridge calls and event dispatch on different threads. Mitigated by posting to correct threads.
4. **Memory leaks**: Forgotten subscriptions holding listener references. Mitigated by auto-cleanup on dropdown close and hook unmount.
5. **Stale data**: Full-item updates reduce sync issues. Periodic full refresh as safety net if needed.
