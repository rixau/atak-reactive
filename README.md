# atak-reactive

Build ATAK plugin UIs with React. Add React screens to any existing plugin — one screen at a time, alongside your native Android UI — with instant hot-reload during development.

## How It Works

Your plugin's React UI runs in a WebView panel. A typed JavaScript bridge connects it to ATAK's map engine — markers, shapes, routes, map items, GPS, CoT messaging, intents, coordinates, preferences, and navigation. During development, Vite serves the UI with hot module replacement. For release, assets are bundled into the APK.

## Prerequisites

- **Node.js 22+** — includes `npm` and `npx` (used to run the CLI and build the web UI)
- **Java 17** — required by ATAK's Gradle build
- **Android SDK** — with ATAK SDK extracted (`main.jar`, `atak-gradle-takdev.jar`)
- **An existing ATAK plugin project** — with `settings.gradle` at the root

## Quick Start

No installation needed — `npx` runs the CLI directly from npm. Run all commands from your ATAK plugin project root (where `settings.gradle` is).

```bash
# 1. Initialize (adds React bridge + web project to your existing plugin)
npx @atak-reactive/cli init

# Or, for incremental migration (bridge + web project, no new dropdown)
npx @atak-reactive/cli init --embedded

# 2. Build release APK (builds web assets + APK)
npx @atak-reactive/cli build

# 3. Develop with hot reload
npx @atak-reactive/cli dev
```

## React Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useMapItems(filter?)` | `MapItemData[]` | Live array of map items (markers, shapes, routes). Filters by `type`, `group`, `visible`, `meta`. Updates on add/remove/change. Shape fields (`points`, `strokeColor`, `radius`, etc.) included when present. |
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
| `useMenuAction(actionId, cb)` | `void` | Callback when a radial menu button is clicked. Filters by action ID. |
| `useMenuAction(cb)` | `void` | Callback for any radial menu button click. No filter. |
| `useNavigationState()` | `NavigationState` | Route navigation state: `active`, `routeUid`, `currentWaypointIndex`, `gpsLost`. Updates reactively as navigation progresses. |
| `useContacts(filter?)` | `ContactData[]` | Live contact list. Filter by `team`, `role`, `status`, `type`. Updates on contact online/offline/change. |
| `useContact(uid)` | `ContactData \| null` | Single contact by UID with live updates. Stable reference when unchanged. |
| `useChat(conversationId)` | `ChatMessageData[]` | Live message stream for a conversation. Loads history on mount, appends new messages. |
| `useGeofenceAlerts(fenceUid?)` | `GeofenceAlertData[]` | Accumulates geofence entry/exit alerts. Optional filter by fence UID. |

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
| `addShape(opts)` | Create a polygon/polyline. Returns UID. Options: `points`, `closed?`, `title?`, `strokeColor?`, `fillColor?`, `strokeWeight?`, `editable?`, `archive?`. |
| `addCircle(opts)` | Create a circle. Returns UID. Options: `center`, `radius`, `title?`, `strokeColor?`, `fillColor?`, `rings?`, `editable?`, `archive?`. |
| `addEllipse(opts)` | Create an ellipse. Returns UID. Options: `center`, `width`, `length`, `angle?`, `title?`, colors, `editable?`, `archive?`. |
| `addRectangle(opts)` | Create a rectangle. Returns UID. Options: `points` (4 corners), `title?`, colors, `editable?`, `archive?`. |
| `updateShape(uid, opts)` | Update shape geometry, style, or title. Type-dispatched — wrong-type fields are silently ignored. |
| `removeShape(uid)` | Remove any shape from the map. Handles child cleanup per shape type. |
| `getPluginShapes()` | Get all shapes created by this plugin. |
| `getManagedShapeUids()` | Get the Set of shape UIDs created by this plugin. |
| `addRoute(opts)` | Create a route with waypoints. Returns UID. Options: `waypoints`, `title?`, `color?`, `prefix?`, `method?`, `direction?`. |
| `updateRoute(uid, opts)` | Update route title, color, method, or direction. |
| `addWaypoint(routeUid, opts)` | Add a waypoint to a route. Options: `lat`, `lng`, `alt?`, `index?`, `title?`. |
| `removeWaypoint(routeUid, waypointUid)` | Remove a waypoint from a route. |
| `removeRoute(uid)` | Remove a route and all its waypoints. |
| `startNavigation(routeUid, opts?)` | Start navigating a route. Options: `startIndex?`. |
| `stopNavigation()` | Stop active navigation. |
| `getNavigationState()` | One-shot navigation state. |
| `getPluginRoutes()` | Get all routes created by this plugin. |
| `getManagedRouteUids()` | Get the Set of route UIDs created by this plugin. |
| `onNavigationStateChanged(cb)` | Subscribe to navigation state changes. Returns unsubscribe function. |
| `sendMessage(conversationId, text)` | Send a chat message to a contact or group. |
| `openConversation(contactUid)` | Open ATAK's native GeoChat UI for a contact. |
| `getChatHistory(conversationId, limit?)` | Load chat message history. Default limit: 100. |
| `getConversations()` | List all conversations with IDs, names, and unread counts. |
| `createGeofence(opts)` | Attach a geofence to an existing shape. Options: `shapeUid`, `trigger` (`entry`/`exit`/`both`), `monitoredTypes` (`all`/`friendly`/`hostile`/`tak_users`), `rangeKm?`, `minElevation?`, `maxElevation?`. |
| `removeGeofence(shapeUid)` | Remove a geofence from a shape. |
| `dismissGeofenceAlert(fenceUid, itemUid)` | Dismiss a geofence alert. |
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
| `menuAction` | `{ actionId, itemUid, itemType, title }` | Radial menu button clicked |
| `navigationStateChanged` | `{ active, routeUid, currentWaypointIndex, gpsLost }` | Route navigation state changed |
| `contactsChanged` | `ContactData[]` | Contact list updated (online/offline/changed) |
| `chatMessage` | `ChatMessageData` | New chat message received |
| `geofenceAlert` | `GeofenceAlertData` | Geofence entry/exit detected |

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

