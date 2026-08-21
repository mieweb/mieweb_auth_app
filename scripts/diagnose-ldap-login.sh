#!/bin/bash
# ──────────────────────────────────────────────────────────
# diagnose-ldap-login.sh
# Isolates which step of the admin LDAP login is failing.
# Read-only: performs binds and searches, changes nothing.
#
#   bash diagnose-ldap-login.sh <username>
#
# Reads config from /home/actions/scripts/set-env.sh when readable, so it
# tests exactly what the app uses. Override any value with env vars.
# ──────────────────────────────────────────────────────────
set -uo pipefail

USERNAME="${1:-}"
if [ -z "$USERNAME" ]; then
  echo "Usage: bash diagnose-ldap-login.sh <username>"
  exit 1
fi

ENV_FILE="${ENV_FILE:-/home/actions/scripts/set-env.sh}"

# Pull the LDAP_* values the service actually runs with.
if sudo test -r "$ENV_FILE" 2>/dev/null; then
  echo "Reading config from ${ENV_FILE}"
  eval "$(sudo grep -E "^export (LDAP_|NODE_EXTRA_CA_CERTS)" "$ENV_FILE")"
else
  echo "⚠️  ${ENV_FILE} not readable — relying on current environment"
fi

LDAP_URL="${LDAP_URL:-ldaps://ldap.med-web.com:636}"
LDAP_USER_BASE_DN="${LDAP_USER_BASE_DN:-ou=people,dc=med-web,dc=com}"
LDAP_ADMIN_GROUP_DN="${LDAP_ADMIN_GROUP_DN:-cn=mie,ou=secgroup,dc=med-web,dc=com}"
LDAP_USER_RDN_ATTR="${LDAP_USER_RDN_ATTR:-uid}"
LDAP_GROUP_MEMBER_ATTR="${LDAP_GROUP_MEMBER_ATTR:-uniqueMember}"
LDAP_BIND_DN="${LDAP_BIND_DN:-}"
LDAP_BIND_PASSWORD="${LDAP_BIND_PASSWORD:-}"

USER_DN="${LDAP_USER_RDN_ATTR}=${USERNAME},${LDAP_USER_BASE_DN}"

# ldapsearch reads the CA from LDAPTLS_CACERT; Node reads NODE_EXTRA_CA_CERTS.
if [ -n "${NODE_EXTRA_CA_CERTS:-}" ] && [ -r "${NODE_EXTRA_CA_CERTS}" ]; then
  export LDAPTLS_CACERT="$NODE_EXTRA_CA_CERTS"
fi

section() {
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  $1"
  echo "════════════════════════════════════════════════════════"
}

if ! command -v ldapsearch >/dev/null 2>&1; then
  echo "ERROR: ldapsearch not installed. Run: sudo apt-get install -y ldap-utils"
  exit 1
fi

echo "URL:        ${LDAP_URL}"
echo "User DN:    ${USER_DN}"
echo "Group DN:   ${LDAP_ADMIN_GROUP_DN}"
echo "Member attr:${LDAP_GROUP_MEMBER_ATTR}"
echo "CA cert:    ${LDAPTLS_CACERT:-<system default>}"

# Same six-clause filter the app builds (server/adminAuth.js buildMembershipFilter).
FILTER="(&(objectClass=*)(|(${LDAP_GROUP_MEMBER_ATTR}=${USERNAME})(memberUid=${USERNAME})(member=uid=${USERNAME},${LDAP_USER_BASE_DN})(member=cn=${USERNAME},${LDAP_USER_BASE_DN})(uniqueMember=uid=${USERNAME},${LDAP_USER_BASE_DN})(uniqueMember=cn=${USERNAME},${LDAP_USER_BASE_DN})))"

section "1. TLS handshake"
if echo | openssl s_client -connect "$(echo "$LDAP_URL" | sed -E 's|ldaps?://||; s|/$||')" \
     ${LDAPTLS_CACERT:+-CAfile "$LDAPTLS_CACERT"} 2>/dev/null | grep -q "Verify return code: 0"; then
  echo "✅ certificate verifies"
else
  echo "❌ certificate does NOT verify — this alone breaks the app"
  echo "   (ldapsearch may still work if it trusts the system store)"
fi

