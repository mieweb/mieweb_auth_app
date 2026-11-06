const TOKEN_KEY = "adminToken";
const REQUEST_TIMEOUT_MS = 30 * 1000;

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

let handleUnauthorized = () => {};
/** Register the callback invoked when the server rejects the admin session. */
export const setUnauthorizedHandler = (fn) => {
  handleUnauthorized = fn;
};

export class ApiError extends Error {
  constructor(message, { status = 0, errorCode = null, retryAfterMs } = {}) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.retryAfterMs = retryAfterMs;
  }
}

export const isSessionError = (err) => err?.errorCode === "session-expired";

/**
 * JSON request to the admin REST API. Throws ApiError for network failures
 * and non-2xx responses. A 401/403 on an authenticated call ends the session
 * via the registered handler.
 */
export const api = async (path, { method = "GET", body, auth = true } = {}) => {
  // Remember which session sent this request so a late 401/403 from an old
  // session can't sign out a newer one.
  const requestToken = auth ? getToken() : null;
  let response;
  try {
    response = await fetch(path, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        ...(auth && { Authorization: `Bearer ${requestToken || ""}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError";
    throw new ApiError(
      timedOut
        ? "The server took too long to respond. Please try again."
        : "Can't reach the server. Check your connection and try again.",
      { errorCode: "network-error" },
    );
  }

  const data = await response.json().catch(() => ({}));

  if (auth && (response.status === 401 || response.status === 403)) {
    if (requestToken === getToken()) handleUnauthorized();
    throw new ApiError("Your session has expired. Please sign in again.", {
      status: response.status,
      errorCode: "session-expired",
    });
  }

  if (!response.ok) {
    throw new ApiError(
      data.error || data.message || `Request failed (${response.status})`,
      {
        status: response.status,
        errorCode: data.errorCode,
        retryAfterMs: data.retryAfterMs,
      },
    );
  }

  return data;
};

export const RESOURCES = {
  users: "/api/admin/users/list",
  devices: "/api/admin/devices/list",
  emails: "/api/admin/emails/list",
  apiKeys: "/api/admin/api-keys/list",
  duo: "/api/admin/duo/list",
  migration: "/api/admin/diagnostics/identity-migration",
};

export const diagnosticsPath = (query) =>
  query ? `/api/admin/diagnostics/user?q=${encodeURIComponent(query)}` : null;
