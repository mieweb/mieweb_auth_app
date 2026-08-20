#!/bin/bash
# Deprecated shim — the current deploy workflows still call this path.
# Use `bash scripts/apply-variant.sh mie` instead.
set -euo pipefail
exec bash "$(dirname "${BASH_SOURCE[0]}")/apply-variant.sh" mie
