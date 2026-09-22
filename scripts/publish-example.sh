#!/usr/bin/env bash
set -euo pipefail

# Publishes an example APK to Arsenal C2.
# Usage: ./scripts/publish-example.sh <apk> [--dry-run]
#
# Env:
#   ARSENAL_TOKEN     API token with the publish scope. Required.
#   ARSENAL_ORG       namespace to publish into. Required.
#   ARSENAL_CHANNEL   alpha | beta | rc | release (default: release)
#   ARSENAL_NOTES     release notes (optional)
#   ARSENAL_URL       registry base URL (default: https://arsenalc2.com/api)
#
# This is the HTTP call `arsenal push` makes, without the CLI, which is not on npm.
# The registry reads the package name, versionCode, versionName, flavor and signer
# off the APK, so the request is only the artifact and a channel.
#
# Keep the /api suffix on ARSENAL_URL: the bare origin serves the portal, and
# every request to it 200s with index.html.

APK="${1:?Usage: publish-example.sh <apk> [--dry-run]}"
DRY_RUN="${2:-}"
case "${DRY_RUN}" in
    ""|--dry-run) ;;
    # Refuse rather than ignore: a typo'd --dryrun would otherwise publish.
    *) echo "error: unknown option ${DRY_RUN}" >&2; exit 1 ;;
esac
: "${ARSENAL_TOKEN:?ARSENAL_TOKEN is not set}"
: "${ARSENAL_ORG:?ARSENAL_ORG is not set}"
CHANNEL="${ARSENAL_CHANNEL:-release}"
URL="${ARSENAL_URL:-https://arsenalc2.com/api}"

[ -f "${APK}" ] || { echo "error: ${APK} is not a file" >&2; exit 1; }

QUERY="org=${ARSENAL_ORG}"
[ -n "${DRY_RUN}" ] && QUERY="${QUERY}&dryRun=1"

BODY="$(mktemp)"
trap 'rm -f "${BODY}"' EXIT

echo "$([ -n "${DRY_RUN}" ] && echo checking || echo pushing) $(basename "${APK}") -> ${ARSENAL_ORG} (${CHANNEL})"
STATUS="$(curl -sS -o "${BODY}" -w '%{http_code}' -X POST "${URL}/upload?${QUERY}" \
    -H "Authorization: Bearer ${ARSENAL_TOKEN}" \
    -F "channel=${CHANNEL}" \
    ${ARSENAL_NOTES:+-F "releaseNotes=${ARSENAL_NOTES}"} \
    -F "artifact=@${APK}")"

if [ "${STATUS}" -lt 200 ] || [ "${STATUS}" -ge 300 ]; then
    echo "::error::Arsenal C2 refused the upload (HTTP ${STATUS}): $(head -c 500 "${BODY}")"
    exit 1
fi

VERB="$([ -n "${DRY_RUN}" ] && echo 'would publish' || echo published)"
jq -r --arg verb "${VERB}" \
    '"\($verb) \(.version.packageName) versionCode \(.version.versionCode)"' "${BODY}"

# Lints are the registry's findings about the build. An error-level one fails the
# job; the rest are surfaced as annotations rather than buried in the log.
# wont_load_official is expected: the example is signed with the SDK key, so it
# loads on SDK builds of ATAK, not on the official one.
jq -r '.version.lints[]? | "\(.level)\t\(.code)\t\(.message)"' "${BODY}" \
    | while IFS=$'\t' read -r level code message; do
        case "${level}" in
            error) echo "::error title=${code}::${message}" ;;
            warn)  echo "::warning title=${code}::${message}" ;;
            *)     echo "::notice title=${code}::${message}" ;;
        esac
    done

if jq -e '[.version.lints[]? | select(.level == "error")] | length > 0' "${BODY}" >/dev/null; then
    exit 1
fi
