import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { ReactiveVar } from "meteor/reactive-var";
import { Session } from "meteor/session";
import { Tracker } from "meteor/tracker";
import { IOS_APPROVAL_CATEGORIES } from "../../utils/constants.js";
import {
  canSendTrayAction,
  enqueueTrayAction,
  hasTrayAction,
  removeTrayAction,
  resolveTrayActionOutcome,
  updateTrayAction,
} from "../../utils/trayAction.js";
import { completePushMigration, signOperation } from "./identity-migration.js";
import { wipeLocalCredentialsAndLogout } from "./local-session.js";

// Notification actions (tray / lock screen / watch) waiting to be sent.
// Opening the app from the action fires `resume`, which triggers the
// screen-lock logout (useSessionTimeout). Actions are therefore queued and
// only sent once the user is really logged in; if the logout still wins the
// race the server answers `not-authenticated` and the action is re-sent after
// the user re-authenticates (issue #552). One entry per notification, sent
// one at a time in tap order.
const PENDING_TRAY_ACTIONS_KEY = "pendingTrayActions";
const trayActionInFlight = new ReactiveVar(false);

const getTrayActionQueue = () => Session.get(PENDING_TRAY_ACTIONS_KEY) || [];

const queueTrayAction = (userId, action, notificationId) => {
  Session.set("actionPerformedFromTray", true);
  Session.set(
    PENDING_TRAY_ACTIONS_KEY,
    enqueueTrayAction(getTrayActionQueue(), {
      userId,
      action,
      notificationId,
      queuedAt: new Date().getTime(),
      authRetries: 0,
    }),
  );
};

const dispatchTrayAction = async (pending) => {
  const { userId, action, notificationId } = pending;
  trayActionInFlight.set(true);

  const deviceUUID = Session.get("capturedDeviceInfo")?.uuid || null;
  // Phase 5: sign the exact notification + action with the installation
  // key. Null when unavailable — server accepts that until enforcement.
  const identityProof = await signOperation(`${notificationId}:${action}`);

  Meteor.call(
    "notifications.handleResponse",
    userId,
    action,
    notificationId,
    deviceUUID,
    identityProof,
    (error, result) => {
      const queue = getTrayActionQueue();
      // A newer action for the same notification replaced this one while the
      // call was in flight; the replacement is dispatched next.
      if (!hasTrayAction(queue, pending)) {
        trayActionInFlight.set(false);
        return;
      }

      const outcome = resolveTrayActionOutcome({
        error,
        result,
        action,
        authRetries: pending.authRetries,
      });

      if (outcome.type === "retry") {
        // Keep the action queued; the dispatcher re-sends it after login.
        Session.set(
          PENDING_TRAY_ACTIONS_KEY,
          updateTrayAction(queue, pending, {
            authRetries: pending.authRetries + 1,
          }),
        );
        trayActionInFlight.set(false);
        return;
      }

      const remaining = removeTrayAction(queue, pending);
      Session.set(PENDING_TRAY_ACTIONS_KEY, remaining);
      if (remaining.length === 0) {
        // Clear the flag so future notifications can open the modal
        Session.set("actionPerformedFromTray", false);
      }
      // Clear any stale persisted notification so a later resume event
      // doesn't reopen the modal for an already-handled notification.
      try {
        localStorage.removeItem("pendingNotification");
      } catch {}

      if (outcome.type === "error") {
        // Surface the error to the UI layer so it can fall back to the modal
        Session.set("trayActionResult", {
          notificationId,
          action,
          status: "error",
          error: outcome.message,
        });
      } else {
        Session.set("trayActionResult", {
          notificationId,
          action,
          status: action === "approve" ? "approved" : "rejected",
          timestamp: new Date().getTime(),
        });
      }
      trayActionInFlight.set(false);
    },
  );
};

const setupTrayActionDispatcher = () => {
  Tracker.autorun(() => {
    const [next] = getTrayActionQueue();
    if (!next || trayActionInFlight.get()) return;

    const ready = canSendTrayAction({
      userId: Meteor.userId(),
      loggingIn: Meteor.loggingIn(),
      loggingOut: Meteor.loggingOut(),
      hasProfile: !!Session.get("userProfile"),
    });
    if (!ready) return;

    Tracker.nonreactive(() => dispatchTrayAction(next));
  });

  // A tray result from the previous session must not resurface (as a stale
  // error modal) after the user logs back in.
  Accounts.onLogout(() => Session.set("trayActionResult", null));
};

