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
| `@atak-reactive/sdk` | TypeScript bridge + React hooks | Installed automatically by `init` |

## Quick Start

### 1. Initialize

From the root of any existing ATAK plugin:

```bash
npx @atak-reactive/cli init
```

This automatically:
- Detects your ATAK version from `build.gradle`
- Copies the Java bridge source into your plugin
- Patches `build.gradle` (webkit dependency, asset source dir)
- Patches `proguard-gradle.txt` (JavascriptInterface keep rule)
- Scaffolds a `web/` folder with React + Vite + TypeScript + `@atak-reactive/sdk`
- Registers a `ReactiveDropDown` in your MapComponent (auto-detected)
- Installs npm dependencies

No manual Java editing required.

### 2. Build and install

```bash
# Build web assets
npx @atak-reactive/cli build

# Build the plugin APK
./gradlew assembleCivDebug

# Install on device/emulator
adb install -r app/build/outputs/apk/civ/debug/*.apk
```

### 3. Develop with hot-reload

```bash
npx @atak-reactive/cli dev
```

This runs `adb reverse` and starts the Vite dev server. Open your React screen in ATAK — edit `web/src/App.tsx` and changes appear instantly. No rebuild, no reinstall, no ATAK restart.

To trigger the React screen:
```bash
adb shell am broadcast -a com.yourplugin.SHOW_REACT
```

The `init` command prints the exact intent action for your plugin.

### That's it

Day-to-day workflow is just `npx @atak-reactive/cli dev` and editing React code. Your existing native screens are untouched.

## What `init` Does

The CLI detects your plugin's structure and makes minimal, additive changes:

| What | Where | Change |
|------|-------|--------|
| Java bridge source | `app/src/main/java/.../reactive/` | Copied (5 files) |
| WebKit dependency | `app/build.gradle` | One line added to `dependencies {}` |
| Asset source dir | `app/build.gradle` | One line added to `sourceSets.main {}` |
| Proguard rule | `app/proguard-gradle.txt` | Appended |
| Web project | `web/` | Created with React + Vite + TypeScript |
| MapComponent | Your existing MapComponent | Registration injected after last receiver |
| .gitignore | `.gitignore` | `dist-assets/` appended |

Running `init` again is safe — it detects what's already there and skips it.

If no MapComponent is found, or multiple are found, the CLI prints the code snippet to add manually.

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

The SDK includes a mock bridge for browser-only development. When no device is connected, bridge calls return fake data and log to the console.

```bash
cd web && npx vite
# Open http://localhost:5173 in a browser — no device needed
```

## Incremental Migration

Convert screens one at a time:

1. Build the new screen in React in `web/src/`
2. Register another `ReactiveDropDown` with a new intent action
3. Route the intent to the new receiver (or trigger from a button in your native UI)
4. Delete the old native receiver when ready

Old screens keep working. New screens hot-reload. No big bang rewrite.

## Project Structure

```
your-plugin/                          (after running init)
├── app/src/main/java/
│   ├── com/yourplugin/
│   │   ├── YourMapComponent.java     ← registration auto-injected here
│   │   └── NativeScreen.java        ← untouched
│   └── com/atakmap/android/reactive/ ← copied by init
│       ├── ReactiveDropDown.java
│       ├── DevReloadHelper.java
│       └── bridge/
│           ├── AtakBridge.java
│           ├── BridgeEventEmitter.java
│           └── MarkerManager.java
├── web/                              ← created by init
│   ├── src/
│   │   ├── App.tsx                   ← your React UI
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── app/build.gradle                  ← patched by init
```

## CLI Commands

| Command | What it does |
|---------|-------------|
| `npx @atak-reactive/cli init` | Set up atak-reactive in an existing ATAK plugin |
| `npx @atak-reactive/cli dev` | Run `adb reverse` + start Vite dev server |
| `npx @atak-reactive/cli build` | Build web assets for release |

## Compatibility

- ATAK 5.6.x (version-specific templates, more versions coming)
- Android 5.0+ (API 21+)
- Java 17
- Node.js 20+
- React 18+

## License

Public domain.
