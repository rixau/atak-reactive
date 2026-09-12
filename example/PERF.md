# Resource profiling

Answers "is a WebView panel expensive?" with numbers instead of an argument.
The example plugin's **Perf** tab drives a fixed stress scenario, and
`scripts/perf-profile.sh` samples memory and CPU from the host while
it runs.

## Where the cost lives

Reading the code, the cost splits into a fixed part and a variable part:

- **Fixed: one Chromium renderer per WebView.** `ReactiveWebView` and
  `ReactiveDropDown` create the `WebView` at construction and load
  `about:blank`, so the renderer process exists from plugin load, not first
  open. That is a deliberate first-open latency trade. Most of a renderer's
  footprint is shared zygote pages, so PSS and RSS tell very different stories:
  on an x86_64 emulator one idle renderer measured ~6.6 MB PSS against ~95 MB
  RSS. PSS is the honest "what does this cost the device" number and is what the
  script records; quote RSS only if you say which one you mean. On top of that
  sits GPU/graphics memory inside ATAK's own process. A plugin with three
  embedded views pays the renderer cost three times.
- **Variable: the event relay while a hook is mounted.** Nothing crosses the
  bridge unless a hook subscribes: `MapItemStore` ref-counts subscribers and
  calls `startMapItemStream()` / `stopMapItemStream()`, and
  `MapItemEventRelay` attaches native listeners only while that count is
  non-zero. Updates are debounced 100 ms and coalesced per UID, so a marker
  moving ten times a second costs one `evaluateJavascript` per 100 ms.
  The hot loop on a busy map is: serialize changed items → build one JSON
  payload → `evaluateJavascript` → `handleEvent` re-runs `getFiltered()`
  over the whole store for every subscriber → React re-render.
- **Closed: ~0 CPU.** `onDropDownClose` detaches every listener and calls
  `webView.onPause()`, which suspends timers and the compositor. The renderer
  stays resident.

## Running it

1. Build and install the example as a **release** build:

   ```bash
   cd example/web && npm run build
   cd .. && ./gradlew assembleCivRelease
   adb install -r app/build/outputs/apk/civ/release/*.apk
   ```

   Release is the build worth measuring: it serves the minified bundle from
   `assets/`. A debug build loads the React dev bundle from the Vite dev server
   and shows a retrying error page when that server is not running — it never
   falls back to the bundled assets. Console output reaches logcat either way,
   since `WebChromeClient` is attached unconditionally.
2. After installing, enable the plugin: ATAK marks a freshly installed plugin
   `will NOT load` until you tick it in Settings → Tool Preferences → Package
   Management. Confirm with `adb logcat -d | grep ReactiveDropDown` — one
   `Loading: about:blank` per WebView appears at plugin load.
3. Kill other apps that use WebView — every renderer on the device is summed,
   because renderers run under isolated uids and cannot be attributed.
4. With the plugin panel **closed**:

   ```bash
   cd example
   ./scripts/perf-profile.sh            # add --battery on a physical device
   ```

5. When prompted, open the plugin, go to **Perf**, adjust the fields if you
   like, tap **Run**. The defaults (200 markers, 1 Hz, 15 s phases, 30 s
   churn) take about two and a half minutes.
6. When prompted again, close the panel for the leak check.

Results land in `perf-results/<timestamp>.{csv,md}`.

## Phases

| phase | what is running | what it isolates |
|---|---|---|
| `closed` | ATAK + plugin loaded, panel closed | resident cost of the idle renderer |
| `idle` | panel open, Perf tab, no hooks mounted | React + a live WebView doing nothing |
| `subscribed` | `useMapItems()` mounted on whatever the map already holds | native listeners attached, seed snapshot |
| `load` | `addMarker()` × N in a tight loop | JS→Java call cost; time until the hook sees all N |
| `loaded` | N markers, no updates, hook mounted | steady state with a populated store |
| `churn` | every marker moved at `updateHz`, hook mounted | **the full path** — the number a critic would cite |
| `churn-unsubscribed` | identical updates, hook unmounted, relay detached | ATAK's own cost of moving N markers, plus the JS→Java update calls |
| `cleanup` | `removeMarker()` × N, hook remounted | removal path |
| `cleaned` | nothing, hook unmounted | should match `idle`; growth is a leak |
| `closed-after` | panel closed | should match `closed` |

The pair that matters is **`churn` minus `churn-unsubscribed`**: same marker
load, same update rate, same JS→Java calls, but in the second one nothing
crosses back into the WebView. That delta is what the library adds to a busy
map. The summary prints it.

