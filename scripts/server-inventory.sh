#!/bin/bash
# ──────────────────────────────────────────────────────────
# server-inventory.sh
# READ-ONLY audit of a host being prepared to run MIEAuth.
# Changes nothing — safe to run on prod. Run as the service/runner user.
#
#   bash server-inventory.sh            # print to stdout
#   bash server-inventory.sh > out.txt  # capture for review
# ──────────────────────────────────────────────────────────

section() {
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  $1"
  echo "════════════════════════════════════════════════════════"
}

# Reports "installed <version>" or "MISSING" without failing the script.
have() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "  [ok]      $1 -> $(command -v "$1")"
    return 0
  fi
  echo "  [MISSING] $1"
  return 1
}

echo "MIEAuth server inventory — $(date)"

section "1. Host / OS"
hostname -f 2>/dev/null || hostname
echo "IPs: $(hostname -I 2>/dev/null)"
cat /etc/os-release 2>/dev/null | grep -E '^(PRETTY_NAME|VERSION_ID)='
echo "Kernel: $(uname -r)"
echo "Arch:   $(uname -m)"
echo "Uptime: $(uptime -p 2>/dev/null)"
echo "CPUs:   $(nproc 2>/dev/null)"
free -h 2>/dev/null | head -2

section "2. Identity / permissions"
echo "whoami: $(whoami)"
id
echo "HOME:   $HOME"
echo ""
echo "-- passwordless sudo available? --"
if sudo -n true 2>/dev/null; then
  echo "  yes"
else
  echo "  no (or requires password) — CI needs NOPASSWD for systemctl mieauth"
fi
echo ""
echo "-- sudoers drop-ins --"
sudo -n ls -l /etc/sudoers.d/ 2>/dev/null || echo "  (cannot read without password)"

section "3. Disk"
df -h / /home 2>/dev/null
echo ""
echo "-- home usage --"
du -sh "$HOME" 2>/dev/null

section "4. Required toolchain"
have node   && echo "            version: $(node --version 2>/dev/null)"
have npm    && echo "            version: $(npm --version 2>/dev/null)"
have meteor && echo "            version: $(meteor --version 2>/dev/null)"
have git    && echo "            version: $(git --version 2>/dev/null)"
have curl
have mongod && echo "            version: $(mongod --version 2>/dev/null | head -1)"
have mongosh
have mongodump
have mongorestore
have nginx  && echo "            version: $(nginx -v 2>&1)"
have jarsigner
have python3

echo ""
echo "-- nvm --"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  echo "  [ok]      ~/.nvm present"
  ls "$HOME/.nvm/versions/node" 2>/dev/null | sed 's/^/            node: /'
else
  echo "  [MISSING] ~/.nvm"
fi

echo ""
echo "-- meteor install dir --"
[ -d "$HOME/.meteor" ] && echo "  [ok]      ~/.meteor present" || echo "  [MISSING] ~/.meteor"

section "5. MIEAuth app layout"
for p in "$HOME/Builds" "$HOME/Builds/current" "$HOME/scripts" "$HOME/scripts/set-env.sh" "$HOME/scripts/start-mieauth.sh" "$HOME/github/mieweb_auth_app"; do
  if [ -e "$p" ]; then
    echo "  [ok]      $p"
  else
    echo "  [MISSING] $p"
  fi
done
echo ""
echo "-- existing builds --"
ls -dt "$HOME"/Builds/Webserver-build-* 2>/dev/null | head -5 || echo "  none"
echo ""
echo "-- current symlink --"
readlink -f "$HOME/Builds/current" 2>/dev/null || echo "  none"

echo ""
echo "-- set-env.sh variables (values redacted) --"
if [ -r "$HOME/scripts/set-env.sh" ]; then
  grep -oE '^[[:space:]]*export[[:space:]]+[A-Z_]+' "$HOME/scripts/set-env.sh" | awk '{print "            " $2}'
else
  echo "  not present / not readable"
fi

section "6. systemd service"
if systemctl list-unit-files 2>/dev/null | grep -q '^mieauth.service'; then
  systemctl status mieauth --no-pager 2>/dev/null | head -15
  echo ""
  echo "-- enabled at boot? --"
  systemctl is-enabled mieauth 2>/dev/null
else
  echo "  mieauth.service NOT installed"
fi
echo ""
echo "-- any stray node processes --"
pgrep -af "node .*main.js" 2>/dev/null || echo "  none"

