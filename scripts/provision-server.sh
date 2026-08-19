#!/bin/bash
# ──────────────────────────────────────────────────────────
# provision-server.sh
# Prepares a fresh Debian host to build and run MIEAuth.
# Idempotent — safe to re-run.
#
# Assumes (as found on mie-fwdc-auth1):
#   - MongoDB already installed and running
#   - cloudflared tunnel already terminating TLS for the public hostname,
#     so NO nginx/certbot is installed here
#   - GitHub Actions runner already registered
#
# The toolchain must belong to the user the Actions runner runs as (User= in the
# actions.runner.* unit), which is not necessarily the user holding sudo. Run as
# the sudo-capable account and point TARGET_USER at the runner's user:
#
#   TARGET_USER=actions bash provision-server.sh
# ──────────────────────────────────────────────────────────
set -euo pipefail

NODE_VERSION="20.19.6"
NVM_VERSION="v0.40.1"
SWAP_SIZE_GB=4

section() {
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  $1"
  echo "════════════════════════════════════════════════════════"
}

# Per-user half: nvm, Meteor, app dirs. Re-invoked as TARGET_USER further down.
if [ "${1:-}" = "--user-setup" ]; then
  section "3. nvm + Node ${NODE_VERSION}  (user: $(id -un), home: ${HOME})"
  export NVM_DIR="$HOME/.nvm"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"

  if ! nvm ls "$NODE_VERSION" >/dev/null 2>&1; then
    nvm install "$NODE_VERSION"
  fi
  nvm alias default "$NODE_VERSION"
  nvm use default
  echo "✅ node $(node --version) / npm $(npm --version)"

  section "4. Meteor"
  if [ ! -d "$HOME/.meteor" ]; then
    # The installer tries to sudo a launcher into /usr/local/bin and hangs on a
    # password prompt for users without sudo. Neutralise it with a no-op shim —
    # the launcher is created later by the privileged half of this script, and
    # ~/.meteor is on PATH regardless.
    SHIM_DIR="$(mktemp -d)"
    printf '#!/bin/sh\nexit 0\n' > "${SHIM_DIR}/sudo"
    chmod +x "${SHIM_DIR}/sudo"
    curl https://install.meteor.com/ | PATH="${SHIM_DIR}:$PATH" sh
    rm -rf "$SHIM_DIR"
  fi
  export PATH="$HOME/.meteor:$PATH"
  grep -q '.meteor' "$HOME/.profile" 2>/dev/null || echo 'export PATH="$HOME/.meteor:$PATH"' >> "$HOME/.profile"
  echo "✅ meteor $(meteor --version 2>/dev/null || echo installed)"

  section "5. App directories"
  mkdir -p "$HOME/Builds" "$HOME/scripts"
  echo "✅ ${HOME}/Builds and ${HOME}/scripts ready"

  section "6. Verification (as $(id -un))"
  echo "  node:    $(node --version 2>/dev/null || echo MISSING)"
  echo "  npm:     $(npm --version 2>/dev/null || echo MISSING)"
  echo "  git:     $(git --version 2>/dev/null || echo MISSING)"
  echo "  meteor:  $(meteor --version 2>/dev/null || echo MISSING)"
  exit 0
fi

TARGET_USER="${TARGET_USER:-$(id -un)}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"

if [ -z "$TARGET_HOME" ]; then
  echo "ERROR: user '${TARGET_USER}' does not exist"
  exit 1
fi

echo "Provisioning $(hostname -f 2>/dev/null || hostname)"
echo "  invoking user: $(id -un)"
echo "  target user:   ${TARGET_USER}  (home: ${TARGET_HOME})"

section "1. APT packages"
# meteor/npm need git + a C toolchain to compile native modules (bcrypt, etc.)
sudo apt-get update -qq
sudo apt-get install -y \
  git \
  build-essential \
  python3 \
  ca-certificates \
  curl \
  procps
echo "✅ base packages installed"

section "2. Swap"
# LXC/Proxmox containers cannot call swapon() — swap is a host-level setting.
CONTAINER_TYPE="$(systemd-detect-virt -c 2>/dev/null || echo none)"

if sudo swapon --show 2>/dev/null | grep -q .; then
  echo "ℹ️  swap already active:"
  sudo swapon --show
