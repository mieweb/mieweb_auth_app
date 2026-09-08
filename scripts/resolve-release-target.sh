#!/bin/bash
# ──────────────────────────────────────────────────────────
# resolve-release-target.sh
# Resolves a release tag (or a manual dispatch input) into the full parameter
# set for one release target, read from variants/<target>.env.
#
# Inputs (environment):
#   EVENT_NAME        github.event_name ("release" or "workflow_dispatch")
#   TAG               release tag, for EVENT_NAME=release
#   DISPATCH_TARGET   target name, for EVENT_NAME=workflow_dispatch
#   DISPATCH_VERSION  app version, for EVENT_NAME=workflow_dispatch
#   INCLUDE_MOBILE    "true" when the run builds the mobile apps
#
# Writes key=value pairs to $GITHUB_OUTPUT in CI, or to stdout locally:
#   EVENT_NAME=release TAG=mie-v1.2.3 bash scripts/resolve-release-target.sh
# ──────────────────────────────────────────────────────────
set -euo pipefail

# shellcheck source=scripts/lib/variant.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/variant.sh"

EVENT_NAME="${EVENT_NAME:-}"
TAG="${TAG:-}"
DISPATCH_TARGET="${DISPATCH_TARGET:-}"
DISPATCH_VERSION="${DISPATCH_VERSION:-}"
INCLUDE_MOBILE="${INCLUDE_MOBILE:-false}"

fail() {
  echo "::error::$1"
  exit 1
}

APP_VERSION=""
VERSION_SOURCE=""

if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
  TARGET="$DISPATCH_TARGET"
  APP_VERSION="$DISPATCH_VERSION"
  VERSION_SOURCE="input 'app_version'"
else
  VERSION_SOURCE="tag '${TAG}'"
  case "$TAG" in
    mie-os-dev-v*) TARGET=mie-os-dev; APP_VERSION="${TAG#mie-os-dev-v}" ;;
    mie-os-prod-v*) TARGET=mie-os-prod; APP_VERSION="${TAG#mie-os-prod-v}" ;;
    mie-v*) TARGET=mie; APP_VERSION="${TAG#mie-v}" ;;
    v* | dev-v*)
      fail "Tag '${TAG}' uses the retired scheme. Use mie-os-dev-v*, mie-os-prod-v* or mie-v* — see the Releasing section of README.md."
      ;;
    *)
      fail "Tag '${TAG}' matches no release target. Use mie-os-dev-v*, mie-os-prod-v* or mie-v* — see the Releasing section of README.md."
      ;;
  esac
fi

load_variant "$TARGET" || fail "Unknown release target '${TARGET}'."

# Without a version the build ships whatever is committed in mobile-config.js,
# and the store rejects the upload as a duplicate build number.
if [ -z "$APP_VERSION" ] && [ "$INCLUDE_MOBILE" = "true" ]; then
  fail "A mobile build needs a version. Set the 'app_version' input (e.g. 1.7.2) — it must be higher than the last version published for '${TARGET}'."
fi

if [ -n "$APP_VERSION" ] && [[ ! "$APP_VERSION" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
  fail "Version '${APP_VERSION}' from ${VERSION_SOURCE} is not a dotted numeric version."
fi

emit() {
  local out="${GITHUB_OUTPUT:-/dev/stdout}"
  local key
  for key in "$@"; do
    echo "$(echo "$key" | tr '[:upper:]' '[:lower:]')=${!key:-}" >>"$out"
  done
}

emit TARGET APP_VERSION ANDROID_APP_ID IOS_APP_ID APP_NAME URL_SCHEME \
  SERVER_URL PLAY_TRACK BRANCH DEPLOY_MODE SSH_HOST SSH_PORT SSH_USER \
  MATCH_READONLY BRANDING_LOGO

echo "Resolved target '${TARGET}'${APP_VERSION:+ version ${APP_VERSION}} → ${SERVER_URL}" >&2
