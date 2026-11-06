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

## Dashboard Sections

The console is a client route (`client/admin/`) built with `@mieweb/ui`. Each section has its own URL (`/admin/<section>`), so refreshes and bookmarks keep your place. Desktop shows a sidebar; tablet/mobile show a header with scrollable section links. Light/dark mode follows the site-wide `darkMode` preference.

| Section                     | Description                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users (`users`)             | Search by name / username / email, filter by status (pending first, with a review banner and nav badge). Approve pending users, reset or resend an approved user's PIN (with a live cooldown countdown), delete users, copy a user ID, or jump to Diagnostics.                                                                                             |
| Devices (`devices`)         | Searchable table of every device (pending first, nav badge). Approve pending devices or revoke any device.                                                                                                                                                                                                                                                 |
| API Keys (`api-keys`)       | Create / delete client API keys. The key is shown once in a dialog with a copy button; the list shows the prefix + masked remainder.                                                                                                                                                                                                                       |
| Duo (`duo`)                 | Create Duo integrations (auth / admin), enable or disable them, rotate credentials, delete. The skey is shown once.                                                                                                                                                                                                                                        |
| Emails (`emails`)           | Outgoing email log (masked). Filter by type or failures, search, and approve / reject pending registrations inline.                                                                                                                                                                                                                                        |
| Diagnostics (`diagnostics`) | Identity-migration coverage, plus a user lookup (`?q=`) showing account, devices, stored FCM token state (masked preview + SHA-256 fingerprint) and recent notifications. Send a per-device test push to verify the stored token against live FCM (a `registration-token-not-registered` result means the token is stale and the device must re-register). |

**Live updates:** lists are cached per endpoint and refetched every 15 s while the page is visible, on window focus, and after every action (including from other sections, e.g. approving from Emails updates Users and Devices). Action buttons stay busy until the refreshed data arrives, and repeat clicks are ignored. If a refresh fails, the last data stays visible with a retry link; an expired session returns to the sign-in page.

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

| Method | Path                         | Body         | Description                                                                                                                         |
| ------ | ---------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/admin/users/list`      | —            | List all users, incl. `pinResetCooldownMs` (remaining resend cooldown) and top-level `pinResetCooldownTotalMs`                      |
| POST   | `/api/admin/users/approve`   | `{ userId }` | Approve user + all devices                                                                                                          |
| POST   | `/api/admin/users/reset-pin` | `{ userId }` | Issue a temporary PIN → `{ tempPin, emailSent, expiresAt, cooldownMs }`; `429` + `Retry-After` / `retryAfterMs` during the cooldown |
| POST   | `/api/admin/users/delete`    | `{ userId }` | Delete user + all data                                                                                                              |

### Resetting a user's PIN

Users cannot reset their own PIN. In the app, **Forgot PIN?** lets them enter a temporary PIN or tap **Notify my administrator**, which emails `EMAIL_ADMIN` (at most once per 15 minutes per account).

1. On the **Users** tab, click **Reset PIN** on an approved user.
2. The user's current PIN stops working right away and they are signed out on all devices. Biometric sign-in keeps working.
3. A 6-digit temporary PIN is emailed to the user and shown to you **once**. If the email could not be sent, share the PIN with the user securely.
4. In the app, the user taps **Forgot PIN?**, enters the temporary PIN and chooses a new PIN.

The temporary PIN expires after 24 hours, works only once, and is invalidated after 5 wrong attempts. It cannot be used to sign in. **Resend PIN** issues a new temporary PIN (the previous one stops working). Issuing is limited per user by a server-enforced cooldown — 30 seconds by default, configurable with `PIN_RESET_RESEND_COOLDOWN_SECONDS` (clamped to 15–30). The cooldown is claimed atomically in MongoDB, so it holds across browser tabs, admins, direct API calls and server instances; the dashboard shows the remaining time as a countdown, which survives page reloads.

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

| File                    | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `server/adminAuth.js`   | LDAP bind + group membership check, session store, middleware |
| `server/adminApi.js`    | All REST endpoints                                            |
| `client/admin/`         | Admin console (React route `/admin/*`, `@mieweb/ui`)          |
| `utils/adminHelpers.js` | Pure formatting / filtering helpers (unit-tested)             |
| `utils/api/emailLog.js` | `EmailLog` Mongo collection                                   |
