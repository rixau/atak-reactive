#!/usr/bin/env bash
set -euo pipefail

# Downloads ATAK SDK main.jar from GitHub Release assets.
# Usage: ./scripts/download-sdk.sh <atak-version>
# Example: ./scripts/download-sdk.sh 5.6.0
#
# Downloads to lib/sdks/<version>/main.jar
# Requires: gh CLI authenticated, or GITHUB_TOKEN env var

ATAK_VERSION="${1:?Usage: download-sdk.sh <atak-version>}"
REPO="rixau/atak-ci-resources"
TAG="sdk-${ATAK_VERSION}"
DEST="lib/sdks/${ATAK_VERSION}"

mkdir -p "${DEST}"

if [ -f "${DEST}/main.jar" ]; then
    echo "Already exists: ${DEST}/main.jar"
    exit 0
fi

echo "Downloading main.jar for ATAK ${ATAK_VERSION}..."
gh release download "${TAG}" \
    --repo "${REPO}" \
    --pattern "main.jar" \
    --dir "${DEST}"

echo "Downloaded: ${DEST}/main.jar"
