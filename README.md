# atak-reactive

Build **ATAK (Android Team Awareness Kit)** plugin UIs with React and TypeScript. Add React screens to any existing plugin — one screen at a time, alongside your native Android UI — with instant hot-reload during development.

## Why this exists

Native ATAK plugin UIs are written in Android XML and Java. That works, but iteration is slow: every UI change is a Gradle build and APK reinstall. atak-reactive lets you keep your existing plugin and convert just the UI layer — or one tab, or one panel — to React, with browser-style hot reload during development and bundled assets for release builds.

## How It Works

Your plugin's React UI runs in a WebView panel. A typed JavaScript bridge connects it to ATAK's map engine — markers, shapes, routes, map items, GPS, CoT messaging, intents, coordinates, preferences, and navigation. During development, Vite serves the UI with hot module replacement. For release, assets are bundled into the APK.

## Prerequisites

- **Node.js 22+** — includes `npm` and `npx` (used to run the CLI and build the web UI)
- **Java 17** — required by ATAK's Gradle build
- **Android SDK** — with ATAK SDK extracted (`main.jar`, `atak-gradle-takdev.jar`)
- **An existing ATAK plugin project** — with `settings.gradle` at the root

## Quick Start

Run from your ATAK plugin project root (where `settings.gradle` is). No global install needed.

**1. Add React to your plugin**

```bash
npx @atak-reactive/cli init
```

This adds the bridge AAR, patches `build.gradle`, creates a `web/` folder with React + Vite, and registers a `ReactiveDropDown` in your MapComponent. Use `--embedded` to skip the dropdown and wire up `ReactiveWebView` yourself. Use `--dry-run` to preview changes without writing anything.

**2. Develop with hot reload**

```bash
npx @atak-reactive/cli dev
```

Builds the debug APK, installs it, sets up `adb reverse`, and starts Vite. Edit `web/src/App.tsx` — changes appear instantly in ATAK.

`dev` is two halves, and each can be run on its own:

```bash
npx @atak-reactive/cli dev install   # build + install, leave the server alone
npx @atak-reactive/cli dev serve     # tunnel + dev server, don't touch the APK
```

| | builds + installs | opens tunnel | serves |
|---|---|---|---|
| `dev` | yes | yes | yes |
| `dev install` | yes | no | no |
| `dev serve` | no | yes | yes |
| `vite` directly (in `web/`) | no | **no** | yes |

Use `dev serve` to restart the dev server: `dev` removes the `adb reverse` tunnel when it exits, and running Vite by hand does not re-open it, so the device would have no route to the server.

Use `dev install` when native code changed but a server is already running. Worth avoiding otherwise — **reinstalling a plugin APK resets ATAK's per-plugin "load" setting**, so you may need to re-enable the plugin in ATAK's Plugins manager afterwards.

(In a scaffolded project `npm run dev` is wired to `atak-reactive dev`, so it does the full cycle.)

**3. Running two plugins at once**

The dev server port is compiled into the debug APK, so each plugin needs its own. Set it once per plugin:

```properties
# local.properties
devServerPort=5174
```

`dev` and `serve` both read it, and use it for the Gradle build, the `adb reverse` tunnel, and Vite. Pass `--port <n>` to override for a single run. Changing the port requires `dev`, since it rebuilds the APK.

If the port is busy, the CLI stops before building and tells you — it will not silently move to another port or disturb another plugin's session.

**4. Wireless debugging (no USB)**

Set your dev machine's IP in `local.properties`:

```properties
# local.properties
devServerHost=192.168.1.50
```

`init` adds the matching `resValue` entries to your debug build type. If you are wiring an existing project by hand, they look like this:

```groovy
// app/build.gradle → buildTypes → debug
resValue "string", "atak_reactive_dev_host", { /* reads devServerHost from local.properties */ }()
resValue "string", "atak_reactive_dev_port", { /* reads devServerPort from local.properties */ }()
```

**5. Build for release**

```bash
npx @atak-reactive/cli build
```

Builds web assets into the APK.

Signing is your project's `signingConfig`, not something the CLI does. The ATAK plugin template ships a release config using the ATAK **development** keystore — that produces a signed APK suitable for sideloading and testing, but it is a keystore every ATAK developer has, not yours. If your project has no release `signingConfig`, Gradle emits an `-unsigned.apk`, which ATAK will not load.

Substitute your own signing config before distributing through TAK.gov or an organization's plugin store.

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
| `useRadialMenu()` | `MapItemData \| null` | The item whose radial menu last opened, or `null` after it closes. Observes only — never suppresses ATAK's menu. Map-point menus (long-press on empty map) are invisible to ATAK's listener, so treat this as "last item menu", not proof one is open. |
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

### Reacting to radial menu buttons

There is no `useMenuAction` hook, because ATAK cannot tell you *which* radial button was
clicked. A click is observable — the buttons are enumerable widgets and their click
handlers can be wrapped — but the action a button maps to lives in a private field of a
package-private class, with a setter and no getter. Any hook that filtered by action id
would have to reflect into ATAK internals to know what it was filtering on.

You don't need it. Radial buttons dispatch through `AtakBroadcast`, and the action string
is one *you* choose when you add the button, so you already know it. Declare the button in
your plugin's menu XML:

```xml
<!-- assets/menus/my_menu.xml -->
<menu>
  <button ... >
    <broadcast action="com.myplugin.FLAG_ITEM">
      <extra key="uid" value="{uid}"/>
    </broadcast>
  </button>
</menu>
```

ATAK phrase-expands each extra's value against the clicked item's metadata, so `{uid}`
arrives as that item's UID. Then react to it like any other broadcast:

```tsx
import { useState } from 'react';
import { useIntentCallback, useMapItem } from '@atak-reactive/sdk';

function FlaggedItem() {
  const [uid, setUid] = useState('');
  useIntentCallback('com.myplugin.FLAG_ITEM', (intent) => {
    // extras values are unknown — they arrive as strings from the Intent bundle
    setUid(String(intent.extras.uid ?? ''));
  });

  const item = useMapItem(uid);
  return item ? <div>Flagged: {item.title}</div> : null;
}
```

Use `useRadialMenu()` when you only need to know *which item* the user opened the menu on,
without adding a button of your own.

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
| `radialMenuChanged` | `{ open, item }` | Radial menu opened or closed on an item |
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

# Memory / CPU profile per scenario phase (device or emulator)
# Open plugin in ATAK → Perf tab → Run, when prompted
cd example && ./scripts/perf-profile.sh
```

The profile isolates what the library adds on a busy map from what ATAK spends anyway; see [example/PERF.md](example/PERF.md) for the phases and how to read the result.

## Compatibility

- ATAK 5.4.0 – 5.6.x
- Android 5.0+ (API 21+)
- Java 17, Node.js 22+, React 18+

## License

This repository is split by component:

- **Bridge library (`lib/`, published as the `dev.atakreactive:bridge-*` AAR)** — **GPLv3** (see [LICENSE](LICENSE)). It links the ATAK SDK, which is itself GPLv3, so a plugin built with the bridge is a GPLv3 work: if you distribute that plugin, its Corresponding Source must be available under GPLv3.
- **CLI (`@atak-reactive/cli`) and TypeScript SDK (`@atak-reactive/sdk`)** — **MIT** (see [cli/LICENSE](cli/LICENSE), [sdk/LICENSE](sdk/LICENSE)). These do not link ATAK and can be reused freely.

*Not affiliated with or endorsed by the TAK Product Center or the U.S. Government. "ATAK" and "TAK" are used only to describe compatibility.*
