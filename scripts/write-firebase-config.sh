#!/bin/bash
# ──────────────────────────────────────────────────────────
# write-firebase-config.sh <target>
# Decodes the Firebase config for one release target into the paths
# mobile-config.js declares via App.addResourceFile.
#
# Meteor evaluates mobile-config.js for every Cordova build, so BOTH files must
# exist before `meteor build` — an Android build fails on a missing iOS plist
# too.
#
# Inputs (environment, base64):
#   GOOGLE_SERVICES_JSON_BASE64   google-services.json  (Android)
#   GOOGLE_SERVICES_PLIST_BASE64  GoogleService-Info.plist (iOS)
#
# Each file is checked against the target's app ID, so config from the wrong
# Firebase project fails here instead of silently shipping an app whose push
# notifications never arrive. File contents are never printed.
# ──────────────────────────────────────────────────────────
set -euo pipefail

# shellcheck source=scripts/lib/variant.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/variant.sh"

load_variant "${1:-}"

cd "$(variant_repo_root)"

write_config() {
  local label="$1" encoded="$2" dest="$3" expected_id="$4"

  if [ -z "$encoded" ]; then
    echo "ERROR: no ${label} provided for ${TARGET}"
    exit 1
  fi

  mkdir -p "$(dirname "$dest")"
  if ! printf '%s' "$encoded" | base64 --decode >"$dest" 2>/dev/null; then
    echo "ERROR: ${label} for ${TARGET} is not valid base64"
    exit 1
  fi

  if [ ! -s "$dest" ]; then
    echo "ERROR: ${label} for ${TARGET} decoded to an empty file"
    exit 1
  fi

  if ! grep -q "$expected_id" "$dest"; then
    echo "ERROR: ${label} does not mention ${expected_id} — wrong Firebase project for ${TARGET}"
    exit 1
  fi

  echo "Wrote ${dest} ($(wc -c <"$dest" | tr -d ' ') bytes, ${expected_id})"
}

write_config "google-services.json" "${GOOGLE_SERVICES_JSON_BASE64:-}" \
  private/android/google-services.json "$ANDROID_APP_ID"

write_config "GoogleService-Info.plist" "${GOOGLE_SERVICES_PLIST_BASE64:-}" \
  private/ios/GoogleService-Info.plist "$IOS_APP_ID"
