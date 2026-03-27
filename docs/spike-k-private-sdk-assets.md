# Spike K: Private SDK Assets

## Context

The ATAK SDK JARs (`main.jar`) are currently stored as public GitHub Release assets on `rixau/atak-reactive` (tags `sdk-5.4.0` through `sdk-5.6.0`). These are only needed by CI — locally, developers get `main.jar` from their ATAK SDK install via takdev. The JARs shouldn't be publicly visible.

## Solution

Move the SDK JARs to a private repo (`rixau/atak-ci-resources`) and update CI to download from there using a PAT.

## Steps

### 1. Upload JARs to `rixau/atak-ci-resources`

Create four releases, each with a `main.jar` asset:

```bash
# From wherever the JARs currently live
for v in 5.4.0 5.5.0 5.5.1 5.6.0; do
  gh release create "sdk-${v}" \
    --repo rixau/atak-ci-resources \
    --title "ATAK SDK ${v}" \
    --notes "main.jar for ATAK ${v}" \
    "path/to/sdks/${v}/main.jar"
done
```

### 2. Add PAT as repo secret on `rixau/atak-reactive`

Create a fine-grained PAT (or use the existing classic PAT) with `repo` scope for `rixau/atak-ci-resources`. Add it as a repository secret:

- Secret name: `CI_SDK_TOKEN`
- Scope: read access to `rixau/atak-ci-resources` releases

### 3. Update `scripts/download-sdk.sh`

Change the repo and token:

```bash
REPO="rixau/atak-ci-resources"   # was: rixau/atak-reactive
```

The script already uses `GH_TOKEN` env var via `gh release download`. No other changes needed — the tag naming (`sdk-5.6.0`) and asset naming (`main.jar`) stay the same.

### 4. Update CI workflows

**`publish-aar.yml`** — change the token passed to `download-sdk.sh`:

```yaml
- name: Download ATAK SDK
  run: ./scripts/download-sdk.sh ${{ matrix.atak-version }}
  env:
    GH_TOKEN: ${{ secrets.CI_SDK_TOKEN }}   # was: github.token
```

**`test.yml`** (from Spike J) — same change for the `lib-compile` job:

```yaml
- name: Download ATAK SDK (5.6.0)
  run: ./scripts/download-sdk.sh 5.6.0
  env:
    GH_TOKEN: ${{ secrets.CI_SDK_TOKEN }}   # was: github.token
```

### 5. Delete public SDK releases from `rixau/atak-reactive`

```bash
for v in 5.4.0 5.5.0 5.5.1 5.6.0; do
  gh release delete "sdk-${v}" --repo rixau/atak-reactive --yes
done
```

## Files to Modify

| File | Change |
|------|--------|
| `scripts/download-sdk.sh` | Change `REPO` to `rixau/atak-ci-resources` |
| `.github/workflows/publish-aar.yml` | Use `CI_SDK_TOKEN` secret instead of `github.token` |
| `.github/workflows/test.yml` | Use `CI_SDK_TOKEN` secret in `lib-compile` job |

## Depends On

- Spike J (test.yml creation) — for the `lib-compile` job update, but `publish-aar.yml` can be updated independently
- `rixau/atak-ci-resources` repo exists (already created)
- `CI_SDK_TOKEN` secret added to `rixau/atak-reactive`

## Time Estimate

An hour. Uploading JARs, updating three files, deleting old releases.
