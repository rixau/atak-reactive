ATAK Reactive Example


_________________________________________________________________
PURPOSE AND CAPABILITIES

Example plugin for atak-reactive (https://github.com/rixau/atak-reactive), a
library for building ATAK plugin UIs in React and TypeScript. The plugin's UI is
a React app that runs in an Android WebView inside an ATAK dropdown, and calls
ATAK through a typed JavaScript bridge (Java objects exposed to the page with
addJavascriptInterface).

What the example shows:

- Home: self location, the last map click and the selected map item, plus a
  native tabbed dropdown with one React tab ("Mixed Demo").
- Map Items: create, list, select and delete markers; shapes and routes.
- Settings: reading and writing ATAK preferences.
- Test: an in-app integration test page that exercises the bridge.

The web UI is a prebuilt, minified bundle in web/dist-assets/web, packaged into
the APK's assets and loaded from them through androidx.webkit's
WebViewAssetLoader (https://appassets.androidplatform.net/assets/). The release
build loads nothing from the network. Its source is in web/src, built with Vite
from web/package.json and web/package-lock.json.

The bridge's Java source is compiled into the plugin from
app/src/reactive-bridge/java (package com.atakmap.android.reactive).


_________________________________________________________________
STATUS

Released. Published to Arsenal C2 for ATAK CIV 5.4.0, 5.5.0, 5.5.1 and 5.6.0.
Example version: see version.txt.


_________________________________________________________________
POINT OF CONTACTS

rixau (https://github.com/rixau)


_________________________________________________________________
PORTS REQUIRED

None. The plugin opens no sockets and makes no network requests of its own.

CoT messages sent from the React UI go through ATAK's own dispatchers
(CommsMapComponent internal/external dispatcher), on whatever connections ATAK
is already configured to use.

Debug builds only (not the release/signed build): the WebView loads the UI from
a Vite dev server on the developer's machine, by default localhost:5173 through
`adb reverse`. Release builds never contact it.


_________________________________________________________________
EQUIPMENT REQUIRED

An Android device running ATAK CIV 5.4.0 or newer (minSdk 21, targetSdk 34),
with Android System WebView.


_________________________________________________________________
EQUIPMENT SUPPORTED

Android phones and tablets running ATAK CIV 5.4.0, 5.5.0, 5.5.1 or 5.6.0.


_________________________________________________________________
COMPILATION

Standard ATAK plugin build:

    ./gradlew assembleCivRelease

The build needs no Node.js: the web UI is prebuilt and checked in at
web/dist-assets. A release build fails if web/dist-assets/web/index.html is
missing, rather than producing an APK with a blank panel.

To rebuild the web UI from source (optional, needs Node.js 22):

    cd web && npm ci && npm run build


_________________________________________________________________
DEVELOPER NOTES

- WebView settings. The release build enables JavaScript and exposes the bridge
  with addJavascriptInterface; this is how the React UI reaches ATAK. Content
  comes only from the APK's own assets. Mixed content and WebView remote
  debugging are enabled only in debug builds.
- Benchmark receivers. BenchReceiver and NativeChurnReceiver are system-exported
  broadcast receivers used by the performance scripts. They are compiled in only
  with -Pbenchmarks=true and are absent from a normal build.
- Source layout. This README describes the submission package, which
  scripts/package-tpc-submission.sh in the atak-reactive repository produces. In
  that repository the bridge source lives in lib/, the SDK in sdk/, and
  web/dist-assets is a build output rather than checked in.
