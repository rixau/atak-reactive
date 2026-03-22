# atak-reactive

Build ATAK plugin UIs with React. Add React screens to any existing plugin — one screen at a time, alongside your native Android UI — with instant hot-reload during development.

## How It Works

Your plugin's React UI runs in a WebView panel. A typed JavaScript bridge connects it to ATAK's map engine — markers, GPS, map events, preferences. During development, Vite serves the UI with hot module replacement. For release, assets are bundled into the APK.

## Quick Start

### 1. Initialize

From the root of any existing ATAK plugin:

```bash
npx @atak-reactive/cli init
```

This sets up everything — Java bridge source, Gradle config, web project with React + TypeScript, and auto-registers a `ReactiveDropDown` in your MapComponent. No manual Java editing required.

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

Edit `web/src/App.tsx` — changes appear instantly in ATAK. No rebuild, no reinstall, no restart.

## Bridge API

### Functions

```tsx
import { getSelfLocation, getMapCenter, addMarker, updateMarker, removeMarker, panTo, getPreference } from '@atak-reactive/sdk';

const location = getSelfLocation();
const uid = addMarker({ lat: 38.89, lng: -77.03, title: "Pin" });
updateMarker(uid, { title: "Updated" });
removeMarker(uid);
panTo(38.89, -77.03);
```

### React Hooks

```tsx
import { useSelfLocation, useMapEvent } from '@atak-reactive/sdk';

function MyScreen() {
  const location = useSelfLocation();
  const lastClick = useMapEvent('mapClick');
  const selected = useMapEvent('itemSelected');

  return (
    <div>
      <p>You are at: {location?.lat}, {location?.lng}</p>
      <p>Selected: {selected?.title}</p>
    </div>
  );
}
```

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `selfLocationChanged` | `{ lat, lng, alt, bearing, speed }` | GPS position updated |
| `mapClick` | `{ lat, lng }` | User tapped the map |
| `mapLongPress` | `{ lat, lng }` | User long-pressed the map |
| `itemSelected` | `{ uid, type, title, lat, lng }` | User tapped a map item |

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

## Incremental Migration

Convert screens one at a time. Your existing native screens keep working — React screens are registered alongside them as additional `DropDownReceiver` instances. No big bang rewrite.

## Compatibility

- ATAK 5.6.x
- Android 5.0+ (API 21+)
- Java 17, Node.js 20+, React 18+

## License

Public domain.
