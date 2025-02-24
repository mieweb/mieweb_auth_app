#!/bin/bash

PUSHGATEWAY="https://41ef-50-221-78-186.ngrok-free.app"
RELYINGPARTY="a78f8aa7b740a9b7c043883a726de4b8"
#USERID=

curl -X POST "$PUSHGATEWAY/send-notification" \
-H "Content-Type: application/json" \
-d '{
  "appId": "'"${RELYINGPARTY}"'",
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
