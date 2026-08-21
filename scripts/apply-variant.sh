#!/bin/bash
# ──────────────────────────────────────────────────────────
# apply-variant.sh <target> [platform]
# Rebrands the checked-out opensource app as one release target, using the
# identity in variants/<target>.env.
#
# Used in two places:
#   - CI: run before the Meteor/Cordova build in each mobile job
#   - Local: called by scripts/build-mobile-local.sh
#
# Edits mobile-config.js, public/resources and public/logo.png IN PLACE. All
# belong to the opensource app, so callers are responsible for restoring them
# (the local script does; CI runs on a throwaway checkout).
#
#   APP_VERSION=1.2.3 bash scripts/apply-variant.sh mie android
#
# mobile-config.js carries a SINGLE app id that Cordova uses for whichever
# platform it is building, so the id must be chosen per platform. mie-os-prod
# is the only target where the two differ (com.mieweb.mieauth on Play,
# org.mieweb.opensource on the App Store); building it without a platform
# argument produces an AAB that Play rejects as "wrong package name".
# ──────────────────────────────────────────────────────────
set -euo pipefail

# shellcheck source=scripts/lib/variant.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/variant.sh"

load_variant "${1:-}"
PLATFORM="${2:-both}"

case "$PLATFORM" in
  android) APP_ID="$ANDROID_APP_ID" ;;
  ios)     APP_ID="$IOS_APP_ID" ;;
  both)
    APP_ID="$IOS_APP_ID"
    if [ "$ANDROID_APP_ID" != "$IOS_APP_ID" ]; then
      echo "ERROR: ${TARGET} uses different ids per platform:"
      echo "         Android: ${ANDROID_APP_ID}"
      echo "         iOS:     ${IOS_APP_ID}"
      echo "       mobile-config.js holds only one, so pass 'android' or 'ios'."
      exit 1
    fi
    ;;
  *) echo "ERROR: platform must be android, ios, or both"; exit 1 ;;
esac

cd "$(variant_repo_root)"

echo "=== ${APP_NAME} pre-build patch (${TARGET}, ${PLATFORM}) ==="

# Icons and splash screens are derived from the source logo, so they are
# generated here rather than committed. Targets without a logo keep the
# artwork already committed in public/resources.
if [ -n "${BRANDING_LOGO:-}" ]; then
  BRANDING_DIR="${BRANDING_DIR:-}"

  if [ ! -f "$BRANDING_LOGO" ]; then
    echo "ERROR: ${BRANDING_LOGO} not found"
    exit 1
  fi

  # The cache is copied *onto* public/resources, so it must not be that path.
  case "${BRANDING_DIR%/}" in
    '' | public/resources)
      echo "ERROR: ${TARGET} sets BRANDING_LOGO but BRANDING_DIR is '${BRANDING_DIR}'"
      echo "       It must name a separate directory to generate icons into."
      exit 1
      ;;
  esac

  if [ -z "$(ls -A "$BRANDING_DIR" 2>/dev/null)" ]; then
    if ! python3 -c "import PIL" 2>/dev/null; then
      echo "ERROR: generate_app_resources.py needs Pillow, which is not installed."
      echo "       Install it with: pip3 install --break-system-packages Pillow"
      exit 1
    fi
    echo "Generating resources from ${BRANDING_LOGO}"
    mkdir -p "$BRANDING_DIR"
    python3 generate_app_resources.py "$BRANDING_LOGO" "$BRANDING_DIR"
  else
    echo "Reusing generated resources in ${BRANDING_DIR}"
  fi

  echo "Applying branding from ${BRANDING_DIR}"
  mkdir -p public/resources
  cp -f "$BRANDING_DIR"/* public/resources/
else
  echo "No branding logo for ${TARGET} — keeping the committed app icons"
fi

# The in-app logo for the shared web UI is a separate decision from the app
# icons: the beta app rebrands its icons but keeps the opensource web logo.
if [ -n "${BRANDING_WEB_LOGO:-}" ]; then
  if [ ! -f "$BRANDING_WEB_LOGO" ]; then
    echo "ERROR: ${BRANDING_WEB_LOGO} not found"
    exit 1
  fi
  cp -f "$BRANDING_WEB_LOGO" public/logo.png
  echo "Applied ${BRANDING_WEB_LOGO} → public/logo.png"
fi

node - "$APP_ID" "$APP_NAME" "$URL_SCHEME" "$SERVER_URL" "${APP_VERSION:-}" <<'PATCH'
const fs = require("fs");
const [appId, appName, urlScheme, serverUrl, appVersion] = process.argv.slice(2);
const file = "mobile-config.js";
let src = fs.readFileSync(file, "utf8");

const replace = (pattern, next, label) => {
  if (!pattern.test(src)) {
    console.error(`ERROR: could not find ${label} in ${file}`);
    process.exit(1);
  }
  src = src.replace(pattern, next);
};

replace(/id:\s*['"][^'"]+['"]/, `id: "${appId}"`, "id");
replace(/name:\s*['"][^'"]+['"]/, `name: "${appName}"`, "name");
replace(/website:\s*['"][^'"]+['"]/, `website: "${serverUrl}"`, "website");
replace(/URL_SCHEME:\s*['"][^'"]+['"]/, `URL_SCHEME: "${urlScheme}"`, "URL_SCHEME");

if (appVersion) {
  replace(/version:\s*['"][^'"]+['"]/, `version: '${appVersion}'`, "version");
}

fs.writeFileSync(file, src);
console.log(
  src
    .split("\n")
    .filter((l) => /\b(id|name|website|version):|URL_SCHEME/.test(l))
    .join("\n"),
);
PATCH

echo "✅ Patched for ${APP_NAME} (${APP_ID}) → ${SERVER_URL}"
