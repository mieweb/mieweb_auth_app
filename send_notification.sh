#!/bin/bash

curl -X POST http://localhost:3000/send-notification \
-H "Content-Type: application/json" \
-d '{
  "token": "dV4xr4RBQjmjuuiAH_v1bp:APA91bHJPq8W8rJPW994gPStWJC2uipSxbX82TaswiyFXN11X3UPJMz8ZMPn3n5D5srW3fMw1eL69dATHun0m62cF8kSKEZ3gJ7XO7t8NZCdA9xLftNoWAI",
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
