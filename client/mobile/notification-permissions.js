import { Session } from "meteor/session";

// Session key mirroring the current OS-level push notification permission.
//   true  -> notifications are enabled
//   false -> notifications are disabled/denied
//   null  -> unknown (non-Cordova/web, or the status could not be determined)
export const PUSH_PERMISSION_SESSION_KEY = "pushPermissionEnabled";

/**
 * Reads the current OS-level push notification permission state.
 *
 * Detection reuses the already-installed push plugin (`PushNotification`), which
 * exposes `hasPermission({ isEnabled })` on both iOS and Android — so no extra
 * native permissions are pulled in just to read the status. The result is
 * mirrored into Session so the UI can react to it.
 *
 * @returns {Promise<boolean|null>} enabled state, or null when undeterminable.
 */
export const checkNotificationPermission = () =>
  new Promise((resolve) => {
    const setAndResolve = (value) => {
      Session.set(PUSH_PERMISSION_SESSION_KEY, value);
      resolve(value);
    };

    try {
      if (
        typeof PushNotification === "undefined" ||
        typeof PushNotification.hasPermission !== "function"
      ) {
        // Web / non-Cordova environment, or the plugin isn't ready yet.
        setAndResolve(null);
        return;
      }

      PushNotification.hasPermission((data) => {
        setAndResolve(!!(data && data.isEnabled));
      });
    } catch {
      setAndResolve(null);
    }
  });

/**
 * Opens the OS "app settings" screen so the user can (re)enable notifications.
 *
 * Once the OS-level permission has been denied it cannot be re-prompted from JS
 * (iOS never re-prompts; Android stops after a permanent denial), so the only
 * reliable recovery is to deep-link the user into the system settings page.
 * Uses the core module of `cordova.plugins.diagnostic` (`switchToSettings`),
 * which is available on both iOS and Android.
 *
 * @returns {Promise<void>} resolves once settings opened, rejects otherwise.
 */
export const openAppSettings = () =>
  new Promise((resolve, reject) => {
    const diagnostic = window.cordova?.plugins?.diagnostic;

    if (!diagnostic || typeof diagnostic.switchToSettings !== "function") {
      reject(
        new Error("Opening system settings is not available on this device."),
      );
      return;
    }

    diagnostic.switchToSettings(resolve, (error) => {
      reject(new Error(error || "Unable to open system settings."));
    });
  });
