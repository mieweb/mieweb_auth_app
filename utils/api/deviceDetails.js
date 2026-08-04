import { Mongo } from "meteor/mongo";
import { check, Match } from "meteor/check";
import { SHA256 } from "meteor/sha";

// Initialize collection
const DeviceDetails = new Mongo.Collection("deviceDetails");

// Export the collection
export { DeviceDetails };

/**
 * Generate app ID from device UUID, email, and creation time
 * @param {String} deviceUUID - Device unique identifier
 * @param {String} email - User email
 * @param {String} creationTime - Creation timestamp
 * @returns {String} Generated App ID
 */
const generateAppId = (deviceUUID, email, creationTime) => {
  const combinedString = `${deviceUUID}:${email}:${creationTime}`;
  return SHA256(combinedString).substring(0, 32);
};

// Create indexes for better query performance
if (Meteor.isServer) {
  Meteor.startup(() => {
    try {
      // Primary index for user lookups
      DeviceDetails.createIndex({ userId: 1 });

      // Compound index for device lookups
      DeviceDetails.createIndex({ userId: 1, "devices.deviceUUID": 1 });
      DeviceDetails.createIndex({ userId: 1, "devices.appId": 1 });

      // Index for device-specific queries
      DeviceDetails.createIndex({ "devices.deviceUUID": 1 });
      DeviceDetails.createIndex({ "devices.appId": 1 });

      // Index for the device specific biometric secret
      DeviceDetails.createIndex({ "devices.biometricSecret": 1 });
      console.log("DeviceDetails indexes created successfully");
    } catch (error) {
      console.error("Error creating DeviceDetails indexes:", error);
    }
  });
}

// Define methods for DeviceDetails
Meteor.methods({
  /**
   * Replace the biometric credential for the authenticated user's current
   * approved device after PIN-based recovery.
   * @param {Object} options - Current device UUID and replacement secret
   * @returns {Object} Rotation result
   */
  async "users.rotateBiometricSecret"(options) {
    check(options, {
      deviceUUID: String,
      biometricSecret: String,
    });

    if (!this.userId) {
      throw new Meteor.Error(
        "not-authorized",
        "You must sign in before setting up biometrics",
      );
    }

    const { deviceUUID, biometricSecret } = options;
    const userDoc = await DeviceDetails.findOneAsync({
      userId: this.userId,
      devices: {
        $elemMatch: {
          deviceUUID,
          deviceRegistrationStatus: "approved",
        },
      },
    });

    if (!userDoc) {
      throw new Meteor.Error(
        "device-not-approved",
        "This device is not approved for biometric login",
      );
    }

    const updated = await DeviceDetails.updateAsync(
      {
        userId: this.userId,
        devices: {
          $elemMatch: {
            deviceUUID,
            deviceRegistrationStatus: "approved",
          },
        },
      },
      {
        $set: {
          "devices.$.biometricSecret": biometricSecret,
          "devices.$.lastUpdated": new Date(),
          lastUpdated: new Date(),
        },
      },
    );

    if (updated !== 1) {
      throw new Meteor.Error(
        "biometric-update-failed",
        "Unable to update biometric credentials",
      );
    }

    return { success: true };
  },
});

/**
 * Register (upsert) a device for a user.
 *
 * Server-internal: intentionally NOT exposed as a Meteor method. Device
 * records carry credentials (biometricSecret, fcmToken), so registration may
 * only be driven by trusted server flows (users.register), never directly by
 * a client.
 *
 * @param {Object} data - Device details data
 * @returns {Object} Registration result including generated appId
 */
