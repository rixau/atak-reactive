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
| `usePreference(key)` | `[string \| null, setter]` | Read/write a single ATAK preference. Reactive to changes from any source. |
| `useDropdownVisible()` | `boolean` | Whether the dropdown panel is currently visible. Use to pause work when backgrounded. |
| `useDropdownSize()` | `{ width, height }` | Current dropdown dimensions as screen fractions. Updates on resize. |
| `useNavVisible()` | `[boolean, setter]` | ATAK nav button visibility + setter. Reactive to changes from any source. |

## Functions

| Function | Description |
|----------|-------------|
| `addMarker(opts)` | Create a marker. Returns UID. Options: `lat`, `lng`, `title`, `type?`, `uid?`, `iconUri?`, `iconColor?`, `group?`. |
| `updateMarker(uid, opts)` | Update marker title, type, position, or icon. |
| `removeMarker(uid)` | Remove a marker from the map. |
| `setMarkerIcon(uid, opts)` | Set or change a marker's icon. Options: `iconUri`, `iconColor?`. |
| `panTo(lat, lng, zoom?)` | Pan the map camera to a location. |
| `getSelfLocation()` | One-shot GPS position. |
| `getMapCenter()` | Current map center point. |
| `getPreference(key)` | Read an ATAK preference. |
| `setPreference(key, value)` | Write an ATAK preference. |
| `removePreference(key)` | Remove an ATAK preference. |
| `setDropdownSize(width, height)` | Resize the dropdown panel. Width/height: `'third'`, `'half'`, or `'full'`. |
| `getDropdownSize()` | Current dropdown dimensions as `{ width, height }` fractions. |
| `setNavVisible(visible)` | Show or hide ATAK's nav buttons. |
| `getNavVisible()` | Whether ATAK's nav buttons are visible. |
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
| `createMapGroup(name, parent?)` | Create a map group. Registers overlay in Overlay Manager. |
| `removeMapGroup(name)` | Remove a map group and unregister its overlay. |
| `setGroupVisible(name, visible)` | Show/hide a group and all its children. |
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
| `dropDownVisible` | `boolean` | Dropdown panel shown/hidden |
| `dropDownClose` | `{}` | Dropdown panel closed |
| `dropDownSizeChanged` | `{ width, height }` | Dropdown panel resized |
| `navVisible` | `boolean` | ATAK nav buttons shown/hidden |
| `preferenceChanged` | `{ key, value }` | Any ATAK preference changed |

## Custom Bridges

Every plugin has domain-specific data beyond markers and CoT. Custom bridges expose your Java managers to React with the same reactive pattern as the built-in hooks.

**Example: Platform Simulator** — a plugin that spawns simulated aircraft tracks with configurable orbits.

Java side — expose your domain logic:

```java
public class PlatformSimBridge {
    private final PlatformSimulator simulator;
    private final BridgeEventEmitter emitter;

    @JavascriptInterface
    public String getActivePlatforms() {
        return simulator.getAllAsJson();
    }

    @JavascriptInterface
    public String startSimulation(String configJson) {
        return simulator.start(new JSONObject(configJson));
    }

    @JavascriptInterface
    public void stopSimulation(String platformId) {
        simulator.stop(platformId);
    }

    // Called by simulator when platform state changes
    public void onPlatformUpdated(Platform p) {
        emitter.emit("platformUpdated", serializePlatform(p));
    }
}
```

Register it alongside the built-in bridge:

```java
ReactiveDropDown view = new ReactiveDropDown(mapView, ctx, "web/index.html");
view.addBridge(new PlatformSimBridge(simulator, emitter));
```

React side — same reactive pattern as built-in hooks:

```tsx
import { on, off } from '@atak-reactive/sdk';

function usePlatforms(): SimPlatform[] {
  const [platforms, setPlatforms] = useState<SimPlatform[]>([]);

  useEffect(() => {
    setPlatforms(JSON.parse(window._platformSimBridge.getActivePlatforms()));
    const handler = (p: SimPlatform) =>
      setPlatforms(prev => prev.map(x => x.uid === p.uid ? p : x));
    on('platformUpdated', handler);
    return () => off('platformUpdated', handler);
  }, []);

  return platforms;
}

function PlatformSimulator() {
  const platforms = usePlatforms();

  const launch = () => {
    window._platformSimBridge.startSimulation(JSON.stringify({
      lat: 38.89, lng: -77.03, altitude: 5000,
      orbit: 'racetrack', speed: 120,
    }));
  };

  return (
    <div>
      <button onClick={launch}>Launch Platform</button>
      {platforms.map(p => (
        <div key={p.uid}>{p.callsign} — {p.altitude}ft — {p.speed}kts</div>
      ))}
    </div>
  );
}
```

The simulation engine stays in Java. The config form and live status list are React. Simulated tracks also appear on the ATAK map as CoT items, visible via `useMapItems()`.

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
cd sdk && npm test          # 71 tests via vitest

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