section "2. Anonymous bind + read the group"
if ldapsearch -H "$LDAP_URL" -x -b "$LDAP_ADMIN_GROUP_DN" -s base "(objectClass=*)" \
     dn "$LDAP_GROUP_MEMBER_ATTR" memberUid member 2>&1 | head -30; then
  echo "(above: anonymous read result)"
fi

section "3. Service-account bind (LDAP_BIND_DN)"
if [ -z "$LDAP_BIND_DN" ]; then
  echo "ℹ️  LDAP_BIND_DN not set — app would use an anonymous search (step 2)"
else
  echo "Trying configured DN: ${LDAP_BIND_DN}"
  if [ -z "$LDAP_BIND_PASSWORD" ]; then
    echo "⚠️  LDAP_BIND_PASSWORD is empty — bind will fail"
  fi
  ldapsearch -H "$LDAP_URL" -x -D "$LDAP_BIND_DN" -w "$LDAP_BIND_PASSWORD" \
    -b "$LDAP_ADMIN_GROUP_DN" -s base "(objectClass=*)" dn 2>&1 | head -10

  # The configured DN omits ou=people, unlike every other user DN. Try the
  # alternative so a wrong DN is distinguishable from a wrong password.
  ALT_BIND_DN="uid=proxyuser,${LDAP_USER_BASE_DN}"
  if [ "$LDAP_BIND_DN" != "$ALT_BIND_DN" ]; then
    echo ""
    echo "Trying alternative DN: ${ALT_BIND_DN}"
    ldapsearch -H "$LDAP_URL" -x -D "$ALT_BIND_DN" -w "$LDAP_BIND_PASSWORD" \
      -b "$LDAP_ADMIN_GROUP_DN" -s base "(objectClass=*)" dn 2>&1 | head -10
  fi
fi

section "4. Bind as the user (password check)"
echo "Enter the LDAP password for ${USERNAME} (not echoed):"
read -rs USER_PASSWORD
echo ""
ldapsearch -H "$LDAP_URL" -x -D "$USER_DN" -w "$USER_PASSWORD" \
  -b "$USER_DN" -s base "(objectClass=*)" dn 2>&1 | head -10

section "5. Group membership, as the user"
echo "Filter: ${FILTER}"
echo ""
RESULT=$(ldapsearch -H "$LDAP_URL" -x -D "$USER_DN" -w "$USER_PASSWORD" \
  -b "$LDAP_ADMIN_GROUP_DN" -s base "$FILTER" dn 2>&1)
echo "$RESULT" | head -20
if echo "$RESULT" | grep -q "^dn: "; then
  echo ""
  echo "✅ ${USERNAME} IS a member — the app should accept this login"
else
  echo ""
  echo "❌ no match — the app would reject with NOT_IN_GROUP"
fi

section "6. Group membership, via the service account"
if [ -n "$LDAP_BIND_DN" ] && [ -n "$LDAP_BIND_PASSWORD" ]; then
  SVC_RESULT=$(ldapsearch -H "$LDAP_URL" -x -D "$LDAP_BIND_DN" -w "$LDAP_BIND_PASSWORD" \
    -b "$LDAP_ADMIN_GROUP_DN" -s base "$FILTER" dn 2>&1)
  echo "$SVC_RESULT" | head -20
  if echo "$SVC_RESULT" | grep -q "^dn: "; then
    echo "✅ service account can see the membership"
  else
    echo "❌ service account cannot see it — even though the user can."
    echo "   The app checks membership via this bind, so login fails here."
  fi
else
  ANON_RESULT=$(ldapsearch -H "$LDAP_URL" -x \
    -b "$LDAP_ADMIN_GROUP_DN" -s base "$FILTER" dn 2>&1)
  echo "$ANON_RESULT" | head -20
  if echo "$ANON_RESULT" | grep -q "^dn: "; then
    echo "✅ anonymous search can see the membership"
  else
    echo "❌ anonymous search cannot see it — the directory likely hides"
    echo "   membership from anonymous clients. A service bind is required."
  fi
fi

section "Summary"
cat <<'EOF'
  Step 1 fails  → CA/TLS problem (NODE_EXTRA_CA_CERTS)
  Step 3 fails  → wrong LDAP_BIND_DN or password
  Step 4 fails  → wrong user password or user base DN
  Step 5 fails  → user genuinely not in the admin group
  Step 6 fails but 5 succeeds
                → the bind identity cannot read membership; the app checks
                  membership BEFORE binding as the user, so this blocks login
EOF
