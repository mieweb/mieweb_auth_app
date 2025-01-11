import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { SHA256 } from 'meteor/sha'; 

export const DeviceLogs = new Mongo.Collection('deviceLogs');



// Add generateAppId utility function
const generateAppId = (deviceUUID, email, creationTime) => {
    const combinedString = `${deviceUUID}:${email}:${creationTime}`;
    return SHA256(combinedString).substring(0, 32);
  };
  

// Create indexes for better query performance
if (Meteor.isServer) {
  Meteor.startup(() => {
    DeviceLogs.createIndex({ userId: 1 });
    DeviceLogs.createIndex({ deviceUUID: 1 });
    DeviceLogs.createIndex({ email: 1 });
    DeviceLogs.createIndex({ appId: 1 });
  });
}

// Define methods for DeviceLogs
Meteor.methods({
    'deviceLogs.upsert': async function(data) {
        check(data, {
          userId: String,
          email: String,
          deviceUUID: String,
          fcmToken: String,
          deviceInfo: Object,
        });
      
        const creationTime = new Date().toISOString();
        const appId = generateAppId(data.deviceUUID, data.email, creationTime);
        console.log('Generated appId during upsert:', appId); // Add this log
        
        return DeviceLogs.upsertAsync(
          {
            userId: data.userId,
            deviceUUID: data.deviceUUID,
          },
          {
            $set: {
              email: data.email,
              fcmToken: data.fcmToken,
              appId: appId,
              lastUpdated: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          }
        );
      },
  'deviceLogs.updateToken'(userId, deviceUUID, fcmToken) {
    check(userId, String);
    check(deviceUUID, String);
    check(fcmToken, String);

    return DeviceLogs.updateAsync(
      { 
        userId: userId,
        deviceUUID: deviceUUID 
      },
      {
        $set: {
          fcmToken: fcmToken,
          lastUpdated: new Date()
        }
      }
    );
  },
  'deviceLogs.getFCMTokenByAppId': async function(appId) {
    check(appId, String);
    
    const deviceLog = await DeviceLogs.findOneAsync({ appId: appId });
    
    if (!deviceLog) {
      throw new Meteor.Error('invalid-app-id', 'No device found with this App ID');
    }
    
    return deviceLog.fcmToken;
  },
  
  // Also fix the debug method
  'deviceLogs.getByAppId': async function(appId) {
    check(appId, String);
    const result = await DeviceLogs.findOneAsync({ appId });
    console.log('Looking for appId:', appId);
    console.log('Found device log:', result);
    return result;
  }
});

// Publish device logs
if (Meteor.isServer) {
  Meteor.publish('deviceLogs.byUser', function(userId) {
    check(userId, String);
    return DeviceLogs.find({ userId: userId });
  });

  Meteor.publish('deviceLogs.byDevice', function(deviceUUID) {
    check(deviceUUID, String);
    return DeviceLogs.find({ deviceUUID: deviceUUID });
  });
}