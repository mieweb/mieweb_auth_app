# API Key Authentication for /send-notification Endpoint

## Overview

This feature adds client-specific API key authentication to the `/send-notification` endpoint. It allows administrators to issue unique API keys to different clients (e.g., `ldap.example.com`, `hr-system.company.com`) and track which client originated each notification request.

## Features

- **Secure API Key Storage**: Keys are hashed using PBKDF2 with SHA-512 (100,000 iterations) and a unique 32-byte salt per key
- **Client Tracking**: Each notification is tagged with the originating client ID
- **Optional or Mandatory Authentication**: Controlled via environment variable
- **CLI Management Tool**: Easy key generation, listing, deletion, and regeneration
- **Reserved 'unspecified' Handling**: Unauthenticated requests are tagged as 'unspecified'

## Files Changed

| File                                                | Description                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `utils/api/apiKeys.js`                              | **NEW** - MongoDB collection and Meteor methods for API key management |
| `server/main.js`                                    | Added API key verification logic to `/send-notification` endpoint      |
| `utils/api/notificationHistory.js`                  | Added `clientId` field and index to track notification origins         |
| `client/WebNotificationPage.jsx`                    | Added API key and client ID input fields to the test UI                |
| `manage-api-keys.js`                                | **NEW** - CLI tool for API key administration                          |
| `client/mobile/src/ui/components/AppRoutes.jsx`     | Changed route from `/send-notification` to `/test-notification`        |
| `client/web/components/Layout.jsx`                  | Updated navigation links to use new route                              |
| `client/mobile/src/ui/hooks/useNotificationData.js` | Fixed null appId handling to prevent errors                            |
| `package.json`                                      | Added `mongodb` dependency for CLI tool                                |

## Configuration

### Environment Variable

| Variable                       | Description                                                        | Default                           |
| ------------------------------ | ------------------------------------------------------------------ | --------------------------------- |
| `SEND_NOTIFICATION_FORCE_AUTH` | Set to `"true"` to require API key authentication for all requests | Not set (authentication optional) |

### Behavior Matrix

| SEND_NOTIFICATION_FORCE_AUTH | API Key Provided | Result                                    |
| ---------------------------- | ---------------- | ----------------------------------------- |
| Not set / false              | No               | Request allowed, clientId = 'unspecified' |
| Not set / false              | Yes (valid)      | Request allowed, clientId = client's ID   |
| Not set / false              | Yes (invalid)    | **403 Forbidden**                         |
| `"true"`                     | No               | **403 Forbidden**                         |
| `"true"`                     | Yes (valid)      | Request allowed, clientId = client's ID   |
| `"true"`                     | Yes (invalid)    | **403 Forbidden**                         |

## Usage

### Managing API Keys (CLI)

```bash
# Generate a new API key for a client
node manage-api-keys.js generate ldap.example.com

# List all API keys
node manage-api-keys.js list

# Delete an API key
node manage-api-keys.js delete ldap.example.com

# Regenerate an API key (invalidates the old key)
node manage-api-keys.js regenerate ldap.example.com
```

### Sending Authenticated Notifications

Include `apikey` and optionally `client_id` in your POST request:

```json
{
  "username": "user123",
  "title": "Approval Request",
  "body": "Please approve this action",
  "actions": [
    { "icon": "approve", "title": "Approve", "callback": "approve" },
    { "icon": "reject", "title": "Reject", "callback": "reject" }
  ],
  "apikey": "your-64-character-hex-api-key",
  "client_id": "ldap.example.com"
}
```

**Note**: Providing `client_id` is optional but speeds up key verification (avoids checking all keys).

### cURL Example

```bash
curl -X POST http://localhost:3000/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "title": "Test Notification",
    "body": "This is a test",
    "actions": [
      {"icon": "approve", "title": "Approve", "callback": "approve"},
      {"icon": "reject", "title": "Reject", "callback": "reject"}
    ],
    "apikey": "fdd1cdf60fdda3a9de4fd50593d3ce6f2e09ef83a231d16d17589b8644063003",
    "client_id": "ldaptest-local.example.com"
  }'
```

## Database Schema

### apiKeys Collection

