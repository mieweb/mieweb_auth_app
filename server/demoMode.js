import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { check, Match } from "meteor/check";
import { Random } from "meteor/random";
import { DeviceDetails } from "../utils/api/deviceDetails.js";
import { DeviceAuditLog } from "./deviceManagement.js";

/**
 * TEMPORARY — App Store review workaround (Guideline 2.1).
 *
 * The normal flow binds an account to a device that an administrator must
 * approve, so a reviewer can never reach the dashboard with shared
 * credentials. When DEMO_MODE is on, the allowlisted demo account may sign in
 * with its password from any device and that device is linked to it on the
 * spot, giving the reviewer a working end-to-end demo (including push).
 *
 * KILL SWITCH: unset DEMO_MODE (or set it to anything but "true"). Every
 * method here then refuses, the seeded account stops being maintained, and
 * the standard registration-gated flow is restored with no client change and
 * no resubmission. Do this as soon as the app is approved — the demo
 * credentials are published in App Store Connect, so while the flag is on
 * anyone who downloads the app can sign in as the demo user.
 */

export const isDemoModeEnabled = () => process.env.DEMO_MODE === "true";

// DEMO_MODE alone is enough to get a working review account; the allowlist is
// only there so the address can be changed without a code edit.
const DEFAULT_DEMO_EMAIL = "demo@example.com";

