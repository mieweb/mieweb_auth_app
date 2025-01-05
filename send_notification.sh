#!/bin/bash

curl -X POST http://localhost:3000/send-notification \
-H "Content-Type: application/json" \
-d '{
  "token": "eOeRQyCSRdOOzbLOT5uzMf:APA91bGzOX2wTCOlXGFzNETAHRQ6nbJ2OdKMDKPUJZ4K8KaonSIdi7FYJ3yTPY4e58K5qjWppw44LuPrLTBmaieKdZFnzYc7SsrZGjvJObKA3HwIYxsAG8E",
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