section "7. MongoDB"
if systemctl list-unit-files 2>/dev/null | grep -qE '^mongod'; then
  systemctl is-active mongod 2>/dev/null | sed 's/^/  mongod active: /'
else
  echo "  mongod unit not found"
fi
if command -v mongosh >/dev/null 2>&1; then
  echo ""
  echo "-- databases --"
  mongosh --quiet --eval 'db.adminCommand("listDatabases").databases.forEach(d => print("  " + d.name + "  " + (d.sizeOnDisk/1048576).toFixed(1) + " MB"))' 2>/dev/null \
    || echo "  cannot connect to mongodb://localhost:27017"
  echo ""
  echo "-- mieauth collection counts --"
  mongosh mieauth --quiet --eval 'db.getCollectionNames().forEach(c => print("  " + c + ": " + db[c].countDocuments()))' 2>/dev/null \
    || echo "  database not present (or requires authentication)"
fi

section "8. Listening ports"
if command -v ss >/dev/null 2>&1; then
  sudo -n ss -tlnp 2>/dev/null || ss -tln
else
  netstat -tln 2>/dev/null
fi
echo ""
echo "-- is port 3000 in use? --"
(ss -tln 2>/dev/null | grep -q ':3000 ' && echo "  YES") || echo "  no"

section "9. Reverse proxy / TLS"
for d in /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/apache2/sites-enabled /etc/httpd/conf.d; do
  [ -d "$d" ] && { echo "  $d:"; ls -1 "$d" 2>/dev/null | sed 's/^/    /'; }
done
echo ""
echo "-- configs mentioning mieauth.mieweb.org or port 3000 --"
sudo -n grep -rl -E 'mieauth\.mieweb\.org|127\.0\.0\.1:3000|localhost:3000' /etc/nginx /etc/apache2 /etc/httpd 2>/dev/null | sed 's/^/    /' || echo "    (none found or unreadable)"
echo ""
echo "-- certbot certificates --"
sudo -n certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry' || echo "  certbot not available / no certs"

section "10. GitHub Actions runner"
RUNNER_DIR=$(find "$HOME" /opt /srv -maxdepth 3 -name "svc.sh" -path "*runner*" 2>/dev/null | head -1)
if [ -n "$RUNNER_DIR" ]; then
  echo "  found: $RUNNER_DIR"
  cat "$(dirname "$RUNNER_DIR")/.runner" 2>/dev/null | sed 's/^/    /'
else
  echo "  runner install dir not found under \$HOME, /opt, /srv"
fi
echo ""
echo "-- runner services --"
systemctl list-units --type=service --no-pager 2>/dev/null | grep -i 'actions.runner' || echo "  none registered"

section "11. LDAP / SSSD"
if [ -r /etc/sssd/sssd.conf ]; then
  sudo -n grep -E '^(ldap_uri|ldap_user_search_base|ldap_group_search_base|ldap_default_bind_dn)' /etc/sssd/sssd.conf 2>/dev/null | sed 's/^/  /' \
    || echo "  present but unreadable without sudo"
else
  echo "  /etc/sssd/sssd.conf not present"
fi
echo ""
echo "-- name lookup for current user --"
getent passwd "$(whoami)" | sed 's/^/  /'

section "12. Firewall"
sudo -n ufw status 2>/dev/null \
  || sudo -n firewall-cmd --list-all 2>/dev/null \
  || echo "  ufw/firewalld not available (or needs password)"

section "13. Outbound connectivity"
for target in \
  "https://mieauth.mieweb.org" \
  "https://fcm.googleapis.com" \
  "https://install.meteor.com" \
  "https://github.com"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$target" 2>/dev/null || echo "000")
  echo "  $target -> HTTP $CODE"
done
echo ""
echo "-- smtp relay --"
(timeout 5 bash -c "cat < /dev/null > /dev/tcp/relay.cluster.mieweb.org/25" 2>/dev/null && echo "  relay.cluster.mieweb.org:25 reachable") || echo "  relay.cluster.mieweb.org:25 NOT reachable"
echo ""
echo "-- DNS for mieauth.mieweb.org --"
getent hosts mieauth.mieweb.org 2>/dev/null | sed 's/^/  /' || echo "  does not resolve"

section "Done"
echo "Review the [MISSING] entries above before running scripts/setup-systemd.sh."
