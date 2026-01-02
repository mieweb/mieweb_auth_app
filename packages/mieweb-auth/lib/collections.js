import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { SHA256 } from 'meteor/sha';
import { Random } from 'meteor/random';

// Device Details Collection
export const DeviceDetails = new Mongo.Collection('deviceDetails');

// Notification History Collection  
export const NotificationHistory = new Mongo.Collection('notificationHistory');

// Pending Responses Collection
export const PendingResponses = new Mongo.Collection('pendingResponses');

// Approval Tokens Collection
export const ApprovalTokens = new Mongo.Collection('approvalTokens');

// Utility function for generating app IDs
export const generateAppId = (deviceUUID, email, creationTime) => {
  const combinedString = `${deviceUUID}:${email}:${creationTime}`;
  return SHA256(combinedString).substring(0, 32);
};

// Create indexes for better query performance
if (Meteor.isServer) {
  Meteor.startup(() => {
    try {
      // DeviceDetails indexes
      DeviceDetails.createIndex({ userId: 1 });
      DeviceDetails.createIndex({ userId: 1, 'devices.deviceUUID': 1 });
      DeviceDetails.createIndex({ userId: 1, 'devices.appId': 1 });
      DeviceDetails.createIndex({ 'devices.deviceUUID': 1 });
      DeviceDetails.createIndex({ 'devices.appId': 1 });
      DeviceDetails.createIndex({ 'devices.biometricSecret': 1 });
      
      // NotificationHistory indexes
      NotificationHistory.createIndex({ userId: 1 });
      NotificationHistory.createIndex({ appId: 1 });
      NotificationHistory.createIndex({ notificationId: 1 });
      NotificationHistory.createIndex({ status: 1 });
      
      // PendingResponses indexes
      PendingResponses.createIndex({ username: 1 });
      PendingResponses.createIndex({ requestId: 1 });
      PendingResponses.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      
      console.log('MiewebAuth collections indexes created successfully');
    } catch (error) {
      console.error('Error creating MiewebAuth indexes:', error);
    }
  });
}
