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
  open. That is a deliberate first-open latency trade. Much of a renderer's
  footprint is shared zygote pages, so PSS and RSS tell very different stories;
  PSS is the honest "what does this cost the device" number and is what the
  script records. On an x86_64 emulator (WebView 113) the renderer sits at
  ~34 MB PSS holding `about:blank`, ~49 MB once the example page is loaded, and
  stays there after the panel closes. On top of that sits GPU/graphics memory
  inside ATAK's own process. All WebViews in one app share the single renderer,
  so a plugin with three embedded views pays the process once and the page
  three times.
- **Variable: the event relay while a hook is mounted.** Nothing crosses the
  bridge unless a hook subscribes: `MapItemStore` ref-counts subscribers and
  calls `startMapItemStream()` / `stopMapItemStream()`, and
  `MapItemEventRelay` attaches native listeners only while that count is
  non-zero. Updates are coalesced per UID with a 100 ms trailing debounce and
  a 500 ms deadline, so under a continuous feed the WebView sees at most two
  batches a second no matter how many events arrive. Items are serialized on
  whichever thread changed them — `CotDispatcher` for a CoT feed — and only
  the batched `evaluateJavascript` lands on the UI thread. The hot loop on a
  busy map is: serialize changed items → build one JSON payload →
  `evaluateJavascript` → `handleEvent` re-runs `getFiltered()` over the whole
  store for every subscriber → React re-render.
- **Closed: ~0 CPU.** `onDropDownClose` stops the emitter listeners and calls
  `webView.onPause()`, which suspends timers and the compositor. The map-item
  relay itself keeps batching until the page unmounts its hooks, but the
  measured cost of that with the panel hidden is below sampling noise (see
  below). The renderer stays resident.

## Running it

1. Build and install the example as a **release** build, with the Perf tab
   switched on:

   ```bash
   cd example/web && VITE_PERF_TAB=true npm run build
   cd .. && ./gradlew assembleCivRelease
   adb install -r app/build/outputs/apk/civ/release/*.apk
   ```

   `VITE_PERF_TAB` is a Vite build-time flag: the tab and its page are only
   in the bundle when it is set, so a normal `npm run build` ships the four
   example tabs and nothing else. The dev server always shows it.

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
| `closed-after` | panel closed | should match `idle` — the page stays loaded, only paused |

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
  Java-side bridge objects). `cleaned` vs `idle` and `closed-after` vs `idle`
  are the leak checks. One run cannot tell a leak from lazy GC and allocator
  slack — V8 and ART both keep freed memory around. If a delta looks bad, run
  the scenario a second time in the same session without restarting ATAK; a
  leak grows again, slack does not.
- **JS heap** is deliberately not reported. `performance.memory` in Chromium is
  bucketized and refreshed at most every 20 minutes unless the renderer runs
  with `--enable-precise-memory-info`, so per-phase readings come back
  identical and look like a flat heap when they are just a stale one.
- **CPU** is normalised per core: 100 = one core saturated. `dumpsys meminfo`
  costs the target a few hundred ms per sample, so keep `--interval` ≥ 2.
- **Battery** (`--battery`) resets `batterystats` at start and dumps the
  package's estimated draw at the end. Only meaningful on a physical device,
  unplugged; emulators report nothing useful. Run three times and compare.

For a comparison against native, do not reuse this scenario: its load comes
from the page, so a native panel cannot be measured under it. Use
`scripts/cot-compare.sh` (below), which feeds real CoT and measures Overlay
Manager, a purpose-built native list and the React page under the same load.

## Reference run

x86_64 emulator (`sdk_gphone64_x86_64`, Android 14, WebView 113.0.5672.136),
ATAK 5.6.0.14, example release build, defaults (200 markers, 1 Hz, 15 s
phases, 30 s churn), 3 s samples, two runs back to back in one ATAK process.
Emulator numbers are not device numbers — ATAK's map rendering in particular
is far heavier under software GL — but the deltas transfer better than the
absolutes.

| phase | ATAK PSS avg (MB) | renderer PSS avg (MB) | ATAK CPU avg % | renderer CPU avg % |
|---|---|---|---|---|
| closed | 318 / 331 | 34 / 59 | 7.8 / 7.0 | 0.0 |
| idle | 324 / 330 | 49 / 54 | 7.7 / 6.8 | 0.1 / 0.0 |
| subscribed | 325 / 330 | 49 / 54 | 6.6 / 5.9 | 0.2 / 0.4 |
| churn | 353 / 361 | 58 / 60 | 229.1 / 203.7 | 3.1 / 3.2 |
| churn-unsubscribed | 364 / 366 | 59 / 57 | 204.6 / 196.0 | 1.7 / 1.7 |
| cleaned | 344 / 355 | 59 / 57 | 12.2 / 12.5 | 0.2 |
| closed-after | 332 / 334 | 59 / 56 | 6.3 / 6.8 | 0.0 / 0.1 |

What it says:

- **Open, idle: +21 MB, no measurable CPU.** Opening the panel costs ~15 MB in
  the renderer (page load) and ~6 MB in ATAK. Idle and subscribed are
  indistinguishable from closed on CPU: the relay costs nothing until items
  actually change.
- **Nothing leaks.** Run 2 started where run 1 ended (390 vs 391 MB total) and
  returned to the same place (390 MB). The +38 MB run 1 appeared to "grow" was
  one-time page-load and warm-up, not accumulation. This is why the run must be
  repeated in one process before calling anything a leak — a single run cannot
  tell first-run cost from a leak.
- **The ATAK-side CPU cost of the bridge is below this method's noise floor.**
  The churn delta was +24.5 points in run 1 and +7.7 in run 2 — and run 2 did
  *more* bridge work (31 of 31 batches, 6200 items, against 19 of 30 and 3800).
  Differencing two ~200% numbers that each swing ±10 cannot resolve a
  single-digit signal. Treat the honest answer as "somewhere under ~25 points,
  and not separable from ATAK's own map cost at this marker count".
