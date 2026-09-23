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

# The release lives in a private repo, so an unauthenticated gh reports it as
# "release not found" — which reads as a missing asset, not a missing token.
# Say what is actually wrong. This is what an outside contributor sees if they
# run the script locally, and what CI showed for every fork PR before forks were
# gated out of lib-compile.
if [ -z "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ] && ! gh auth status >/dev/null 2>&1; then
    echo "error: not authenticated to GitHub — ${REPO} is private." >&2
    echo "  Set GH_TOKEN (CI: secrets.CI_SDK_TOKEN) or run: gh auth login" >&2
    exit 1
fi

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
