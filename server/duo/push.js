import { Meteor } from "meteor/meteor";
import { Random } from "meteor/random";
import { sendNotification } from "../firebase.js";
import { approvedDevices } from "./users.js";
import { TIMEOUT_DURATION_MS } from "../../utils/constants.js";

/**
 * Select which of a subject's approved devices should receive the push.
 *
 * Duo's `device` parameter:
 *   - "auto" (or absent): target all approved devices.
 *   - a specific device id: match against our appId or deviceUUID.
 *
 * @returns {Array} selected device sub-documents
 */
export const selectDevices = (subject, device = "auto") => {
  const devices = approvedDevices(subject);
  if (!device || device === "auto") {
    return devices;
  }
  return devices.filter((d) => d.appId === device || d.deviceUUID === device);
};

/**
 * Send a Duo push to the subject's selected device(s) and wait for the user's
 * response. Mirrors the /send-notification push-and-wait flow but is invoked
 * in-process.
 *
 * @param {Object} o
 * @param {Object} o.subject          resolved Duo user (see users.js)
 * @param {string} o.device           Duo device id or "auto"
 * @param {string} o.type             optional "type" string shown to the user
 * @param {string} o.displayUsername  optional display username
 * @param {string} o.pushinfo         optional URL-encoded key/value info
 * @returns {Promise<{result: string, status: string, status_msg: string}>}
 */
export const sendPushAndWait = async ({
  subject,
  device = "auto",
  type = "Login Request",
  displayUsername,
  pushinfo,
}) => {
  const username = subject?.username;
  if (!username) {
    return {
      result: "deny",
      status: "deny",
      status_msg: "User has no account to receive a push.",
    };
  }

  const targets = selectDevices(subject, device);
  const fcmTokens = targets.map((d) => d.fcmToken).filter(Boolean);

  if (fcmTokens.length === 0) {
    return {
      result: "deny",
      status: "no_devices",
      status_msg: "No approved devices are available to receive a push.",
    };
  }

  const title = type || "Login Request";
  const who = displayUsername || username;
  const body = pushinfo
    ? `Approve login for ${who} (${decodeURIComponent(pushinfo)})`
    : `Approve login for ${who}`;

  // Pre-create notification history so tray actions can be correlated.
  const primary = targets.find((d) => d.isPrimary) || targets[0];
  let notificationId = null;
  try {
    notificationId = await Meteor.callAsync("notificationHistory.insert", {
      userId: subject.meteorUserId || username,
      title,
      body,
      appId: primary?.appId,
      clientId: "duo",
    });
  } catch (e) {
    console.error("[duo] failed to create notification history:", e);
  }

  const notificationData = {
    appId: primary?.appId,
    userId: subject.meteorUserId || username,
    notificationId,
    messageFrom: "mie",
    notificationType: "approval",
    content_available: "1",
    forceStart: "1",
    priority: "high",
    notId: "10",
    isDismissal: "false",
    isSync: "false",
    actions: JSON.stringify([
      { callback: "approve", title: "Approve", foreground: true },
      { callback: "reject", title: "Reject", foreground: true },
    ]),
    click_action: "FLUTTER_NOTIFICATION_CLICK",
    sound: "default",
    platform: "both",
    timestamp: new Date().toISOString(),
  };

  // Fan out the push to every targeted device.
  const sends = fcmTokens.map((token) =>
    sendNotification(token, title, body, notificationData).catch((err) => {
      console.error("[duo] push send failed for a device:", err?.message);
      return null;
    }),
  );
  const results = await Promise.all(sends);
  if (results.every((r) => r === null)) {
    if (notificationId) {
      await Meteor.callAsync(
        "notificationHistory.updateStatus",
        notificationId,
        "timeout",
      ).catch(() => {});
    }
    return {
      result: "deny",
      status: "deny",
      status_msg: "Unable to deliver the push notification.",
    };
  }

  // Create and wait on the pending response (keyed by username).
  const requestId = Random.id();
  await Meteor.callAsync(
    "pendingResponses.create",
    username,
    requestId,
    TIMEOUT_DURATION_MS,
  );

  const action = await Meteor.callAsync(
    "pendingResponses.waitForResponse",
    username,
    requestId,
    TIMEOUT_DURATION_MS,
  );

  if (action === "approve") {
    return {
      result: "allow",
      status: "allow",
      status_msg: "Success. Logging you in...",
    };
  }
  if (action === "reject") {
    return {
      result: "deny",
      status: "deny",
      status_msg: "Login request denied.",
    };
  }
  // timeout / unknown
  return {
    result: "deny",
    status: "timeout",
    status_msg: "Authentication request timed out.",
  };
};