```javascript
{
  _id: ObjectId,
  clientId: String,        // Unique client identifier (e.g., "ldap.example.com")
  hashedKey: String,       // PBKDF2-SHA512 hash of the API key
  salt: String,            // Unique 32-byte salt for this key
  createdAt: Date,         // When the key was created/regenerated
  lastUsed: Date | null    // Last time the key was used
}
```

### notificationHistory Collection (Updated)

```javascript
{
  // ... existing fields ...
  clientId: String; // NEW - The client that sent this notification (default: 'unspecified')
}
```

## Security Considerations

1. **One-way hashing**: API keys are hashed with PBKDF2 and cannot be recovered from the database
2. **Unique salts**: Each key has its own salt, preventing rainbow table attacks
3. **Timing-safe comparison**: Verification uses `crypto.timingSafeEqual()` for constant-time comparison to prevent timing attacks
4. **Non-blocking hashing**: Uses async PBKDF2 to avoid blocking the event loop during request handling
5. **Key shown once**: The plain API key is only displayed when generated/regenerated
6. **Reserved 'unspecified'**: Cannot be used as a client ID to prevent spoofing
7. **Server-only methods**: API key management methods (create, list, delete, regenerate) can only be called from the server

## Web UI Changes

The notification test page has been moved from `/send-notification` to `/test-notification` to avoid conflicts with the API endpoint. Navigation links have been updated accordingly.

## Testing

Tests are implemented in [tests/main.js](tests/main.js). Run them with:

```bash
meteor test --once --driver-package meteortesting:mocha
```

### Test Coverage

#### Unit Tests (hashApiKey, verifyApiKey)

- [x] `hashApiKey()` produces consistent hashes with same salt
- [x] `hashApiKey()` produces different hashes with different salts
- [x] `hashApiKey()` generates salt if none provided
- [x] `hashApiKey()` produces 128-character hex hash
- [x] `verifyApiKey()` returns true for valid key/hash pairs
- [x] `verifyApiKey()` returns false for invalid keys
- [x] `verifyApiKey()` returns false for incorrect salt

#### Integration Tests (Meteor Methods)

- [x] `apiKeys.create` creates a new key and returns it
- [x] `apiKeys.create` rejects duplicate client IDs
- [x] `apiKeys.create` rejects 'unspecified' client ID (case-insensitive)
- [x] `apiKeys.verify` validates correct API keys
- [x] `apiKeys.verify` validates correct API keys without client ID hint
- [x] `apiKeys.verify` rejects incorrect API keys
- [x] `apiKeys.verify` rejects keys for non-existent clients
- [x] `apiKeys.verify` updates `lastUsed` timestamp
- [x] `apiKeys.verify` rejects 'unspecified' as client ID
- [x] `apiKeys.list` returns all keys without exposing hashes
- [x] `apiKeys.list` returns empty array when no keys exist
- [x] `apiKeys.delete` removes keys
- [x] `apiKeys.delete` returns false for non-existent keys
- [x] `apiKeys.regenerate` creates new key and invalidates old one
- [x] `apiKeys.regenerate` rejects non-existent clients
- [x] `apiKeys.regenerate` rejects 'unspecified' client ID

#### Notification History Tests

- [x] Default clientId to 'unspecified' when not provided
- [x] Store provided clientId correctly

#### Endpoint Tests (TODO - require HTTP testing setup)

- [ ] POST `/send-notification` without auth succeeds when FORCE_AUTH is disabled
- [ ] POST `/send-notification` with valid auth succeeds
- [ ] POST `/send-notification` with invalid auth returns 403
- [ ] POST `/send-notification` without auth returns 403 when FORCE_AUTH is enabled

#### CLI Tests (TODO - require separate test runner)

- [ ] `generate` creates new key and displays it
- [ ] `generate` rejects 'unspecified' client ID
- [ ] `list` displays all keys with metadata
- [ ] `delete` removes key after confirmation
- [ ] `regenerate` creates new key and invalidates old

## Rollback Instructions

To remove this feature:

1. Remove environment variable `SEND_NOTIFICATION_FORCE_AUTH`
2. Revert changes to `server/main.js` (remove API key verification block)
3. Delete `utils/api/apiKeys.js`
4. Delete `manage-api-keys.js`
5. Optionally remove `clientId` field from notification history (data migration needed)
6. Revert route changes if desired