export const registerDeviceDetails = async (data) => {
  console.log(
    " ### Log Step 6 : Inside deviceDetails.js and checking all the data received",
  );

  // Extended check to include all required fields
  check(
    data,
    Match.ObjectIncluding({
      username: String,
      biometricSecret: String,
      userId: String,
      email: String,
      deviceUUID: String,
      fcmToken: String,
      firstName: String,
      lastName: String,
      isFirstDevice: Match.Maybe(Boolean),
      isSecondaryDevice: Match.Maybe(Boolean),
      deviceModel: Match.Maybe(String),
      devicePlatform: Match.Maybe(String),
      autoApprove: Match.Maybe(Boolean),
    }),
  );

  // Generate appId
  const creationTime = new Date().toISOString();
  const appId = generateAppId(data.deviceUUID, data.username, creationTime);
  const deviceRegistrationStatus = data.autoApprove ? "approved" : "pending";
  console.log(
    " ### Log Step 6.1 : Inside deviceDetails.js, generating app Id",
    JSON.stringify({ appId }),
  );
  // Check if this is the first device
  if (data.isFirstDevice) {
    // First device registration for first time user
    console.log(
      "### Log Step 6.2 : Inside deviceDetails.js, Create new user document with first device",
    );

    await DeviceDetails.insertAsync({
      userId: data.userId,
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      devices: [
        {
          deviceUUID: data.deviceUUID,
          appId: appId,
          biometricSecret: data.biometricSecret,
          fcmToken: data.fcmToken,
          deviceModel: data.deviceModel || "Unknown",
          devicePlatform: data.devicePlatform || "Unknown",
          isFirstDevice: true,
          isPrimary: true,
          isSecondaryDevice: false,
          deviceRegistrationStatus,
          lastUpdated: new Date(),
        },
      ],
      createdAt: new Date(),
      lastUpdated: new Date(),
    });

    return {
      appId,
      isRequireAdminApproval: !data.autoApprove,
    };
  } else {
    // Not the first device, set isSecondaryDevice = true

    // Get the existing details against the user
    const existingDevices = await DeviceDetails.findOneAsync({
      userId: data.userId,
    });
    console.log(
      `### Log Step 6.2 : Inside deviceDetails.js, fetching existing device details:`,
      existingDevices,
    );

    if (!existingDevices) {
      // Handle case where user doesn't exist but isFirstDevice is false
      console.log("### Warning: User not found but isFirstDevice is false");
      throw new Meteor.Error(
        "user-not-found",
        "User not found but isFirstDevice is false",
      );
    }

    const existingDeviceIndex = existingDevices.devices.findIndex(
      (device) => device.deviceUUID === data.deviceUUID,
    );

    if (existingDeviceIndex !== -1) {
      // Update existing device
      console.log(
        `### Log Step 6.3 : Inside deviceDetails.js, Existing device details found and updating it, existingDeviceIndex: ${existingDeviceIndex}`,
      );
      await DeviceDetails.updateAsync(
        { userId: data.userId },
        {
          $set: {
            email: data.email,
            username: data.username,
            firstName: data.firstName,
            lastName: data.lastName,
            lastUpdated: new Date(),
            [`devices.${existingDeviceIndex}.deviceUUID`]: data.deviceUUID,
            [`devices.${existingDeviceIndex}.appId`]:
              existingDevices.devices[existingDeviceIndex].appId,
            [`devices.${existingDeviceIndex}.biometricSecret`]:
              data.biometricSecret,
            [`devices.${existingDeviceIndex}.fcmToken`]: data.fcmToken,
            [`devices.${existingDeviceIndex}.deviceModel`]:
              data.deviceModel || "Unknown",
            [`devices.${existingDeviceIndex}.devicePlatform`]:
              data.devicePlatform || "Unknown",
            [`devices.${existingDeviceIndex}.deviceRegistrationStatus`]:
              deviceRegistrationStatus,
            [`devices.${existingDeviceIndex}.isFirstDevice`]: false,
            [`devices.${existingDeviceIndex}.isPrimary`]: false,
            [`devices.${existingDeviceIndex}.isSecondaryDevice`]: true,
            [`devices.${existingDeviceIndex}.lastUpdated`]: new Date(),
          },
        },
      );
      return {
        appId: existingDevices.devices[existingDeviceIndex].appId,
        isRequireSecondaryDeviceApproval: !data.autoApprove,
      };
    } else {
      // Add new device to existing user document
      console.log(
        "### Log Step 6.3 : Inside deviceDetails.js, Existing device details not found thus creating a new device details against the existing user",
      );
      await DeviceDetails.updateAsync(
        { userId: data.userId },
        {
          $push: {
            devices: {
              deviceUUID: data.deviceUUID,
              appId: appId,
              biometricSecret: data.biometricSecret,
              fcmToken: data.fcmToken,
              deviceModel: data.deviceModel || "Unknown",
              devicePlatform: data.devicePlatform || "Unknown",
              deviceRegistrationStatus,
              isFirstDevice: false,
              isPrimary: false,
              isSecondaryDevice: true,
              lastUpdated: new Date(),
            },
          },
          $set: {
            email: data.email,
            username: data.username,
            firstName: data.firstName,
            lastName: data.lastName,
            lastUpdated: new Date(),
          },
        },
      );
      return {
        appId,
        isRequireSecondaryDeviceApproval: !data.autoApprove,
      };
    }
  }
};