const demoEmails = () => {
  const configured = (process.env.DEMO_ACCOUNT_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? configured : [DEFAULT_DEMO_EMAIL];
};

const isDemoEmail = (email) =>
  !!email && demoEmails().includes(email.trim().toLowerCase());

const demoPin = () => process.env.DEMO_ACCOUNT_PIN || "000000";

// The demo credentials are public while review is running, so the device list
// is capped rather than growing one entry per curious installer. Keeping more
// than one means a stranger signing in cannot knock the reviewer's device off
// mid-review.
const MAX_DEMO_DEVICES = 3;

// Meteor masks "user not found" and "incorrect password" behind one ambiguous
// message, so the only way to know whether the seeded credentials actually
// work is to check them here and say so explicitly.
const CASE_INSENSITIVE = { collation: { locale: "en", strength: 2 } };

const syncDemoAccount = async (email, { verbose }) => {
  const matches = await Meteor.users
    .find({ "emails.address": email }, CASE_INSENSITIVE)
    .fetchAsync();

  if (matches.length > 1) {
    console.error(
      `[demoMode] ${matches.length} accounts share ${email} (${matches
        .map((u) => u._id)
        .join(
          ", ",
        )}). Password login stays broken until all but one are removed.`,
    );
  }

  let user = matches[0];
  let repaired = false;

  if (!user) {
    // A pre-existing account holding the plain username would make
    // createUser fail with a duplicate error that Meteor reports as the same
    // ambiguous credentials message.
    const preferred = email.split("@")[0];
    const taken = await Meteor.users.findOneAsync(
      { username: preferred },
      CASE_INSENSITIVE,
    );
    const username = taken ? `${preferred}-${Random.id(4)}` : preferred;

    const userId = await Accounts.createUserAsync({
      email,
      username,
      password: demoPin(),
      profile: {
        firstName: "App",
        lastName: "Review",
        registrationStatus: "approved",
      },
    });
    user = await Meteor.users.findOneAsync({ _id: userId });
    repaired = true;
    console.warn(
      `[demoMode] Created demo account ${email} (${userId}) with username "${username}".`,
    );
  }

  if (user.profile?.registrationStatus !== "approved") {
    await Meteor.users.updateAsync(
      { _id: user._id },
      { $set: { "profile.registrationStatus": "approved" } },
    );
    repaired = true;
    console.warn(`[demoMode] Re-approved demo account ${email} (${user._id}).`);
  }

  // Only rewrite the password when it no longer matches, and never with the
  // default logout:true — that would drop the reviewer's session on restart.
  const check = await Accounts._checkPasswordAsync(user, demoPin());
  if (check.error) {
    await Accounts.setPasswordAsync(user._id, demoPin(), { logout: false });
    repaired = true;
    console.warn(
      `[demoMode] Reset the PIN for ${email} (${user._id}); the stored password did not match DEMO_ACCOUNT_PIN.`,
    );
  }

  if (verbose || repaired) {
    console.warn(
      `[demoMode] ${email} (${user._id}) is approved and the configured PIN verifies. Sign-in should work.`,
    );
  }
};

const syncAllDemoAccounts = async ({ verbose }) => {
  for (const email of demoEmails()) {
    try {
      await syncDemoAccount(email, { verbose });
    } catch (error) {
      console.error(`[demoMode] Failed to sync demo account ${email}:`, error);
    }
  }
};

Meteor.startup(async () => {
  if (!isDemoModeEnabled()) return;

  console.warn(
    `[demoMode] ENABLED for ${demoEmails().join(", ")}. Unset DEMO_MODE once App Store review is complete.`,
  );

  await syncAllDemoAccounts({ verbose: true });

  // Anything that mutates the account mid-review (an admin action, a stray
  // registration) would otherwise break sign-in until the next deploy.
  Meteor.setInterval(
    () => syncAllDemoAccounts({ verbose: false }),
    5 * 60 * 1000,
  );
});

Meteor.methods({
  /**
   * Link the calling device to the demo account, keeping only the most recent
   * MAX_DEMO_DEVICES. Restricted to the DEMO_ACCOUNT_EMAILS allowlist and only
   * while DEMO_MODE is on — the caller's identity is taken from the
   * authenticated session, never from client input.
   */
  async "demo.linkDevice"(options) {
    check(options, {
      deviceUUID: String,
      deviceModel: Match.Maybe(String),
      devicePlatform: Match.Maybe(String),
      fcmToken: Match.Maybe(String),
    });

    if (!isDemoModeEnabled()) {
      throw new Meteor.Error("demo-disabled", "Demo mode is not enabled.");
    }
    if (!this.userId) {
      throw new Meteor.Error(
        "not-authorized",
        "You must be signed in to link a device.",
      );
    }

    const user = await Meteor.users.findOneAsync({ _id: this.userId });
    const email = user?.emails?.[0]?.address;
    if (!isDemoEmail(email)) {
      throw new Meteor.Error(
        "not-demo-account",
        "This account is not a demo account.",
      );
    }

    const { deviceUUID, deviceModel, devicePlatform, fcmToken } = options;
    if (fcmToken && fcmToken.length > 4096) {
      throw new Meteor.Error("invalid-token", "Invalid FCM token.");
    }
    const clean = (value) => (value || "").toString().trim().slice(0, 64);

    const userDoc = await DeviceDetails.findOneAsync({ userId: this.userId });
    const existingDevices = userDoc?.devices || [];
    const previous = existingDevices.find((d) => d.deviceUUID === deviceUUID);

    const device = {
      deviceUUID,
      appId: previous?.appId || Random.id(32),
      // Re-linking the same installation keeps whatever biometric it enrolled;
      // a device seen for the first time gets an unguessable placeholder so
      // loginWithBiometric can never match an empty secret.
      biometricSecret: previous?.biometricSecret || Random.secret(32),
      fcmToken: fcmToken || previous?.fcmToken || "",
      deviceModel: clean(deviceModel) || previous?.deviceModel || "Unknown",
      devicePlatform:
        clean(devicePlatform) || previous?.devicePlatform || "Unknown",
      isFirstDevice: true,
      isPrimary: true,
      isSecondaryDevice: false,
      deviceRegistrationStatus: "approved",
      lastUpdated: new Date(),
      lastUsed: new Date(),
    };

    // Newest sign-in first, oldest evicted past the cap.
    const devices = [
      device,
      ...existingDevices
        .filter((d) => d.deviceUUID !== deviceUUID)
        .map((d) => ({
          ...d,
          isFirstDevice: false,
          isPrimary: false,
          isSecondaryDevice: true,
        })),
    ].slice(0, MAX_DEMO_DEVICES);

    await DeviceDetails.upsertAsync(
      { userId: this.userId },
      {
        $set: {
          userId: this.userId,
          email,
          username: user.username,
          firstName: user.profile?.firstName || "App",
          lastName: user.profile?.lastName || "Review",
          devices,
          lastUpdated: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
    );

    try {
      await DeviceAuditLog.insertAsync({
        userId: this.userId,
        action: "demoLinkDevice",
        deviceUUID,
        actorDeviceUUID: deviceUUID,
        details: `${device.deviceModel} (${device.devicePlatform})`,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("[demoMode] Failed to write audit log:", error);
    }

    console.warn(
      `[demoMode] Linked device ${deviceUUID} to demo account ${email} (${devices.length}/${MAX_DEMO_DEVICES} devices).`,
    );

    return { success: true };
  },
});
