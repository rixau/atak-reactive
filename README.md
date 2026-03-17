# atak-reactive

A library for building ATAK plugin UIs with React. Drop it into any existing plugin and convert screens from native Android to React one at a time — with hot-reload during development.

## What It Is

Two artifacts:

- **Java library** (`lib/`) — a `ReactiveDropDown` class that hosts a WebView with a JS bridge to ATAK. Drop the source into your plugin, register a receiver, done.
- **TypeScript SDK** (`@atak-reactive/sdk`) — typed bridge functions and React hooks for your web UI.

Your plugin keeps all its existing native screens. You add React screens alongside them. Each React screen is a `ReactiveDropDown` registered with its own intent action — same pattern as any other ATAK dropdown.

## Quick Start

### 1. Add the library to your plugin

Copy the `lib/src/main/java/com/atakmap/android/reactive/` folder into your plugin's source tree.

Add to `build.gradle`:
```gradle
implementation 'androidx.webkit:webkit:1.12.1'
```

Add to `proguard-gradle.txt`:
```
-keepclassmembers class * {
    @android.webkit.JavascriptInterface *;
}
```

### 2. Create a React screen

In your `MapComponent.onCreate()`:

```java
ReactiveDropDown settingsView = new ReactiveDropDown(view, context, "web/index.html");
DocumentedIntentFilter f = new DocumentedIntentFilter();
f.addAction("com.myplugin.SHOW_SETTINGS", "React settings screen");
registerDropDownReceiver(settingsView, f);
```

That's it. Three lines. Your existing native screens are untouched.

### 3. Build the React UI

Create a `web/` folder in your plugin with a Vite + React + TypeScript project:

```bash
npm create vite@latest web -- --template react-ts
cd web
npm install @atak-reactive/sdk
```

```tsx
import { useSelfLocation, useMapEvent, addMarker } from '@atak-reactive/sdk';

function MySettings() {
  const location = useSelfLocation();
  const lastClick = useMapEvent('mapClick');

  return (
    <div>
      <p>You are at: {location?.lat}, {location?.lng}</p>
      <button onClick={() => lastClick && addMarker({
        lat: lastClick.lat, lng: lastClick.lng, title: "Pin"
      })}>
        Drop Marker
      </button>
    </div>
  );
}
```

### 4. Develop with hot-reload

```bash
# Terminal 1: Vite dev server
adb reverse tcp:5173 tcp:5173
cd web && npm run dev

# Terminal 2: Build and install plugin (one-time)
./gradlew installCivDebug
```

Open the React screen in ATAK. Edit your React code — changes appear instantly.

### 5. Build for release

The Gradle build bundles web assets into the APK. In debug mode, the WebView tries the dev server first and falls back to bundled assets if it's not running.

## Bridge API

### Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `getSelfLocation()` | `SelfLocation \| null` | GPS position |
| `getMapCenter()` | `GeoPoint \| null` | Map center |
| `addMarker(opts)` | `string \| null` | Add marker, returns UID |
| `updateMarker(uid, opts)` | `boolean` | Update marker properties |
| `removeMarker(uid)` | `boolean` | Remove marker |
| `panTo(lat, lng, zoom?)` | `void` | Pan map |
| `getPreference(key)` | `string \| null` | Read ATAK preference |

### React Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useSelfLocation()` | `SelfLocation \| null` | Live GPS position |
| `useMapEvent('mapClick')` | `MapClickEvent \| null` | Last map tap |
| `useMapEvent('mapLongPress')` | `MapClickEvent \| null` | Last long press |
| `useMapEvent('itemSelected')` | `ItemSelectedEvent \| null` | Last item tap |

### Custom Bridges

Add plugin-specific JS bridges:

```java
public class MyBridge {
    @JavascriptInterface
    public String getData() { return "{\"hello\": true}"; }
}

// Exposed as window._myBridge
ReactiveDropDown view = new ReactiveDropDown(mapView, ctx, "web/index.html",
    new MyBridge());
```

## Example

The `example/` directory is a modified helloworld plugin with one React screen added alongside all the existing native screens. See:

- `ReactSettingsReceiver.java` — the new receiver (20 lines)
- `HelloWorldMapComponent.java` — 3 lines added to register it
- `example/web/` — the React UI

## Project Structure

```
atak-reactive/
├── lib/                          # Java library source
│   └── src/main/java/.../reactive/
│       ├── ReactiveDropDown.java     # Main class — WebView + bridge + lifecycle
│       ├── DevReloadHelper.java      # Debug plugin reload utility
│       └── bridge/
│           ├── AtakBridge.java       # @JavascriptInterface methods
│           ├── BridgeEventEmitter.java
│           └── MarkerManager.java
│
├── sdk/                          # @atak-reactive/sdk (npm package)
│   └── src/
│       ├── types.ts, bridge.ts, events.ts, hooks.ts, mock.ts, index.ts
│
└── example/                      # Modified helloworld plugin
    ├── app/                      # Standard ATAK plugin
    └── web/                      # React UI
```

## Compatibility

- ATAK 5.5.x / 5.6.x
- Android 5.0+ (API 21+)
- Java 17
- Node.js 18+
- React 18+

## License

Public domain.
