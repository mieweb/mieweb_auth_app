import { Meteor } from 'meteor/meteor';
import { DeviceDetails, NotificationHistory, PendingResponses } from '../lib/collections.js';

// Publications for DeviceDetails
Meteor.publish('deviceDetails.byUser', function(userId) {
  if (!this.userId) {
    return this.ready();
  }
  
  return DeviceDetails.find({ userId });
});

Meteor.publish('deviceDetails.byDevice', function(deviceUUID) {
  if (!this.userId) {
    return this.ready();
  }
  
  return DeviceDetails.find({ 'devices.deviceUUID': deviceUUID });
});

// Publications for NotificationHistory
Meteor.publish('notificationHistory.byUser', function (userId) {
  if (!this.userId) {
    return this.ready();
  }
  
  return NotificationHistory.find({ userId });
});

Meteor.publish('notificationHistory.byStatus', function (status) {
  if (!this.userId) {
    return this.ready();
  }
  
  return NotificationHistory.find({ status });
});

// Publications for PendingResponses
Meteor.publish('pendingResponses.byUser', function(username) {
  if (!this.userId) {
    return this.ready();
  }
  
  return PendingResponses.find({ username });
});
