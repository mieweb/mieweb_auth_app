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
      console.warn("Session validation failed after retries");
      Session.set("notificationReceivedId", {
        appId: notification.additionalData.appId,
        status: "pending",
      });
    }
  };
  checkSession();
};

const sendUserAction = (appId, action) => {
  validateSessionWithRetry(() => {
    Meteor.call(
      "notifications.handleResponse",
      appId,
      action,
      (error, result) => {
        if (error) {
          console.error("Action failed:", error);
          Session.set("notificationReceivedId", {
            appId,
            status: "error",
            error: error.message,
          });
        } else {
          Session.set("notificationReceivedId", {
            appId,
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
    (error) => {},
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

const setupNotificationHandler = (push) => {
  push.on("notification", (notification) => {
    Meteor.startup(() => {
      const additionalData = notification.additionalData || {};

      // Cold start handling
      if (additionalData.coldstart) {
        setTimeout(() => {
          if (additionalData.action && additionalData.appId) {
            validateSessionWithRetry(() => {
              sendUserAction(additionalData.appId, additionalData.action);
            });
          }
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
    console.error("Push system error:", error);
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
