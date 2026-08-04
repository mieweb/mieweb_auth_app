import { Meteor } from "meteor/meteor";
import { Mongo } from "meteor/mongo";
import { Accounts } from "meteor/accounts-base";
import { check, Match } from "meteor/check";
import { DDPRateLimiter } from "meteor/ddp-rate-limiter";
import crypto from "crypto";
import { DeviceDetails } from "../utils/api/deviceDetails.js";
import { ApprovalTokens } from "../utils/api/approvalTokens";
import { sendNotification } from "./firebase.js";

/**
 * Self-service device management ("My Devices").
 *
 * Every method here:
 *  - requires an authenticated session (this.userId), and
 *  - operates exclusively on the caller's own DeviceDetails document,
 * so a user can never read or mutate another user's devices.
 *
 * Destructive/trust-changing actions (revoke, approve/reject a pending
 * device) additionally require step-up re-authentication: the client must
 * present the device-bound biometric secret (released by the OS only after a
 * successful biometric prompt) or the account PIN.
 */

// Insert-only audit trail of self-service device management actions.
export const DeviceAuditLog = new Mongo.Collection("deviceAuditLog");

Meteor.startup(() => {
  try {
    DeviceAuditLog.createIndex({ userId: 1, createdAt: -1 });
  } catch (error) {
    console.error("Error creating DeviceAuditLog indexes:", error);
  }
});

// 1-40 chars; letters, numbers, spaces and ' . _ - (must start alphanumeric).
const DEVICE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 '._-]{0,39}$/;

const REAUTH_PATTERN = Match.OneOf(
  { biometricSecret: String },
  { pin: String },
);

/**
 * Constant-time string comparison (hash first so lengths never leak).
 */
const timingSafeEquals = (a, b) => {
  const hashA = crypto.createHash("sha256").update(String(a)).digest();
  const hashB = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
};

const requireLogin = (context) => {
  if (!context.userId) {
    throw new Meteor.Error(
      "not-authorized",
      "You must be signed in to manage devices.",
    );
  }
};

/**
 * Verify step-up re-authentication proof for destructive device actions.
 * Accepts either the device-bound biometric secret of one of the caller's
 * approved devices, or the account PIN.
 */
const verifyStepUpAuth = async (userId, reAuth) => {
  if (reAuth.biometricSecret) {
    const userDoc = await DeviceDetails.findOneAsync({ userId });
    const verified = (userDoc?.devices || []).some(
      (device) =>
        device.deviceRegistrationStatus === "approved" &&
        device.biometricSecret &&
        timingSafeEquals(device.biometricSecret, reAuth.biometricSecret),
    );
    if (!verified) {
      throw new Meteor.Error(
        "reauth-failed",
        "Biometric verification failed. Please try again.",
      );
    }
    return;
  }

  const user = await Meteor.users.findOneAsync({ _id: userId });
  if (!user) {
    throw new Meteor.Error("reauth-failed", "Account not found.");
  }
  const result = await Accounts._checkPasswordAsync(user, reAuth.pin);
  if (result.error) {
    throw new Meteor.Error("reauth-failed", "Incorrect PIN. Please try again.");
  }
};

const getUserDevicesOrThrow = async (userId) => {
  const userDoc = await DeviceDetails.findOneAsync({ userId });
  if (!userDoc || !userDoc.devices?.length) {
    throw new Meteor.Error(
      "not-found",
      "No devices are registered for this account.",
    );
  }
  return userDoc;
};

const findOwnedDeviceOrThrow = (userDoc, deviceUUID) => {
  const device = userDoc.devices.find((d) => d.deviceUUID === deviceUUID);
  if (!device) {
    throw new Meteor.Error(
      "device-not-owned",
      "This device is not registered to your account.",
    );
  }
  return device;
};

const deviceLabel = (device) =>
  device.customName ||
  device.deviceModel ||
  `Device ${device.deviceUUID.substring(0, 8)}...`;

const logDeviceAudit = async (entry) => {
  try {
    await DeviceAuditLog.insertAsync({ ...entry, createdAt: new Date() });
  } catch (error) {
    console.error("Failed to write device audit log:", error);
  }
};

// Fire-and-forget push; device management must not fail because a courtesy
// notification could not be delivered.
const notifyDevice = (fcmToken, title, body, data) => {
  if (!fcmToken) return;
  sendNotification(fcmToken, title, body, {
    isDismissal: "false",
    isSync: "false",
    ...data,
  }).catch((error) => {
    console.error("Device management notification failed:", error.message);
  });
};

/**
 * Remove a user account and everything attached to it (devices, approval
 * tokens). Shared by users.removeCompletely and last-device self-revocation.
 */
