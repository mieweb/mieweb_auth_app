# Admin Dashboard

Web-based admin panel served at `ROOT_URL/admin`.

## Setup

Set two env vars before starting the server:

```bash
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=<strong-password>
```

No database seeding required — credentials live entirely in env vars.

## Authentication

1. Open `/admin` in a browser → login with username + password.
2. Server returns a Bearer session token (8 h TTL, in-memory).
3. All subsequent API calls include `Authorization: Bearer <token>`.

## Dashboard Tabs

| Tab | Description |
|-----|-------------|
| 🔑 API Keys | Create / delete client API keys. Key shown once with copy button; list shows first-5-char prefix + masked remainder. |
| 👤 Users | List all users with registration status. Approve pending users or delete any user. |
| 📱 Devices | Devices grouped by user. Approve pending devices or revoke any device. |
| 📧 Emails | Log of every outgoing email (registration approval, support, account deletion). Filter by type. Approve / reject users inline from registration emails. |

## REST API Reference

All endpoints require `Authorization: Bearer <token>` except login.

### Auth
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/admin/auth` | `{ username, password }` | Login → `{ token }` |
| GET | `/api/admin/verify` | — | Check session validity |
| POST | `/api/admin/logout` | — | Destroy session |

### API Keys
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/admin/api-keys/list` | — | List all client keys (prefix only) |
| POST | `/api/admin/api-keys/create` | `{ clientId }` | Create key → returns plain key once |
| DELETE | `/api/admin/api-keys/delete` | `{ clientId }` | Delete a key |

### Users
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/admin/users/list` | — | List all users |
| POST | `/api/admin/users/approve` | `{ userId }` | Approve user + all devices |
| POST | `/api/admin/users/delete` | `{ userId }` | Delete user + all data |

### Devices
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/admin/devices/list` | — | List all devices |
| POST | `/api/admin/devices/approve` | `{ userId, deviceUUID }` | Approve one device |
| POST | `/api/admin/devices/revoke` | `{ userId, deviceUUID }` | Remove one device |

### Emails
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/admin/emails/list` | — | Last 200 emails (newest first) |

## Files

| File | Purpose |
|------|---------|
| `server/adminAuth.js` | Credential validation, session store, middleware |
| `server/adminApi.js` | All REST endpoints |
| `server/templates/admin.js` | Self-contained React SPA (served as HTML) |
| `utils/api/emailLog.js` | `EmailLog` Mongo collection |
