import { Meteor } from "meteor/meteor";
import { Mongo } from "meteor/mongo";
import { Accounts } from "meteor/accounts-base";
import { check, Match } from "meteor/check";
import { DDPRateLimiter } from "meteor/ddp-rate-limiter";
import crypto from "crypto";
import { DeviceDetails } from "../utils/api/deviceDetails.js";
import { ApprovalTokens } from "../utils/api/approvalTokens";
import "../utils/api/notificationHistory.js"; // Method registration (primary-transfer approvals)
import "../utils/api/pendingResponses.js"; // Method registration (primary-transfer approvals)
import { APPROVAL_ACTIONS } from "../utils/constants.js";
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

// How long the current primary device has to approve a primary transfer.
const PRIMARY_TRANSFER_TIMEOUT_MS = 25000;

// Delay before the "primary changed" notice is pushed. The initiating user
// usually has the app OPEN when the change happens, and iOS shows no OS
// banner for foreground pushes — the delay gives them time to background the
// app so the confirmation arrives as a visible system notification.
const PRIMARY_CHANGE_NOTICE_DELAY_MS = 10000;

const REAUTH_PATTERN = Match.OneOf(
  { biometricSecret: String },
  { pin: String },
);

/**
 * Constant-time string comparison (hash first so lengths never leak).
 */
