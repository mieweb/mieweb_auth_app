import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { SHA256 } from 'meteor/sha'; 

// Initialize collection
const DeviceDetails = new Mongo.Collection('deviceDetails');

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
      DeviceDetails.createIndex({ userId: 1, 'devices.deviceUUID': 1 });
      DeviceDetails.createIndex({ userId: 1, 'devices.appId': 1 });
      
      // Index for device-specific queries
      DeviceDetails.createIndex({ 'devices.deviceUUID': 1 });
      DeviceDetails.createIndex({ 'devices.appId': 1 });
      
      // Index for the device specific biometric secret
      DeviceDetails.createIndex({ 'devices.biometricSecret': 1 });
      console.log('DeviceDetails indexes created successfully');
    } catch (error) {
      console.error('Error creating DeviceDetails indexes:', error);
    }
  });
}

// Define methods for DeviceDetails
Meteor.methods({
  /**
   * Upsert device details
   * @param {Object} data - Device details data
   * @returns {String} Generated appId
   */
  'deviceDetails': async function(data) {
    check(data, {
      username: String,
      biometricSecret: String,
      userId: String,
      email: String,
      deviceUUID: String,
      fcmToken: String,
      firstName: String,
      lastName: String
    });
  
    const creationTime = new Date().toISOString();
    const appId = generateAppId(data.deviceUUID, data.username, creationTime);
    
    const userDeviceDoc = await DeviceDetails.findOneAsync({ userId: data.userId });
    console.log(`userDeviceDoc: ${JSON.stringify(userDeviceDoc)}`);
    
    
    if (userDeviceDoc) {
      // Check if device already exists
      const existingDeviceIndex = userDeviceDoc.devices.findIndex(
        device => device.deviceUUID === data.deviceUUID
      );
      console.log(`existingDeviceIndex: ${existingDeviceIndex}`);
      if (existingDeviceIndex !== -1) {
        // Update existing device
        await DeviceDetails.updateAsync(
          { 
            userId: data.userId,            
          },
          {
            $set: {
              email: data.email,
              username: data.username,                           
              lastUpdated: new Date(),
              [`devices.${existingDeviceIndex}`]: {
                deviceUUID: data.deviceUUID,
                appId: userDeviceDoc.devices[existingDeviceIndex].appId,
                biometricSecret: data.biometricSecret,
                fcmToken: data.fcmToken,
                lastUpdated: new Date()
              }
            }
          }
        );
        return userDeviceDoc.devices[existingDeviceIndex].appId;
      } else {
        // Add new device to existing user document
        await DeviceDetails.updateAsync(
          { userId: data.userId },
          {
            $push: {
              devices: {
                deviceUUID: data.deviceUUID,
                appId: appId,
                biometricSecret: data.biometricSecret,
                fcmToken: data.fcmToken,
                lastUpdated: new Date()
              }
            },
            $set: {
              email: data.email,
              username: data.username,
              firstName: data.firstName,
              lastName: data.lastName,
              lastUpdated: new Date()
            }
          }
        );
        return appId;
      }
    } else {
      // Create new user document with first device
      await DeviceDetails.insertAsync({
        userId: data.userId,
        email: data.email,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        devices: [{
          deviceUUID: data.deviceUUID,
          appId: appId,
          biometricSecret: data.biometricSecret,
          fcmToken: data.fcmToken,
          lastUpdated: new Date()
        }],
        createdAt: new Date(),
        lastUpdated: new Date()
      });
      return appId;
    }
  },
  
  /**
   * Update FCM token for a device
   * @param {String} userId - User ID
   * @param {String} deviceUUID - Device unique identifier
   * @param {String} fcmToken - Firebase Cloud Messaging token
   * @returns {Object} Update result
   */
  'deviceDetails.updateToken': async function(userId, deviceUUID, fcmToken) {
    check(userId, String);
    check(deviceUUID, String);
    check(fcmToken, String);

    return DeviceDetails.updateAsync(
      { 
        userId,
        'devices.deviceUUID': deviceUUID 
      },
      {
        $set: {
          'devices.$.fcmToken': fcmToken,
          'devices.$.lastUpdated': new Date(),
          lastUpdated: new Date()
        }
      }
    );
  },
  
  /**
   * Get all FCM tokens by username
   * @param {String} username - Username
   * @returns {Array} Array of FCM tokens
   */
  'deviceDetails.getFCMTokenByUsername': async function(username) {
    check(username, String);
    
    const userDoc = await DeviceDetails.findOneAsync({ username });
    if (!userDoc) {
      throw new Meteor.Error('invalid-username', 'No device found with this Username');
    }
    
    // Return array of FCM tokens from all devices
    return userDoc.devices.map(device => device.fcmToken);
  },
  
  /**
   * Get FCM token by device UUID
   * @param {String} deviceUUID - Device unique identifier
   * @returns {String} FCM token
   */
  'deviceDetails.getFCMTokenByDeviceId': async function(deviceUUID) {
    check(deviceUUID, String);
    
    const userDoc = await DeviceDetails.findOneAsync({ 'devices.deviceUUID': deviceUUID });
    if (!userDoc) {
      throw new Meteor.Error('invalid-device-id', 'No device found with this Device ID');
    }
    
    const device = userDoc.devices.find(d => d.deviceUUID === deviceUUID);
    return device.fcmToken;
  },
  
  /**
   * Get device details by App ID
   * @param {String} appId - App identifier
   * @returns {Object} Device details
   */
  'deviceDetails.getByAppId': async function(appId) {
    check(appId, String);
    const userDoc = await DeviceDetails.findOneAsync({ 'devices.appId': appId });
    if (!userDoc) return null;
    return userDoc.devices.find(d => d.appId === appId);
  },
  
  /**
   * Get all devices by user ID
   * @param {String} userId - User ID
   * @returns {Array} List of device details
   */
  'deviceDetails.getByUserId': async function(userId) {
    check(userId, String);
    const userDoc = await DeviceDetails.findOneAsync({ userId });
    return userDoc ? userDoc.devices : [];
  }
});

// Publish device details
if (Meteor.isServer) {
  Meteor.publish('deviceDetails.byUser', function(userId) {
    check(userId, String);
    return DeviceDetails.find({ userId });
  });

  Meteor.publish('deviceDetails.byDevice', function(deviceUUID) {
    check(deviceUUID, String);
    return DeviceDetails.find({ 'devices.deviceUUID': deviceUUID });
  });
}