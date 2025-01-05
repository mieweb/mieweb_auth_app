import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { sendNotification } from './firebase';
import { Accounts } from 'meteor/accounts-base';
import '../imports/api/deviceLogs.js'
import { check } from "meteor/check";
import { DeviceLogs } from '../imports/api/deviceLogs.js';

// Create a Map to store pending notifications
const pendingNotifications = new Map();
let successBool = false;

// Notification endpoint
WebApp.connectHandlers.use('/send-notification', async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const { token, title, body: messageBody, actions } = JSON.parse(body);

      // Validate inputs
      if (!token || !title || !messageBody || !actions) {
        throw new Error('Missing required fields');
      }

      // Send the push notification using Firebase
      await sendNotification(token, title, messageBody, actions);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: successBool }));
      successBool = !successBool;
    } catch (error) {
      console.error('Error processing request:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  });
});

// Meteor methods
Meteor.methods({
  async saveFCMToken(token) {
    console.log('Received FCM token:', token);
    // Additional logic can be added here
  },

  async updateFCMToken(token) {
    console.log('Updated FCM token:', token);
    // Additional logic can be added here
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
      sessionDeviceInfo: Object, // Ensure sessionDeviceInfo is an object
    });

    console.log(`User details to register: ${JSON.stringify({ userDetails })}`);

    const { email, pin, firstName, lastName, sessionDeviceInfo } = userDetails;

    // Check if the user already exists
    if (await Meteor.users.findOneAsync({ 'emails.address': email })) {
      throw new Meteor.Error('user-exists', 'User already exists with this email');
    }

    try {
      // Create user in Meteor users collection
      const userId = Accounts.createUser({
        email,
        password: pin,
        profile: { firstName, lastName },
      });

      // Save device details in deviceLogs collection
      await DeviceLogs.insertAsync({
        userId,
        email,
        deviceUUID: sessionDeviceInfo.uuid,
        createdAt: new Date(),
      });

      // Simulate Tailwind loading animation and show success prompt
      return { success: true, message: 'Registration successful. Redirecting to login page...' };
    } catch (error) {
      console.error('Error during registration:', error);
      throw new Meteor.Error('registration-failed', 'An error occurred during registration. Please try again later.');
    }
  },

  async 'users.login'({ email, password, deviceDetails }) {
    console.log('Login attempt:', { email, password });
    const user = await Meteor.users.findOneAsync({ "emails.address": email });
    if (!user) {
      console.error('User not found:', email);
      throw new Meteor.Error('user-not-found', 'No user found with this email');
    }
  
    try {
      const loginResult = await Accounts.loginWithPassword(email, password);
      console.log('Login successful:', loginResult);
      return loginResult;
    } catch (error) {
      console.error('Login error:', error);
      throw new Meteor.Error('login-failed', 'Invalid email or password');
    }
  },  

  async 'users.checkRegistration'(fcmToken) {
    check(fcmToken, String);

    const user = Meteor.users.findOneAsync({ 'profile.fcmToken': fcmToken });
    if (!user) {
      throw new Meteor.Error('device-deregistered', 'This device is deregistered. Please register again.');
    }
    return user._id;
  },

  async 'users.mapFCMTokenToUser' (userId, fcmToken) {
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
  Meteor.publish('deviceLogs', function (deviceUuid) {
    console.log("Publishing deviceLogs for UUID:", deviceUuid);
    
    if (!deviceUuid) {
      console.log("No UUID provided, returning empty set");
      return this.ready();
    }
    
    const query = { deviceUUID: deviceUuid };
    console.log("MongoDB query:", query);
    
    const records = DeviceLogs.find(query, { 
      fields: { 
        deviceUUID: 1, 
        email: 1,
        fcmToken: 1 
      } 
    });
    
    console.log("Found records count:", records.countAsync());
    return records;
  });
});
