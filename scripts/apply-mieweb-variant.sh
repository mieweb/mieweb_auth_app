#!/bin/bash
# ──────────────────────────────────────────────────────────
# apply-mieweb-variant.sh
# Turns the checked-out opensource app into the MIEWeb Auth instance build.
#
# Used in two places:
#   - CI: passed as `pre_build_script` to mieweb/actions
#   - Local: called by scripts/build-mobile-local.sh
#
# Edits mobile-config.js and public/resources IN PLACE. Both belong to the
# opensource app, so callers are responsible for restoring them (the local
# script does; CI runs on a throwaway checkout).
#
#   APP_VERSION=1.2.3 bash scripts/apply-mieweb-variant.sh
# ──────────────────────────────────────────────────────────
set -euo pipefail

APP_ID="org.mieweb.auth"
APP_NAME="MIEWeb Auth"
URL_SCHEME="miewebauth"
SERVER_URL="https://mieauth.mieweb.org"
BRANDING_DIR="branding/mieauth/resources"
BRANDING_LOGO="branding/mieauth/logo.png"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== MIEWeb Auth pre-build patch ==="

# Icons and splash screens are derived from the source logo, so they are
# generated here rather than committed.
if [ ! -f "$BRANDING_LOGO" ]; then
  echo "ERROR: ${BRANDING_LOGO} not found"
  exit 1
fi

if [ -z "$(ls -A "$BRANDING_DIR" 2>/dev/null)" ]; then
  echo "Generating resources from ${BRANDING_LOGO}"
  mkdir -p "$BRANDING_DIR"
  python3 generate_app_resources.py "$BRANDING_LOGO" "$BRANDING_DIR"
else
  echo "Reusing generated resources in ${BRANDING_DIR}"
fi

echo "Applying branding from ${BRANDING_DIR}"
mkdir -p public/resources
cp -f "$BRANDING_DIR"/* public/resources/

# public/logo.png is the in-app logo for the shared web UI, so it has to be
# swapped too. The repo copy stays the opensource one; callers restore it.
cp -f "$BRANDING_LOGO" public/logo.png
echo "Applied ${BRANDING_LOGO} → public/logo.png"

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
