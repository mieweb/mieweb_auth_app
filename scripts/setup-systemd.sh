#!/bin/bash
# ──────────────────────────────────────────────────────────
# setup-systemd.sh
# One-time setup script to install the MIEAuth systemd service
# Run this on the Proxmox container: mieauth-prod.os.mieweb.org
# ──────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="${SCRIPT_DIR}/mieauth.service"
START_SCRIPT="${SCRIPT_DIR}/start-mieauth.sh"

echo "=== MIEAuth systemd Setup ==="

# Step 1: Copy start wrapper script to ~/scripts
echo "Installing start script..."
cp "$START_SCRIPT" "$HOME/scripts/start-mieauth.sh"
chmod +x "$HOME/scripts/start-mieauth.sh"
echo "✅ Start script installed: ~/scripts/start-mieauth.sh"

# Verify set-env.sh exists (used by start script)
if [ ! -f "$HOME/scripts/set-env.sh" ]; then
  echo "⚠️  ~/scripts/set-env.sh not found!"
  echo "   The start script sources this file for environment variables."
  echo "   Please create it before starting the service."
fi

# Step 2: Install systemd unit file
echo "Installing systemd service..."
sudo cp "$SERVICE_FILE" /etc/systemd/system/mieauth.service
sudo systemctl daemon-reload
sudo systemctl enable mieauth
echo "✅ systemd service installed and enabled"

# Step 3: Configure sudoers for CI/CD (passwordless restart)
SUDOERS_LINE="aabrol ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart mieauth, /usr/bin/systemctl stop mieauth, /usr/bin/systemctl start mieauth, /usr/bin/systemctl status mieauth, /usr/bin/systemctl is-active mieauth, /usr/bin/journalctl -u mieauth *"
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
LATEST_BUILD=$(ls -dt ~/Builds/Webserver-build-* 2>/dev/null | head -1)
if [ -n "$LATEST_BUILD" ] && [ -d "${LATEST_BUILD}/bundle" ]; then
  ln -sfn "${LATEST_BUILD}/bundle" ~/Builds/current
  echo "✅ Symlink created: ~/Builds/current → ${LATEST_BUILD}/bundle"
else
  echo "⚠️  No existing build found. Run a deployment to create ~/Builds/current"
fi

# Step 5: Stop nohup process if running
if pgrep -f "node main.js" > /dev/null; then
  echo "Stopping existing nohup node process..."
  pkill -f "node main.js" || true
  sleep 3
  echo "✅ Old nohup process stopped"
fi

# Step 6: Start service
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
