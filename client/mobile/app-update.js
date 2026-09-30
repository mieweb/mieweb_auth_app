import { Session } from "meteor/session";

// true once the server has a release this native build can't hot-code-push to.
export const APP_UPDATE_SESSION_KEY = "appUpdateAvailable";

// Reported by cordova-plugin-meteor-webapp (Android and iOS) when a new release
// changes Cordova plugins/platform, so it must come from the app store instead.
const INCOMPATIBLE_RELEASE_MESSAGE =
  "Cordova platform version or plugin versions have changed";

export const initializeAppUpdateCheck = () => {
  window.WebAppLocalServer?.onError((error) => {
    console.warn("[AppUpdate] Hot code push skipped:", error.message);
    if (error.message.includes(INCOMPATIBLE_RELEASE_MESSAGE)) {
      Session.set(APP_UPDATE_SESSION_KEY, true);
    }
  });
};
