#!/bin/bash

curl -X POST http://localhost:3000/send-notification \
-H "Content-Type: application/json" \
-d '{
  "appId": "62a9be765df13228cdd2541bdba02555",
  "title": "Meteor Auth test",
  "body": "This is an authorization push notification. Please approve or reject the request.",
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
      "foreground": false
    }
  ]
}' | (sleep 6; cat)