export const removeUserCompletely = async (userId) => {
  const userRemoved = await Meteor.users.removeAsync({ _id: userId });
  const deviceRemoved = await DeviceDetails.removeAsync({ userId });
  const tokensRemoved = await ApprovalTokens.removeAsync({ userId });

  return {
    success: true,
    userRemoved: userRemoved > 0,
    deviceRemoved: deviceRemoved > 0,
    tokensRemoved: tokensRemoved > 0,
  };
};

/**
 * Invalidate resume login tokens for the caller's account. Meteor login
 * tokens are not bound to a device, so per-device invalidation is not
 * possible; instead we drop every session except (optionally) the caller's
 * current one. Other legitimate devices simply re-authenticate with their
 * device-bound biometric secret, while a revoked device cannot — its
 * credentials no longer exist server-side.
 */
const invalidateOtherSessions = async (userId, connection) => {
  const currentHashedToken = connection
    ? Accounts._getLoginToken(connection.id)
    : null;

  if (currentHashedToken) {
    await Meteor.users.updateAsync(
      { _id: userId },
      {
        $pull: {
          "services.resume.loginTokens": {
            hashedToken: { $ne: currentHashedToken },
          },
        },
      },
    );
  } else {
    await Meteor.users.updateAsync(
      { _id: userId },
      { $set: { "services.resume.loginTokens": [] } },
    );
  }
};

