// Example server setup for using the Mieweb Auth Package
import { Meteor } from 'meteor/meteor';
import { MiewebAuthServer } from 'meteor/mieweb:auth';

Meteor.startup(() => {
  // Configure the Mieweb Auth package
  MiewebAuthServer.configure({
    firebaseServiceAccount: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'),
    emailSettings: {
      mailUrl: process.env.MAIL_URL
    },
    customSettings: {
      appName: 'Your Custom App Name',
      requireAdminApproval: true,
      requireSecondaryDeviceApproval: true,
      notificationSettings: {
        retryAttempts: 3,
        retryDelay: 5000
      }
    }
  });
  
  console.log('Mieweb Auth package configured successfully');
});

// Example: Custom server method that uses the package collections
Meteor.methods({
  'customApp.getDeviceCount': function() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized');
    }
    
    // Use the package collections
    const { DeviceDetails } = require('meteor/mieweb:auth');
    const userDoc = DeviceDetails.findOne({ userId: this.userId });
    
    return userDoc ? userDoc.devices.length : 0;
  },
  
  'customApp.sendCustomNotification': async function(title, body, data = {}) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized');
    }
    
    // Use the package notification functions
    const { sendNotification, DeviceDetails } = require('meteor/mieweb:auth');
    
    // Get user's FCM tokens
    const tokens = await Meteor.callAsync('deviceDetails.getFCMTokenByUserId', this.userId);
    
    // Send to all user devices
    const results = [];
    for (const token of tokens) {
      try {
        const result = await sendNotification(token, title, body, data);
        results.push({ token, result });
      } catch (error) {
        console.error('Failed to send notification to token:', token, error);
        results.push({ token, error: error.message });
      }
    }
    
    return results;
  }
});

// Example: Custom publication that extends the package
Meteor.publish('customApp.enhancedDeviceDetails', function() {
  if (!this.userId) {
    return this.ready();
  }
  
  // Use package collections in custom publications
  const { DeviceDetails, NotificationHistory } = require('meteor/mieweb:auth');
  
  return [
    DeviceDetails.find({ userId: this.userId }),
    NotificationHistory.find({ userId: this.userId }, { 
      sort: { createdAt: -1 }, 
      limit: 50 
    })
  ];
});
