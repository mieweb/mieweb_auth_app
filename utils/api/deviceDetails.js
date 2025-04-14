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
  console.log(" ### Log Step 6 : Inside /utils/api/deviceDetails.js and checking all the data received");
  check(data, {
    username: String,
    biometricSecret: String,
    userId: String,
    email: String,
    deviceUUID: String,
    fcmToken: String,
    firstName: String,
    lastName: String,
    isPrimaryDevice: Match.Optional(Boolean), // New parameter
    deviceStatus: Match.Optional(String) // New parameter: 'pending' or 'approved'
  });

  const creationTime = new Date().toISOString();
  const appId = generateAppId(data.deviceUUID, data.username, creationTime);
  console.log(" ### Log Step 6.1  : Inside /utils/api/deviceDetails.js,  generating app Id", JSON.stringify({appId}));
  
  const userDeviceDoc = await DeviceDetails.findOneAsync({ userId: data.userId });
  console.log(`### Log Step 6.2 : Inside /utils/api/deviceDetails.js, fetching existing device details if any(against userId : ${data.userId}),  userDeviceDoc: ${JSON.stringify(userDeviceDoc)}`);
  
  // Determine if this is a primary device (first device for the user)
  const isPrimaryDevice = data.isPrimaryDevice || false;
  const deviceStatus = data.deviceStatus || 'approved';
  
  if (userDeviceDoc) {
    // Check if device already exists
    const existingDeviceIndex = userDeviceDoc.devices.findIndex(
      device => device.deviceUUID === data.deviceUUID
    );
    console.log(`### Log Step 6.2 : Inside /utils/api/deviceDetails.js, fetching existing device details, existingDeviceIndex: ${existingDeviceIndex}`);
    
    if (existingDeviceIndex !== -1) {
      // Update existing device
      console.log(`### Log Step 6.3 : Inside /utils/api/deviceDetails.js, Existing device details found and updating it, existingDeviceIndex: ${existingDeviceIndex}`);
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
              isPrimaryDevice: userDeviceDoc.devices[existingDeviceIndex].isPrimaryDevice,
              deviceStatus: userDeviceDoc.devices[existingDeviceIndex].deviceStatus,
              lastUpdated: new Date()
            }
          }
        }
      );
      return userDeviceDoc.devices[existingDeviceIndex].appId;
    } else {
      // Add new device to existing user document
      console.log('### Log Step 6.3 : Inside /utils/api/deviceDetails.js, Existing device details not found thus creating a new device details against the existing user');
      
      // Check if there's already a primary device
      const hasPrimaryDevice = userDeviceDoc.devices.some(device => device.isPrimaryDevice && device.deviceStatus === 'approved');
      
      // If this is a new device for a user who already has a primary device, 
      // we'll automatically mark it as pending for the primary device's approval
      const shouldRequireApproval = hasPrimaryDevice && !isPrimaryDevice;
      const newDeviceStatus = shouldRequireApproval ? 'pending' : deviceStatus;
      
      // If there's a primary device and this is a secondary device, notify the primary device
      if (shouldRequireApproval) {
        const primaryDevices = userDeviceDoc.devices.filter(device => 
          device.isPrimaryDevice && device.deviceStatus === 'approved'
        );
        
        // Send notifications to all primary devices
        for (const primaryDevice of primaryDevices) {
          try {
            await Meteor.callAsync('sendDeviceApprovalNotification', {
              fcmToken: primaryDevice.fcmToken,
              newDeviceInfo: {
                deviceUUID: data.deviceUUID,
                appId: appId
              },
              username: data.username
            });
          } catch (error) {
            console.error('Failed to send notification to primary device:', error);
          }
        }
      }
      
      await DeviceDetails.updateAsync(
        { userId: data.userId },
        {
          $push: {
            devices: {
              deviceUUID: data.deviceUUID,
              appId: appId,
              biometricSecret: data.biometricSecret,
              fcmToken: data.fcmToken,
              isPrimaryDevice: isPrimaryDevice,
              deviceStatus: newDeviceStatus,
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
    console.log('### Log Step 6.4 : Inside /utils/api/deviceDetails.js, Create new user document with first device ');
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
        isPrimaryDevice: isPrimaryDevice,
        deviceStatus: deviceStatus,
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
 * Approve or reject a device registration request
 * @param {String} userId - User ID
 * @param {String} deviceUUID - Device UUID to approve/reject
 * @param {Boolean} approve - Whether to approve or reject
 * @returns {Object} Update result
 */
'deviceDetails.approveDevice': async function(userId, deviceUUID, approve) {
  check(userId, String);
  check(deviceUUID, String);
  check(approve, Boolean);
  
  // Only allow admin users to approve/reject devices
  if (!Roles.userIsInRole(this.userId, ['admin'])) {
    throw new Meteor.Error('not-authorized', 'You must be an admin to approve devices');
  }
  
  const userDeviceDoc = await DeviceDetails.findOneAsync({ 
    userId: userId,
    'devices.deviceUUID': deviceUUID
  });
  
  if (!userDeviceDoc) {
    throw new Meteor.Error('device-not-found', 'Device not found');
  }
  
  const device = userDeviceDoc.devices.find(d => d.deviceUUID === deviceUUID);
  if (!device) {
    throw new Meteor.Error('device-not-found', 'Device not found');
  }
  
  // Update device status
  const result = await DeviceDetails.updateAsync(
    { 
      userId: userId,
      'devices.deviceUUID': deviceUUID
    },
    {
      $set: {
        'devices.$.deviceStatus': approve ? 'approved' : 'rejected',
        'devices.$.lastUpdated': new Date(),
        lastUpdated: new Date()
      }
    }
  );
  
  // Update user profile status if this is the primary device
  if (device.isPrimaryDevice) {
    await Meteor.users.updateAsync(
      { _id: userId },
      {
        $set: {
          'profile.registrationStatus': approve ? 'approved' : 'rejected'
        }
      }
    );
  }
  
  // Send notification to the user's device
  try {
    await Meteor.callAsync('sendRegistrationStatusNotification', {
      fcmToken: device.fcmToken,
      approved: approve,
      isPrimaryDevice: device.isPrimaryDevice
    });
  } catch (notificationError) {
    console.error('Failed to send registration status notification:', notificationError);
  }
  
  return result;
},
/**
 * Approve a new device from a primary device
 * @param {String} userId - User ID
 * @param {String} primaryDeviceUUID - Primary device UUID
 * @param {String} newDeviceUUID - New device UUID to approve
 * @param {Boolean} approve - Whether to approve or reject
 * @returns {Object} Update result
 */
'deviceDetails.approveNewDeviceFromPrimary': async function(userId, primaryDeviceUUID, newDeviceUUID, approve) {
  check(userId, String);
  check(primaryDeviceUUID, String);
  check(newDeviceUUID, String);
  check(approve, Boolean);
  
  // First verify that the primaryDeviceUUID is actually a primary device for this user
  const userDeviceDoc = await DeviceDetails.findOneAsync({ 
    userId: userId,
    'devices.deviceUUID': primaryDeviceUUID,
    'devices.isPrimaryDevice': true,
    'devices.deviceStatus': 'approved'
  });
  
  if (!userDeviceDoc) {
    throw new Meteor.Error('not-authorized', 'You are not authorized to approve devices');
  }
  
  // Update the new device status
  const result = await DeviceDetails.updateAsync(
    { 
      userId: userId,
      'devices.deviceUUID': newDeviceUUID
    },
    {
      $set: {
        'devices.$.deviceStatus': approve ? 'approved' : 'rejected',
        'devices.$.lastUpdated': new Date(),
        lastUpdated: new Date()
      }
    }
  );
  
  // Find the new device to send notification
  const updatedUserDeviceDoc = await DeviceDetails.findOneAsync({ 
    userId: userId,
    'devices.deviceUUID': newDeviceUUID
  });
  
  if (updatedUserDeviceDoc) {
    const newDevice = updatedUserDeviceDoc.devices.find(d => d.deviceUUID === newDeviceUUID);
    if (newDevice) {
      // Send notification to the new device
      try {
        await Meteor.callAsync('sendRegistrationStatusNotification', {
          fcmToken: newDevice.fcmToken,
          approved: approve,
          isPrimaryDevice: false
        });
      } catch (notificationError) {
        console.error('Failed to send registration status notification:', notificationError);
      }
    }
  }
  
  return result;
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