- **The renderer-side cost is small and reproducible**: +1.4 and +1.5 points
  between `churn` and `churn-unsubscribed` across the two runs. That is the
  React + store-filter + re-render share.
- **Delivery lags under load**: `lagMsAvg` 706 ms and 848 ms against a ~150 ms
  floor. `evaluateJavascript` runs on the UI thread, which is already busy with
  the map, so batches queue. This is contention, not serialization cost, and it
  is what a user actually sees.
- **JS→Java calls are cheap**: 200 `addMarker` in 136–216 ms, 200
  `updateMarker` in ~38–50 ms. Roughly 0.2–1 ms each.

### Comparing against a native panel

Two scripts, two kinds of load. Use the second one for any number you intend
to quote.

**`scripts/native-compare.sh`** moves markers from a plain thread inside the
plugin (`NativeChurnReceiver`), one `mapView.post(setPoint)` per marker per
tick. That puts all the work on the UI thread, which is not where a real feed
puts it, and a build before the store fixes in #35 showed the React panel
STATIC under it. Keep it for the Perf tab's own phases, not for head-to-head.

**`scripts/cot-compare.sh`** is the fair one. `cot-load.py` sends real CoT to
ATAK's TCP input on 4242 (one event per connection — that is how ATAK frames
it), so the markers arrive through ATAK's own ingest and item listeners fire on
`CotDispatcher`, exactly as in the field. It then samples five phases of equal
length under that load: no panel, Overlay Manager filtered to the load, a
purpose-built native list, the React Map Items page, and no panel again as a
drift check. `NativeListReceiver` is the native control: a `ListView` showing
every visible point item with the same three fields as the React page (title,
lat/lon, type), driven by the same listener set as `MapItemEventRelay` and the
same 100 ms / 500 ms batching. Whatever it costs is what a native panel with
this design pays; the gap between it and the React panel is the WebView.

Same emulator as above, ATAK 5.6.0.14, example release build with #35, 100
markers at 1 Hz through CoT, 60 s per phase in six 10 s windows, every panel
confirmed repainting by frame diff:

| phase | ATAK CPU % | ATAK PSS MB | renderer PSS MB | renderer CPU % |
|---|---|---|---|---|
| no panel | 142 | 332 | 46 | 0 |
| Overlay Manager | **156** | 347 | 46 | 0 |
| native list | **143** | 343 | 46 | 0 |
| React Map Items | **138** | 342 | **65** | **1.7** |
| no panel again | 138 | 345 | 61 | 0 |

The baseline drifted 142 → 138 over the run, so read each panel against its
neighbours. Per-window samples overlap completely (no panel 135–147, native
137–147, React 136–141).

- **A batched native list and the React page cost the same in ATAK's process:
  nothing measurable.** Both are inside the noise of no panel at all. The
  library's real overhead is in the renderer: ~19 MB PSS while the page is
  open (~15 MB retained after close) and under 2% of a core, on a separate
  process.
- **Overlay Manager's +14–18 points is the cost of its design, not of being
  native.** It is a general-purpose tree that recomputes range, bearing and MSL
  per row and refreshes per event. That is the panel a plugin author would
  otherwise reuse, so it is a fair "what would I ship instead" comparison —
  but it is not evidence that WebView beats native. The native list is.
- **Where the library would lose** is a load where serialization itself
  dominates. At 500 markers and ~500 events/s the relay delivered 300–450 item
  batches at the 500 ms deadline with ATAK at ~200% CPU, but that CPU was
  ATAK's own ingest; this harness did not find the relay's ceiling.

Things checked on the same build that produced no number worth a table:
the panel hidden with the relay still batching (248% vs 250% at 500 markers,
below noise), 5.5 min sustained at 500 markers (renderer 57–69 MB, no trend, no
ANR), renderer death while subscribed (old bridge disposed, fresh one created,
no refcount drift), and removal through `t-x-d-d` (rows disappear).
## If the run aborts

The script checks before every sample that ATAK still holds the pid it started
with, and stops if it does not — a dead target makes `dumpsys` return nothing,
which would otherwise be recorded as `0` and summarised as if it were data.

The cause worth recognising is the WebView renderer dying and taking ATAK with
it. On Android 8+ a renderer death kills the host process unless *every*
WebView on that renderer handles `onRenderProcessGone`. `ReactiveWebView` and
`ReactiveDropDown` do — they log `WebView renderer crashed` / `was killed by
the system`, destroy the dead view and rebuild it — but ATAK 5.6.0.14 core
holds three WebViews of its own with the default client, so on that build the
host still dies (verified with the plugin uninstalled). It shows up in
`adb logcat -b events` as two lines a third of a second apart, with no
`am_kill` and plenty of free memory:

```
am_proc_died: [0,12496,com.google.android.webview:sandboxed_process0:...,0,3]
am_proc_died: [0,12219,com.atakmap.app.civ,0,2]
```

ATAK then offers "ATAK exited uncleanly... one of the plugins malfunctioned" on
the next start. If the library's log line is present just before the death,
the plugin handled it and the kill came from elsewhere.

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

## If the delta is bad

The likely culprit is `MapItemStore.handleEvent`, which rebuilds
`getFiltered()` for every subscriber on every batch: an O(store × subscribers)
scan every 100 ms. Options, cheapest first:

1. Skip subscribers whose filter cannot match anything in the batch.
2. Keep a per-filter index (type/group) so a filtered hook does not scan
   unrelated items.
3. Diff instead of re-filter: hand subscribers the batch and let them patch.

Have the benchmark before doing any of it.
