// Decision logic for approve/reject actions tapped on a push notification
// (tray, lock screen, or watch). Kept free of Meteor/Cordova globals so it can
// be unit-tested; client/mobile/push-notifications.js wires it up.
import { getHandleResponseError } from "./notificationResponse.js";

// How many times a queued action is re-sent after the server reports the
// connection was not logged in (e.g. the resume logout won the race).
export const MAX_TRAY_ACTION_AUTH_RETRIES = 2;

// Only send once the DDP connection is really authenticated and the app's own
// login flow (registration/device approval checks) has finished — the cached
// Session profile alone can outlive the server session during a logout.
export const canSendTrayAction = ({
  userId,
  loggingIn,
  loggingOut,
  hasProfile,
}) => Boolean(userId) && !loggingIn && !loggingOut && Boolean(hasProfile);

export const isNotAuthenticatedError = (error) =>
  error?.error === "not-authenticated";

// Pending tray actions form a FIFO queue with at most one entry per
// notification: actions for different requests are all kept, while a newer
// action for the same request replaces the older one (the user's latest
// answer wins). Entries are matched by notificationId + queuedAt so a result
// for a replaced entry can't touch its replacement.
const isSameEntry = (a, b) =>
  a.notificationId === b.notificationId && a.queuedAt === b.queuedAt;

export const enqueueTrayAction = (queue = [], entry) => {
  const existing = queue.findIndex(
    (e) => e.notificationId === entry.notificationId,
  );
  if (existing === -1) return [...queue, entry];
  return queue.map((e, i) => (i === existing ? entry : e));
};

export const removeTrayAction = (queue = [], entry) =>
  queue.filter((e) => !isSameEntry(e, entry));

export const updateTrayAction = (queue = [], entry, changes) =>
  queue.map((e) => (isSameEntry(e, entry) ? { ...e, ...changes } : e));

export const hasTrayAction = (queue = [], entry) =>
  queue.some((e) => isSameEntry(e, entry));

/**
 * Classify the result of notifications.handleResponse for a queued action.
 * @returns {{type: "retry"} | {type: "error", message: string} | {type: "success"}}
 */
export const resolveTrayActionOutcome = ({
  error,
  result,
  action,
  authRetries = 0,
}) => {
  if (
    isNotAuthenticatedError(error) &&
    authRetries < MAX_TRAY_ACTION_AUTH_RETRIES
  ) {
    return { type: "retry" };
  }

  if (error) {
    return {
      type: "error",
      message: error.message || error.reason || String(error),
    };
  }

  const resultError = getHandleResponseError(result, action);
  if (resultError) {
    return { type: "error", message: resultError };
  }

  return { type: "success" };
};
