#!/usr/bin/env bash
set -euo pipefail

# Builds the example plugin's civ release APK from a clean checkout.
# Usage: ./scripts/build-example.sh
#
# Prints the APK path on the last line of stdout.
#
# Requires: gh authenticated for rixau/atak-ci-resources (CI: secrets.CI_SDK_TOKEN),
# ANDROID_HOME (or sdk.dir in example/local.properties), Java 17, Node 22.
#
# takdev reads four files from an ATAK SDK directory: main.jar, android_keystore,
# proguard-release-keep.txt and (optionally) mapping.txt. Locally that directory
# defaults to two levels above example/, which is wherever the developer unpacked
# the SDK. Here it is lib/sdks/<version>, filled from the same private release as
# the bridge's main.jar, and passed in explicitly as sdk.path.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

ATAK_VERSION="$(sed -n "s/^ *ext.ATAK_VERSION = '\(.*\)'.*/\1/p" example/app/build.gradle)"
[ -n "${ATAK_VERSION}" ] || { echo "error: no ext.ATAK_VERSION in example/app/build.gradle" >&2; exit 1; }
SDK="${ROOT}/lib/sdks/${ATAK_VERSION}"

./scripts/download-sdk.sh "${ATAK_VERSION}" >&2
gh release download "sdk-${ATAK_VERSION}" \
    --repo rixau/atak-ci-resources \
    --dir "${SDK}" \
    --skip-existing \
    --pattern atak-gradle-takdev.jar \
    --pattern android_keystore \
    --pattern proguard-release-keep.txt >&2 || true

# The download is allowed to fail above so this check can report it. gh exits
# non-zero when *no* pattern matches and says only "no assets match the file
# pattern", naming neither the release nor which file is missing - and under
# `set -e` that would abort before the message below, which is the one that says
# what to do. Anything genuinely wrong (a network failure, a bad token) leaves a
# file missing too, so nothing is swallowed.
for f in main.jar atak-gradle-takdev.jar android_keystore proguard-release-keep.txt; do
    [ -f "${SDK}/${f}" ] || {
        echo "error: ${f} is missing from the sdk-${ATAK_VERSION} release of rixau/atak-ci-resources." >&2
        echo "  Upload it from the ATAK ${ATAK_VERSION} SDK: gh release upload sdk-${ATAK_VERSION} <file> --repo rixau/atak-ci-resources" >&2
        exit 1
    }
done

# The web app depends on the SDK by path (file:../../sdk), so it needs a built dist/.
(cd sdk && npm ci && npm run build) >&2

# `npm install`, not `npm ci`: the lockfile records the SDK's version, which moves
# with every release, and the release bump does not touch example/. `ci` would
# refuse the first build after every bump.
(cd example/web && npm install --no-audit --no-fund && npm run build) >&2

# Clear old outputs so the lookup below cannot pick up a stale APK.
rm -rf example/app/build/outputs/apk
(cd example && ./gradlew --no-daemon assembleCivRelease \
    -Psdk.path="${SDK}" \
    -Ptakdev.plugin="${SDK}/atak-gradle-takdev.jar") >&2

APK="$(find example/app/build/outputs/apk/civ/release -name '*.apk' | head -1)"
[ -n "${APK}" ] || { echo "error: the build produced no APK" >&2; exit 1; }
echo "${ROOT}/${APK}"
