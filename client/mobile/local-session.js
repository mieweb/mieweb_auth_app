import { Meteor } from "meteor/meteor";

// Credentials this device caches for the signed-in account.
const LOCAL_CREDENTIAL_KEYS = [
  "biometricsEnabled",
  "biometricUserId",
  "lastLoggedInEmail",
  "pendingNotification",
];

/**
 * Clear this device's cached credentials and return to the start screen.
 * Used whenever the account or device no longer exists server-side (revoked
 * device, self-service account deletion).
 */
export const wipeLocalCredentialsAndLogout = () => {
  LOCAL_CREDENTIAL_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  });
  Meteor.logout(() => window.location.replace("/"));
};
