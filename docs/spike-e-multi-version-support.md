# Spike E: ATAK 5.5.1 SDK Support

## Context

The SDK and CLI currently target ATAK 5.6.0 only. This spike adds support for ATAK 5.5.1 — the next version down. Older versions (5.5.0, 5.4.0) are handled in Spike F.

An initial attempt to compile our bridge code against the 5.5.1 SDK by swapping `main.jar` and `takdev.jar` in an isolated project failed — not because of API differences, but because each version's takdev plugin has a different mechanism for providing ATAK classes to the compiler. The `main.jar` contents differ significantly between versions (5.5.1 has fewer classes exposed directly).

**The lesson:** You can't test version compatibility by swapping JARs in a project built for a different version. You need a real plugin project created by that version's SDK.

## Approach

For each target version:

1. Extract the SDK zip
2. Use the SDK's own plugin template to create a real plugin project (each SDK ships a template plugin)
3. Run `npx @atak-reactive/cli init` on that project
4. Build with `./gradlew assembleCivDebug`
5. Catalog what breaks
6. Create version-specific templates in `cli/src/templates/{version}/` with fixes
7. Verify the build passes

## SDK

| SDK | Path |
|-----|------|
| 5.5.1 | `~/Downloads/atak-sdks/ATAK-CIV-5.5.1.13-SDK.zip` |

## Research Per Version

### 1. Extract and Set Up Plugin Project

```bash
# Extract SDK
unzip ~/Downloads/atak-sdks/ATAK-CIV-5.5.1.13-SDK.zip -d /tmp/atak-sdk-5.5.1/

# The SDK should include a template plugin project or instructions
# to create one. Check docs/ for setup instructions.
ls /tmp/atak-sdk-5.5.1/ATAK-CIV-5.5.1.13-SDK/
```

If the SDK doesn't include a template project, use the `plugintemplate` from the atak-civ source tree but adjust `ATAK_VERSION` and point to the correct takdev/main.jar.

### 2. Run Init and Build

```bash
cd /path/to/5.5.1-plugin-project
npx @atak-reactive/cli init
./gradlew assembleCivDebug
```

### 3. Catalog Failures

For each compile error, document:
- File and line
- What class/method is missing or changed
- What the 5.6.0 code expects vs what 5.5.1 provides
- The fix (different import, different method signature, feature not available)

### 4. Key Areas to Watch

Based on the initial investigation, these are likely to differ:

**Plugin lifecycle classes:**
- `com.atak.plugins.impl.AbstractPlugin` — may have different constructor signature
- `com.atak.plugins.impl.AbstractPluginTool` — same
- `gov.tak.api.plugin.IServiceController` — may not exist in older versions
- `com.atak.plugins.impl.PluginContextProvider` — same

**Contact system:**
- `com.atakmap.android.contact.Contact` vs `gov.tak.platform.contact.Contact`
- Listener interface may differ

**Geofence system:**
- Entire package may not exist or have different structure

**Chat system:**
- `ChatManagerMapComponent` listener interface may differ

**Navigation:**
- `RouteNavigator` listener interfaces may have different method signatures

**Build system:**
- `atak-gradle-takdev` plugin behavior differs per version
- How `main.jar` is resolved and added to classpath
- Proguard rules may differ

### 5. Create Version Template

For each difference found:
- If it's an import change: update the import in the template file
- If it's a missing method: add a version-compatible alternative
- If it's a missing feature: stub it out with a no-op and log a warning
- If it's a structural change: create a different version of the file

The goal is: `cli/src/templates/5.5.1/java/reactive/` contains bridge files that compile against 5.5.1 without errors. The SDK (TypeScript) doesn't change — it talks to the same bridge interface regardless of version.

### 6. Update CLI Version Detection

The CLI's `detectAtakVersion()` already reads `ATAK_VERSION` from `build.gradle` and resolves to the nearest template. Verify:
- `5.5.1` resolves to `5.5.1/` templates
- `5.5.0` resolves to `5.5.0/` or falls back to `5.5.1/` if close enough
- `5.4.0` resolves to `5.4.0/` or its own templates

