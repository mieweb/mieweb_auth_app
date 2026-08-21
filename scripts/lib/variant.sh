#!/bin/bash
# ──────────────────────────────────────────────────────────
# variant.sh — shared loader for variants/<target>.env
#
# Source this, then call `load_variant <target>`. Every key in the file is
# exported. The file is parsed, never sourced, so a variant file can only
# declare data — it can never execute code.
# ──────────────────────────────────────────────────────────

VARIANT_REQUIRED_KEYS=(
  ANDROID_APP_ID
  IOS_APP_ID
  APP_NAME
  URL_SCHEME
  SERVER_URL
  PLAY_TRACK
  BRANCH
  DEPLOY_MODE
)

variant_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

variant_targets() {
  local root
  root="$(variant_repo_root)"
  ls "${root}/variants" | sed -n 's/\.env$//p' | sort
}

load_variant() {
  local target="${1:-}" root file key value

  # Anchored whitelist — the target becomes part of a path.
  if [[ ! "$target" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    echo "ERROR: invalid target '${target}'" >&2
    echo "Known targets: $(variant_targets | tr '\n' ' ')" >&2
    return 1
  fi

  root="$(variant_repo_root)"
  file="${root}/variants/${target}.env"
  if [ ! -f "$file" ]; then
    echo "ERROR: no such target '${target}' (${file} not found)" >&2
    echo "Known targets: $(variant_targets | tr '\n' ' ')" >&2
    return 1
  fi

  while IFS='=' read -r key value || [ -n "$key" ]; do
    key="${key%%$'\r'}"
    value="${value%%$'\r'}"
    case "$key" in '' | '#'*) continue ;; esac
    if [[ ! "$key" =~ ^[A-Z][A-Z0-9_]*$ ]]; then
      echo "ERROR: ${file}: invalid key '${key}'" >&2
      return 1
    fi
    printf -v "$key" '%s' "$value"
    export "${key?}"
  done <"$file"

  for key in "${VARIANT_REQUIRED_KEYS[@]}"; do
    if [ -z "${!key:-}" ]; then
      echo "ERROR: ${file}: missing required key ${key}" >&2
      return 1
    fi
  done

  export TARGET="$target"
}
