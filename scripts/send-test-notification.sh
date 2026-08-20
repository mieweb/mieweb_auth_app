#!/bin/bash
# ────────────────────────────────────────────────
# send-test-notification.sh
# Smoke test for POST /send-notification — fires one approve/reject push at a
# user so you can confirm the server, Firebase, and the device are wired up.
#
# Edit PUSHGATEWAY and RELYINGPARTY below before running.
#
#   bash scripts/send-test-notification.sh
#
# Add an API key header if SEND_NOTIFICATION_FORCE_AUTH=true on the target.
# ────────────────────────────────────────────────

PUSHGATEWAY="http://localhost:3000/"
RELYINGPARTY="aa"
#USERID=

curl -X POST "$PUSHGATEWAY/send-notification" \
-H "Content-Type: application/json" \
-d '{
  "username": "'"${RELYINGPARTY}"'",
  "title": "MIE Sudo Security Alert",
  "body": "Please review and respond to your pending MIE request in the app",
  "timeout": "",
  "restriction": "",
  "deviceType": "primary",
  "metaData": "server name, ip, source, etc",
  "actions": [
    {
      "icon": "approve",
      "title": "Approve",
      "callback": "approve"
    },
    {
      "icon": "reject",
      "title": "Reject",
      "callback": "reject"
    }
  ]
}'