Meteor.methods({
  /**
   * Rename one of the caller's own devices.
   */
  async "devices.rename"({ deviceUUID, name }) {
    check(deviceUUID, String);
    check(name, String);
    requireLogin(this);

    const trimmedName = name.trim();
    if (!DEVICE_NAME_PATTERN.test(trimmedName)) {
      throw new Meteor.Error(
        "invalid-name",
        "Device name must be 1-40 characters: letters, numbers, spaces or ' . _ -",
      );
    }

    const userDoc = await getUserDevicesOrThrow(this.userId);
    findOwnedDeviceOrThrow(userDoc, deviceUUID);

    await DeviceDetails.updateAsync(
      { userId: this.userId, "devices.deviceUUID": deviceUUID },
      {
        $set: {
          "devices.$.customName": trimmedName,
          "devices.$.lastUpdated": new Date(),
          lastUpdated: new Date(),
        },
      },
    );

    await logDeviceAudit({
      userId: this.userId,
      action: "rename",
      deviceUUID,
      details: trimmedName,
    });

    return { success: true };
  },

  /**
   * Mark one of the caller's approved devices as the primary device.
   */
  async "devices.setPrimary"({ deviceUUID }) {
    check(deviceUUID, String);
    requireLogin(this);

    const userDoc = await getUserDevicesOrThrow(this.userId);
    const device = findOwnedDeviceOrThrow(userDoc, deviceUUID);

    if (device.deviceRegistrationStatus !== "approved") {
      throw new Meteor.Error(
        "device-not-approved",
        "Only an approved device can be made primary.",
      );
    }

    // Single atomic update so exactly one device ends up primary.
    await DeviceDetails.rawCollection().updateOne(
      { userId: this.userId },
      {
        $set: {
          "devices.$[target].isPrimary": true,
          "devices.$[others].isPrimary": false,
          lastUpdated: new Date(),
        },
      },
      {
        arrayFilters: [
          { "target.deviceUUID": deviceUUID },
          { "others.deviceUUID": { $ne: deviceUUID } },
        ],
      },
    );

    await logDeviceAudit({
      userId: this.userId,
      action: "setPrimary",
      deviceUUID,
    });

    return { success: true };
  },

  /**
   * Revoke (remove) one of the caller's own devices.
   *
   * Requires step-up re-authentication. Removing the last device deregisters
   * the whole account (re-registration then goes through the normal
   * first-device admin approval flow).
   */
  async "devices.revoke"({ deviceUUID, actorDeviceUUID, reAuth }) {
    check(deviceUUID, String);
    check(actorDeviceUUID, String);
    check(reAuth, REAUTH_PATTERN);
    requireLogin(this);

    await verifyStepUpAuth(this.userId, reAuth);

    const userDoc = await getUserDevicesOrThrow(this.userId);
    const target = findOwnedDeviceOrThrow(userDoc, deviceUUID);
    findOwnedDeviceOrThrow(userDoc, actorDeviceUUID);

    const remaining = userDoc.devices.filter(
      (d) => d.deviceUUID !== deviceUUID,
    );

    // Tell the revoked device to wipe its local state and sign out. Best
    // effort — even if the push never arrives, the device can no longer act:
    // its biometric secret is deleted and its sessions are invalidated below.
    notifyDevice(
      target.fcmToken,
      "Device Removed",
      "This device has been removed from your MIE Auth account.",
      { notificationType: "device_revoked" },
    );

    if (remaining.length === 0) {
      // Last device: fully deregister the account.
      const result = await removeUserCompletely(this.userId);
      await logDeviceAudit({
        userId: this.userId,
        action: "revoke",
        deviceUUID,
        actorDeviceUUID,
        details: "last device — account deregistered",
      });
      return { ...result, accountRemoved: true };
    }

    await DeviceDetails.updateAsync(
      { userId: this.userId },
      {
        $pull: { devices: { deviceUUID } },
        $set: { lastUpdated: new Date() },
      },
    );

    // Keep the invariant that one device is primary (device approval pushes
    // are routed to the primary device).
    if (target.isPrimary) {
      const successor =
        remaining.find((d) => d.deviceRegistrationStatus === "approved") ||
        remaining[0];
      await DeviceDetails.updateAsync(
        { userId: this.userId, "devices.deviceUUID": successor.deviceUUID },
        {
          $set: {
            "devices.$.isPrimary": true,
            "devices.$.lastUpdated": new Date(),
          },
        },
      );
    }

    await invalidateOtherSessions(this.userId, this.connection);

    // Courtesy notice on the user's other approved devices.
    remaining
      .filter(
        (d) =>
          d.deviceRegistrationStatus === "approved" &&
          d.deviceUUID !== actorDeviceUUID,
      )
      .forEach((d) => {
        notifyDevice(
          d.fcmToken,
          "Device Removed",
          `"${deviceLabel(target)}" was removed from your account. If this wasn't you, contact your administrator.`,
          { notificationType: "device_removed_info" },
        );
      });

    await logDeviceAudit({
      userId: this.userId,
      action: "revoke",
      deviceUUID,
      actorDeviceUUID,
      details: deviceLabel(target),
    });

    return { success: true, accountRemoved: false };
  },

  /**
   * Approve or reject one of the caller's own pending devices from an
   * already-approved device. Requires step-up re-authentication.
   */
  async "devices.approvePending"({
    deviceUUID,
    actorDeviceUUID,
    approve,
    reAuth,
  }) {
    check(deviceUUID, String);
    check(actorDeviceUUID, String);
    check(approve, Boolean);
    check(reAuth, REAUTH_PATTERN);
    requireLogin(this);

    await verifyStepUpAuth(this.userId, reAuth);

    const userDoc = await getUserDevicesOrThrow(this.userId);
    const target = findOwnedDeviceOrThrow(userDoc, deviceUUID);
    const actor = findOwnedDeviceOrThrow(userDoc, actorDeviceUUID);

    if (actor.deviceRegistrationStatus !== "approved") {
      throw new Meteor.Error(
        "device-not-approved",
        "Only an approved device can respond to pending device requests.",
      );
    }
    if (target.deviceRegistrationStatus !== "pending") {
      throw new Meteor.Error(
        "invalid-status",
        "This device is not pending approval.",
      );
    }

    if (approve) {
      await DeviceDetails.updateAsync(
        { userId: this.userId, "devices.deviceUUID": deviceUUID },
        {
          $set: {
            "devices.$.deviceRegistrationStatus": "approved",
            "devices.$.lastUpdated": new Date(),
            lastUpdated: new Date(),
          },
        },
      );
    } else {
      // Mirror the registration flow: a rejected pending device is removed.
      await DeviceDetails.updateAsync(
        { userId: this.userId },
        {
          $pull: { devices: { deviceUUID } },
          $set: { lastUpdated: new Date() },
        },
      );
    }

    notifyDevice(
      target.fcmToken,
      approve ? "Device Approved" : "Device Registration Rejected",
      approve
        ? "Your device has been approved. You can now use the application."
        : "Your device registration has been rejected.",
      {
        notificationType: "device_approval",
        status: approve ? "approved" : "rejected",
      },
    );

    await logDeviceAudit({
      userId: this.userId,
      action: approve ? "approvePending" : "rejectPending",
      deviceUUID,
      actorDeviceUUID,
    });

    return { success: true, approved: approve };
  },
});

// Brute-force protection for authentication and device management methods.
const RATE_LIMITED_METHODS = new Set([
  "users.loginWithBiometric",
  "users.register",
  "devices.rename",
  "devices.setPrimary",
  "devices.revoke",
  "devices.approvePending",
]);

DDPRateLimiter.addRule(
  {
    type: "method",
    name: (name) => RATE_LIMITED_METHODS.has(name),
    connectionId: () => true,
  },
  10, // max 10 calls
  60 * 1000, // per minute, per connection
);
