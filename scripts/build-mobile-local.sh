#!/bin/bash
# ──────────────────────────────────────────────────────────
# build-mobile-local.sh <target> [platform]
# Local mobile build for one release target (see variants/).
#
# Patching is delegated to scripts/apply-variant.sh — the same script CI passes
# to mieweb/actions — so local and CI builds cannot drift.
#
# mobile-config.js and public/resources belong to the OPENSOURCE app and are
# tracked in git. This script always restores them on exit, including on
# failure or Ctrl-C, so a local build can never leak into a commit.
#
#   bash scripts/build-mobile-local.sh mie            # both platforms
#   bash scripts/build-mobile-local.sh mie ios
#   bash scripts/build-mobile-local.sh mie-os-dev android
#
# Icons/splashes are generated from the variant's BRANDING_LOGO by the prebuild.
# Delete the generated resources directory to force them to be regenerated.
# ───────────────────────────────────────────────────
set -euo pipefail

# shellcheck source=scripts/lib/variant.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/variant.sh"

load_variant "${1:-}"
PLATFORM="${2:-both}"
OUT_DIR="${OUT_DIR:-./mie-build}"

# Files the prebuild rewrites in place; all belong to the opensource app.
PATCHED_PATHS=(mobile-config.js public/resources public/logo.png)

cd "$(variant_repo_root)"

case "$PLATFORM" in
  android) PLATFORMS="android" ;;
  ios)     PLATFORMS="ios" ;;
  both)    PLATFORMS="ios,android" ;;
  *)       echo "ERROR: platform must be android, ios, or both"; exit 1 ;;
esac

if [ -n "$(git status --porcelain "${PATCHED_PATHS[@]}" 2>/dev/null)" ]; then
  echo "ERROR: these already have uncommitted changes:"
  git status --short "${PATCHED_PATHS[@]}"
  echo "Commit or stash them first — this script restores to HEAD when it finishes."
  exit 1
fi

restore() {
  echo ""
  echo "=== Restoring opensource app files ==="
  git checkout -- "${PATCHED_PATHS[@]}" 2>/dev/null || true
  git status --short "${PATCHED_PATHS[@]}"
}
trap restore EXIT

bash scripts/apply-variant.sh "$TARGET" "$PLATFORM"

# Cordova cannot rename an existing platform ("product name change ... is not
# supported dynamically"), and config.xml gets rewritten before that check, so
# it is not a reliable signal. Stamp the cache with the brand it was built for
# and wipe the platforms when it differs.
CORDOVA_BUILD=".meteor/local/cordova-build"
BRAND_STAMP="${CORDOVA_BUILD}/.built-for-brand"
BRAND="${APP_NAME} ${IOS_APP_ID}"

if [ -d "$CORDOVA_BUILD" ] && [ "$(cat "$BRAND_STAMP" 2>/dev/null)" != "$BRAND" ]; then
  echo "=== Cordova cache was built for a different app — clearing platforms ==="
  rm -rf "${CORDOVA_BUILD}/platforms" "${CORDOVA_BUILD}/plugins"
fi
mkdir -p "$CORDOVA_BUILD"
echo "$BRAND" > "$BRAND_STAMP"

echo "=== Generating build info ==="
node generate-build-info.js

echo "=== Checking Firebase config ==="
for f in private/android/google-services.json private/ios/GoogleService-Info.plist; do
  if [ ! -f "$f" ]; then
    echo "  ⚠️  missing ${f} — push notifications will not work"
  elif ! grep -q "$ANDROID_APP_ID" "$f" && ! grep -q "$IOS_APP_ID" "$f"; then
    echo "  ⚠️  ${f} mentions neither ${ANDROID_APP_ID} nor ${IOS_APP_ID} (wrong Firebase app?)"
  else
    echo "  ✅ ${f}"
  fi
done

echo "=== meteor build (${PLATFORMS}) ==="
meteor build "$OUT_DIR" \
  --platforms "$PLATFORMS" \
  --server="$SERVER_URL"

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Build output: ${OUT_DIR}"
echo ""
echo "  Android: ${OUT_DIR}/android/project             (open in Android Studio)"
echo "  iOS:     ${OUT_DIR}/ios/project/*.xcworkspace   (open in Xcode)"
echo "═══════════════════════════════════════════════════"
