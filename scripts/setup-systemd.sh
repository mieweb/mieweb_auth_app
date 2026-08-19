#!/bin/bash
# ──────────────────────────────────────────────────────────
# setup-systemd.sh
# One-time setup script to install the MIEAuth systemd service.
# Run on the production host as a sudo-capable user.
#
# The service must run as the same user as the GitHub Actions runner, since the
# runner owns ~/Builds. Override when they differ:
#
#   SVC_USER=actions bash setup-systemd.sh
# ──────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="${SCRIPT_DIR}/mieauth.service"
START_SCRIPT="${SCRIPT_DIR}/start-mieauth.sh"

SVC_USER="${SVC_USER:-$(id -un)}"
SVC_GROUP="${SVC_GROUP:-$(id -gn "$SVC_USER")}"
SVC_HOME="$(getent passwd "$SVC_USER" | cut -d: -f6)"

if [ -z "$SVC_HOME" ]; then
  echo "ERROR: user '${SVC_USER}' does not exist"
  exit 1
fi

echo "=== MIEAuth systemd Setup ==="
echo "Service user:  ${SVC_USER}"
echo "Service group: ${SVC_GROUP}"
echo "Service home:  ${SVC_HOME}"

sudo -u "$SVC_USER" mkdir -p "${SVC_HOME}/scripts" "${SVC_HOME}/Builds"

# Step 1: Copy start wrapper script into the service user's ~/scripts
echo "Installing start script..."
sudo cp "$START_SCRIPT" "${SVC_HOME}/scripts/start-mieauth.sh"
sudo chown "${SVC_USER}:${SVC_GROUP}" "${SVC_HOME}/scripts/start-mieauth.sh"
sudo chmod +x "${SVC_HOME}/scripts/start-mieauth.sh"
echo "✅ Start script installed: ${SVC_HOME}/scripts/start-mieauth.sh"

# Verify set-env.sh exists (used by start script)
if ! sudo test -f "${SVC_HOME}/scripts/set-env.sh"; then
  echo "⚠️  ${SVC_HOME}/scripts/set-env.sh not found!"
  echo "   The start script sources this file for environment variables."
  echo "   Please create it before starting the service."
fi

# Step 2: Install systemd unit file
echo "Installing systemd service..."
sed -e "s|__USER__|${SVC_USER}|g" \
    -e "s|__GROUP__|${SVC_GROUP}|g" \
    -e "s|__HOME__|${SVC_HOME}|g" \
    "$SERVICE_FILE" | sudo tee /etc/systemd/system/mieauth.service > /dev/null
sudo systemctl daemon-reload
sudo systemctl enable mieauth
echo "✅ systemd service installed and enabled"

# Step 3: Configure sudoers for CI/CD (passwordless restart)
SUDOERS_LINE="${SVC_USER} ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart mieauth, /usr/bin/systemctl stop mieauth, /usr/bin/systemctl start mieauth, /usr/bin/systemctl status mieauth, /usr/bin/systemctl is-active mieauth, /usr/bin/journalctl -u mieauth *"
SUDOERS_FILE="/etc/sudoers.d/mieauth"

if [ ! -f "$SUDOERS_FILE" ]; then
  echo "$SUDOERS_LINE" | sudo tee "$SUDOERS_FILE" > /dev/null
  sudo chmod 440 "$SUDOERS_FILE"
  sudo visudo -cf "$SUDOERS_FILE"
  echo "✅ sudoers configured for passwordless systemctl"
else
  echo "ℹ️  Sudoers file already exists: ${SUDOERS_FILE}"
fi

# Step 4: Create initial symlink if a build exists
HAVE_BUILD=false
LATEST_BUILD=$(sudo ls -dt "${SVC_HOME}"/Builds/Webserver-build-* 2>/dev/null | head -1)
if [ -n "$LATEST_BUILD" ] && sudo test -d "${LATEST_BUILD}/bundle"; then
  sudo -u "$SVC_USER" ln -sfn "${LATEST_BUILD}/bundle" "${SVC_HOME}/Builds/current"
  echo "✅ Symlink created: ${SVC_HOME}/Builds/current → ${LATEST_BUILD}/bundle"
  HAVE_BUILD=true
else
  echo "⚠️  No existing build found."
fi

# Step 5: Stop nohup process if running
if pgrep -f "node main.js" > /dev/null; then
  echo "Stopping existing nohup node process..."
  pkill -f "node main.js" || true
  sleep 3
  echo "✅ Old nohup process stopped"
fi

# Step 6: Start service — only meaningful once a build exists, since
# WorkingDirectory points at the build symlink.
if [ "$HAVE_BUILD" != true ]; then
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "✅ Service installed and enabled, but not started."
  echo ""
  echo "  ${SVC_HOME}/Builds/current does not exist yet, so there is"
  echo "  nothing to run. Deploy a build (tag a v* release, or run the"
  echo "  production workflow), which creates the symlink and starts the"
  echo "  service automatically."
  echo "═══════════════════════════════════════════════════"
  exit 0
fi

echo "Starting mieauth service..."
sudo systemctl start mieauth
sleep 5

if sudo systemctl is-active --quiet mieauth; then
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "✅ MIEAuth is running as a systemd service!"
  echo ""
  echo "  Useful commands:"
  echo "    sudo systemctl status mieauth    # Check status"
  echo "    sudo journalctl -u mieauth -f    # Follow logs"
  echo "    sudo systemctl restart mieauth   # Restart"
  echo "═══════════════════════════════════════════════════"
else
  echo "❌ mieauth failed to start. Check logs:"
  echo "  sudo journalctl -u mieauth --no-pager -n 50"
  exit 1
fi