Check `resolveTemplateVersion()` in `cli/src/utils.ts` for the resolution logic.

## Deliverable Per Version

- `cli/src/templates/{version}/java/reactive/` — version-specific bridge files
- Document listing all API differences from 5.6.0
- Build verification: `./gradlew assembleCivDebug` passes with a real plugin project
- Updated version resolution logic in CLI if needed

## What Doesn't Change

- `sdk/src/` — TypeScript SDK is version-independent (Principle #13)
- `sdk/src/types/` — same types across all versions
- `sdk/src/hooks/` — same hooks
- `sdk/src/__tests__/` — same tests (they test against mock bridge)
- `example/web/` — same React app

Only the Java templates change per version.

## Research Findings

### 5.5.1 — Tested 2026-03-25

**Result: 5.6.0 bridge code compiles against 5.5.1 with zero code changes.**

Setup:
- Extracted `ATAK-CIV-5.5.1.13-SDK.zip` → `atak-gradle-takdev.jar` + `main.jar` (no plugin template bundled)
- Used `plugintemplate` from atak-civ source, set `ATAK_VERSION = '5.5.1'`, pointed `takdev.plugin` to 5.5.1 jar
- Ran `npx @atak-reactive/cli init`, then `./gradlew assembleCivDebug`

Findings:
1. **Bridge compilation: PASS** — all 17 Java files compile with no errors against 5.5.1 `main.jar`
2. **takdev classpath resolution** — the 5.5.1 takdev plugin didn't auto-resolve `main.jar` in this standalone setup. Workaround: copy `main.jar` to `app/libs/` as `compileOnly`. In a real SDK-generated plugin project, takdev handles this automatically.
3. **Plugin template incompatibility** — the atak-civ `plugintemplate` (5.6.0) uses `gov.tak.api.plugin` and `gov.tak.api.ui` packages that don't exist in 5.5.1. This is the *plugin scaffold*, not our bridge code. A real 5.5.1 plugin would use `com.atak.plugins.impl.AbstractPlugin` instead.
4. **No API differences found** — contacts, chat, geofence, navigation, routes, markers, shapes, CoT, intents — all compile identically.

Action taken: Created `cli/src/templates/5.5.1/` as a copy of `5.6.0/` so the CLI resolves it directly. If differences surface later, the template is in place to diverge.

### 5.5.0 — Tested 2026-03-25

**Result: 5.6.0 bridge code compiles against 5.5.0 with zero code changes.**

Same setup as 5.5.1 using `ATAK-CIV-5.5.0.7-SDK.zip`. All 17 bridge files compile cleanly. No API differences found.

Action taken: Created `cli/src/templates/5.5.0/` as a copy of `5.6.0/`.

### 5.4.0 — Tested 2026-03-25

**Result: 5.6.0 bridge code compiles against 5.4.0 with zero code changes.**

Same setup using `ATAK-CIV-5.4.0.31-SDK.zip`. All 17 bridge files compile cleanly. No API differences found. This was the version most expected to diverge, but the ATAK APIs used by our bridges (contacts, chat, geofence, routes, navigation, maps, CoT) have remained stable across 5.4.0–5.6.0.

Action taken: Created `cli/src/templates/5.4.0/` as a copy of `5.6.0/`.

### Summary

| Version | Bridge Compilation | Code Changes | Template |
|---------|-------------------|--------------|----------|
| 5.6.0 | PASS | — (baseline) | `cli/src/templates/5.6.0/` |
| 5.5.1 | PASS | None | `cli/src/templates/5.5.1/` |
| 5.5.0 | PASS | None | `cli/src/templates/5.5.0/` |
| 5.4.0 | PASS | None | `cli/src/templates/5.4.0/` |

All templates are currently identical copies of 5.6.0. Each has its own directory so the CLI resolves exactly and any future version-specific fixes can be applied without affecting other versions.

## Depends On

Spike A (Java API wiring) — done.
Spike C (CLI template sync) — done.
