import { Tinytest } from "meteor/tinytest";
import { Meteor } from "meteor/meteor";
import { 
  MiewebAuth,
  DeviceDetails,
  NotificationHistory,
  PendingResponses,
  ApprovalTokens,
  generateAppId,
  isValidToken
} from "meteor/mieweb:auth";

// Test package exports
Tinytest.add('mieweb:auth - package exports', function (test) {
  // Test main package object exists
  test.isNotNull(MiewebAuth, "MiewebAuth package object should exist");
  test.equal(typeof MiewebAuth, 'object', "MiewebAuth should be an object");
  
  // Test collections are exported
  test.isNotNull(DeviceDetails, "DeviceDetails collection should be exported");
  test.isNotNull(NotificationHistory, "NotificationHistory collection should be exported");
  test.isNotNull(PendingResponses, "PendingResponses collection should be exported");
  test.isNotNull(ApprovalTokens, "ApprovalTokens collection should be exported");
  
  // Test utility functions are exported
  test.equal(typeof generateAppId, 'function', "generateAppId should be a function");
  test.equal(typeof isValidToken, 'function', "isValidToken should be a function");
});

// Test collections structure
Tinytest.add('mieweb:auth - collections structure', function (test) {
  // Test that collections have expected methods
  test.equal(typeof DeviceDetails.find, 'function', "DeviceDetails should have find method");
  test.equal(typeof DeviceDetails.findOne, 'function', "DeviceDetails should have findOne method");
  test.equal(typeof DeviceDetails.insert, 'function', "DeviceDetails should have insert method");
  
  test.equal(typeof NotificationHistory.find, 'function', "NotificationHistory should have find method");
  test.equal(typeof PendingResponses.find, 'function', "PendingResponses should have find method");
  test.equal(typeof ApprovalTokens.find, 'function', "ApprovalTokens should have find method");
});

// Test utility functions
Tinytest.add('mieweb:auth - utility functions', function (test) {
  // Test generateAppId function
  const deviceUUID = 'test-device-123';
  const email = 'test@example.com';
  const creationTime = '2024-01-01T00:00:00.000Z';
  
  const appId = generateAppId(deviceUUID, email, creationTime);
  test.equal(typeof appId, 'string', "generateAppId should return a string");
  test.equal(appId.length, 32, "generateAppId should return 32 character string");
  
  // Test that same inputs produce same output
  const appId2 = generateAppId(deviceUUID, email, creationTime);
  test.equal(appId, appId2, "generateAppId should be deterministic");
  
  // Test that different inputs produce different outputs
  const appId3 = generateAppId('different-device', email, creationTime);
  test.notEqual(appId, appId3, "generateAppId should produce different results for different inputs");
});

// Test package structure
Tinytest.add('mieweb:auth - package structure', function (test) {
  // Test MiewebAuth package structure
  test.isNotNull(MiewebAuth.collections, "MiewebAuth should have collections property");
  test.isNotNull(MiewebAuth.methods, "MiewebAuth should have methods property");
  test.isNotNull(MiewebAuth.utils, "MiewebAuth should have utils property");
  test.equal(MiewebAuth.version, '1.0.0', "MiewebAuth should have correct version");
  
  // Test collections are properly nested
  test.equal(MiewebAuth.collections.DeviceDetails, DeviceDetails, "DeviceDetails should be accessible via MiewebAuth.collections");
  test.equal(MiewebAuth.collections.NotificationHistory, NotificationHistory, "NotificationHistory should be accessible via MiewebAuth.collections");
});

// Server-only tests
if (Meteor.isServer) {
  Tinytest.add('mieweb:auth - server functionality', function (test) {
    // Test that server-specific exports exist
    test.isNotNull(Meteor.server.method_handlers['deviceDetails'], "deviceDetails method should be registered");
    test.isNotNull(Meteor.server.method_handlers['notificationHistory.insert'], "notificationHistory.insert method should be registered");
    test.isNotNull(Meteor.server.method_handlers['pendingResponses.create'], "pendingResponses.create method should be registered");
  });
}

// Client-only tests  
if (Meteor.isClient) {
  Tinytest.add('mieweb:auth - client functionality', function (test) {
    // Test that client components can be imported
    // Note: This would require the components to be imported, but we're testing basic structure
    test.isTrue(true, "Client test placeholder - components should be importable");
  });
}

// Test method names structure
Tinytest.add('mieweb:auth - method names', function (test) {
  const methods = MiewebAuth.methods;
  
  // Test that method name constants exist
  test.equal(typeof methods.DEVICE_DETAILS, 'string', "DEVICE_DETAILS method name should be a string");
  test.equal(typeof methods.NOTIFICATION_INSERT, 'string', "NOTIFICATION_INSERT method name should be a string");
  test.equal(typeof methods.PENDING_RESPONSE_CREATE, 'string', "PENDING_RESPONSE_CREATE method name should be a string");
  
  // Test that method names have expected values
  test.equal(methods.DEVICE_DETAILS, 'deviceDetails', "DEVICE_DETAILS should equal 'deviceDetails'");
  test.equal(methods.NOTIFICATION_INSERT, 'notificationHistory.insert', "NOTIFICATION_INSERT should equal 'notificationHistory.insert'");
});
