# atak-reactive

Build ATAK plugin UIs with React. Add React screens to any existing plugin — one screen at a time, alongside your native Android UI — with instant hot-reload during development.

## How It Works

Your plugin's React UI runs in a WebView panel. A typed JavaScript bridge connects it to ATAK's map engine — markers, map items, GPS, CoT messaging, intents, coordinates, and preferences. During development, Vite serves the UI with hot module replacement. For release, assets are bundled into the APK.

## Quick Start

### 1. Initialize

From the root of any existing ATAK plugin:

```bash
npx @atak-reactive/cli init
```

This sets up everything — Java bridge source, Gradle config, web project with React + TypeScript, and auto-registers a `ReactiveDropDown` in your MapComponent.

### 2. Build and install

```bash
npx @atak-reactive/cli build
./gradlew assembleCivDebug
adb install -r app/build/outputs/apk/civ/debug/*.apk
```

### 3. Develop

```bash
npx @atak-reactive/cli dev
```

Edit `web/src/App.tsx` — changes appear instantly in ATAK.

## Bridge API

### Map Items (Reactive)

Query and subscribe to all items on the map — markers, tracks, shapes, anything ATAK represents as a MapItem. Live updates via a shared subscription architecture.

```tsx
import { useMapItems, useMapItem, useMapGroups } from '@atak-reactive/sdk';

function MapItemList() {
  const items = useMapItems({ visible: true });            // all visible items, live
  const friendlies = useMapItems({ type: 'a-f-*' });      // CoT type filter
  const selected = useMapItem('some-uid');                 // single item by UID
  const groups = useMapGroups();                           // group tree

  return <div>{items.length} items on map</div>;
}
```

### Markers

```tsx
import { addMarker, updateMarker, removeMarker } from '@atak-reactive/sdk';

const uid = addMarker({ lat: 38.89, lng: -77.03, title: 'Pin' });
updateMarker(uid, { title: 'Updated' });
removeMarker(uid);
```

### Location & Map Events

```tsx
import { useSelfLocation, useMapEvent, panTo } from '@atak-reactive/sdk';

function MyScreen() {
  const location = useSelfLocation();
  const lastClick = useMapEvent('mapClick');
  const selected = useMapEvent('itemSelected');

  return (
    <div>
      <p>You are at: {location?.lat}, {location?.lng}</p>
      <p>Selected: {selected?.title}</p>
      <button onClick={() => location && panTo(location.lat, location.lng)}>
        Pan to Self
      </button>
    </div>
  );
}
```

### CoT Messaging

Send and receive Cursor-on-Target messages — ATAK's network protocol.

```tsx
import { useCotStream, useCotEvent, sendCot } from '@atak-reactive/sdk';

function TeamTracker() {
  const friendlies = useCotStream({ type: 'a-f-*' });     // live friendly tracks

  useCotEvent((event) => {
    console.log('Received CoT:', event.uid, event.callsign);
  });

  const sendPosition = () => {
    sendCot({
      uid: 'my-report',
      type: 'a-f-G-U-C',
      lat: 38.89,
      lng: -77.03,
      alt: null,
      how: 'h-g-i-g-o',
      time: Date.now(),
      stale: Date.now() + 300000,
      callsign: 'ALPHA-1',
      team: 'Cyan',
      detail: {},
    }, 'external');  // 'external' | 'internal' | 'both'
  };

  return <div>{friendlies.length} friendlies tracked</div>;
}
```

### Intent Broadcast (IPC)

Send and receive ATAK internal broadcasts for inter-plugin communication.

```tsx
import { useIntent, sendBroadcast } from '@atak-reactive/sdk';

function IntentDemo() {
  const intent = useIntent('com.example.MY_ACTION');

  const trigger = () => {
    sendBroadcast('com.atakmap.android.maps.SHOW_DETAILS', { uid: 'some-uid' });
  };

  return <div>Last intent: {intent?.extras?.uid}</div>;
}
```

### Coordinate Conversions

Convert between lat/lng, MGRS, and UTM. Format in the user's preferred display.

```tsx
import { toMGRS, toUTM, fromMGRS, formatCoordinate, distanceTo, useCoordinateFormat } from '@atak-reactive/sdk';

const mgrs = toMGRS(38.89, -77.03);           // "18S UJ 23394 07395"
const utm = toUTM(38.89, -77.03);             // "18S 323371 4306519"
const point = fromMGRS('18SUJ2339407395');     // { lat, lng }
const display = formatCoordinate(38.89, -77.03); // user's preferred format
const dist = distanceTo(
  { lat: 38.89, lng: -77.03 },
  { lat: 39.0, lng: -77.0 }
);  // { distance: meters, bearing: degrees }
```

### Metadata

Read and write arbitrary metadata on any map item.

```tsx
import { setItemMeta, getItemMeta, useMapItems } from '@atak-reactive/sdk';

function TagItem({ uid }: { uid: string }) {
  const items = useMapItems();

  const tag = () => {
    setItemMeta(uid, 'mission-status', 'complete');
    // Triggers ITEM_REFRESH → reactive update → hook re-renders automatically
  };

  return <button onClick={tag}>Mark Complete</button>;
}
```

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `selfLocationChanged` | `{ lat, lng, alt, bearing, speed }` | GPS position updated |
| `mapClick` | `{ lat, lng }` | User tapped the map |
| `mapLongPress` | `{ lat, lng }` | User long-pressed the map |
| `itemSelected` | `{ uid, type, title, lat, lng }` | User tapped a map item |
| `mapItemsChanged` | `{ added, removed, updated }` | Map items changed (managed by MapItemStore) |
| `cotReceived` | `CotEventData[]` | Inbound CoT messages |
| `intentReceived` | `{ action, extras }` | ATAK broadcast received |

### Custom Bridges

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

One Java relay per domain, one JS store, N hooks. Debouncing on the Java side, filtering on the JS side.

## Testing

```bash
# Unit tests (headless, no emulator)
cd sdk && npm test          # 51 tests via vitest

# Integration test (emulator, manual trigger)
# Open plugin in ATAK → tap Test tab
cd example && ./scripts/integration-test.sh
```

## Incremental Migration

Convert screens one at a time. Your existing native screens keep working — React screens are registered alongside them as additional `DropDownReceiver` instances.

## Compatibility

- ATAK 5.6.x
- Android 5.0+ (API 21+)
- Java 17, Node.js 22+, React 18+

## License

Public domain.
