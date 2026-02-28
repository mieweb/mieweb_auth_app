import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { Random } from 'meteor/random';
import { SHA256 } from 'meteor/sha';
import { DeviceDetails, NotificationHistory, PendingResponses, generateAppId } from './collections.js';
import { isValidToken } from './utils.js';

// All Meteor methods are defined in the original API files in utils/api/
// They will be loaded by the original files that are still part of the main app
// This file just exports the method name constants for easy reference

// Export commonly used method names for convenience
export const MiewebAuthMethods = {
  DEVICE_DETAILS: 'deviceDetails',
  UPDATE_DEVICE_FCM_TOKEN: 'updateDeviceFCMToken',
  UPDATE_DEVICE_STATUS: 'updateDeviceStatus',
  GET_USER_DEVICES: 'getUserDevices',
  GET_DEVICE_BY_UUID: 'getDeviceByUUID',
  VERIFY_BIOMETRIC_SECRET: 'verifyBiometricSecret',
  
  NOTIFICATION_INSERT: 'notificationHistory.insert',
  NOTIFICATION_UPDATE_STATUS: 'notificationHistory.updateStatus',
  NOTIFICATION_GET_BY_USER: 'notificationHistory.getByUser',
  NOTIFICATION_DELETE_OLD: 'notificationHistory.deleteOld',
  
  PENDING_RESPONSE_CREATE: 'pendingResponses.create',
  PENDING_RESPONSE_UPDATE: 'pendingResponses.update',
  PENDING_RESPONSE_GET: 'pendingResponses.get',
  PENDING_RESPONSE_CLEANUP: 'pendingResponses.cleanup',
  
  USER_PROFILE_UPDATE: 'userProfile.update',
  USER_PROFILE_GET: 'userProfile.get'
};
