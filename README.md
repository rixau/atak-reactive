# atak-reactive

Build ATAK plugin UIs with React. Add React screens to any existing plugin — one screen at a time, alongside your native Android UI — with instant hot-reload during development.

## How It Works

Your plugin's React UI runs in a WebView panel. A typed JavaScript bridge connects it to ATAK's map engine — markers, map items, GPS, CoT messaging, intents, coordinates, and preferences. During development, Vite serves the UI with hot module replacement. For release, assets are bundled into the APK.

## Quick Start

```bash
# 1. Initialize (from any existing ATAK plugin root)
npx @atak-reactive/cli init

# 2. Build and install
npx @atak-reactive/cli build
./gradlew assembleCivDebug
adb install -r app/build/outputs/apk/civ/debug/*.apk

# 3. Develop with hot reload
npx @atak-reactive/cli dev
```

## React Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useMapItems(filter?)` | `MapItemData[]` | Live array of map items. Filters by `type`, `group`, `visible`, `meta`. Updates on add/remove/change. |
| `useMapItem(uid)` | `MapItemData \| null` | Single item by UID with live updates. |
| `useMapGroups()` | `MapGroupData[]` | Map group tree. Refreshes on structural changes only. |
| `usePluginMarkers()` | `MapItemData[]` | Items created by this plugin via `addMarker()`. |
| `useSelfLocation()` | `SelfLocation \| null` | GPS position, bearing, speed. Subscribes to updates. |
| `useMapEvent(event)` | `EventPayload \| null` | Last received map event (`mapClick`, `mapLongPress`, `itemSelected`). |
| `useAtakEvent(event, cb)` | `void` | Callback on each map event. |
| `useCotStream(filter?)` | `CotEventData[]` | Live inbound CoT messages. Filter by type with wildcard. |
| `useCotEvent(cb)` | `void` | Raw callback for every inbound CoT. No state, no dedup. |
| `useIntent(action)` | `IntentData \| null` | Last received ATAK broadcast matching action. |
| `useIntentCallback(action, cb)` | `void` | Callback on each matching broadcast. |
| `useCoordinateFormat()` | `string` | User's preferred coordinate format (`dd`, `dm`, `dms`, `mgrs`, `utm`). |

## Functions

| Function | Description |
|----------|-------------|
| `addMarker(opts)` | Create a marker. Returns UID. |
| `updateMarker(uid, opts)` | Update marker title, type, or position. |
| `removeMarker(uid)` | Remove a marker from the map. |
| `panTo(lat, lng, zoom?)` | Pan the map camera to a location. |
| `getSelfLocation()` | One-shot GPS position. |
| `getMapCenter()` | Current map center point. |
| `getPreference(key)` | Read an ATAK preference. |
| `setItemMeta(uid, key, value)` | Write string metadata on any map item. Triggers reactive update. |
| `setItemMetaDouble(uid, key, value)` | Write double metadata. |
| `setItemMetaBool(uid, key, value)` | Write boolean metadata. |
| `getItemMeta(uid, key)` | Read metadata from any map item. |
| `sendCot(event, dispatch)` | Send a CoT message. Dispatch: `'external'`, `'internal'`, or `'both'`. |
| `sendCotToContacts(event, uids)` | Unicast CoT to specific contacts. |
| `sendBroadcast(action, extras?)` | Send an ATAK internal broadcast. |
| `registerAction(action)` | Register to receive an ATAK broadcast action. |
| `unregisterAction(action)` | Unregister a broadcast action. |
| `toMGRS(lat, lng)` | Convert to MGRS string. |
| `toUTM(lat, lng)` | Convert to UTM string. |
| `fromMGRS(mgrs)` | Parse MGRS to `{ lat, lng }`. |
| `fromUTM(utm)` | Parse UTM to `{ lat, lng }`. |
| `formatCoordinate(lat, lng)` | Format in user's preferred coordinate system. |
| `distanceTo(p1, p2)` | Distance (meters) and bearing (degrees) between two points. |
| `isNative()` | `true` when running inside ATAK, `false` in browser dev mode. |
| `on(event, fn)` / `off(event, fn)` | Low-level event subscribe/unsubscribe. |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `selfLocationChanged` | `{ lat, lng, alt, bearing, speed }` | GPS position updated |
| `mapClick` | `{ lat, lng }` | User tapped the map |
| `mapLongPress` | `{ lat, lng }` | User long-pressed the map |
| `itemSelected` | `{ uid, type, title, lat, lng }` | User tapped a map item |
| `mapItemsChanged` | `{ added, removed, updated }` | Map items changed |
| `cotReceived` | `CotEventData[]` | Inbound CoT messages |
| `intentReceived` | `{ action, extras }` | ATAK broadcast received |

## Custom Bridges

Add plugin-specific functionality beyond the built-in bridge:

```java
public class MyPluginBridge {
    @JavascriptInterface
    public String getCustomData() {
        return "{\"status\": \"ok\"}";
    }
}

ReactiveDropDown view = new ReactiveDropDown(mapView, ctx, "web/index.html",
    true, new MyPluginBridge());
```

## Architecture

```
React hooks (useMapItems, useCotStream, ...)
    ↕ subscribe/notify
MapItemStore / CotStore (in-memory cache, fan-out)
    ↕ on/off events
WebView bridge (window._atak ↔ window.__atakBridge)
    ↕ @JavascriptInterface + evaluateJavascript
Java relay (MapItemEventRelay, CotBridge, IntentBridge)
    ↕ ATAK listeners
ATAK runtime (MapView, CotService, AtakBroadcast)
```

One Java relay per domain, one JS store, N hooks. Debouncing on the Java side, filtering on the JS side. The TypeScript SDK is version-independent — all ATAK API coupling is in the Java templates.

## Testing

```bash
# Unit tests (headless, no emulator needed)
cd sdk && npm test          # 51 tests via vitest

# Integration smoke test (emulator)
# Open plugin in ATAK → tap Test tab
cd example && ./scripts/integration-test.sh
```

## Compatibility

- ATAK 5.6.x
- Android 5.0+ (API 21+)
- Java 17, Node.js 22+, React 18+

## License

Public domain.