const createNotificationChannel = () => {
  // Notification channels are an Android-only concept. Calling createChannel on
  // iOS throws "Method 'createChannel:' not defined" — skip it there. Only
  // proceed when we can positively identify Android (device may be undefined
  // before Cordova is ready or in a non-Cordova environment).
  if (typeof device === "undefined" || device.platform !== "Android") return;
  PushNotification.createChannel(
    () => {},
    () => {},
    {
      id: "default",
      name: "Approval Channel",
      description: "Critical security approvals",
      importance: 4,
      vibration: true,
      sound: "default",
      visibility: 1,
      lights: true,
      lightColor: "#FF4081",
    },
  );
};

const configurePushNotifications = () => {
  return PushNotification.init({
    android: {
      forceShow: true,
      clearNotifications: false,
      icon: "ic_launcher",
      iconColor: "#4CAF50",
      priority: "high",
      sound: true,
      vibrate: true,
      channel: {
        id: "default",
        importance: "high",
        sound: "default",
        vibration: true,
      },
    },
    ios: {
      alert: true,
      badge: true,
      sound: true,
      priority: "high",
      foreground: true,
      // Reset the app-icon badge on launch — the landing page shows any
      // pending requests right away, so a lingering badge is always stale.
      clearBadge: true,
      // NOTE: `forceShow` must stay OFF. With forceShow the plugin only shows
      // the OS banner for foreground pushes and does NOT dispatch them to the
      // JS `notification` handler until tapped (see PushPlugin.m
      // willPresentNotification), which breaks the auto-opening approve/reject
      // actions modal. Foreground pushes are surfaced in-app instead.
      // Statically register the APPROVAL category so its action buttons are
      // rendered by the system — including when the notification is mirrored to
      // a paired Apple Watch. The watch only shows actions that come from a
      // statically registered UNNotificationCategory; runtime/payload actions
      // are ignored on the wrist. The category id must match aps.category
      // ("APPROVAL") set by the server, and each action's `callback` must match
      // the push.on("approve"/"reject") handlers so a tap (from phone OR watch)
      // routes back through the same handler.
      categories: IOS_APPROVAL_CATEGORIES,
    },
  });
};

const setupRegistrationHandler = (push) => {
  push.on("registration", (data) => {
    Session.set("deviceToken", data.registrationId);
  });
};

// Last (user, device, token) combination successfully sent to the server, so
// the autorun below doesn't repeat the call on unrelated reactive changes.
let lastReconciledKey = null;

// Keep the server's stored FCM token in sync with the live one. Tokens rotate
// (reinstall, OS restore, Firebase refresh) and a stale stored token means
// pushes silently stop. Reactive on login state, captured device info and the
// token itself, so it works regardless of which becomes available first.
const setupTokenReconciliation = () => {
  Tracker.autorun(() => {
    const userId = Meteor.userId();
    const fcmToken = Session.get("deviceToken");
    const deviceUUID = Session.get("capturedDeviceInfo")?.uuid;

    if (!userId || !fcmToken || !deviceUUID) return;

    const key = `${userId}:${deviceUUID}:${fcmToken}`;
    if (key === lastReconciledKey) return;
    lastReconciledKey = key;

    signOperation(`updateFCMToken:${deviceUUID}:${fcmToken}`).then(
      (identityProof) => {
        Meteor.call(
          "devices.updateFCMToken",
          { deviceUUID, fcmToken, identityProof },
          (error) => {
            if (error) {
              // Allow a retry on the next reactive change (e.g. re-login).
              lastReconciledKey = null;
              console.warn(
                "FCM token reconciliation failed:",
                error.reason || error.message,
              );
            }
          },
        );
      },
    );
  });
};

const handleActionFromTray = (push, action, data) => {
  const additionalData = data.additionalData || {};
  const userId = additionalData.userId;
  const notificationId = additionalData.notificationId;

  // Both fields are required for the server to identify the exact pending
  // notification and verify the caller's ownership. If either is missing the
  // payload is malformed — bail out so the existing modal flow can recover.
  if (!userId || !notificationId) {
    console.warn(
      "Tray action received without userId/notificationId; skipping.",
    );
    return;
  }

  // Sent by the dispatcher once the user is logged in — immediately when the
  // app is already unlocked, or after re-authentication on cold start / resume.
  queueTrayAction(userId, action, notificationId);

  push.finish(
    () => {},
    () => {},
    additionalData.notId,
  );
};

const setupActionHandlers = (push) => {
  push.on("approve", (data) => {
    handleActionFromTray(push, "approve", data);
  });

  push.on("reject", (data) => {
    handleActionFromTray(push, "reject", data);
  });
};

