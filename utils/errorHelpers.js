/**
 * Shared error classification helpers.
 *
 * • Client-side: classifyError() + ERROR_HINTS  — maps an errorCode / HTTP
 *   status to a UI display type ("error" | "warning") and an actionable hint.
 *
 * • Server-side: mapMeteorError() + HTTP_STATUS_MAP — maps a Meteor.Error
 *   (or generic Error) to { status, error, errorCode } for JSON responses.
 */

// ── Client-side: UI error classification ─────────────────────────────────────

/** Error code → { type?, hint } lookup for the notification test page / any UI. */
export const ERROR_HINTS = {
  'user-not-found':      { hint: 'Make sure the user has installed the MIEWeb Auth app and completed registration.' },
  'no-devices':          { hint: 'Make sure the user has installed the MIEWeb Auth app and completed registration.' },
  'invalid-username':    { hint: 'Make sure the user has installed the MIEWeb Auth app and completed registration.' },
  'device-not-approved': { type: 'warning', hint: 'An admin needs to approve the device before notifications can be sent.' },
  'api-key-required':    { type: 'warning', hint: 'Check your API key in the fields below, or contact your administrator.' },
  'api-key-invalid':     { type: 'warning', hint: 'Check your API key in the fields below, or contact your administrator.' },
  'fcm-error':           { hint: 'The push notification service encountered an issue. Ask the user to re-open the app to refresh their device token.' },
  'timeout':             { type: 'warning', hint: 'The user did not respond in time. They may not have seen the notification — try again.' },
  'network-error':       { hint: 'If the problem persists, the server may be down for maintenance.' },
};

/**
 * Classify an error for UI display.
 * @param {string} errorCode - The errorCode string from the server response.
 * @param {number} [httpStatus] - HTTP status code (used as fallback).
 * @returns {{ type: 'error'|'warning', hint: string }}
 */
export const classifyError = (errorCode, httpStatus) => {
  const entry = ERROR_HINTS[errorCode];
  if (entry) return { type: entry.type || 'error', hint: entry.hint };
  if (httpStatus === 400) return { type: 'error', hint: 'Please check that all required fields are filled in correctly.' };
  return { type: 'error', hint: '' };
};

// ── Server-side: Meteor.Error → HTTP response mapping ────────────────────────

/** Meteor.Error code → HTTP status + default message. */
export const HTTP_STATUS_MAP = {
  'unauthorized':      { status: 401, msg: 'Unauthorized' },
  'not-authorized':    { status: 401, msg: 'Not authorized' },
  'client-exists':     { status: 409, msg: 'Resource already exists' },
  'client-not-found':  { status: 404, msg: 'Resource not found' },
  'invalid-client-id': { status: 400, msg: 'Invalid client ID' },
  'user-not-found':    { status: 404, msg: 'User not found' },
  'invalid-username':  { status: 404, msg: 'Invalid username' },
  'not-found':         { status: 404, msg: 'Not found' },
  'invalid-device-id': { status: 404, msg: 'Device not found' },
  'database-error':    { status: 500, msg: 'A database error occurred. Please try again.' },
};

/**
 * Map a caught error (typically Meteor.Error) to a JSON-ready response object.
 * @param {Error} err
 * @returns {{ status: number, error: string, errorCode: string }}
 */
export const mapMeteorError = (err) => {
  if (err.isClientSafe && err.error) {
    const mapped = HTTP_STATUS_MAP[err.error];
    if (mapped) {
      return { status: mapped.status, error: err.reason || mapped.msg, errorCode: err.error };
    }
    // Unknown Meteor.Error — still use reason if available
    return { status: 400, error: err.reason || err.message, errorCode: err.error };
  }
  // Non-Meteor error — don't leak internals
  console.error('[ErrorHelper] Unexpected error:', err);
  return { status: 500, error: 'An unexpected error occurred. Please try again.', errorCode: 'server-error' };
};