elif [ "$CONTAINER_TYPE" != "none" ]; then
  echo "ℹ️  Running inside a '${CONTAINER_TYPE}' container — swap cannot be enabled here."
  echo "   Ask the Proxmox host admin to raise this container's RAM or swap if"
  echo "   'meteor build' is OOM-killed. The build sets a heap cap to compensate."
  if [ -f /swapfile ]; then
    echo "   Removing unusable /swapfile left by an earlier attempt..."
    sudo rm -f /swapfile
    sudo sed -i '\|^/swapfile|d' /etc/fstab
  fi
else
  echo "Creating ${SWAP_SIZE_GB}G swapfile..."
  sudo fallocate -l "${SWAP_SIZE_GB}G" /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  if sudo swapon /swapfile; then
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
    echo "✅ swap enabled"
  else
    echo "⚠️  swapon failed — removing the file"
    sudo rm -f /swapfile
  fi
fi

section "3-6. Toolchain for '${TARGET_USER}'"
if [ "$TARGET_USER" = "$(id -un)" ]; then
  bash "$0" --user-setup
else
  # Copy to a world-readable path: TARGET_USER may not be able to read $0.
  sudo cp "$0" /tmp/provision-user-setup.sh
  sudo chmod 755 /tmp/provision-user-setup.sh
  sudo -u "$TARGET_USER" -H bash /tmp/provision-user-setup.sh --user-setup
  sudo rm -f /tmp/provision-user-setup.sh
fi

section "Host summary"
if [ -x "${TARGET_HOME}/.meteor/meteor" ] && [ ! -e /usr/local/bin/meteor ]; then
  sudo ln -sfn "${TARGET_HOME}/.meteor/meteor" /usr/local/bin/meteor
  echo "✅ launcher linked: /usr/local/bin/meteor"
fi
echo ""
echo "-- memory + swap --"
free -h | head -3
echo ""
echo "-- mongod --"
mongod --version 2>/dev/null | head -1 || echo "  MISSING"

section "7. Cloudflare tunnel (read-only check)"
if pgrep -x cloudflared >/dev/null 2>&1; then
  echo "✅ cloudflared is running"
  echo ""
  sudo -n systemctl cat cloudflared 2>/dev/null | grep -E '^ExecStart' | sed 's/^/  /' || true
  if sudo -n test -f /etc/cloudflared/config.yml 2>/dev/null; then
    echo ""
    sudo -n grep -A20 'ingress' /etc/cloudflared/config.yml 2>/dev/null | sed 's/^/  /'
  else
    echo ""
    echo "  No local config.yml — this is a token-managed tunnel."
    echo "  Configure routing in the Cloudflare dashboard:"
    echo "    Zero Trust > Networks > Tunnels > Public Hostname"
    echo "    mieauth.mieweb.org -> HTTP localhost:3000"
  fi
  echo ""
  echo "  A 502 from https://mieauth.mieweb.org means nothing is on :3000 yet."
else
  echo "⚠️  cloudflared not running — the public hostname will not resolve to this box"
fi

section "Next steps"
cat <<STEPS
  1. Create ${TARGET_HOME}/scripts/set-env.sh (copy from the old prod host, then edit):
       export ROOT_URL='https://mieauth.mieweb.org'
       export APP_URL='https://mieauth.mieweb.org'
       export PORT=3000
       export MAIL_URL='smtp://localhost:25'
       export MONGO_URL='mongodb://mieauth:<PASSWORD>@mie-fwdc-auth1.med-web.com:27017/mieauth?replicaSet=mieauth-rs&authSource=admin'
       export MONGO_OPLOG_URL='mongodb://mieauth:<PASSWORD>@mie-fwdc-auth1.med-web.com:27017/local?replicaSet=mieauth-rs&authSource=admin'
     Then:
       sudo chown ${TARGET_USER} ${TARGET_HOME}/scripts/set-env.sh
       sudo chmod 600 ${TARGET_HOME}/scripts/set-env.sh

  2. Restore the database (old db 'mieweb_auth' -> new db 'mieauth'):
       mongorestore --uri="\${MONGO_URL}" --archive=/tmp/mieauth.archive --gzip \\
         --nsFrom='mieweb_auth.*' --nsTo='mieauth.*' --drop

  3. Install the service (from a repo checkout, as a sudo-capable user):
       SVC_USER=${TARGET_USER} bash scripts/setup-systemd.sh

  4. Trigger the production workflow to populate ${TARGET_HOME}/Builds/current.
STEPS
