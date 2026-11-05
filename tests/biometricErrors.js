import assert from "assert";
import {
  BIOMETRIC_ERROR_CODES,
  getBiometricErrorMessage,
  isBiometricPluginError,
} from "../utils/biometricErrors";

describe("biometric error messages", function () {
  const pluginError = (code, message) => ({ code, message });

  it("maps known plugin codes to actionable messages", function () {
    assert.match(
      getBiometricErrorMessage(pluginError(-106, "BIOMETRIC_NOT_ENROLLED"), {
        platform: "Android",
      }),
      /No fingerprint is set up for this profile/,
    );
    assert.match(
      getBiometricErrorMessage(
        pluginError(-104, "BIOMETRIC_HARDWARE_NOT_SUPPORTED"),
      ),
      /Biometrics aren't available on this device/,
    );
    assert.match(
      getBiometricErrorMessage(
        pluginError(-110, "BIOMETRIC_SCREEN_GUARD_UNSECURED"),
      ),
      /Set up a screen lock/,
    );
    for (const code of [-111, -112]) {
      assert.match(
        getBiometricErrorMessage(pluginError(code, "BIOMETRIC_LOCKED_OUT")),
        /Too many failed attempts/,
      );
    }
  });

  it("chooses the message by numeric code, not message text", function () {
    assert.match(
      getBiometricErrorMessage(pluginError("-106", "BIOMETRIC_DISMISSED"), {
        platform: "Android",
      }),
      /No fingerprint is set up/,
    );
    assert.strictEqual(
      getBiometricErrorMessage({ message: "BIOMETRIC_NOT_ENROLLED" }),
      "Unable to set up biometrics. Please try again or use your PIN.",
    );
  });

  it("gives platform-specific enrollment guidance for -106", function () {
    const notEnrolled = pluginError(-106, "BIOMETRIC_NOT_ENROLLED");
    const ios = getBiometricErrorMessage(notEnrolled, { platform: "iOS" });
    assert.match(ios, /Face ID or Touch ID isn't set up/);
    assert.ok(!/fingerprint|work profile|Face unlock/i.test(ios), ios);

    const unknown = getBiometricErrorMessage(notEnrolled, { platform: "" });
    assert.match(unknown, /No biometrics are set up on this device/);
    assert.ok(!/work profile|Face unlock/i.test(unknown), unknown);
  });

  it("uses context-specific wording for cancel and fallback", function () {
    const dismissed = pluginError(-108, "BIOMETRIC_DISMISSED");
    assert.strictEqual(
      getBiometricErrorMessage(dismissed, { context: "setup" }),
      "Biometric setup was cancelled.",
    );
    assert.strictEqual(
      getBiometricErrorMessage(dismissed, { context: "login" }),
      "Biometric sign-in was cancelled. Use your PIN instead.",
    );
    assert.match(
      getBiometricErrorMessage(dismissed, { context: "verify" }),
      /Enter your PIN to continue/,
    );
    assert.strictEqual(
      getBiometricErrorMessage(pluginError(-101, "BIOMETRIC_UNKNOWN_ERROR"), {
        context: "login",
      }),
      "Biometric sign-in failed. Use your PIN instead.",
    );
  });

  it("falls back safely for missing or malformed errors", function () {
    const fallback =
      "Unable to set up biometrics. Please try again or use your PIN.";
    for (const error of [
      undefined,
      null,
      "BIOMETRIC_NOT_ENROLLED",
      {},
      { code: "" },
    ]) {
      assert.strictEqual(getBiometricErrorMessage(error), fallback);
    }
  });

  it("never surfaces raw plugin enum names", function () {
    const codes = [
      -100, -101, -102, -103, -104, -105, -106, -107, -108, -109, -110, -111,
      -112, -113,
    ];
    for (const context of ["setup", "login", "verify"]) {
      for (const code of codes) {
        const message = getBiometricErrorMessage(
          pluginError(code, "BIOMETRIC_SOMETHING"),
          { context },
        );
        assert.ok(
          !/BIOMETRIC_/.test(message),
          `${context} ${code}: ${message}`,
        );
      }
    }
  });

  it("identifies plugin errors separately from server errors", function () {
    assert.strictEqual(isBiometricPluginError(pluginError(-106)), true);
    assert.strictEqual(isBiometricPluginError(pluginError("-108")), true);
    assert.strictEqual(
      isBiometricPluginError({ error: "not-authorized", reason: "Nope" }),
      false,
    );
    assert.strictEqual(isBiometricPluginError(new Error("boom")), false);
    assert.strictEqual(isBiometricPluginError(undefined), false);
  });

  it("keeps the -113 missing-secret code available for the recovery flow", function () {
    assert.strictEqual(BIOMETRIC_ERROR_CODES.SECRET_NOT_FOUND, -113);
    assert.strictEqual(
      isBiometricPluginError(
        pluginError(BIOMETRIC_ERROR_CODES.SECRET_NOT_FOUND),
      ),
      true,
    );
  });
});
