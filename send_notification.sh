#!/bin/bash

curl -X POST http://localhost:3000/send-notification \
-H "Content-Type: application/json" \
-d '{
    "appId": "f51ebc45c65d833e16a648d8e5cb2de1",
    "title": "MIE Sudo Security Alert",
    "body": "Please review and respond to your pending MIE request in the app.",
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


# If you set the foreground property to true, the app will be brought to the front, if foreground is false then the callback is run without the app being brought to the foreground.