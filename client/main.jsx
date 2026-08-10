import React from "react";
import { createRoot } from "react-dom/client";
import { Meteor } from "meteor/meteor";
import { Reload } from "meteor/reload";
import "./main.css";
import { App } from "./mobile/src/ui/App";
import { captureDeviceInfo } from "./mobile/capture-device-info";
import { initializeBiometrics } from "./mobile/biometrics";
import { initializeDeepLinks } from "./mobile/deep-links";
import { initializePushNotifications } from "./mobile/push-notifications";
import { checkNotificationPermission } from "./mobile/notification-permissions";
import { initializeDiagnostics } from "./mobile/diagnostics";

// During a hot code push the WebView is fully reloaded while the new bundle
// loads. Without covering that gap the user sees a blank/black screen. Show the
// native splash screen right before the reload so the transition stays branded.
// Note: navigator.splashscreen.show() is only supported on iOS — on Android the
// splashscreen plugin no longer supports programmatic show(), so we skip it.
if (Meteor.isCordova) {
  Reload._onMigrate(() => {
    if (
      window.cordova?.platformId === "ios" &&
      typeof navigator !== "undefined" &&
      navigator.splashscreen?.show
    ) {
      navigator.splashscreen.show();
    }
    return [true];
  });
}

Meteor.startup(() => {
  const container = document.getElementById("react-target");
  const root = createRoot(container);

  if (Meteor.isCordova) {
    document.addEventListener(
      "deviceready",
      () => {
        captureDeviceInfo();
        initializeBiometrics();
        initializeDeepLinks();
        initializePushNotifications();
        initializeDiagnostics();
        // Record whether the OS-level notification permission is granted so the
        // UI can prompt the user to re-enable it if they denied/dismissed it.
        checkNotificationPermission();
      },
      false,
    );

    // Re-check on resume so returning from the system settings screen (or any
    // change made while backgrounded) is reflected in the app.
    document.addEventListener(
      "resume",
      () => {
        checkNotificationPermission();
      },
      false,
    );
  } else {
    // non-Cordova environment – skip device capture and push notifications
  }

  root.render(<App />);
});
