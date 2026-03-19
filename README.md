# atak-reactive

Build ATAK plugin UIs with React. Add React screens to any existing plugin — one screen at a time, alongside your native Android UI — with instant hot-reload during development.

## How It Works

```
Dev Machine                          Android Device
┌──────────────┐    adb reverse     ┌──────────────────────┐
│ Vite Dev      │◄──────────────────│ ATAK                 │
│ Server :5173  │   tcp:5173        │  ┌──────────────────┐ │
└──────────────┘                    │  │ Your Plugin      │ │
                                    │  │  ┌────────────┐  │ │
                                    │  │  │ WebView    │  │ │
                                    │  │  │ (React UI) │  │ │
                                    │  │  └─────┬──────┘  │ │
                                    │  │   @JavascriptInterface
                                    │  │  ┌─────▼──────┐  │ │
                                    │  │  │ AtakBridge  │  │ │
                                    │  │  │ (Java)      │  │ │
                                    │  │  └────────────┘  │ │
                                    │  └──────────────────┘ │
                                    └──────────────────────┘
```

Your plugin's React UI runs in a WebView panel. A typed JavaScript bridge connects it to ATAK's map engine — markers, GPS, map events, preferences. During development, Vite serves the UI with hot module replacement. For release, assets are bundled into the APK.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@atak-reactive/cli` | CLI tool — init, dev server, build | `npx @atak-reactive/cli init` |
| `@atak-reactive/sdk` | TypeScript bridge + React hooks | `npm install @atak-reactive/sdk` |

## Quick Start

### 1. Initialize

From the root of any existing ATAK plugin:

```bash
npx @atak-reactive/cli init
```

This automatically:
- Copies the Java bridge source into your plugin
- Patches `build.gradle` (webkit dependency, asset source dir)
- Patches `proguard-gradle.txt` (JavascriptInterface keep rule)
- Scaffolds a `web/` folder with React + Vite + TypeScript
- Installs npm dependencies

### 2. Register a React screen

Add to your `MapComponent.onCreate()`:

```java
ReactiveDropDown myScreen = new ReactiveDropDown(view, context, "web/index.html");
DocumentedIntentFilter f = new DocumentedIntentFilter();
f.addAction("com.myplugin.SHOW_SCREEN", "My React screen");
registerDropDownReceiver(myScreen, f);
```

Three lines. Your existing native screens are untouched.

### 3. Develop

```bash
npx @atak-reactive/cli dev
```

This runs `adb reverse` and starts the Vite dev server. Open your React screen in ATAK — edit `web/src/App.tsx` and changes appear instantly. No rebuild, no reinstall, no ATAK restart.

### 4. Build for release

```bash
npx @atak-reactive/cli build
```

Builds web assets into `web/dist-assets/web/`. Gradle bundles them into the APK automatically. The WebView loads from bundled assets in release mode — no dev server needed.

## Bridge API

### Functions

```tsx
import { getSelfLocation, getMapCenter, addMarker, updateMarker, removeMarker, panTo, getPreference } from '@atak-reactive/sdk';

const location = getSelfLocation();       // { lat, lng, alt, bearing, speed }
const center = getMapCenter();            // { lat, lng }
const uid = addMarker({ lat: 38.89, lng: -77.03, title: "Pin" });
updateMarker(uid, { title: "Updated" });
removeMarker(uid);
panTo(38.89, -77.03, 15);
const val = getPreference("some.key");
```

### React Hooks

```tsx
import { useSelfLocation, useMapEvent } from '@atak-reactive/sdk';

function MyScreen() {
  const location = useSelfLocation();              // updates on GPS change
  const lastClick = useMapEvent('mapClick');        // { lat, lng }
  const selected = useMapEvent('itemSelected');     // { uid, type, title, lat, lng }

  return (
    <div>
      <p>You are at: {location?.lat}, {location?.lng}</p>
      <p>Last click: {lastClick?.lat}, {lastClick?.lng}</p>
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

// Pass as additional bridge — exposed as window._myPluginBridge
ReactiveDropDown view = new ReactiveDropDown(mapView, ctx, "web/index.html",
    true, new MyPluginBridge());
```

### Mock Bridge

The SDK includes a mock bridge for browser-only development. When no device is connected, bridge calls return fake data and log to the console. Your React UI shows a "MOCK" badge automatically.

```bash
cd web && npm run dev
# Open http://localhost:5173 in a browser — no device needed
```

## How It Integrates

The library uses ATAK's standard plugin patterns. Each React screen is a `ReactiveDropDown` (extends `DropDownReceiver`) registered with a `DocumentedIntentFilter` — the same way native ATAK screens work. Multiple React screens and native screens coexist in the same plugin.

```
your-plugin/
├── app/src/main/java/com/yourplugin/
│   ├── YourMapComponent.java          # registers native + React receivers
│   ├── NativeScreen.java             # existing native UI (untouched)
│   └── com/atakmap/android/reactive/  # copied by CLI init
│       ├── ReactiveDropDown.java
│       ├── DevReloadHelper.java
│       └── bridge/
│           ├── AtakBridge.java
│           ├── BridgeEventEmitter.java
│           └── MarkerManager.java
├── web/                               # created by CLI init
│   ├── src/
│   │   ├── App.tsx                    # your React UI
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── app/build.gradle                   # patched by CLI init
```

## Incremental Migration

Convert screens one at a time:

1. Pick a screen (settings panel, detail view, list)
2. Build it in React in `web/src/`
3. Register a `ReactiveDropDown` for it
4. Route the intent to the new receiver
5. Delete the old native receiver when ready

Old screens keep working. New screens hot-reload. No big bang rewrite.

## Project Structure

```
atak-reactive/
├── cli/                          # @atak-reactive/cli (npm package)
│   └── src/
│       ├── commands/             # init, dev, build
│       ├── templates/            # Java source + web scaffold
│       └── index.ts
│
├── sdk/                          # @atak-reactive/sdk (npm package)
│   └── src/
│       ├── bridge.ts             # typed bridge wrappers
│       ├── events.ts             # Java → JS event system
│       ├── hooks.ts              # React hooks
│       ├── mock.ts               # browser-only mock bridge
│       └── types.ts              # TypeScript interfaces
│
├── lib/                          # Java library source (canonical copy)
│   └── src/main/java/.../reactive/
│
└── example/                      # Working example plugin
    ├── app/                      # ATAK plugin (plugintemplate base)
    └── web/                      # React UI
```

## Compatibility

- ATAK 5.6.x
- Android 5.0+ (API 21+)
- Java 17
- Node.js 20+
- React 18+

## License

Public domain.
