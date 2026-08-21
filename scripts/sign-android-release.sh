#!/bin/bash
# ──────────────────────────────────────────────────────────
# sign-android-release.sh
# Signs the MIEWeb Auth Android artifacts from mie-build/android.
#
#   AAB  → jarsigner            (apksigner cannot sign bundles)
#   APK  → zipalign + apksigner (jarsigner v1 signatures are rejected
#                                by Android 11+ for installs)
#
#   bash scripts/sign-android-release.sh          # sign whatever is present
#   bash scripts/sign-android-release.sh aab
#   bash scripts/sign-android-release.sh apk
#
# Password is read from KEYSTORE_PASSWORD/KEY_PASSWORD if exported, otherwise
# prompted. Never pass it on the command line — it lands in shell history.
# ──────────────────────────────────────────────────────────
set -euo pipefail

TARGET="${1:-auto}"
KEYSTORE="${KEYSTORE:-miewebauth-release.jks}"
ALIAS="${ALIAS:-miewebauth}"
BUILD_DIR="${BUILD_DIR:-mie-build/android}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f "$KEYSTORE" ]; then
  echo "ERROR: keystore not found: ${KEYSTORE}"
  echo "Create it with:"
  echo "  keytool -genkeypair -v -keystore ${KEYSTORE} -alias ${ALIAS} \\"
  echo "    -keyalg RSA -keysize 2048 -validity 10000"
  exit 1
fi

if [ -z "${KEYSTORE_PASSWORD:-}" ]; then
  echo -n "Keystore password for ${KEYSTORE}: "
  read -rs KEYSTORE_PASSWORD
  echo ""
fi
KEY_PASSWORD="${KEY_PASSWORD:-$KEYSTORE_PASSWORD}"

# Confirm the alias and password are right before touching any artifact.
if ! keytool -list -keystore "$KEYSTORE" -alias "$ALIAS" \
      -storepass "$KEYSTORE_PASSWORD" >/dev/null 2>&1; then
  echo "ERROR: cannot open ${KEYSTORE} with alias '${ALIAS}' and that password."
  echo "Aliases in this keystore:"
  keytool -list -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASSWORD" 2>/dev/null \
    | grep -i 'Alias name' || echo "  (password rejected)"
  exit 1
fi

echo "=== Signing identity ==="
keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$KEYSTORE_PASSWORD" 2>/dev/null \
  | grep -E 'Alias name|Valid from|SHA1:|SHA256:' | sed 's/^/  /'

# ── AAB ────────────────────────────────────────────────────
sign_aab() {
  local src="$1"
  local out="${BUILD_DIR}/MIEWebAuth-release-signed.aab"

  echo ""
  echo "=== Signing AAB ==="
  echo "  in:  ${src}"
  cp -f "$src" "$out"

  jarsigner -verbose:summary \
    -sigalg SHA256withRSA \
    -digestalg SHA-256 \
    -keystore "$KEYSTORE" \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    "$out" "$ALIAS"

  echo ""
  echo "=== Verifying AAB ==="
  jarsigner -verify -certs "$out" | tail -5
  echo "✅ ${out}"
}

# ── APK ────────────────────────────────────────────────────
sign_apk() {
  local src="$1"
  local aligned="${BUILD_DIR}/app-release-aligned.apk"
  local out="${BUILD_DIR}/MIEWebAuth-release-signed.apk"

  local build_tools
  build_tools="$(ls -d "${ANDROID_SDK_ROOT}"/build-tools/* 2>/dev/null | sort -V | tail -1)"
  if [ -z "$build_tools" ]; then
    echo "ERROR: no build-tools under ${ANDROID_SDK_ROOT}/build-tools"
    echo "Set ANDROID_SDK_ROOT, or install build-tools via Android Studio."
    exit 1
  fi
  echo ""
  echo "=== Signing APK (build-tools: $(basename "$build_tools")) ==="
  echo "  in:  ${src}"

  "${build_tools}/zipalign" -f -p 4 "$src" "$aligned"

  "${build_tools}/apksigner" sign \
    --ks "$KEYSTORE" \
    --ks-key-alias "$ALIAS" \
    --ks-pass "pass:${KEYSTORE_PASSWORD}" \
    --key-pass "pass:${KEY_PASSWORD}" \
    --out "$out" \
    "$aligned"

  rm -f "$aligned"

  echo ""
  echo "=== Verifying APK ==="
  "${build_tools}/apksigner" verify --verbose --print-certs "$out" | head -12
  echo "✅ ${out}"
}

FOUND_AAB="$(find "$BUILD_DIR" -maxdepth 2 -name '*.aab' ! -name '*signed*' 2>/dev/null | head -1)"
FOUND_APK="$(find "$BUILD_DIR" -maxdepth 2 -name '*.apk' ! -name '*signed*' ! -name '*aligned*' 2>/dev/null | head -1)"

case "$TARGET" in
  aab)
    [ -n "$FOUND_AAB" ] || { echo "ERROR: no .aab under ${BUILD_DIR}"; exit 1; }
    sign_aab "$FOUND_AAB"
    ;;
  apk)
    [ -n "$FOUND_APK" ] || { echo "ERROR: no .apk under ${BUILD_DIR}"; exit 1; }
    sign_apk "$FOUND_APK"
    ;;
  auto)
    [ -n "$FOUND_AAB" ] && sign_aab "$FOUND_AAB"
    [ -n "$FOUND_APK" ] && sign_apk "$FOUND_APK"
    if [ -z "$FOUND_AAB" ] && [ -z "$FOUND_APK" ]; then
      echo "ERROR: nothing to sign under ${BUILD_DIR}"
      echo "Run: bash scripts/build-mobile-local.sh android"
      exit 1
    fi
    ;;
  *)
    echo "ERROR: target must be aab, apk, or omitted"
    exit 1
    ;;
esac

cat <<EOF

═══════════════════════════════════════════════════
  Next: upload the signed .aab to Play Console
  (Internal testing > Create new release) for the
  first release of org.mieweb.auth. After that the
  CI workflow can publish automatically.
═══════════════════════════════════════════════════
EOF
