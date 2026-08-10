# Admin Dashboard

Web-based admin panel served at `ROOT_URL/admin`.

## Setup

Set the following LDAP env vars before starting the server:

```bash
# Comma-separated for failover (tries ldap1 first, falls back to ldap2)
export LDAP_URL="ldaps://ldap1.cluster.mieweb.org:636,ldaps://ldap2.cluster.mieweb.org:636"
export LDAP_BASE_DN="dc=cluster,dc=mieweb,dc=org"
export LDAP_USER_BASE_DN="ou=users,dc=cluster,dc=mieweb,dc=org"
export LDAP_ADMIN_GROUP_DN="cn=tfa-admins,ou=groups,dc=cluster,dc=mieweb,dc=org"
# optional – user RDN attribute, defaults to "uid" (authentik uses "cn")
# export LDAP_USER_RDN_ATTR="cn"
# optional – defaults to "memberUid"
# export LDAP_GROUP_MEMBER_ATTR="memberUid"
export LDAP_REJECT_UNAUTHORIZED="false"
```

| Variable                   | Required | Description                                                                                     |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `LDAP_URL`                 | Yes      | LDAP server URL(s). Comma-separated for failover (e.g. `ldaps://ldap1:636,ldaps://ldap2:636`)   |
| `LDAP_BASE_DN`             | Yes      | Base DN for the directory                                                                       |
| `LDAP_USER_BASE_DN`        | Yes      | DN under which user entries live (used to build `<rdn>=<username>,<USER_BASE_DN>`)              |
| `LDAP_USER_RDN_ATTR`       | No       | RDN attribute for user entries, used to build the bind DN (default: `uid`; authentik uses `cn`) |
| `LDAP_ADMIN_GROUP_DN`      | Yes      | DN of the group whose members are allowed admin access                                          |
| `LDAP_GROUP_MEMBER_ATTR`   | No       | Attribute on the group entry that lists members (default: `memberUid`)                          |
| `LDAP_REJECT_UNAUTHORIZED` | No       | Set to `"false"` to skip TLS certificate validation (default: `"true"`)                         |

No database seeding required — admin access is determined by LDAP group membership.

## Authentication

1. Open `/admin` in a browser → login with your LDAP username + password.
2. Server performs an LDAP bind as `uid=<username>,<LDAP_USER_BASE_DN>` to validate the password.
3. Server searches `LDAP_ADMIN_GROUP_DN` to verify the user is a member of the admin group.
4. On success, returns a Bearer session token (8 h TTL, in-memory).
5. All subsequent API calls include `Authorization: Bearer <token>`.

## Dashboard Tabs

| Tab            | Description                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔑 API Keys    | Create / delete client API keys. Key shown once with copy button; list shows first-5-char prefix + masked remainder.                                                                                                                                                                                                                                                                           |
| 👤 Users       | List all users with registration status. Approve pending users or delete any user.                                                                                                                                                                                                                                                                                                             |
| 📱 Devices     | Devices grouped by user. Approve pending devices or revoke any device.                                                                                                                                                                                                                                                                                                                         |
| 📧 Emails      | Log of every outgoing email (registration approval, support, account deletion). Filter by type. Approve / reject users inline from registration emails.                                                                                                                                                                                                                                        |
| 🩺 Diagnostics | Look up a user (username / email / userId) to inspect their account, devices, stored FCM token state (masked preview + SHA-256 fingerprint), and recent notification history — without direct MongoDB access. Send a per-device test push to verify the stored token against live FCM (a `registration-token-not-registered` result means the token is stale and the device must re-register). |

## REST API Reference

All endpoints require `Authorization: Bearer <token>` except login.

### Auth

| Method | Path                | Body                     | Description            |
| ------ | ------------------- | ------------------------ | ---------------------- |
| POST   | `/api/admin/auth`   | `{ username, password }` | Login → `{ token }`    |
| GET    | `/api/admin/verify` | —                        | Check session validity |
| POST   | `/api/admin/logout` | —                        | Destroy session        |

### API Keys

| Method | Path                         | Body           | Description                         |
| ------ | ---------------------------- | -------------- | ----------------------------------- |
| GET    | `/api/admin/api-keys/list`   | —              | List all client keys (prefix only)  |
| POST   | `/api/admin/api-keys/create` | `{ clientId }` | Create key → returns plain key once |
| DELETE | `/api/admin/api-keys/delete` | `{ clientId }` | Delete a key                        |

### Users

| Method | Path                       | Body         | Description                |
| ------ | -------------------------- | ------------ | -------------------------- |
| GET    | `/api/admin/users/list`    | —            | List all users             |
| POST   | `/api/admin/users/approve` | `{ userId }` | Approve user + all devices |
| POST   | `/api/admin/users/delete`  | `{ userId }` | Delete user + all data     |

### Devices

| Method | Path                         | Body                     | Description        |
| ------ | ---------------------------- | ------------------------ | ------------------ |
| GET    | `/api/admin/devices/list`    | —                        | List all devices   |
| POST   | `/api/admin/devices/approve` | `{ userId, deviceUUID }` | Approve one device |
| POST   | `/api/admin/devices/revoke`  | `{ userId, deviceUUID }` | Remove one device  |

### Emails

| Method | Path                     | Body | Description                    |
| ------ | ------------------------ | ---- | ------------------------------ |
| GET    | `/api/admin/emails/list` | —    | Last 200 emails (newest first) |

### Diagnostics

| Method | Path                               | Body / Query                   | Description                                                                                          |
| ------ | ---------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| GET    | `/api/admin/diagnostics/user`      | `?q=<username\|email\|userId>` | Account, devices (masked FCM token info, biometric-secret presence), warnings, last 15 notifications |
| POST   | `/api/admin/diagnostics/test-push` | `{ userId, deviceUUID }`       | Send a test push to the stored token; returns the live FCM result (e.g. stale-token error codes)     |

Full FCM tokens are never returned — only a masked preview (first 12 + last 6 chars), length, and a truncated SHA-256 fingerprint, which is enough to compare against a device's diagnostics logs.

## Files

| File                        | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `server/adminAuth.js`       | LDAP bind + group membership check, session store, middleware |
| `server/adminApi.js`        | All REST endpoints                                            |
| `server/templates/admin.js` | Self-contained React SPA (served as HTML)                     |
| `utils/api/emailLog.js`     | `EmailLog` Mongo collection                                   |
