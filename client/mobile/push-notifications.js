import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { Tracker } from "meteor/tracker";
import { IOS_APPROVAL_CATEGORIES } from "../../utils/constants.js";

// Session validation with retry logic
const validateSessionWithRetry = (callback, retries = 3, interval = 1000) => {
  let attempts = 0;
  const checkSession = () => {
    if (Session.get("userProfile")) {
      callback();
    } else if (attempts < retries) {
      attempts++;
      setTimeout(checkSession, interval);
    } else {
      Session.set("notificationReceivedId", {
        appId: notification.additionalData.appId,
        status: "pending",
      });
    }
  };
  checkSession();
};

const sendUserAction = (userId, action, notificationId, deviceUUID) => {
  validateSessionWithRetry(() => {
    Meteor.call(
      "notifications.handleResponse",
      userId,
      action,
      notificationId,
      deviceUUID,
      (error, result) => {
        // Clear the in-flight flag so future notifications can open the modal
        Session.set("actionPerformedFromTray", false);
        // Clear any stale persisted notification so a later resume event
        // doesn't reopen the modal for an already-handled notification.
        try {
          localStorage.removeItem("pendingNotification");
        } catch {}

        // Treat both transport errors and server-returned { success: false }
        // as failures — otherwise the success modal lies when the server
        // couldn't find/update the notification (e.g. expired or missing).
        const failed = error || (result && result.success === false);

        if (failed) {
          const errorMsg = error
            ? error.message || error.reason || String(error)
            : result.message || "Unable to process action";
          // Surface the error to the UI layer so it can fall back to the modal
          Session.set("trayActionResult", {
            notificationId,
            action,
            status: "error",
            error: errorMsg,
          });
        } else {
          Session.set("trayActionResult", {
            notificationId,
            action,
            status: action === "approve" ? "approved" : "rejected",
            timestamp: new Date().getTime(),
          });
        }
      },
    );
  });
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

    Meteor.call("devices.updateFCMToken", { deviceUUID, fcmToken }, (error) => {
      if (error) {
        // Allow a retry on the next reactive change (e.g. re-login).
        lastReconciledKey = null;
        console.warn(
          "FCM token reconciliation failed:",
          error.reason || error.message,
        );
      }
    });
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

  const deviceUUID = Session.get("capturedDeviceInfo")?.uuid || null;

  Session.set("actionPerformedFromTray", true);

  if (additionalData.coldstart) {
    // sendUserAction internally wraps the Meteor call in validateSessionWithRetry,
    // so we only need a short delay to give the app a chance to boot. A second
    // outer retry loop here would just multiply the wait time.
    setTimeout(() => {
      sendUserAction(userId, action, notificationId, deviceUUID);
    }, 2000);
  } else {
    sendUserAction(userId, action, notificationId, deviceUUID);
  }

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

      // Skip if action was already handled from the notification tray. Do NOT
      // clear the flag here — the tray-action request may still be in flight,
      // and clearing early can let the resume/tracker paths reopen the actions
      // modal for the same notification. The sendUserAction callback clears
      // the flag once the server call settles.
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
        const deviceUUID = Session.get("capturedDeviceInfo")?.uuid || null;
        setTimeout(() => {
          validateSessionWithRetry(() => {
            sendUserAction(
              additionalData.userId,
              additionalData.action,
              additionalData.notificationId,
              deviceUUID,
            );
          });
        }, 2000);
      }

      // This device was revoked from the account (via My Devices on another
      // device or by an admin). Wipe local credentials and sign out — the
      // server has already deleted this device's record and invalidated its
      // sessions, so this is a cleanup courtesy for the user.
      if (additionalData.notificationType === "device_revoked") {
        [
          "biometricsEnabled",
          "biometricUserId",
          "lastLoggedInEmail",
          "pendingNotification",
        ].forEach((key) => {
          try {
            localStorage.removeItem(key);
          } catch {}
        });
        Meteor.logout(() => {
          window.location.replace("/");
        });
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

export const initializePushNotifications = () => {
  try {
    // Android channel setup
    createNotificationChannel();

    // Initialize push service
    const push = configurePushNotifications();
    console.log(
      `[PushPlugin] init complete — registered iOS categories: ${Object.keys(
        IOS_APPROVAL_CATEGORIES,
      ).join(", ")}`,
    );

    // Register handlers
    setupRegistrationHandler(push);
    setupTokenReconciliation();
    setupActionHandlers(push);
    setupNotificationHandler(push);
    setupErrorHandler(push);

    // Ensure default channel exists every 30 seconds
    setInterval(() => {
      createNotificationChannel();
    }, 30000);
  } catch (error) {
    Session.set("pushInitError", error.toString());
  }
};
