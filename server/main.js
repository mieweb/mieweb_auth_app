import { Meteor } from "meteor/meteor";
import { WebApp } from "meteor/webapp";
import { sendNotification } from "./firebase";
import { Accounts } from "meteor/accounts-base";
import "../imports/api/deviceDetails.js";
import { check } from "meteor/check";
import { DeviceDetails } from "../imports/api/deviceDetails.js";
import { NotificationHistory } from "../imports/api/notificationHistory";
import { Random } from "meteor/random";

// Create Maps to store pending notifications and response promises
const pendingNotifications = new Map();
const responsePromises = new Map();

/**
 * Save notification history for a user
 * @param {Object} notification - Notification details
 */
const saveUserNotificationHistory = async (notification) => {
  const { appId, title, body } = notification;

  const userDoc = await DeviceDetails.findOneAsync({ 'devices.appId': appId });
  if (!userDoc) {
    console.error("No user found for appId:", appId);
    return;
  }

  const device = userDoc.devices.find(d => d.appId === appId);
  const userId = userDoc.userId;
  const data = { userId, appId, title, body };

  Meteor.call("notificationHistory.insert", data, (error, result) => {
    if (error) {
      console.error("Error inserting notification:", error);
    } else {
      console.log("Notification inserted successfully:", result);
    }
  });
};

// Handle notification endpoint
WebApp.connectHandlers.use("/send-notification", async (req, res) => {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const requestBody = JSON.parse(body);
      console.log("Received request body:", requestBody);

      const { username, title, body: messageBody, actions } = requestBody;

      if (!username || !title || !messageBody || !actions) {
        throw new Error("Missing required fields");
      }

      // Get FCM tokens for the username
      const fcmTokens = await new Promise((resolve, reject) => {
        Meteor.call("deviceDetails.getFCMTokenByUsername", username, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      if (!fcmTokens || fcmTokens.length === 0) {
        throw new Error("No FCM tokens found for the given username");
      }

      // Get user document for appId
      const userDoc = await DeviceDetails.findOneAsync({ username });
      if (!userDoc) {
        throw new Error("User not found");
      }

      // Send notification to all devices of the user
      const notificationPromises = fcmTokens.map(fcmToken => 
        sendNotification(fcmToken, title, messageBody, actions)
      );

      await Promise.all(notificationPromises);
      console.log("Notifications sent successfully to all devices");

      // Save notification history for the user
      await saveUserNotificationHistory({
        appId: userDoc.devices[0].appId,
        title,
        body: messageBody,
        userId: userDoc.userId
      });

      // Create promise for user response
      const userResponsePromise = new Promise((resolve) => {
        // Use username as the key for response tracking
        responsePromises.set(username, resolve);

        // Add timeout
        setTimeout(() => {
          if (responsePromises.has(username)) {
            resolve("timeout");
            responsePromises.delete(username);
          }
        }, 25000); // 25 seconds timeout
      });

      // Wait for user response
      const userResponse = await userResponsePromise;
      console.log("USER RESPONSE", userResponse);

      // Send final response
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          action: userResponse,
        })
      );
    } catch (error) {
      console.error("Error in /send-notification:", error);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: error.message,
        })
      );
    }
  });
});

