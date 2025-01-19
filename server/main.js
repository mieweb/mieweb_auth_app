import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { sendNotification } from './firebase';
import { Accounts } from 'meteor/accounts-base';
import '../imports/api/deviceLogs.js'
import { check } from "meteor/check";

// Create a Map to store pending notifications
const pendingNotifications = new Map();
const responsePromises = new Map();

WebApp.connectHandlers.use('/send-notification', async (req, res) => {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const requestBody = JSON.parse(body);
      console.log('Received request body:', requestBody);

      const { appId, title, body: messageBody, actions } = requestBody;

      if (!appId || !title || !messageBody || !actions) {
        throw new Error('Missing required fields');
      }

      // Get FCM token
      const fcmToken = await new Promise((resolve, reject) => {
        Meteor.call('deviceLogs.getFCMTokenByAppId', appId, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      // Send notification
      await sendNotification(fcmToken, title, messageBody, actions);
      console.log('Notification sent successfully');

      // Create promise for user response
      const userResponsePromise = new Promise((resolve) => {
        // Store the FCM token as the appId since that's what we'll get back
        responsePromises.set(fcmToken, resolve);

        // Add timeout
        setTimeout(() => {
          if (responsePromises.has(fcmToken)) {
            resolve('timeout');
            responsePromises.delete(fcmToken);
          }
        }, 300000); // 5 minute timeout
      });

      // Wait for user response
      const userResponse = await userResponsePromise;
      console.log("USER RESPONSE", userResponse)

      // Send final response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        action: userResponse
      }));

    } catch (error) {
      console.error('Error in /send-notification:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message
      }));
    }
  });
});

// Meteor methods
Meteor.methods({
  async 'notifications.handleResponse'(appId, action) {
    check(appId, String);
    check(action, String);

    console.log(`Handling notification response for appId: ${appId}, action: ${action}`);

    // If we have a pending promise for this notification, resolve it
    if (responsePromises.has(appId)) {
      const resolve = responsePromises.get(appId);
      resolve(action);
      responsePromises.delete(appId);
      return { success: true, message: `Response ${action} processed successfully` };
    } else {
      console.log('No pending promise found for appId:', appId);
      return { success: false, message: 'No pending notification found' };
    }

  },

  async userAction(action, requestId, replyText = null) {
    check(action, String);
    check(requestId, String);
    if (replyText) check(replyText, String);

    const validActions = ['approve', 'reject', 'reply'];
    if (!validActions.includes(action)) {
      throw new Meteor.Error('invalid-action', 'Invalid action performed by the user.');
    }

    const pendingNotification = pendingNotifications.get(requestId);
    if (pendingNotification) {
      clearTimeout(pendingNotification.timeout);
      pendingNotification.resolve({ action, replyText });
      pendingNotifications.delete(requestId);
      return { success: true, action, replyText };
    } else {
      throw new Meteor.Error('invalid-request', 'No pending notification found for this request.');
    }
  },

  async 'users.register'(userDetails) {
    check(userDetails, {
      email: String,
      pin: String,
      firstName: String,
      lastName: String,
      sessionDeviceInfo: {
        model: String,
        platform: String,
        uuid: String,
        version: String,
        manufacturer: String,
      },
      fcmDeviceToken: String,
    });

    const { email, pin, firstName, lastName, sessionDeviceInfo } = userDetails;
    const fcmToken = userDetails.fcmDeviceToken;

    // Check if user exists
    if (await Meteor.users.findOneAsync({ 'emails.address': email })) {
      throw new Meteor.Error('user-exists', 'User already exists with this email');
    }

    try {
      // Create user in Meteor users collection
      const userId = await Accounts.createUser({
        email,
        password: pin,
        profile: {
          firstName,
          lastName,
          deviceInfo: sessionDeviceInfo,
          deviceToken: fcmToken,
        },
      });

      if (userId) {
        console.log(`user id in server is: ${userId}`);

        // Ensure userId is passed as a string
        await Meteor.call('deviceLogs.upsert', {
          userId: userId.toString(),
          email,
          deviceUUID: sessionDeviceInfo.uuid,
          fcmToken,
          deviceInfo: sessionDeviceInfo,
        });
      }

      return {
        success: true,
        userId,
        message: 'Registration successful',
      };
    } catch (error) {
      console.error('Error during registration:', error);
      throw new Meteor.Error('registration-failed', error.message);
    }
  },

  async getUserDetails(email) {
    if (!email) {
      throw new Meteor.Error('Email is required');
    }

    const user = await Meteor.users.findOneAsync({ 'emails.address': email });

    if (!user) {
      throw new Meteor.Error('User not found');
    }

    return {
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      email: user.emails[0].address || '',
    };
  },


  async 'users.checkRegistration'(fcmToken) {
    check(fcmToken, String);

    const user = Meteor.users.findOneAsync({ 'profile.fcmToken': fcmToken });
    if (!user) {
      throw new Meteor.Error('device-deregistered', 'This device is deregistered. Please register again.');
    }
    return user._id;
  },

  async 'users.mapFCMTokenToUser'(userId, fcmToken) {
    check(userId, String);
    check(fcmToken, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'User must be logged in');
    }

    const user = Meteor.users.findOne(userId);
    if (!user) {
      throw new Meteor.Error('user-not-found', 'User not found');
    }

    // Map token to the user
    Meteor.users.update(userId, {
      $set: {
        'profile.fcmToken': fcmToken,
      },
    });
  },
  async checkUsersExist() {
    try {
      const userCount = await Meteor.users.find().countAsync();
      console.log('User count:', userCount);
      return userCount > 0;
    } catch (error) {
      console.error('Error in checkUsersExist:', error);
      throw new Meteor.Error('server-error', 'Failed to check user existence');
    }
  },

});


Meteor.startup(() => {
  // Meteor.publish('deviceLogs', function (deviceUuid) {
  //   console.log("Publishing deviceLogs for UUID:", deviceUuid);

  //   if (!deviceUuid) {
  //     console.log("No UUID provided, returning empty set");
  //     return this.ready();
  //   }

  //   const query = { deviceUUID: deviceUuid };
  //   console.log("MongoDB query:", query);

  //   const records = DeviceLogs.find(query, { 
  //     fields: { 
  //       deviceUUID: 1, 
  //       email: 1,
  //       fcmToken: 1 
  //     } 
  //   });

  //   console.log("Found records count:", records.countAsync());
  //   return records;
  // });

});