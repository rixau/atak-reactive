#!/usr/bin/env bash
set -euo pipefail

# Publishes an example APK to Arsenal C2.
# Usage: ./scripts/publish-example.sh <apk> [--dry-run]
#
# Env:
#   ARSENAL_TOKEN     API token with the publish scope. Required.
#   ARSENAL_ORG       namespace to publish into. Required.
#   ARSENAL_CHANNEL   alpha | beta | rc | release (default: release)
#   ARSENAL_RELEASE_NAME  semver name of the release this APK belongs to. Required.
#   ARSENAL_NOTES     release notes (optional)
#   ARSENAL_URL       registry base URL (default: https://arsenalc2.com/api)
#
# This is the HTTP call `arsenal push` makes, without the CLI, which is not on npm.
# The registry reads the package name, versionCode, versionName, flavor and signer
# off the APK, so the request is only the artifact, a channel and a release name.
#
# The release name is what the registry orders releases by (semver precedence),
# and every new release needs one. Pushes that carry the same name join one
# release, which is how the per-ATAK-version APKs end up together.
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
: "${ARSENAL_RELEASE_NAME:?ARSENAL_RELEASE_NAME is not set}"
CHANNEL="${ARSENAL_CHANNEL:-release}"
URL="${ARSENAL_URL:-https://arsenalc2.com/api}"

[ -f "${APK}" ] || { echo "error: ${APK} is not a file" >&2; exit 1; }

QUERY="org=${ARSENAL_ORG}"
[ -n "${DRY_RUN}" ] && QUERY="${QUERY}&dryRun=1"

BODY="$(mktemp)"
trap 'rm -f "${BODY}"' EXIT

# push [promote=false]
push() {
    curl -sS -o "${BODY}" -w '%{http_code}' -X POST "${URL}/upload?${QUERY}" \
        -H "Authorization: Bearer ${ARSENAL_TOKEN}" \
        -F "channel=${CHANNEL}" \
        -F "releaseName=${ARSENAL_RELEASE_NAME}" \
        ${ARSENAL_NOTES:+-F "releaseNotes=${ARSENAL_NOTES}"} \
        ${1:+-F "promote=${1}"} \
        -F "artifact=@${APK}"
}
error_code() { jq -r '.error? // empty' "${BODY}" 2>/dev/null; }

echo "$([ -n "${DRY_RUN}" ] && echo checking || echo pushing) $(basename "${APK}") -> ${ARSENAL_ORG} (${CHANNEL}, release ${ARSENAL_RELEASE_NAME})"
STATUS="$(push)"

# The registry refuses to move a channel's head back to a lower release name. On
# a pre-release channel that happens when a PR based on an older example version
# publishes after one based on a newer version. The preview is still worth having,
# so store it without making it the head; on release, an older build is a mistake
# and stays refused.
if [ "${STATUS}" = 409 ] && [ "$(error_code)" = head_is_newer ] && [ "${CHANNEL}" != release ]; then
    echo "::notice title=not the ${CHANNEL} head::${ARSENAL_RELEASE_NAME} is older than the ${CHANNEL} channel's current release, so it is published without becoming the head."
    STATUS="$(push false)"
fi

# The example ships one APK per ATAK version, pushed one at a time into the same
# release. If a push fails partway, re-running the workflow re-pushes the builds
# that already landed, and those are refused as duplicates. That refusal means
# the build is already published, so it is not an error here.
if [ "${STATUS}" = 409 ] && [ "$(error_code)" = artifact_already_exists ]; then
    echo "::notice title=already published::$(basename "${APK}") is already in the registry; skipping it."
    exit 0
fi

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
