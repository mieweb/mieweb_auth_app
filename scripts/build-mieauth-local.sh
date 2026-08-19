#!/bin/bash
# ──────────────────────────────────────────────────────────
# build-mieauth-local.sh
# Local mobile build for the MIE instance (mieauth.mieweb.org).
#
# mobile-config.js and public/resources/ belong to the OPENSOURCE app and are
# tracked in git. This script patches them, builds, and always restores them —
# so a local MIE build can never leak into an opensource commit.
#
#   bash scripts/build-mieauth-local.sh android
#   bash scripts/build-mieauth-local.sh ios
#   bash scripts/build-mieauth-local.sh both
#
#   ICON=path/to/new-logo.png bash scripts/build-mieauth-local.sh both
# ──────────────────────────────────────────────────────────
set -euo pipefail

PLATFORM="${1:-both}"
SERVER_URL="https://mieauth.mieweb.org"
APP_ID="org.mieweb.auth"
URL_SCHEME="miewebauth"
APP_NAME="MIE Auth"
OUT_DIR="${OUT_DIR:-./mie-build}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -n "$(git status --porcelain mobile-config.js public/resources 2>/dev/null)" ]; then
  echo "ERROR: mobile-config.js or public/resources already has uncommitted changes."
  echo "Commit or stash them first — this script restores to HEAD when it finishes."
  exit 1
fi

# Restore the opensource files no matter how we exit (success, failure, Ctrl-C).
restore() {
  echo ""
  echo "=== Restoring opensource app files ==="
  git checkout -- mobile-config.js public/resources 2>/dev/null || true
  git status --short mobile-config.js public/resources
}
trap restore EXIT

echo "=== Building ${APP_NAME} (${APP_ID}) against ${SERVER_URL} ==="

if [ -n "${ICON:-}" ]; then
  if [ ! -f "$ICON" ]; then
    echo "ERROR: ICON file not found: ${ICON}"
    exit 1
  fi
  echo "=== Regenerating icons and splash screens from ${ICON} ==="
  python3 generate_app_resources.py "$ICON"
else
  echo "ℹ️  No ICON set — keeping existing artwork."
  echo "   Re-run with: ICON=path/to/logo.png bash $0 ${PLATFORM}"
fi

echo "=== Patching mobile-config.js ==="
node - "$APP_ID" "$URL_SCHEME" "$SERVER_URL" "$APP_NAME" <<'PATCH'
const fs = require("fs");
const [appId, urlScheme, serverUrl, appName] = process.argv.slice(2);
const file = "mobile-config.js";
let src = fs.readFileSync(file, "utf8");

src = src.replace(/id:\s*['"][^'"]+['"]/, `id: "${appId}"`);
src = src.replace(/name:\s*['"][^'"]+['"]/, `name: "${appName}"`);
src = src.replace(/website:\s*['"][^'"]+['"]/, `website: "${serverUrl}"`);
src = src.replace(/URL_SCHEME:\s*['"][^'"]+['"]/, `URL_SCHEME: "${urlScheme}"`);

fs.writeFileSync(file, src);
console.log(
  src.split("\n").filter((l) => /id:|name:|website:|URL_SCHEME/.test(l)).join("\n"),
);
PATCH

echo "=== Generating build info ==="
node generate-build-info.js

echo "=== Checking Firebase config ==="
for f in private/android/google-services.json private/ios/GoogleService-Info.plist; do
  if [ ! -f "$f" ]; then
    echo "⚠️  Missing ${f}"
    echo "   Download it from the Firebase project for ${APP_ID}."
  elif ! grep -q "$APP_ID" "$f"; then
    echo "⚠️  ${f} does not mention ${APP_ID} — push notifications will fail."
  else
    echo "  ✅ ${f}"
  fi
done

case "$PLATFORM" in
  android) PLATFORMS="android" ;;
  ios)     PLATFORMS="ios" ;;
  both)    PLATFORMS="android,ios" ;;
  *)       echo "ERROR: platform must be android, ios, or both"; exit 1 ;;
esac

echo "=== meteor build (${PLATFORMS}) ==="
meteor build "$OUT_DIR" \
  --platforms "$PLATFORMS" \
  --server="$SERVER_URL"

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Build output: ${OUT_DIR}"
echo ""
echo "  Android: open ${OUT_DIR}/android/project in Android Studio,"
echo "           or sign the APK/AAB under ${OUT_DIR}/android/"
echo "  iOS:     open ${OUT_DIR}/ios/project/*.xcworkspace in Xcode,"
echo "           set the team, then Product > Archive"
echo "═══════════════════════════════════════════════════"