const setupNotificationHandler = (push) => {
  push.on("notification", (notification) => {
    Meteor.startup(() => {
      const additionalData = notification.additionalData || {};

      // Data-only identity-migration challenge — handled silently, no UI.
      if (additionalData.notificationType === "migration_challenge") {
        completePushMigration(additionalData);
        return;
      }

      // This device was revoked from the account (via My Devices on another
      // device or by an admin). Wipe local credentials and sign out — the
      // server has already deleted this device's record and invalidated its
      // sessions, so this is a cleanup courtesy for the user.
      if (additionalData.notificationType === "device_revoked") {
        wipeLocalCredentialsAndLogout();
        return;
      }

      // Informational device-trust pushes (primary changed, device added,
      // device-removed notice). When the app is OPEN, iOS shows no banner for
      // foreground pushes (forceShow is deliberately off), so surface an
      // in-app toast; backgrounded devices already got the OS banner.
      if (
        [
          "primary_changed",
          "device_added_info",
          "device_removed_info",
        ].includes(additionalData.notificationType)
      ) {
        if (additionalData.foreground) {
          Session.set("deviceTrustNotice", {
            message:
              notification.message ||
              additionalData.body ||
              "Your device settings changed.",
            timestamp: new Date().getTime(),
          });
        }
        return;
      }

      // Test notification received while the app is in the foreground.
      // Foreground pushes are delivered straight to this handler (no OS
      // banner, since forceShow is off), so surface an in-app toast that
      // explains what happened instead of silently swallowing the push.
      if (
        additionalData.notificationType === "test" &&
        additionalData.foreground
      ) {
        Session.set("testNotificationForeground", {
          timestamp: new Date().getTime(),
        });
        return;
      }

      // Skip if action was already handled from the notification tray. Do NOT
      // clear the flag here — the tray action may still be queued (waiting for
      // re-login) or in flight, and clearing early can let the resume/tracker
      // paths reopen the actions modal for the same notification. The
      // dispatcher clears the flag once the server call settles. Checked after
      // the revoke/info handlers above so those are never suppressed.
      if (Session.get("actionPerformedFromTray")) {
        return;
      }

      // Cold start handling — if the server attached an explicit action to the
      // notification body (rare; main flow uses dedicated approve/reject
      // events), forward it. Requires both userId and notificationId.
      if (
        additionalData.coldstart &&
        additionalData.action &&
        additionalData.userId &&
        additionalData.notificationId
      ) {
        queueTrayAction(
          additionalData.userId,
          additionalData.action,
          additionalData.notificationId,
        );
      }

      // Standard notification handling
      if (additionalData.appId) {
        Session.set("notificationReceivedId", {
          appId: additionalData.appId,
          status: "pending",
          rawData: JSON.stringify(additionalData),
          timestamp: new Date().getTime(),
        });
      }
    });
  });
};

const setupErrorHandler = (push) => {
  push.on("error", (error) => {
    Session.set("pushError", {
      message: error.message,
      code: error.code,
      details: JSON.stringify(error),
    });
  });
};

// Set once the plugin is initialised (Cordova only); stays null elsewhere so
// clearNotificationBadge is a no-op on web and in the browser during dev.
let pushInstance = null;

/**
 * Reset the iOS app-icon badge. Called when the app is opened or resumed, so a
 * badge can never outlive the requests it counted — even if the server's sync
 * push was missed while the device was offline.
 */
export const clearNotificationBadge = () => {
  if (!pushInstance?.setApplicationIconBadgeNumber) return;
  pushInstance.setApplicationIconBadgeNumber(
    () => {},
    () => {},
    0,
  );
};

// The native plugin only reports to the latest init() instance, so every
// (re)init must attach the full set of handlers.
const registerPush = () => {
  const push = configurePushNotifications();
  pushInstance = push;
  setupRegistrationHandler(push);
  setupActionHandlers(push);
  setupNotificationHandler(push);
  setupErrorHandler(push);
};

// Re-shows the OS prompt when still allowed and fetches the FCM token once granted.
export const requestPushRegistration = () => {
  try {
    registerPush();
  } catch (error) {
    Session.set("pushInitError", error.toString());
  }
};

export const initializePushNotifications = () => {
  try {
    // Android channel setup
    createNotificationChannel();

    // Before registerPush so a cold-start action finds the dispatcher ready.
    setupTrayActionDispatcher();
    registerPush();
    console.log(
      `[PushPlugin] init complete — registered iOS categories: ${Object.keys(
        IOS_APPROVAL_CATEGORIES,
      ).join(", ")}`,
    );

    setupTokenReconciliation();

    // Ensure default channel exists every 30 seconds
    setInterval(() => {
      createNotificationChannel();
    }, 30000);
  } catch (error) {
    Session.set("pushInitError", error.toString());
  }
};
