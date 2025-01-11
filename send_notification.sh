#!/bin/bash

curl -X POST http://localhost:3000/send-notification \
-H "Content-Type: application/json" \
-d '{
    "appId": "505a9c017d3d833ad611b50bf58c6c2c",
    "title": "MIE Sudo Security Alert",
    "body": "Please review and respond to your pending MIE request in the app",
    "actions": [
    {
      "icon": "approve",
      "title": "Approve",
      "callback": "approve",
      "foreground": true
    },
    {
      "icon": "reject",
      "title": "Reject",
      "callback": "reject",
      "foreground": true
    }
  ]
}' | (sleep 6; cat)


# If you set the foreground property to true, the app will be brought to the front, if foreground is false then the callback is run without the app being brought to the foreground.