# Healthcheck API Documentation

## Overview

The `/healthcheck` endpoint reports whether the application can reach MongoDB
and whether the connected node accepts writes. It is intended for load-balancer
health probes, container orchestrator liveness/readiness checks, and uptime
monitoring.

It:

- runs a MongoDB `ping` command
- asks the node whether it is a writable primary
- returns `200` only when both checks pass, otherwise `503`

## Endpoint

- **Methods:** `GET`, `HEAD`
- **Path:** `/healthcheck`
- **Response Content-Type:** `application/json`

The path must match exactly. Sub-paths such as `/healthcheck/db` are not handled
and fall through to the normal application routes. Query strings are ignored, so
`/healthcheck?probe=lb` behaves identically to `/healthcheck`.

Any method other than `GET` or `HEAD` is not handled by this endpoint.

## Authentication

None. The endpoint is unauthenticated so that external probes can reach it.

It exposes no user data, no configuration values, and no database contents. The
only information returned is MongoDB reachability, writability, and a driver
error message when a check fails.

## Status Codes

| Status | Meaning                                                                            |
| -----: | ---------------------------------------------------------------------------------- |
|  `200` | MongoDB responded to `ping` and reports the connected node as a writable primary.  |
|  `503` | MongoDB is reachable but not writable, for example a secondary or read-only node.  |
|  `503` | MongoDB is unreachable, `ping` failed, or the driver command interface is missing. |

There are no other status codes. Every response carries the
`Content-Type: application/json` header, including `HEAD` responses.

## Response Body

| Field                      | Type    | Always Present | Description                                           |
| -------------------------- | ------- | -------------: | ----------------------------------------------------- |
| `status`                   | string  |            Yes | `"ok"` when healthy, `"unhealthy"` otherwise          |
| `timestamp`                | string  |            Yes | ISO 8601 UTC timestamp generated for the request      |
| `checks.mongodb.connected` | boolean |            Yes | Whether the MongoDB `ping` command succeeded          |
| `checks.mongodb.writable`  | boolean |            Yes | Whether the connected node reports a writable primary |
| `error`                    | string  |             No | Present only on `503`; describes the failed check     |

### Healthy — `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-09-15T12:00:00.000Z",
  "checks": {
    "mongodb": {
      "connected": true,
      "writable": true
    }
  }
}
```

### Reachable but not writable — `503 Service Unavailable`

Returned when the node answers `ping` but is not a writable primary, such as a
replica-set secondary or a node in a stepped-down state.

```json
{
  "status": "unhealthy",
  "timestamp": "2026-09-15T12:00:00.000Z",
  "checks": {
    "mongodb": {
      "connected": true,
      "writable": false
    }
  },
  "error": "MongoDB is not writable on this node"
}
```

### Unreachable — `503 Service Unavailable`

Returned when the driver throws, `ping` does not return `ok: 1`, or the command
interface is unavailable. The `error` field carries the underlying driver
message, falling back to `"MongoDB healthcheck failed"` when no message exists.

```json
{
  "status": "unhealthy",
  "timestamp": "2026-09-15T12:00:00.000Z",
  "checks": {
    "mongodb": {
      "connected": false,
      "writable": false
    }
  },
  "error": "connect ECONNREFUSED 127.0.0.1:27017"
}
```

Other values seen in `error` include `"MongoDB command interface unavailable"`
and `"MongoDB ping failed"`.

### `HEAD` responses

A `HEAD` request returns the same status code and the same
`Content-Type: application/json` header with an empty body, as required by
RFC 9110 section 9.3.2. Use it for probes that only need the status line.

## Examples

Full response body:

```bash
curl http://localhost:3000/healthcheck
```

Status code only, suitable for a shell probe:

```bash
curl -o /dev/null -s -w '%{http_code}\n' -I http://localhost:3000/healthcheck
```

Fail a script when the instance is unhealthy:

```bash
curl --fail --silent --show-error http://localhost:3000/healthcheck > /dev/null
```

## Implementation Notes

- The check runs against the application's own database handle rather than
  `admin`. The `ping`, `hello`, and `isMaster` commands are exempt from MongoDB
  access control, so the endpoint works with the standard MeteorJS grant
  (read-write on the application database, read-only on `local` for oplog
  tailing). No elevated MongoDB privileges are required.
- Writability is detected with the `hello` command, which requires MongoDB 4.4
  or newer. On older servers the check falls back to the legacy `isMaster`
  command so that a reachable node is not misreported as disconnected. The
  writable flag is read from `isWritablePrimary`, falling back to `ismaster`.
- Responses are generated per request and are not cached.

## Multi-instance Deployments

Each application instance answers for itself. In a multi-instance deployment,
probe `/healthcheck` on every instance rather than through a shared load-balancer
address, otherwise a single healthy instance can mask a failing one.

Because all instances share one MongoDB database, a database-level outage makes
every instance report `503` at the same time.

## Source and Tests

- Handler and status logic: [../server/healthcheck.js](../server/healthcheck.js)
- Route registration: [../server/main.js](../server/main.js)
- Tests: [../tests/healthcheck.js](../tests/healthcheck.js)
