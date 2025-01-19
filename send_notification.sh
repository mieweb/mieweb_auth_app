#!/bin/bash

curl -X POST http://localhost:3000/send-notification \
-H "Content-Type: application/json" \
-d '{
    "appId": "2c142ea8d3c29cdabbe9f6f2043389ac",
    "title": "MIE Sudo Security Alert",
    "body": "Please review and respond to your pending MIE request in the app.",
    "actions": [
    {
      "icon": "approve",
      "title": "Approve",
      "callback": "approve",
      "foreground": true,
      "background": true
    },
    {
      "icon": "reject",
      "title": "Reject",
      "callback": "reject",
      "foreground": true,
      "background": true
    }
  ]
}'


# If you set the foreground property to true, the app will be brought to the front, if foreground is false then the callback is run without the app being brought to the foreground.