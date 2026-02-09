# Forget PIN Feature Documentation

## Overview

The Forget PIN feature allows users to securely reset their PIN if they have forgotten it. The feature uses email verification with time-limited, single-use tokens to ensure security.

## User Flow

### 1. Request PIN Reset

1. User opens the mobile app and navigates to the login screen
2. On the PIN entry form, user clicks **"Forgot PIN?"** link
3. A modal appears asking for the user's email address
4. User enters their email and clicks **"Send Reset Link"**
5. If the email exists in the system, a reset email is sent (the app always shows success to prevent email enumeration)
6. User sees a confirmation message: "Reset link sent! Check your email..."

### 2. Receive Reset Email

The user receives an email with:
- Clear subject: "Reset Your PIN - MIEWeb Auth"
- Professional branded template
- Prominent "Reset PIN" button linking to the reset page
- Security warnings:
  - Link expires in 24 hours
  - Link can only be used once
  - Current PIN remains active until reset is complete
  
### 3. Reset PIN

1. User clicks the reset link in their email
2. Browser opens to the reset page with a clean, modern interface
3. User enters their new PIN (4-6 digits)
4. User confirms the new PIN by re-entering it
5. Form validates:
   - PINs match
   - PIN is 4-6 digits
   - Token is valid and not expired
6. Upon successful reset:
   - User sees success message
   - Old PIN is invalidated
   - New PIN is immediately active
7. User returns to the mobile app and signs in with their new PIN

## Security Features

### Token Security
- **Expiration**: Reset tokens expire after 24 hours
- **Single-use**: Each token can only be used once
- **Secure generation**: Uses `Random.secret()` for cryptographically secure random tokens
- **Database tracking**: Tokens are tracked with creation time, expiration, and usage status

### Email Security
- **No enumeration**: System always returns success message regardless of email existence
- **Rejection handling**: Rejected accounts cannot reset their PIN
- **Clear warnings**: Email includes security warnings about link expiration and single-use

### PIN Security
- **Format validation**: PIN must be 4-6 numeric digits
- **Match confirmation**: User must enter PIN twice to confirm
- **Immediate activation**: New PIN is active immediately after reset
- **Secure storage**: PIN is hashed using Meteor's Accounts system

## Technical Implementation

### Backend Components

#### Meteor Methods

**`users.requestPinReset(email)`**
- Validates email format
- Finds user by email (case-insensitive)
- Generates secure reset token
- Stores token in ApprovalTokens collection
- Sends reset email
- Returns success regardless of email existence (anti-enumeration)

**`users.updatePinWithToken(userId, token, newPin)`**
- Validates token existence and expiry
- Checks if token was already used
- Validates new PIN format (4-6 digits)
- Updates user password using `Accounts.setPassword()`
- Marks token as used
- Returns success/error

#### Web Endpoints

**`/reset-pin?userId={id}&token={token}`**
- Serves HTML page with reset form
- Embedded form with JavaScript validation
- Calls `/api/update-pin` endpoint on submission
- Shows success/error messages

**`/api/update-pin` (POST)**
- Accepts JSON: `{ userId, token, newPin }`
- Calls `users.updatePinWithToken` method
- Returns JSON response

### Frontend Components

#### Login Page Enhancements

**"Forgot PIN?" Link**
- Positioned next to PIN field label
- Opens modal when clicked
- Styled to match existing design

**Forgot PIN Modal**
- Email input field with validation
- Cancel and Send buttons
- Loading state during email sending
- Success confirmation
- Error handling
- Auto-closes after success

## Configuration

### Environment Variables

Required for email functionality:

```bash
# Email configuration (one of these required)
MAIL_URL=smtp://username:password@smtp.provider.com:587
SENDGRID_API_KEY=your_sendgrid_api_key

# Email addresses
EMAIL_FROM=noreply@yourapp.com
EMAIL_ADMIN=admin@yourapp.com (optional, for admin notifications)
```

### Constants

Defined in `/utils/constants.js`:

```javascript
export const APPROVAL_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
```

## Testing

### Unit Tests

Located in `/tests/main.js`:

1. **PIN Format Validation**: Tests valid PINs (4-6 digits) and invalid PINs
2. **Token Generation**: Verifies token creation and 24-hour expiry
3. **Token Usage**: Tests marking token as used and reuse prevention

### Manual Testing Checklist

- [ ] Click "Forgot PIN?" link opens modal
- [ ] Enter email and receive reset email
- [ ] Email template displays correctly
- [ ] Click reset link opens reset page
- [ ] Enter mismatched PINs shows error
- [ ] Enter invalid PIN format shows error
- [ ] Successfully reset PIN with valid token
- [ ] Try to reuse token (should fail)
- [ ] Wait 24 hours and try expired token (should fail)
- [ ] Login with new PIN succeeds
- [ ] Login with old PIN fails

## API Reference

### Meteor Methods

#### `users.requestPinReset(email)`

**Returns:**
```javascript
{
  success: true,
  message: "If the email exists, a reset link has been sent."
}
```

#### `users.updatePinWithToken(userId, token, newPin)`

**Returns:**
```javascript
{
  success: true,
  message: "PIN successfully updated"
}
```

**Errors:**
- `invalid-pin`: PIN format is invalid
- `invalid-token`: Token doesn't exist or is invalid
- `token-expired`: Token has expired
- `token-used`: Token was already used
- `user-not-found`: User doesn't exist

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-09  
