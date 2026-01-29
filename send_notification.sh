#!/bin/bash

PUSHGATEWAY="https://aabrol-mieauth.dev.bluehive.com"
RELYINGPARTY="aa"
#USERID=

# Optional: Uncomment the following lines if authentication is required
# API_KEY="your-secure-api-key-min-16-chars"
# CLIENT_ID="your-client.example.com"

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

# With authentication (when SEND_NOTIFICATION_FORCE_AUTH=true):
# Add these fields to the JSON above:
#   "apikey": "'"${API_KEY}"'",
#   "client_id": "'"${CLIENT_ID}"'",
