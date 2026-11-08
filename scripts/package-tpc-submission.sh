#!/usr/bin/env bash
# Packages the example plugin as a self-contained source zip for TAK Product
# Center (TPC) signing.
# Usage: ./scripts/package-tpc-submission.sh [--verify <sdk-dir>]
#
# In this repo the example isn't self-contained: it compiles the bridge from
# ../lib/src/main/java, its web UI depends on file:../../sdk, and the built web
# bundle (web/dist-assets) is gitignored. The signing runner builds from the zip
# alone and can't run Node, so the zip has to carry all three:
#   - the bridge source, copied to app/src/reactive-bridge/java
#   - the web bundle, prebuilt into web/dist-assets
#   - the SDK as an npm pack tarball in web/vendor, so web/ still rebuilds from source
#
# --verify <sdk-dir> unpacks the zip outside the repo and runs assembleCivRelease
# on it with Node off the PATH, the way the runner will. <sdk-dir> holds main.jar,
# android_keystore, proguard-release-keep.txt and atak-gradle-takdev.jar
# (e.g. lib/sdks/5.6.0, filled by scripts/build-example.sh).
#
# Prints the zip path on the last line of stdout.
#
# Requires: Node 22, rsync, zip, and for --verify Java 17 and ANDROID_HOME (or
# sdk.dir in example/local.properties).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

VERIFY_SDK=""
if [ "${1:-}" = "--verify" ]; then
    VERIFY_SDK="$(cd "${2:?--verify needs an SDK directory}" && pwd)"
fi

VERSION="$(tr -d '[:space:]' < example/version.txt)"
NAME="atak-reactive-example-${VERSION}"
OUT="${ROOT}/example/build/tpc"
STAGE="${OUT}/${NAME}"
ZIP="${OUT}/${NAME}-src.zip"

rm -rf "${OUT}" && mkdir -p "${STAGE}"

# Build the SDK and pack it exactly as npm would publish it.
(cd sdk && npm ci && npm run build) >&2
mkdir -p "${STAGE}/web/vendor"
SDK_TGZ="$(cd sdk && npm pack --silent --pack-destination "${STAGE}/web/vendor" | tail -1)"

# Everything a reviewer or the runner needs from example/, and nothing local:
# local.properties can hold tak.gov credentials.
rsync -a \
    --exclude 'local.properties' \
    --exclude '.gradle/' \
    --exclude 'build/' \
    --exclude 'app/build/' \
    --exclude 'node_modules/' \
    --exclude 'web/dist/' \
    --exclude 'web/dist-assets/' \
    --exclude 'web/tsconfig.tsbuildinfo' \
    --exclude 'perf-results/' \
    example/ "${STAGE}/" >&2

# Bridge source, compiled in place of ../lib/src/main/java.
mkdir -p "${STAGE}/app/src/reactive-bridge"
cp -r lib/src/main/java "${STAGE}/app/src/reactive-bridge/java"
OLD_SRC='java.srcDirs += ["${rootDir}/../lib/src/main/java"]'
NEW_SRC='java.srcDirs += ["${rootDir}/app/src/reactive-bridge/java"]'
grep -qF "${OLD_SRC}" "${STAGE}/app/build.gradle" || {
    echo "error: example/app/build.gradle no longer has: ${OLD_SRC}" >&2
    exit 1
}
GRADLE_TEXT="$(cat "${STAGE}/app/build.gradle")"
printf '%s\n' "${GRADLE_TEXT/"${OLD_SRC}"/"${NEW_SRC}"}" > "${STAGE}/app/build.gradle"

# Point web/ at the vendored SDK tarball and rebuild the lockfile against it.
(cd "${STAGE}/web" \
    && npm pkg set "dependencies.@atak-reactive/sdk=file:vendor/${SDK_TGZ}" \
    && rm -f package-lock.json \
    && npm install --no-audit --no-fund \
    && npm run build) >&2
[ -f "${STAGE}/web/dist-assets/web/index.html" ] || {
    echo "error: the web build produced no web/dist-assets/web/index.html" >&2
    exit 1
}
rm -rf "${STAGE}/web/node_modules" "${STAGE}/web/tsconfig.tsbuildinfo"

(cd "${OUT}" && zip -qr "${ZIP}" "${NAME}")

if [ -n "${VERIFY_SDK}" ]; then
    VERIFY_DIR="$(mktemp -d)"
    trap 'rm -rf "${VERIFY_DIR}"' EXIT
    (cd "${VERIFY_DIR}" && unzip -q "${ZIP}")
    SDK_DIR_LINE="$(grep '^sdk.dir=' example/local.properties 2>/dev/null || true)"
    [ -n "${SDK_DIR_LINE}" ] && echo "${SDK_DIR_LINE}" > "${VERIFY_DIR}/${NAME}/local.properties"
    # No node or npm on the PATH, as on the signing runner.
    NODE_DIR="$(dirname "$(command -v node)")"
    CLEAN_PATH="$(printf '%s' "${PATH}" | tr ':' '\n' | grep -vxF "${NODE_DIR}" | paste -sd:)"
    (cd "${VERIFY_DIR}/${NAME}" && PATH="${CLEAN_PATH}" ./gradlew --no-daemon assembleCivRelease \
        -Psdk.path="${VERIFY_SDK}" \
        -Ptakdev.plugin="${VERIFY_SDK}/atak-gradle-takdev.jar") >&2
    APK="$(find "${VERIFY_DIR}/${NAME}/app/build/outputs/apk/civ/release" -name '*.apk' | head -1)"
    [ -n "${APK}" ] || { echo "error: the verify build produced no APK" >&2; exit 1; }
    # Not `unzip -l | grep -q`: grep exits at the first match and pipefail turns
    # unzip's SIGPIPE into a failure.
    APK_LISTING="$(unzip -l "${APK}")"
    grep -q 'assets/web/index.html' <<< "${APK_LISTING}" || {
        echo "error: the verify APK has no assets/web/index.html" >&2
        exit 1
    }
    cp "${APK}" "${OUT}/"
    echo "verified: $(basename "${APK}") built from the zip with no Node, and contains assets/web/index.html" >&2
fi

echo "${ZIP}"