// Meteor methods
Meteor.methods({
  /**
   * Handle notification response
   * @param {String} username - Username
   * @param {String} action - User action
   * @returns {Object} Response status
   */
  async "notifications.handleResponse"(username, action) {
    check(username, String);
    check(action, String);

    console.log(`Handling notification response for username: ${username}, action: ${action}`);
    
    if (responsePromises.has(username)) {
      const resolve = responsePromises.get(username);
      resolve(action);
      responsePromises.delete(username);

      // Get all FCM tokens for the user
      const fcmTokens = await new Promise((resolve, reject) => {
        Meteor.call("deviceDetails.getFCMTokenByUsername", username, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      // Send a "notification handled" message to all devices
      const notificationPromises = fcmTokens.map(fcmToken => 
        sendNotification(fcmToken, "Notification Handled", "This notification has been handled on another device", [], true)
      );

      await Promise.all(notificationPromises);

      return {
        success: true,
        message: `Response ${action} processed successfully`,
      };
    } else {
      console.log("No pending promise found for username:", username);
      return { success: false, message: "No pending notification found" };
    }
  },
  
  /**
   * Login with biometric credentials
   * @param {String} secret - Biometric secret
   * @returns {Object} User data
   */
  async 'users.loginWithBiometric'(secret) {
    check(secret, String);
    
    // Find the device with this biometric secret
    const userDoc = await DeviceDetails.findOneAsync({ 'devices.biometricSecret': secret });
    
    if (!userDoc) {
      throw new Meteor.Error('not-found', 'Biometric credentials not found');
    }
    
    const device = userDoc.devices.find(d => d.biometricSecret === secret);
    
    // Get the user associated with this device
    const user = await Meteor.users.findOneAsync({ _id: userDoc.userId });
    
    if (!user) {
      throw new Meteor.Error('not-found', 'User not found with these biometric credentials');
    }
    
    // Return necessary user information for the session
    return {
      _id: user._id,
      email: user.emails[0].address,
      username: user.username,
      deviceLogId: device._id,
      appId: device.appId
    };
  },

  /**
   * Handle user action for notifications
   * @param {String} action - User action
   * @param {String} requestId - Request identifier
   * @param {String} replyText - Optional reply text
   * @returns {Object} Action result
   */
  async userAction(action, requestId, replyText = null) {
    check(action, String);
    check(requestId, String);
    if (replyText) check(replyText, String);

    const validActions = ["approve", "reject", "reply"];
    if (!validActions.includes(action)) {
      throw new Meteor.Error(
        "invalid-action",
        "Invalid action performed by the user."
      );
    }

    const pendingNotification = pendingNotifications.get(requestId);
    if (pendingNotification) {
      clearTimeout(pendingNotification.timeout);
      pendingNotification.resolve({ action, replyText });
      pendingNotifications.delete(requestId);
      return { success: true, action, replyText };
    } else {
      throw new Meteor.Error(
        "invalid-request",
        "No pending notification found for this request."
      );
    }
  },

  /**
   * Register a user or a new device for an existing user
   * @param {Object} userDetails - User registration details
   * @returns {Object} Registration result
   */
  async 'users.register'(userDetails) {
    check(userDetails, {
      email: String,
      username: String,
      pin: String,
      firstName: String,
      lastName: String,
      sessionDeviceInfo: Object,
      fcmDeviceToken: String,
      biometricSecret: String
    });

    const { email, username, pin, firstName, lastName, sessionDeviceInfo, fcmDeviceToken, biometricSecret } = userDetails;

    try {
      // Check if user already exists
      const existingUser = await Meteor.users.findOneAsync({
        $or: [
          { 'emails.address': { $regex: new RegExp(`^${email}$`, 'i') } },
          { username: { $regex: new RegExp(`^${username}$`, 'i') } }
        ]
      });

      let userId;
      if (existingUser) {
        // User exists, use their ID
        userId = existingUser._id;
      } else {
        // Create new user account
        userId = await new Promise((resolve, reject) => {
          Accounts.createUser({
            email,
            username,
            password: pin,
            profile: {
              firstName,
              lastName
            }
          }, (err) => {
            if (err) {
              console.error('Error creating user:', err);
              reject(err);
            } else {
              const newUser = Accounts.findUserByEmail(email);
              if (!newUser) {
                reject(new Meteor.Error('user-creation-failed', 'Failed to create user'));
              } else {
                resolve(newUser._id);
              }
            }
          });
        });
      }

      // Register or update device details
      await Meteor.callAsync('deviceDetails', {
        username,
        biometricSecret,
        userId,
        email,
        deviceUUID: sessionDeviceInfo.uuid,
        fcmToken: fcmDeviceToken,
        firstName,
        lastName
      });

      return {
        success: true,
        userId,
        message: existingUser ? 'Device registered successfully' : 'User registered successfully'
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw new Meteor.Error(
        error.error || 'registration-failed',
        error.reason || 'Failed to register user'
      );
    }
  },

  /**
   * Get user details by email
   * @param {String} email - User email
   * @returns {Object} User profile details
   */
  async getUserDetails(email) {
    check(email, String);

    const user = await Meteor.users.findOneAsync({ "emails.address": email });

    if (!user) {
      throw new Meteor.Error("User not found");
    }

    return {
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
      email: user.emails[0].address || "",
    };
  },

  /**
   * Check if a device is registered
   * @param {String} fcmToken - FCM token
   * @returns {String} User ID
   */
  async "users.checkRegistration"(fcmToken) {
    check(fcmToken, String);

    const deviceLog = await DeviceDetails.findOneAsync({ fcmToken: fcmToken });
    if (!deviceLog) {
      throw new Meteor.Error(
        "device-deregistered",
        "This device is deregistered. Please register again."
      );
    }
    return deviceLog.userId;
  },

  /**
   * Update user profile
   * @param {Object} profile - Profile data
   * @returns {Object} Update result
   */
  async updateUserProfile({ firstName, lastName, email }) {
    check(firstName, String);
    check(lastName, String);
    check(email, String);

    if (!this.userId) {
      throw new Meteor.Error(
        "not-authorized",
        "You must be logged in to update your profile"
      );
    }

    try {
      // Update the user's profile in the database
      await Meteor.users.updateAsync(this.userId, {
        $set: {
          "profile.firstName": firstName,
          "profile.lastName": lastName,
          "emails.0.address": email,
        },
      });

      return { success: true, message: "Profile updated successfully" };
    } catch (error) {
      console.error("Error updating profile:", error);
      throw new Meteor.Error("update-failed", "Failed to update profile", error);
    }
  },

  /**
   * Map FCM token to user
   * @param {String} userId - User ID
   * @param {String} fcmToken - FCM token
   * @returns {Object} Result
   */
  async "users.mapFCMTokenToUser"(userId, fcmToken) {
    check(userId, String);
    check(fcmToken, String);

    if (!this.userId) {
      throw new Meteor.Error("not-authorized", "User must be logged in");
    }

    const user = Meteor.users.findOne(userId);
    if (!user) {
      throw new Meteor.Error("user-not-found", "User not found");
    }

    // Find device log with this FCM token
    const deviceLog = await DeviceDetails.findOneAsync({ userId, fcmToken });
    
    // If device log exists, update it, otherwise create a new entry
    if (deviceLog) {
      await DeviceDetails.updateAsync(
        { _id: deviceLog._id },
        { $set: { fcmToken: fcmToken, lastUpdated: new Date() } }
      );
    }
    
    return { success: true };
  },
  
  /**
   * Check if any users exist in the system
   * @returns {Boolean} Whether users exist
   */
  async checkUsersExist() {
    try {
      const userCount = await Meteor.users.find().countAsync();
      console.log("User count:", userCount);
      return userCount > 0;
    } catch (error) {
      console.error("Error in checkUsersExist:", error);
      throw new Meteor.Error("server-error", "Failed to check user existence");
    }
  },
  
  /**
   * Update App ID in external system
   * @param {String} username - Username
   * @param {String} appId - App ID
   * @returns {Object} API response
   */
  'updateAppId': async function(username, appId) {
    try {
      // const result = await HTTP.post("https://937d-50-221-78-186.ngrok-free.app/update-app-id", {
      //   data: {
      //     username: username,
      //     appId: appId
      //   },
      //   headers: {
      //     'Content-Type': 'application/json'
      //   }
      // });
      const result = 'success';
      return result;
    } catch (error) {
      throw new Meteor.Error('api-error', error.message);
    }
  },
});

Meteor.startup(() => {
  // Create indexes for better performance

});