/**
 * Get all FCM tokens registered for a username.
 *
 * Server-internal: FCM tokens allow sending pushes to a user's devices and
 * must never be readable from the client.
 *
 * @param {String} username - Username
 * @returns {Array} Array of FCM tokens
 */
export const getFCMTokensByUsername = async (username) => {
  check(username, String);

  const userDoc = await DeviceDetails.findOneAsync({ username });
  if (!userDoc) {
    throw new Meteor.Error(
      "invalid-username",
      "No device found with this Username",
    );
  }

  return userDoc.devices.map((device) => device.fcmToken);
};

/**
 * Get FCM tokens from approved devices only, by userId.
 *
 * Server-internal: see getFCMTokensByUsername.
 *
 * @param {String} userId - User ID
 * @returns {Array} Array of FCM tokens from approved devices
 */
export const getApprovedFCMTokensByUserId = async (userId) => {
  check(userId, String);

  const userDoc = await DeviceDetails.findOneAsync({ userId });
  if (!userDoc) {
    throw new Meteor.Error(
      "invalid-username",
      "No device found with this UserId",
    );
  }

  return userDoc.devices
    .filter((device) => device.deviceRegistrationStatus === "approved")
    .map((device) => device.fcmToken);
};

// Publish device details.
//
// SECURITY: device credentials (biometricSecret, fcmToken) are never
// published to any client. Both publications use explicit inclusion
// projections so newly added sensitive fields can't leak by default.
if (Meteor.isServer) {
  // Fields a signed-in user may see about their OWN devices.
  const OWN_DEVICE_FIELDS = {
    userId: 1,
    username: 1,
    firstName: 1,
    lastName: 1,
    email: 1,
    createdAt: 1,
    lastUpdated: 1,
    "devices.deviceUUID": 1,
    "devices.appId": 1,
    "devices.deviceModel": 1,
    "devices.devicePlatform": 1,
    "devices.deviceRegistrationStatus": 1,
    "devices.isPrimary": 1,
    "devices.isFirstDevice": 1,
    "devices.isSecondaryDevice": 1,
    "devices.customName": 1,
    "devices.lastUsed": 1,
    "devices.lastUpdated": 1,
  };

  Meteor.publish("deviceDetails.byUser", function (userId) {
    check(userId, String);

    // A user may only subscribe to their own device list.
    if (!this.userId || this.userId !== userId) {
      return this.ready();
    }

    return DeviceDetails.find(
      { userId: this.userId },
      { fields: OWN_DEVICE_FIELDS },
    );
  });

  // Pre-login registration check (used before a session exists). Exposes only
  // whether the device is registered and its status — no user identifiers,
  // tokens, or secrets.
  Meteor.publish("deviceDetails.byDevice", function (deviceUUID) {
    check(deviceUUID, String);

    return DeviceDetails.find(
      { "devices.deviceUUID": deviceUUID },
      {
        fields: {
          "devices.deviceUUID": 1,
          "devices.deviceRegistrationStatus": 1,
        },
      },
    );
  });
}
