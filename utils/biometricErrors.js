// Numeric error codes returned by cordova-plugin-fingerprint-aio as
// `{ code, message }`. `message` is often just the enum name (e.g.
// "BIOMETRIC_NOT_ENROLLED"), so never show it to users — map by code.
export const BIOMETRIC_ERROR_CODES = Object.freeze({
  HARDWARE_NOT_SUPPORTED: -104,
  NOT_ENROLLED: -106,
  DISMISSED: -108,
  SCREEN_GUARD_UNSECURED: -110,
  LOCKED_OUT: -111,
  LOCKED_OUT_PERMANENT: -112,
  SECRET_NOT_FOUND: -113,
});

// Android only accepts Class 3 (fingerprint) biometrics with this plugin, while
// iOS supports Face ID and Touch ID, so enrollment guidance differs by platform.
const NOT_ENROLLED_MESSAGES = {
  android:
    "No fingerprint is set up for this profile. Add one in Settings. If this app is in a work profile, enable biometrics for work apps. Face unlock alone isn't supported. You can keep using your PIN.",
  ios: "Face ID or Touch ID isn't set up on this device. Turn it on in Settings, then try again. You can keep using your PIN.",
  default:
    "No biometrics are set up on this device. Add them in Settings, then try again. You can keep using your PIN.",
};

const SHARED_MESSAGES = {
  [BIOMETRIC_ERROR_CODES.HARDWARE_NOT_SUPPORTED]:
    "Biometrics aren't available on this device, or they're disabled by your organization. You can keep using your PIN.",
  [BIOMETRIC_ERROR_CODES.SCREEN_GUARD_UNSECURED]:
    "Set up a screen lock (PIN, pattern, or password) on this device first.",
  [BIOMETRIC_ERROR_CODES.LOCKED_OUT]:
    "Too many failed attempts. Unlock your device with its PIN, then try again.",
  [BIOMETRIC_ERROR_CODES.LOCKED_OUT_PERMANENT]:
    "Too many failed attempts. Unlock your device with its PIN, then try again.",
};

const CONTEXT_MESSAGES = {
  setup: {
    dismissed: "Biometric setup was cancelled.",
    fallback: "Unable to set up biometrics. Please try again or use your PIN.",
  },
  login: {
    dismissed: "Biometric sign-in was cancelled. Use your PIN instead.",
    fallback: "Biometric sign-in failed. Use your PIN instead.",
  },
  verify: {
    dismissed:
      "Biometric verification was cancelled. Enter your PIN to continue.",
    fallback: "Biometric verification failed. Enter your PIN to continue.",
  },
};

const getErrorCode = (error) => {
  const raw = error?.code;
  if (raw === undefined || raw === null || raw === "") return null;
  const code = Number(raw);
  return Number.isInteger(code) ? code : null;
};

/**
 * True when `error` came from the fingerprint plugin (negative numeric code),
 * as opposed to a Meteor/server error raised later in the same flow.
 */
export const isBiometricPluginError = (error) => {
  const code = getErrorCode(error);
  return code !== null && code < 0;
};

// cordova-plugin-device exposes a global `device`; absent outside Cordova.
const getDevicePlatform = () =>
  typeof device !== "undefined" ? device?.platform : undefined;

/**
 * User-facing message for a fingerprint plugin error, chosen by numeric code.
 * @param {*} error plugin error (`{ code, message }`), string, or undefined
 * @param {{ context?: "setup" | "login" | "verify", platform?: string }} [options]
 *   `platform` defaults to the Cordova `device.platform` ("Android" / "iOS").
 */
export const getBiometricErrorMessage = (
  error,
  { context = "setup", platform = getDevicePlatform() } = {},
) => {
  const messages = CONTEXT_MESSAGES[context] || CONTEXT_MESSAGES.setup;
  const code = getErrorCode(error);

  if (code === BIOMETRIC_ERROR_CODES.DISMISSED) return messages.dismissed;
  if (code === BIOMETRIC_ERROR_CODES.NOT_ENROLLED) {
    const key = String(platform || "").toLowerCase();
    return NOT_ENROLLED_MESSAGES[key] || NOT_ENROLLED_MESSAGES.default;
  }
  return SHARED_MESSAGES[code] || messages.fallback;
};
