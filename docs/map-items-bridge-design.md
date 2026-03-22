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

## Delta Event Format

```json
{
  "type": "mapItemsChanged",
  "subscriptionId": "sub_1",
  "added": [ { ... item ... } ],
  "removed": [ "uid-1", "uid-2" ],
  "updated": [ { "uid": "uid-3", "lat": 38.90, "lng": -77.04 } ]
}
```

- `added`: Full item objects
- `removed`: Just UIDs
- `updated`: Partial objects — only changed fields + uid

## Implementation Phases

### Phase 1: Read-Only Queries
- `getMapItems(filter)` bridge method
- `getMapItem(uid)` bridge method
- `getMapGroups()` bridge method
- `useMapItems()`, `useMapItem()`, `useMapGroups()` hooks
- No live updates — hooks poll or refresh on mount

### Phase 2: Live Updates
- `MapItemEventRelay` listens globally for ITEM_ADDED/REMOVED
- Subscription system — JS subscribes with a filter, Java pushes matching deltas
- `useMapItems()` becomes truly reactive
- Debouncing and batching

### Phase 3: Per-Item Tracking
- `useMapItem(uid)` subscribes to OnPointChanged + OnMetadataChanged for that item
- Real-time position tracking for individual items
- Auto-unsubscribe on component unmount

### Phase 4: Advanced Queries
- Geo-radius search (`near` filter)
- Pagination for large result sets
- Custom metadata queries
- Type hierarchy awareness (a-f-* matching)

## Risks

1. **Performance on large maps**: Serializing 1000+ items to JSON is expensive. Mitigated by filters and pagination.
2. **Event flood**: Rapid GPS updates for many tracked items. Mitigated by debouncing.
3. **Thread contention**: Bridge calls and event dispatch on different threads. Mitigated by posting to correct threads.
4. **Memory leaks**: Forgotten subscriptions holding listener references. Mitigated by auto-cleanup on dropdown close.
5. **Stale data**: Delta updates could get out of sync. Include sequence numbers or periodic full refresh as safety net.

## Open Questions

1. Should `useMapItems()` return items from ALL groups or only "Cursor on Target"? Default to all, filter to narrow.
2. Should we expose the group tree hierarchy or flatten it? Start flat (group name as string), add hierarchy later if needed.
3. Should `updated` deltas include the full item or just changed fields? Partial for performance, full as option.
4. How to handle items with no position (non-PointMapItem)? Include with null lat/lng or filter out? Include with null.
5. Max reasonable subscription count per plugin? Start with 5, warn above 10.
