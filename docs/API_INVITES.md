# Invite API Documentation

## Overview

The `/api/invite` endpoint creates a one-time registration invite for a user.

It:

- validates the caller with an API key
- creates a secure invite token
- sends the registration email
- returns the generated `inviteUrl` so integrators can turn it into a QR code

## Endpoint

- **Method:** `POST`
- **Path:** `/api/invite`
- **Content-Type:** `application/json`

## Authentication

Send a Bearer token in the `Authorization` header.

```http
Authorization: Bearer <api-key>
```

API keys follow the same model described in [docs/API_KEY_AUTHENTICATION.md](docs/API_KEY_AUTHENTICATION.md).

## Request Body

| Field       | Type   | Required | Description                                        |
| ----------- | ------ | -------: | -------------------------------------------------- |
| `email`     | string |      Yes | Email address of the invited user                  |
| `username`  | string |       No | Username to prefill and lock during registration   |
| `firstName` | string |       No | First name to prefill and lock during registration |
| `lastName`  | string |       No | Last name to prefill and lock during registration  |

### Example Request

```json
{
  "email": "testuser@example.com",
  "username": "testuser",
  "firstName": "Test",
  "lastName": "User"
}
```

### Minimum Valid Request

```json
{
  "email": "testuser@example.com"
}
```

## Success Response

**Status:** `201 Created`

```json
{
  "success": true,
  "inviteUrl": "https://your-host/register?token=abc123...",
  "expiresAt": "2026-03-12T18:30:00.000Z"
}
```

## Response Fields

| Field       | Type    | Description                                    |
| ----------- | ------- | ---------------------------------------------- |
| `success`   | boolean | Indicates invite creation succeeded            |
| `inviteUrl` | string  | Full registration URL for the invite           |
| `expiresAt` | string  | ISO-8601 UTC timestamp when the invite expires |

## Error Responses

### 400 Bad Request

```json
{
  "error": "Email is required"
}
```

Other malformed JSON or oversized payload errors may also return `400` or `413`.

### 401 Unauthorized

```json
{
  "error": "Authorization required"
}
```

or

```json
{
  "error": "Invalid API token"
}
```

### 405 Method Not Allowed

```json
{
  "error": "Method not allowed"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to create invite"
}
```

## Invite Lifecycle Rules

- Invite is valid for **48 hours** from creation
- Invite is **one-time use**
- Registration fields included in the invite are **prefilled and locked**
- Fields omitted from the invite remain editable during registration
- Opening the invite link in the mobile app skips onboarding and goes directly to registration
- Successful invite-based registration auto-approves the invited device for that initial flow

## QR Code Guidance

Use the returned `inviteUrl` as the QR payload.

Recommended:

- encode the full `inviteUrl`
- show the QR code in the partner portal or app
- let the user scan it from the MIE Auth mobile onboarding screen

Do not use only `/register` as the QR payload.

## Example cURL

```bash
curl -X POST "https://your-host/api/invite" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "username": "testuser",
    "firstName": "Test",
    "lastName": "User"
  }'
```

## Integration Summary

A third-party integrator typically needs to:

1. obtain an API key
2. call `POST /api/invite`
3. read `inviteUrl` from the response
4. either:
   - rely on the email sent by MIE Auth, or
   - convert `inviteUrl` into a QR code and display it to the user
