/**
 * Duo Auth API response envelopes and error codes.
 *
 * Every Duo API response is a JSON object of the form:
 *   success: { "stat": "OK",   "response": { ... } }
 *   failure: { "stat": "FAIL", "code": <int>, "message": "...",
 *              "message_detail": "..." }
 *
 * The HTTP status code returned to the client is the first three digits of
 * the Duo error `code` (e.g. 40101 -> HTTP 401, 40002 -> HTTP 400).
 */

/**
 * Canonical Duo error codes we emit. Each maps to a default human message.
 * First three digits double as the HTTP status.
 */
export const DUO_ERRORS = {
  INVALID_REQUEST: { code: 40002, message: "Invalid request parameters" },
  MISSING_PARAM: {
    code: 40001,
    message: "Missing required request parameters",
  },
  UNSUPPORTED_FACTOR: {
    code: 40002,
    message: "The provided factor is not supported",
  },
  UNAUTHORIZED: { code: 40101, message: "Missing request credentials" },
  INVALID_SIGNATURE: {
    code: 40103,
    message: "Invalid signature in request credentials",
  },
  INVALID_IKEY: {
    code: 40102,
    message: "Invalid integration key in request credentials",
  },
  NOT_FOUND: { code: 40401, message: "Resource not found" },
  ENROLL_USERNAME_TAKEN: {
    code: 40002,
    message: "Username already exists",
  },
  USER_NOT_FOUND: { code: 40002, message: "User does not exist" },
  NO_DEVICES: { code: 40002, message: "User has no enrolled devices" },
  RATE_LIMITED: { code: 42901, message: "Too many requests" },
  SERVER_ERROR: { code: 50000, message: "Internal server error" },
};

/** Derive an HTTP status code from a Duo error code. */
export const httpStatusForCode = (code) => {
  const prefix = parseInt(String(code).slice(0, 3), 10);
  return Number.isNaN(prefix) ? 500 : prefix;
};

/** Build a Duo success envelope. */
export const ok = (response = {}) => ({ stat: "OK", response });

/** Build a Duo failure envelope. */
export const fail = (errorDef, messageDetail) => {
  const body = {
    stat: "FAIL",
    code: errorDef.code,
    message: errorDef.message,
  };
  if (messageDetail !== undefined && messageDetail !== null) {
    body.message_detail = String(messageDetail);
  }
  return body;
};

/**
 * Write a JSON Duo response to a connect/http ServerResponse.
 * @param {ServerResponse} res
 * @param {number} status  HTTP status code
 * @param {Object} body    already-built Duo envelope
 */
export const sendDuo = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
};

/** Convenience: write a success envelope with HTTP 200. */
export const sendOk = (res, response = {}) => sendDuo(res, 200, ok(response));

/** Convenience: write a failure envelope, deriving HTTP status from the code. */
export const sendFail = (res, errorDef, messageDetail) =>
  sendDuo(res, httpStatusForCode(errorDef.code), fail(errorDef, messageDetail));
