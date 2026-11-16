// Interprets the result of the notifications.handleResponse method. Shared by
// the in-app actions modal and notification tray/watch actions so neither can
// report "Approved" when the server didn't record that action.

// NotificationHistory.status values written by the server.
const STATUS_LABELS = {
  approve: "approved",
  reject: "rejected",
  timeout: "expired",
};

/**
 * @param {Object} result - Value returned by notifications.handleResponse
 * @param {"approve"|"reject"} action - Action the user took
 * @returns {String|null} User-facing error, or null when the action took effect
 */
export const getHandleResponseError = (result, action) => {
  if (result?.success === false) {
    return result.message || "Unable to process action";
  }

  // Already-handled requests come back as success with the stored status; that
  // only counts as success when it matches what the user asked for (e.g. a
  // double tap, or the same answer from another device).
  const status = result?.status;
  if (status && status !== "pending" && status !== action) {
    if (status === "timeout") {
      return "This request has expired and can no longer be answered.";
    }
    return `This request was already ${STATUS_LABELS[status] || status}.`;
  }

  return null;
};
