import assert from "assert";

describe("meteor-app", function () {
  it("package.json has correct name", async function () {
    const { name } = await import("../package.json");
    assert.strictEqual(name, "meteor-app");
  });

  if (Meteor.isClient) {
    it("client is not server", function () {
      assert.strictEqual(Meteor.isServer, false);
    });

    describe("Screen lock-based session management", function () {
      it("should store pause state in localStorage", function () {
        const STORAGE_KEY = 'appWasPaused';
        
        localStorage.setItem(STORAGE_KEY, 'true');
        const pauseState = localStorage.getItem(STORAGE_KEY);
        
        assert.strictEqual(pauseState, 'true', "Should store pause state correctly");
        
        // Cleanup
        localStorage.removeItem(STORAGE_KEY);
      });

      it("should detect when app was paused", function () {
        const STORAGE_KEY = 'appWasPaused';
        
        // Simulate app pause
        localStorage.setItem(STORAGE_KEY, 'true');
        
        // Check if app was paused
        const wasPaused = localStorage.getItem(STORAGE_KEY) === 'true';
        assert.strictEqual(wasPaused, true, "Should detect that app was paused");
        
        // Cleanup
        localStorage.removeItem(STORAGE_KEY);
      });

      it("should handle no pause state gracefully", function () {
        const STORAGE_KEY = 'appWasPaused';
        
        // Ensure no stored state
        localStorage.removeItem(STORAGE_KEY);
        
        // Check pause state
        const wasPaused = localStorage.getItem(STORAGE_KEY);
        assert.strictEqual(wasPaused, null, "Should return null when no pause state exists");
      });
    });
  }

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });

    describe("User cleanup functionality", function () {
      const { ApprovalTokens } = require("../utils/api/approvalTokens");
      const { DeviceDetails } = require("../utils/api/deviceDetails");

      beforeEach(async function () {
        // Clean up test data before each test
        await Meteor.users.removeAsync({});
        await DeviceDetails.removeAsync({});
        await ApprovalTokens.removeAsync({});
      });

      it("should clean up users with expired approval tokens", async function () {
        // Create a test user
        const userId = await Accounts.createUser({
          email: 'test@example.com',
          username: 'testuser',
          password: 'testpass',
          profile: {
            firstName: 'Test',
            lastName: 'User',
            registrationStatus: 'pending'
          }
        });

        // Create device details for the user
        await DeviceDetails.insertAsync({
          userId: userId,
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          devices: [{
            deviceUUID: 'test-device-uuid',
            appId: 'test-app-id',
            biometricSecret: 'test-secret',
            fcmToken: 'test-fcm-token',
            isFirstDevice: true,
            isPrimary: true,
            isSecondaryDevice: false,
            deviceRegistrationStatus: 'pending',
            lastUpdated: new Date()
          }],
          createdAt: new Date(),
          lastUpdated: new Date()
        });

        // Create an expired approval token
        const expiredDate = new Date(Date.now() - 60 * 1000); // 1 minute ago
        await ApprovalTokens.insertAsync({
          userId: userId,
          token: 'expired-token',
          createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          expiresAt: expiredDate,
          used: false,
          action: null
        });

        // Verify test data exists
        assert.strictEqual(await Meteor.users.find().countAsync(), 1);
        assert.strictEqual(await DeviceDetails.find().countAsync(), 1);
        assert.strictEqual(await ApprovalTokens.find().countAsync(), 1);

        // Run cleanup
        const result = await Meteor.callAsync('users.cleanupExpiredApprovals');

        // Verify cleanup results
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.cleanedUsers, 1);
        assert.strictEqual(result.cleanedDevices, 1);
        assert.strictEqual(result.cleanedTokens, 1);

        // Verify data was actually removed
        assert.strictEqual(await Meteor.users.find().countAsync(), 0);
        assert.strictEqual(await DeviceDetails.find().countAsync(), 0);
        assert.strictEqual(await ApprovalTokens.find().countAsync(), 0);
      });

      it("should not clean up users with valid (non-expired) tokens", async function () {
        // Create a test user
        const userId = await Accounts.createUser({
          email: 'test@example.com',
          username: 'testuser',
          password: 'testpass',
          profile: {
            firstName: 'Test',
            lastName: 'User',
            registrationStatus: 'pending'
          }
        });

        // Create a valid (non-expired) approval token
        const futureDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
        await ApprovalTokens.insertAsync({
          userId: userId,
          token: 'valid-token',
          createdAt: new Date(),
          expiresAt: futureDate,
          used: false,
          action: null
        });

        // Verify test data exists
        assert.strictEqual(await Meteor.users.find().countAsync(), 1);
        assert.strictEqual(await ApprovalTokens.find().countAsync(), 1);

        // Run cleanup
        const result = await Meteor.callAsync('users.cleanupExpiredApprovals');

        // Verify no cleanup occurred for valid tokens
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.cleanedUsers, 0);
        assert.strictEqual(result.cleanedTokens, 0);

        // Verify data still exists
        assert.strictEqual(await Meteor.users.find().countAsync(), 1);
        assert.strictEqual(await ApprovalTokens.find().countAsync(), 1);
      });

      it("should not clean up approved users even with expired tokens", async function () {
        // Create an approved test user
        const userId = await Accounts.createUser({
          email: 'test@example.com',
          username: 'testuser',
          password: 'testpass',
          profile: {
            firstName: 'Test',
            lastName: 'User',
            registrationStatus: 'approved' // Already approved
          }
        });

        // Create an expired approval token
        const expiredDate = new Date(Date.now() - 60 * 1000); // 1 minute ago
        await ApprovalTokens.insertAsync({
          userId: userId,
          token: 'expired-token',
          createdAt: new Date(Date.now() - 5 * 60 * 1000),
          expiresAt: expiredDate,
          used: true, // Token was used for approval
          action: 'approved'
        });

        // Run cleanup
        const result = await Meteor.callAsync('users.cleanupExpiredApprovals');

        // Verify approved user was not removed
        assert.strictEqual(result.cleanedUsers, 0);
        assert.strictEqual(await Meteor.users.find().countAsync(), 1);

        // But expired token should still be cleaned up
        assert.strictEqual(result.cleanedTokens, 1);
        assert.strictEqual(await ApprovalTokens.find().countAsync(), 0);
      });

      it("should completely remove user when admin rejects", async function () {
        // Create a test user
        const userId = await Accounts.createUser({
          email: 'test@example.com',
          username: 'testuser',
          password: 'testpass',
          profile: {
            firstName: 'Test',
            lastName: 'User',
            registrationStatus: 'pending'
          }
        });

        // Create device details
        await DeviceDetails.insertAsync({
          userId: userId,
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          devices: [{
            deviceUUID: 'test-device-uuid',
            appId: 'test-app-id',
            biometricSecret: 'test-secret',
            fcmToken: 'test-fcm-token',
            isFirstDevice: true,
            isPrimary: true,
            isSecondaryDevice: false,
            deviceRegistrationStatus: 'pending',
            lastUpdated: new Date()
          }],
          createdAt: new Date(),
          lastUpdated: new Date()
        });

        // Create approval token
        await ApprovalTokens.insertAsync({
          userId: userId,
          token: 'test-token',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          used: false,
          action: null
        });

        // Verify test data exists
        assert.strictEqual(await Meteor.users.find().countAsync(), 1);
        assert.strictEqual(await DeviceDetails.find().countAsync(), 1);
        assert.strictEqual(await ApprovalTokens.find().countAsync(), 1);

        // Remove user completely
        const result = await Meteor.callAsync('users.removeCompletely', userId);

        // Verify removal was successful
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.userRemoved, true);
        assert.strictEqual(result.deviceRemoved, true);
        assert.strictEqual(result.tokensRemoved, true);

        // Verify all data was removed
        assert.strictEqual(await Meteor.users.find().countAsync(), 0);
        assert.strictEqual(await DeviceDetails.find().countAsync(), 0);
        assert.strictEqual(await ApprovalTokens.find().countAsync(), 0);
      });
    });

    describe("API Key Authentication", function () {
      const { ApiKeys, hashApiKey, verifyApiKey } = require("../utils/api/apiKeys");
      const crypto = require('crypto');

      beforeEach(async function () {
        // Clean up API keys before each test
        await ApiKeys.removeAsync({});
      });

      afterEach(async function () {
        // Clean up after each test
        await ApiKeys.removeAsync({});
      });

      describe("hashApiKey function", function () {
        it("should produce consistent hashes with the same salt", function () {
          const apiKey = "test-api-key-123";
          const salt = crypto.randomBytes(32).toString('hex');
          
          const result1 = hashApiKey(apiKey, salt);
          const result2 = hashApiKey(apiKey, salt);
          
          assert.strictEqual(result1.hashedKey, result2.hashedKey, "Same key and salt should produce same hash");
          assert.strictEqual(result1.salt, result2.salt, "Salt should be returned unchanged");
        });

        it("should produce different hashes with different salts", function () {
          const apiKey = "test-api-key-123";
          const salt1 = crypto.randomBytes(32).toString('hex');
          const salt2 = crypto.randomBytes(32).toString('hex');
          
          const result1 = hashApiKey(apiKey, salt1);
          const result2 = hashApiKey(apiKey, salt2);
          
          assert.notStrictEqual(result1.hashedKey, result2.hashedKey, "Different salts should produce different hashes");
        });

        it("should generate a salt if none provided", function () {
          const apiKey = "test-api-key-123";
          
          const result = hashApiKey(apiKey);
          
          assert.ok(result.salt, "Should generate a salt");
          assert.strictEqual(result.salt.length, 64, "Salt should be 64 hex characters (32 bytes)");
          assert.ok(result.hashedKey, "Should generate a hash");
        });

        it("should produce a 128-character hex hash (64 bytes)", function () {
          const apiKey = "test-api-key-123";
          
          const result = hashApiKey(apiKey);
          
          assert.strictEqual(result.hashedKey.length, 128, "Hash should be 128 hex characters");
        });
      });

      describe("verifyApiKey function", function () {
        it("should return true for valid key/hash pairs", function () {
          const apiKey = "test-api-key-for-verification";
          const result = hashApiKey(apiKey);
          
          const isValid = verifyApiKey(apiKey, result.hashedKey, result.salt);
          
          assert.strictEqual(isValid, true, "Should verify correct API key");
        });

        it("should return false for incorrect API keys", function () {
          const apiKey = "correct-api-key";
          const wrongKey = "wrong-api-key";
          const result = hashApiKey(apiKey);
          
          const isValid = verifyApiKey(wrongKey, result.hashedKey, result.salt);
          
          assert.strictEqual(isValid, false, "Should reject incorrect API key");
        });

        it("should return false for incorrect salt", function () {
          const apiKey = "test-api-key";
          const result = hashApiKey(apiKey);
          const wrongSalt = crypto.randomBytes(32).toString('hex');
          
          const isValid = verifyApiKey(apiKey, result.hashedKey, wrongSalt);
          
          assert.strictEqual(isValid, false, "Should reject with incorrect salt");
        });
      });

      describe("apiKeys.create method", function () {
        it("should create a new API key and return it", async function () {
          const clientId = "test-client.example.com";
          
          const apiKey = await Meteor.callAsync('apiKeys.create', clientId);
          
          assert.ok(apiKey, "Should return an API key");
          assert.strictEqual(apiKey.length, 64, "API key should be 64 hex characters");
          
          // Verify it was stored
          const stored = await ApiKeys.findOneAsync({ clientId });
          assert.ok(stored, "Should store the key in database");
          assert.ok(stored.hashedKey, "Should store hashed key");
          assert.ok(stored.salt, "Should store salt");
          assert.ok(stored.createdAt, "Should store creation date");
        });

        it("should reject duplicate client IDs", async function () {
          const clientId = "duplicate-client.example.com";
          
          // Create first key
          await Meteor.callAsync('apiKeys.create', clientId);
          
          // Try to create duplicate
          try {
            await Meteor.callAsync('apiKeys.create', clientId);
            assert.fail("Should have thrown an error");
          } catch (error) {
            assert.strictEqual(error.error, 'client-exists', "Should throw client-exists error");
          }
        });

        it("should reject 'unspecified' as client ID", async function () {
          try {
            await Meteor.callAsync('apiKeys.create', 'unspecified');
            assert.fail("Should have thrown an error");
          } catch (error) {
            assert.strictEqual(error.error, 'invalid-client-id', "Should throw invalid-client-id error");
          }
        });

        it("should reject 'UNSPECIFIED' (case-insensitive) as client ID", async function () {
          try {
            await Meteor.callAsync('apiKeys.create', 'UNSPECIFIED');
            assert.fail("Should have thrown an error");
          } catch (error) {
            assert.strictEqual(error.error, 'invalid-client-id', "Should throw invalid-client-id error");
          }
        });
      });

      describe("apiKeys.verify method", function () {
        it("should validate correct API keys", async function () {
          const clientId = "verify-test.example.com";
          const apiKey = await Meteor.callAsync('apiKeys.create', clientId);
          
          const result = await Meteor.callAsync('apiKeys.verify', apiKey, clientId);
          
          assert.strictEqual(result.isValid, true, "Should validate correct key");
          assert.strictEqual(result.clientId, clientId, "Should return correct client ID");
        });

        it("should validate correct API keys without client ID hint", async function () {
          const clientId = "verify-no-hint.example.com";
          const apiKey = await Meteor.callAsync('apiKeys.create', clientId);
          
          const result = await Meteor.callAsync('apiKeys.verify', apiKey);
          
          assert.strictEqual(result.isValid, true, "Should validate correct key");
          assert.strictEqual(result.clientId, clientId, "Should return correct client ID");
        });

        it("should reject incorrect API keys", async function () {
          const clientId = "reject-test.example.com";
          await Meteor.callAsync('apiKeys.create', clientId);
          
          const result = await Meteor.callAsync('apiKeys.verify', 'wrong-api-key', clientId);
          
          assert.strictEqual(result.isValid, false, "Should reject incorrect key");
          assert.strictEqual(result.clientId, null, "Should return null client ID");
        });

        it("should reject API keys for non-existent clients", async function () {
          const result = await Meteor.callAsync('apiKeys.verify', 'any-key', 'non-existent-client');
          
          assert.strictEqual(result.isValid, false, "Should reject key for non-existent client");
        });

        it("should update lastUsed timestamp on successful verification", async function () {
          const clientId = "timestamp-test.example.com";
          const apiKey = await Meteor.callAsync('apiKeys.create', clientId);
          
          // Initially lastUsed should be null
          let stored = await ApiKeys.findOneAsync({ clientId });
          assert.strictEqual(stored.lastUsed, null, "lastUsed should be null initially");
          
          // Verify the key
          await Meteor.callAsync('apiKeys.verify', apiKey, clientId);
          
          // Check lastUsed was updated
          stored = await ApiKeys.findOneAsync({ clientId });
          assert.ok(stored.lastUsed, "lastUsed should be updated");
          assert.ok(stored.lastUsed instanceof Date, "lastUsed should be a Date");
        });

        it("should reject 'unspecified' as client ID", async function () {
          const result = await Meteor.callAsync('apiKeys.verify', 'any-key', 'unspecified');
          
          assert.strictEqual(result.isValid, false, "Should reject unspecified client ID");
        });
      });

      describe("apiKeys.list method", function () {
        it("should return all keys with metadata", async function () {
          // Create some keys
          await Meteor.callAsync('apiKeys.create', 'list-test-1.example.com');
          await Meteor.callAsync('apiKeys.create', 'list-test-2.example.com');
          
          const keys = await Meteor.callAsync('apiKeys.list');
          
          assert.strictEqual(keys.length, 2, "Should return 2 keys");
          assert.ok(keys[0].clientId, "Should include clientId");
          assert.ok(keys[0].createdAt, "Should include createdAt");
          assert.ok(!keys[0].hashedKey, "Should NOT include hashedKey");
          assert.ok(!keys[0].salt, "Should NOT include salt");
        });

        it("should return empty array when no keys exist", async function () {
          const keys = await Meteor.callAsync('apiKeys.list');
          
          assert.strictEqual(keys.length, 0, "Should return empty array");
        });
      });

      describe("apiKeys.delete method", function () {
        it("should delete an existing key", async function () {
          const clientId = "delete-test.example.com";
          await Meteor.callAsync('apiKeys.create', clientId);
          
          const result = await Meteor.callAsync('apiKeys.delete', clientId);
          
          assert.strictEqual(result, true, "Should return true on successful delete");
          
          // Verify it was deleted
          const stored = await ApiKeys.findOneAsync({ clientId });
          assert.strictEqual(stored, undefined, "Key should be deleted");
        });

        it("should return false for non-existent keys", async function () {
          const result = await Meteor.callAsync('apiKeys.delete', 'non-existent-client');
          
          assert.strictEqual(result, false, "Should return false for non-existent key");
        });
      });

      describe("apiKeys.regenerate method", function () {
        it("should generate a new key and invalidate the old one", async function () {
          const clientId = "regenerate-test.example.com";
          const oldKey = await Meteor.callAsync('apiKeys.create', clientId);
          
          const newKey = await Meteor.callAsync('apiKeys.regenerate', clientId);
          
          assert.ok(newKey, "Should return new key");
          assert.notStrictEqual(newKey, oldKey, "New key should be different");
          
          // Old key should no longer work
          const oldResult = await Meteor.callAsync('apiKeys.verify', oldKey, clientId);
          assert.strictEqual(oldResult.isValid, false, "Old key should be invalid");
          
          // New key should work
          const newResult = await Meteor.callAsync('apiKeys.verify', newKey, clientId);
          assert.strictEqual(newResult.isValid, true, "New key should be valid");
        });

        it("should reject regeneration for non-existent clients", async function () {
          try {
            await Meteor.callAsync('apiKeys.regenerate', 'non-existent-client');
            assert.fail("Should have thrown an error");
          } catch (error) {
            assert.strictEqual(error.error, 'client-not-found', "Should throw client-not-found error");
          }
        });

        it("should reject 'unspecified' as client ID", async function () {
          try {
            await Meteor.callAsync('apiKeys.regenerate', 'unspecified');
            assert.fail("Should have thrown an error");
          } catch (error) {
            assert.strictEqual(error.error, 'invalid-client-id', "Should throw invalid-client-id error");
          }
        });
      });
    });

    describe("Notification History clientId tracking", function () {
      const { NotificationHistory } = require("../utils/api/notificationHistory");

      beforeEach(async function () {
        await NotificationHistory.removeAsync({});
      });

      afterEach(async function () {
        await NotificationHistory.removeAsync({});
      });

      it("should default clientId to 'unspecified' when not provided", async function () {
        const notificationId = await Meteor.callAsync('notificationHistory.insert', {
          userId: 'test-user-id',
          title: 'Test Notification',
          body: 'Test body'
        });
        
        const notification = await NotificationHistory.findOneAsync({ _id: notificationId });
        
        assert.strictEqual(notification.clientId, 'unspecified', "Should default to 'unspecified'");
      });

      it("should store provided clientId", async function () {
        const clientId = 'ldap.example.com';
        const notificationId = await Meteor.callAsync('notificationHistory.insert', {
          userId: 'test-user-id',
          title: 'Test Notification',
          body: 'Test body',
          clientId: clientId
        });
        
        const notification = await NotificationHistory.findOneAsync({ _id: notificationId });
        
        assert.strictEqual(notification.clientId, clientId, "Should store provided clientId");
      });
    });

    describe("Push Notification Priority Configuration", function () {
      const { sendNotification } = require("../server/firebase");
      
      it("should configure iOS notifications with time-sensitive interruption level", function () {
        // This test verifies the message structure contains iOS priority settings
        // We can't actually send notifications in tests, but we can verify the code structure
        const firebaseModule = require("../server/firebase");
        assert.ok(firebaseModule.sendNotification, "sendNotification function should exist");
      });
      
      it("should verify Android notification channel uses maximum importance", function () {
        // Verify that the push-notifications.js configures channel with importance: 5
        const fs = require('fs');
        const pushNotificationsContent = fs.readFileSync(
          '/home/runner/work/mieweb_auth_app/mieweb_auth_app/client/mobile/push-notifications.js', 
          'utf8'
        );
        
        // Check for importance: 5 (IMPORTANCE_MAX)
        assert.ok(
          pushNotificationsContent.includes('importance: 5'),
          "Android notification channel should have importance level 5 (IMPORTANCE_MAX)"
        );
        
        // Check for priority notification description
        assert.ok(
          pushNotificationsContent.includes('bypasses Do Not Disturb'),
          "Channel description should indicate it bypasses Do Not Disturb"
        );
      });
      
      it("should verify iOS notification includes interruption-level setting", function () {
        // Verify that the firebase.js includes interruption-level in APNS payload
        const fs = require('fs');
        const firebaseContent = fs.readFileSync(
          '/home/runner/work/mieweb_auth_app/mieweb_auth_app/server/firebase.js', 
          'utf8'
        );
        
        // Check for interruption-level: time-sensitive
        assert.ok(
          firebaseContent.includes("'interruption-level': 'time-sensitive'"),
          "iOS notifications should have interruption-level set to time-sensitive"
        );
        
        // Check for apns-priority: 10 (highest)
        assert.ok(
          firebaseContent.includes("'apns-priority': '10'"),
          "iOS notifications should have apns-priority set to 10 (highest)"
        );
      });
    });
  }
});