Note the load driver is the page itself (`updateMarker` from JS), so both
churn phases include that JS→Java cost. It cancels in the delta but inflates
both absolute numbers slightly versus markers moved by CoT ingest.

## In-page metrics

The page logs `PERF_TEST:METRIC:<key>=<value>` lines that the script folds
into the report:

- `<phase>.jsHeapKb` — `performance.memory.usedJSHeapSize` at phase entry.
  Chromium-only; `n/a` in the browser mock.
- `load.addMarkerMs` / `load.timeToConsistentMs` — wall time for the add
  loop, and until `useMapItems()` reported all N. The gap is debounce +
  serialization + bridge + render.
- `churn.tickMsAvg` / `tickMsMax` — time to issue N `updateMarker` calls.
  If this approaches `1000 / updateHz`, the page cannot keep up and the
  effective rate is lower than configured.
- `churn.eventsReceived` / `itemsReceived` — `mapItemsChanged` batches and
  items in them. With debouncing, expect roughly `churnSecs × updateHz`
  batches of ~N items. `churn-unsubscribed.eventsReceived` should be **0**.
- `churn.lagMsAvg` / `lagMsMax` — from the end of an update tick to the next
  batch arriving in JS. Floor is the 100 ms debounce.
- `<phase>.renders` — `Subscriber` render count in the phase. `loaded.renders`
  should be 0 or near it; `churn.renders` ≈ batches received.

## Reading the numbers

- **Renderer PSS** is the fixed cost. It should be flat across phases; if it
  climbs through `churn` and does not fall back by `cleaned`, the JS side is
  retaining something.
- **ATAK PSS** includes the WebView's in-process share (GPU, compositor,
  Java-side bridge objects). `cleaned` vs `idle` is the leak check for the
  native side of the bridge.
- **CPU** is normalised per core: 100 = one core saturated. `dumpsys meminfo`
  costs the target a few hundred ms per sample, so keep `--interval` ≥ 2.
- **Battery** (`--battery`) resets `batterystats` at start and dumps the
  package's estimated draw at the end. Only meaningful on a physical device,
  unplugged; emulators report nothing useful. Run three times and compare.

For a fair comparison against native, run the same scenario with a native
ATAK panel open that lists the same markers — Overlay Manager is the closest
built-in — and put the two `churn` rows side by side.

## If the run aborts

The script checks before every sample that ATAK still holds the pid it started
with, and stops if it does not — a dead target makes `dumpsys` return nothing,
which would otherwise be recorded as `0` and summarised as if it were data.

The cause worth recognising is the WebView renderer dying and taking ATAK with
it. Neither `ReactiveWebView` nor `ReactiveDropDown` overrides
`onRenderProcessGone`, and on Android 8+ an unhandled renderer death kills the
host process. It shows up in `adb logcat -b events` as two lines a third of a
second apart, with no `am_kill` and plenty of free memory:

```
am_proc_died: [0,12496,com.google.android.webview:sandboxed_process0:...,0,3]
am_proc_died: [0,12219,com.atakmap.app.civ,0,2]
```

ATAK then offers "ATAK exited uncleanly... one of the plugins malfunctioned" on
the next start.

Do not sample the renderer with `dumpsys meminfo <renderer pid>`. On the
emulator (WebView 113, Android 14) that call is fatal to the renderer: it runs
`ActivityThread.dumpMemInfo` inside the isolated process, ART's large-object
allocation there issues an `mmap` the Chromium seccomp sandbox rejects, and the
sandbox crashes the process (`Cause: null pointer dereference` in
`libmonochrome`, "crash detected (code 11)" from `aw_browser_terminator`). An
earlier version of this script did exactly that, and every abort seen while
writing it traced back to the sampler, not to the scenario — the scenario
itself completes at 200 markers / 1 Hz with the renderer peaking around 60 MB
PSS. The global `dumpsys meminfo` the script uses now reads `/proc` from
system_server and never calls into the renderer.

The library gap is real all the same, and ATAK 5.6.0.14 core has the same gap
on its own WebViews: with the plugin uninstalled, killing the renderer still
kills ATAK. A fix in this library stops it being *a* cause; it cannot on its
own keep ATAK up on that build.

## If the delta is bad

The likely culprit is `MapItemStore.handleEvent`, which rebuilds
`getFiltered()` for every subscriber on every batch: an O(store × subscribers)
scan every 100 ms. Options, cheapest first:

1. Skip subscribers whose filter cannot match anything in the batch.
2. Keep a per-filter index (type/group) so a filtered hook does not scan
   unrelated items.
3. Diff instead of re-filter: hand subscribers the batch and let them patch.

Have the benchmark before doing any of it.
