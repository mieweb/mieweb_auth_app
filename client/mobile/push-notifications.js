import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";

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
    },
  });
};

const setupRegistrationHandler = (push) => {
  push.on("registration", (data) => {
    Session.set("deviceToken", data.registrationId);
    Meteor.call("deviceDetails.storeFCMToken", data.registrationId);
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

    // Register handlers
    setupRegistrationHandler(push);
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
