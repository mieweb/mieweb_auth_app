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

// Keep the seeded account's credentials and approval state in sync on every
// boot so the reviewer's published password always works.
Meteor.startup(async () => {
  if (!isDemoModeEnabled()) return;

  const emails = demoEmails();

  console.warn(
    `[demoMode] ENABLED for ${emails.join(", ")}. Unset DEMO_MODE once App Store review is complete.`,
  );

  for (const email of emails) {
    try {
      const existing = await Meteor.users.findOneAsync({
        "emails.address": email,
      });

      if (existing) {
        await Meteor.users.updateAsync(
          { _id: existing._id },
          { $set: { "profile.registrationStatus": "approved" } },
        );
        await Accounts.setPasswordAsync(existing._id, demoPin());
        console.warn(
          `[demoMode] Reset demo account ${email} (${existing._id}) to approved with the configured PIN.`,
        );
      } else {
        const userId = await Accounts.createUserAsync({
          email,
          username: email.split("@")[0],
          password: demoPin(),
          profile: {
            firstName: "App",
            lastName: "Review",
            registrationStatus: "approved",
          },
        });
        console.warn(`[demoMode] Seeded demo account ${email} (${userId}).`);
      }
    } catch (error) {
      console.error(`[demoMode] Failed to seed demo account ${email}:`, error);
    }
  }
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