Register it alongside the built-in bridge (works with both `ReactiveDropDown` and `ReactiveWebView`):

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

## Embedded Views (ReactiveWebView)

`ReactiveDropDown` takes over the entire dropdown panel. For incremental migration — converting one tab or section of an existing native UI to React while keeping the rest native — use `ReactiveWebView`.

Same bridge, same SDK, same hooks. Different container.

**Replace one tab in an existing tabbed dropdown:**

```java
public class MyPluginReceiver extends DropDownReceiver {
    private ReactiveWebView reactTab;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        LinearLayout root = new LinearLayout(ctx);
        TabHost tabs = new TabHost(ctx);

        // Native tabs stay native
        tabs.addTab("Dashboard", createNativeDashboard());
        tabs.addTab("Settings", createNativeSettings());

        // One tab is React
        reactTab = new ReactiveWebView(getMapView(), ctx, "web/index.html");
        tabs.addTab("Detections", reactTab);

        showDropDown(root, HALF_WIDTH, FULL_HEIGHT, FULL_WIDTH, HALF_HEIGHT, false, this);
        reactTab.onResume();
    }

    @Override
    public void onDropDownClose() {
        if (reactTab != null) reactTab.destroy();
    }
}
```

**Embed React in a split layout:**

```java
LinearLayout split = new LinearLayout(ctx);
split.setOrientation(LinearLayout.VERTICAL);
split.addView(nativeMapControls, new LayoutParams(MATCH_PARENT, 0, 1));

ReactiveWebView reactList = new ReactiveWebView(mapView, ctx, "web/list.html");
split.addView(reactList, new LayoutParams(MATCH_PARENT, 0, 1));
reactList.onResume();
```

**Multiple React views with different routes:**

```java
ReactiveWebView tab1 = new ReactiveWebView(mapView, ctx, "web/index.html#/detections");
ReactiveWebView tab2 = new ReactiveWebView(mapView, ctx, "web/index.html#/sensors");
// Each has its own WebView, own bridge instance, own React tree
```

Custom bridges work the same way:

```java
ReactiveWebView view = new ReactiveWebView(mapView, ctx, "web/index.html");
view.addBridge(new PlatformSimBridge(simulator, emitter));
```

**Lifecycle:** Call `onResume()` when the view becomes visible, `onPause()` when hidden. `destroy()` is called automatically when the view is detached from the window, but you can call it earlier for explicit cleanup. `useDropdownSize()` and `useDropdownVisible()` return defaults in embedded views — they only update inside `ReactiveDropDown`.

## Architecture

```
React hooks (useMapItems, useCotStream, ...)
    ↕ subscribe/notify
MapItemStore / CotStore / ContactStore / ChatStore (in-memory cache, fan-out)
    ↕ on/off events
WebView bridge (window._atak ↔ window.__atakBridge)
    ↕ @JavascriptInterface + evaluateJavascript
Java relay (MapItemEventRelay, CotBridge, IntentBridge, ContactBridge, ChatBridge, GeofenceBridge)
    ↕ ATAK listeners
ATAK runtime (MapView, CotService, AtakBroadcast)
```

One Java relay per domain, one JS store, N hooks. Debouncing on the Java side, filtering on the JS side. The TypeScript SDK is version-independent — all ATAK API coupling is in the Java templates.

## Testing

```bash
# Unit tests (headless, no emulator needed)
cd sdk && npm test          # 153 tests via vitest

# Integration smoke test (emulator)
# Open plugin in ATAK → tap Test tab
cd example && ./scripts/integration-test.sh
```

## Compatibility

- ATAK 5.4.0 – 5.6.x
- Android 5.0+ (API 21+)
- Java 17, Node.js 22+, React 18+

## License

Public domain.
