# API Key Authentication - Usage Examples

This document provides step-by-step examples for using the API key authentication feature.

## Scenario 1: First-Time Setup (Administrator)

### Step 1: Generate a secure API key
```bash
node manage-api-keys.js generate
```
Output:
```
Generated secure API key: OTNfhCqvpSxl3pNwAMA0grnrbEH2OrRm
```

### Step 2: Create the API key in the database
Open Meteor shell:
```bash
meteor shell
```

In the Meteor shell, run:
```javascript
await Meteor.callAsync('apiKeys.upsert', 'ldap.example.com', 'OTNfhCqvpSxl3pNwAMA0grnrbEH2OrRm')
```

Output:
```javascript
{ success: true, action: 'created' }
```

### Step 3: Enable authentication
Set the environment variable before starting the server:
```bash
export SEND_NOTIFICATION_FORCE_AUTH=true
meteor run
```

Or add it to your deployment configuration.

## Scenario 2: Sending Authenticated Notifications

### Without Authentication (Default)
When `SEND_NOTIFICATION_FORCE_AUTH` is not set or is `false`:

```bash
curl -X POST "https://your-server.com/send-notification" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "title": "Security Alert",
    "body": "Please approve this request",
    "actions": [
      {"icon": "approve", "title": "Approve", "callback": "approve"},
      {"icon": "reject", "title": "Reject", "callback": "reject"}
    ]
  }'
```

### With Authentication Enabled
When `SEND_NOTIFICATION_FORCE_AUTH=true`:

```bash
curl -X POST "https://your-server.com/send-notification" \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "OTNfhCqvpSxl3pNwAMA0grnrbEH2OrRm",
    "client_id": "ldap.example.com",
    "username": "testuser",
    "title": "Security Alert",
    "body": "Please approve this request",
    "actions": [
      {"icon": "approve", "title": "Approve", "callback": "approve"},
      {"icon": "reject", "title": "Reject", "callback": "reject"}
    ]
  }'
```

## Scenario 3: Handling Authentication Errors

### Missing API Key
Request:
```bash
curl -X POST "https://your-server.com/send-notification" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "title": "Test",
    "body": "Test message",
    "actions": []
  }'
```

Response (403 Forbidden):
```json
{
  "success": false,
  "error": "Authentication required. Please provide an API key."
}
```

### Invalid API Key
Request:
```bash
curl -X POST "https://your-server.com/send-notification" \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "wrong-api-key",
    "client_id": "ldap.example.com",
    "username": "testuser",
    "title": "Test",
    "body": "Test message",
    "actions": []
  }'
```

Response (403 Forbidden):
```json
{
  "success": false,
  "error": "Invalid API key or client_id"
}
```

## Scenario 4: Managing API Keys

### List all configured clients
```javascript
// In Meteor shell
await Meteor.callAsync('apiKeys.list')
```

Output:
```javascript
[
  {
    _id: 'abc123',
    clientId: 'ldap.example.com',
    createdAt: ISODate('2024-01-29T10:00:00.000Z'),
    updatedAt: ISODate('2024-01-29T10:00:00.000Z'),
    lastUsed: ISODate('2024-01-29T12:30:00.000Z')
  }
]
```

### Verify an API key
```javascript
// In Meteor shell
await Meteor.callAsync('apiKeys.verify', 'ldap.example.com', 'OTNfhCqvpSxl3pNwAMA0grnrbEH2OrRm')
```

Output:
```javascript
true
```

### Update an API key
```javascript
// In Meteor shell
await Meteor.callAsync('apiKeys.upsert', 'ldap.example.com', 'new-secure-api-key-here')
```

Output:
```javascript
{ success: true, action: 'updated' }
```

### Delete an API key
```javascript
// In Meteor shell
await Meteor.callAsync('apiKeys.delete', 'ldap.example.com')
```

Output:
```javascript
{ success: true, deleted: 1 }
```

## Scenario 5: Tracking Client Activity

### Query notification history by client
```javascript
// In Meteor mongo console or shell
db.notificationHistory.find({ clientId: 'ldap.example.com' }).sort({ createdAt: -1 })
```

This returns all notifications sent by the specified client, useful for:
- Identifying abusive clients
- Audit trails
- Usage statistics

### Check when a client last used their API key
```javascript
// In Meteor mongo console or shell
db.apiKeys.findOne({ clientId: 'ldap.example.com' }, { lastUsed: 1 })
```

## Security Best Practices

1. **Keep API keys secure**: Store them in environment variables or secure vaults, never in code
2. **Use strong keys**: Minimum 16 characters, preferably 32+ with high entropy
3. **Rotate keys regularly**: Update API keys periodically for enhanced security
4. **Monitor usage**: Track lastUsed timestamps and notification history
5. **Restrict access**: Limit API key management methods to administrators only
6. **Enable authentication**: Set `SEND_NOTIFICATION_FORCE_AUTH=true` in production

## Troubleshooting

### Authentication not working
1. Verify `SEND_NOTIFICATION_FORCE_AUTH=true` is set
2. Check that the API key exists: `await Meteor.callAsync('apiKeys.list')`
3. Verify the client_id matches exactly
4. Check server logs for detailed error messages

### API key rejected
1. Ensure the API key is at least 16 characters long
2. Verify no extra whitespace in the key
3. Check that the client_id matches the one used during creation
4. Verify the key hasn't been deleted or updated

### Can't create API keys
1. Ensure you're running commands in the Meteor shell (not a regular terminal)
2. Check that MongoDB is running and accessible
3. Verify no network or permission issues with the database