export const timingSafeEquals = (a, b) => {
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
 * Informational broadcast to a user's approved devices (fire-and-forget).
 */
export const notifyApprovedDevices = (devices, title, body, data) => {
  (devices || [])
    .filter((d) => d.deviceRegistrationStatus === "approved")
    .forEach((d) => notifyDevice(d.fcmToken, title, body, data));
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
   * Pre-login check: is this device registered, and what is its status?
   *
   * Replaces the old `deviceDetails.byDevice` publication. That publication
   * published a stripped projection of the same top-level `devices` field as
   * `deviceDetails.byUser`; Meteor's DDP merge box only tracks TOP-LEVEL
   * fields, so whichever publication ran first clobbered the other and the
   * device list rendered with missing fields (model/platform/isPrimary/
   * lastUsed all undefined). A method has no Minimongo footprint, so no
   * conflict. Exposes only existence + status — no identifiers or secrets.
   */
  async "devices.checkRegistrationByUUID"(deviceUUID) {
    check(deviceUUID, String);

    const userDoc = await DeviceDetails.findOneAsync(
      { "devices.deviceUUID": deviceUUID },
      {
        fields: {
          "devices.deviceUUID": 1,
          "devices.deviceRegistrationStatus": 1,
        },
      },
    );
    const device = userDoc?.devices?.find((d) => d.deviceUUID === deviceUUID);

    return {
      registered: !!device,
      status: device?.deviceRegistrationStatus || null,
    };
  },

  /**
   * Self-report the calling device's live OS info (model/platform) and mark
   * it as recently used. Called on dashboard load so records registered with
   * "Unknown" placeholders heal themselves, and other devices see real names.
   *
   * Also repairs the primary-device invariant: if the account has approved
   * devices but none is flagged primary (legacy re-registrations cleared the
   * flag), the oldest approved device is promoted.
   */
  async "devices.updateInfo"({ deviceUUID, deviceModel, devicePlatform }) {
    check(deviceUUID, String);
    check(deviceModel, Match.Maybe(String));
    check(devicePlatform, Match.Maybe(String));
    requireLogin(this);

    const userDoc = await getUserDevicesOrThrow(this.userId);
    findOwnedDeviceOrThrow(userDoc, deviceUUID);

    const updates = { "devices.$.lastUsed": new Date() };
    const clean = (v) => (v || "").toString().trim().slice(0, 64);
    if (clean(deviceModel))
      updates["devices.$.deviceModel"] = clean(deviceModel);
    if (clean(devicePlatform))
      updates["devices.$.devicePlatform"] = clean(devicePlatform);

    await DeviceDetails.updateAsync(
      { userId: this.userId, "devices.deviceUUID": deviceUUID },
      { $set: updates },
    );

    // Primary invariant repair.
    const approved = userDoc.devices.filter(
      (d) => d.deviceRegistrationStatus === "approved",
    );
    if (approved.length > 0 && !approved.some((d) => d.isPrimary)) {
      const oldest = approved.reduce((a, b) =>
        new Date(a.lastUpdated || 0) <= new Date(b.lastUpdated || 0) ? a : b,
      );
      await DeviceDetails.updateAsync(
        { userId: this.userId, "devices.deviceUUID": oldest.deviceUUID },
        { $set: { "devices.$.isPrimary": true } },
      );
      console.log(
        `Primary invariant repaired for user ${this.userId}: promoted ${oldest.deviceUUID}`,
      );
    }

    return { success: true };
  },

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
   *
   * Trust transfer rules — the change is always confirmed by a human:
   * - Step-up re-authentication (biometric/PIN) is ALWAYS required, so an
   *   unlocked-but-unattended phone (or a hijacked session) cannot silently
   *   change the primary.
   * - If the request is initiated from a device other than the current
   *   primary, the CURRENT primary must additionally approve: an actionable
   *   push (with the notificationId only that device receives) is sent to it
   *   and the method waits for the response.
   */
  async "devices.setPrimary"({ deviceUUID, actorDeviceUUID, reAuth }) {
    check(deviceUUID, String);
    check(actorDeviceUUID, String);
    check(reAuth, REAUTH_PATTERN);
    requireLogin(this);

    const userDoc = await getUserDevicesOrThrow(this.userId);
    const device = findOwnedDeviceOrThrow(userDoc, deviceUUID);
    findOwnedDeviceOrThrow(userDoc, actorDeviceUUID);

    if (device.deviceRegistrationStatus !== "approved") {
      throw new Meteor.Error(
        "device-not-approved",
        "Only an approved device can be made primary.",
      );
    }
    if (device.isPrimary) {
      return { success: true, approved: true };
    }

    // Confirm the human at the initiating device before any trust change.
    await verifyStepUpAuth(this.userId, reAuth);

    // Single atomic update so exactly one device ends up primary.
    const promote = async () => {
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

      // Announce the trust change on EVERY approved device — including the
      // initiating one, so the account owner always gets a record of the
      // change on each device. Purely informational (no appId/actions).
      // Sent after a short delay so users can background the app and get a
      // visible OS banner (iOS shows none for foreground pushes); a device
      // that still has the app open shows an in-app toast instead.
      const recipients = userDoc.devices;
      Meteor.setTimeout(() => {
        notifyApprovedDevices(
          recipients,
          "Primary Device Changed",
          `"${deviceLabel(device)}" is now the primary device for your account. If this wasn't you, contact your administrator.`,
          { notificationType: "primary_changed" },
        );
      }, PRIMARY_CHANGE_NOTICE_DELAY_MS);
    };

    const currentPrimary = userDoc.devices.find(
      (d) => d.isPrimary && d.deviceRegistrationStatus === "approved",
    );

    // Direct transfer: nothing to protect, or initiated from the primary
    // device itself (which is exactly the trusted party we would ask).
    if (!currentPrimary || currentPrimary.deviceUUID === actorDeviceUUID) {
      await promote();
      await logDeviceAudit({
        userId: this.userId,
        action: "setPrimary",
        deviceUUID,
        actorDeviceUUID,
      });
      return { success: true, approved: true };
    }

    // Approval required from the current primary device.
    const user = await Meteor.users.findOneAsync(this.userId);
    if (!user?.username) {
      throw new Meteor.Error("not-found", "Account not found.");
    }

    const title = "Primary Device Change Request";
    const body = `"${deviceLabel(device)}" is requesting to become the primary device for your account.`;

    // The notificationId is delivered ONLY in the push to the current
    // primary device, so only that device can respond to this request
    // (notifications.handleResponse additionally enforces account ownership
    // and approved-device status).
    const notificationId = await Meteor.callAsync(
      "notificationHistory.insert",
      {
        userId: this.userId,
        title,
        body,
        appId: currentPrimary.appId,
      },
    );
    if (!notificationId) {
      throw new Meteor.Error(
        "primary-unreachable",
        "Could not create the approval request. Please try again.",
      );
    }

    await Meteor.callAsync(
      "pendingResponses.create",
      user.username,
      notificationId,
      PRIMARY_TRANSFER_TIMEOUT_MS,
    );

    let sent = null;
    try {
      sent = await sendNotification(currentPrimary.fcmToken, title, body, {
        notificationType: "approval",
        userId: this.userId,
        notificationId,
        appId: currentPrimary.appId,
        actions: JSON.stringify(APPROVAL_ACTIONS),
        isDismissal: "false",
        isSync: "false",
      });
    } catch (error) {
      console.error("Primary transfer push failed:", error.message);
    }
    if (!sent) {
      await Meteor.callAsync(
        "notificationHistory.updateStatus",
        notificationId,
        "timeout",
      );
      throw new Meteor.Error(
        "primary-unreachable",
        "Could not reach your primary device. Make sure it is online and try again.",
      );
    }

    const action = await Meteor.callAsync(
      "pendingResponses.waitForResponse",
      user.username,
      notificationId,
      PRIMARY_TRANSFER_TIMEOUT_MS,
    );

    if (action === "approve" || action === "approved") {
      await promote();
      await logDeviceAudit({
        userId: this.userId,
        action: "setPrimary",
        deviceUUID,
        actorDeviceUUID,
        details: `approved by primary ${currentPrimary.deviceUUID}`,
      });
      return { success: true, approved: true };
    }

    if (action === "timeout") {
      await Meteor.callAsync(
        "notificationHistory.updateStatus",
        notificationId,
        "timeout",
      );
      throw new Meteor.Error(
        "primary-timeout",
        "Your primary device did not respond. Try again when it is nearby.",
      );
    }

    await logDeviceAudit({
      userId: this.userId,
      action: "setPrimaryRejected",
      deviceUUID,
      actorDeviceUUID,
    });
    throw new Meteor.Error(
      "primary-rejected",
      "Your primary device rejected the request.",
    );
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

    // The primary device (or the only approved device) can never be removed:
    // the account always keeps at least one trusted device. To remove it,
    // transfer the primary role to another device first — which requires the
    // current primary's approval.
    const approvedCount = userDoc.devices.filter(
      (d) => d.deviceRegistrationStatus === "approved",
    ).length;
    if (
      target.deviceRegistrationStatus === "approved" &&
      (target.isPrimary || approvedCount === 1)
    ) {
      throw new Meteor.Error(
        "primary-device-protected",
        "The primary device cannot be removed. Make another device primary first.",
      );
    }

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
    // are routed to the primary device). Guarded so a concurrent revoke /
    // setPrimary interleaving cannot produce two primaries: the successor is
    // only promoted if no primary device exists at write time.
    if (target.isPrimary) {
      const successor =
        remaining.find((d) => d.deviceRegistrationStatus === "approved") ||
        remaining[0];
      await DeviceDetails.updateAsync(
        {
          userId: this.userId,
          "devices.deviceUUID": successor.deviceUUID,
          devices: { $not: { $elemMatch: { isPrimary: true } } },
        },
        {
          $set: {
            "devices.$.isPrimary": true,
            "devices.$.lastUpdated": new Date(),
          },
        },
      );
    }

    // Session invalidation: on a self-revoke the calling device is the one
    // being removed, so its own token must die too — the client-side wipe is
    // only best-effort. Revoking a *different* device keeps the caller's
    // session and drops everything else.
    const isSelfRevoke = deviceUUID === actorDeviceUUID;
    await invalidateOtherSessions(
      this.userId,
      isSelfRevoke ? null : this.connection,
    );

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

    // A new trusted device joined the account — tell every other registered
    // device so the owner learns about the addition immediately.
    if (approve) {
      notifyApprovedDevices(
        userDoc.devices.filter((d) => d.deviceUUID !== deviceUUID),
        "New Device Added",
        `"${deviceLabel(target)}" was added to your account. If this wasn't you, contact your administrator.`,
        { notificationType: "device_added_info" },
      );
    }

    await logDeviceAudit({
      userId: this.userId,
      action: approve ? "approvePending" : "rejectPending",
      deviceUUID,
      actorDeviceUUID,
    });

    return { success: true, approved: approve };
  },

  /**
   * Reconcile a rotated FCM registration token for the calling user's own
   * device. Tokens rotate legitimately (reinstall, OS restore, Firebase
   * refresh), so this only replaces the stored token — it never changes the
   * device's registration/approval status.
   */
  async "devices.updateFCMToken"(options) {
    check(options, { deviceUUID: String, fcmToken: String });
    requireLogin(this);

    const { deviceUUID, fcmToken } = options;

    if (!fcmToken || fcmToken.length > 4096) {
      throw new Meteor.Error("invalid-token", "Invalid FCM token.");
    }

    const userDoc = await DeviceDetails.findOneAsync({ userId: this.userId });
    const device = userDoc?.devices?.find((d) => d.deviceUUID === deviceUUID);

    // No-op rather than an error: the device may have been revoked while the
    // app was offline, and the client fires this on every push registration.
    if (!device || device.fcmToken === fcmToken) {
      return { success: true, updated: false };
    }

    await DeviceDetails.updateAsync(
      { userId: this.userId, "devices.deviceUUID": deviceUUID },
      {
        $set: {
          "devices.$.fcmToken": fcmToken,
          "devices.$.lastUpdated": new Date(),
          lastUpdated: new Date(),
        },
      },
    );

    return { success: true, updated: true };
  },
});

// Brute-force protection for authentication and device management methods.
const RATE_LIMITED_METHODS = new Set([
  "users.loginWithBiometric",
  "users.register",
  "devices.checkRegistrationByUUID",
  "devices.updateInfo",
  "devices.updateFCMToken",
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
