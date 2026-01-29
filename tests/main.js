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
  }

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });

    describe("API Keys functionality", function () {
      const { ApiKeys } = require("../utils/api/apiKeys");

      beforeEach(async function () {
        // Clean up test data before each test
        await ApiKeys.removeAsync({});
      });

      it("should create a new API key for a client", async function () {
        const clientId = "test.example.com";
        const apiKey = "test-api-key-minimum-16-chars";

        const result = await Meteor.callAsync('apiKeys.upsert', clientId, apiKey);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.action, 'created');

        // Verify the key was stored
        const storedKey = await ApiKeys.findOneAsync({ clientId });
        assert(storedKey, "API key should be stored in database");
        assert.strictEqual(storedKey.clientId, clientId);
        assert(storedKey.hashedApiKey, "Hashed API key should exist");
        assert.notStrictEqual(storedKey.hashedApiKey, apiKey, "API key should be hashed");
      });

      it("should update an existing API key for a client", async function () {
        const clientId = "test.example.com";
        const apiKey1 = "test-api-key-minimum-16-chars";
        const apiKey2 = "new-test-api-key-minimum-16-chars";

        // Create initial key
        await Meteor.callAsync('apiKeys.upsert', clientId, apiKey1);
        const firstKey = await ApiKeys.findOneAsync({ clientId });

        // Update with new key
        const result = await Meteor.callAsync('apiKeys.upsert', clientId, apiKey2);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.action, 'updated');

        // Verify the key was updated
        const updatedKey = await ApiKeys.findOneAsync({ clientId });
        assert.notStrictEqual(updatedKey.hashedApiKey, firstKey.hashedApiKey, "Hashed key should be different");
      });

      it("should verify a valid API key", async function () {
        const clientId = "test.example.com";
        const apiKey = "test-api-key-minimum-16-chars";

        await Meteor.callAsync('apiKeys.upsert', clientId, apiKey);

        const isValid = await Meteor.callAsync('apiKeys.verify', clientId, apiKey);

        assert.strictEqual(isValid, true, "Valid API key should be verified");
      });

      it("should reject an invalid API key", async function () {
        const clientId = "test.example.com";
        const apiKey = "test-api-key-minimum-16-chars";
        const wrongKey = "wrong-api-key-minimum-16-chars";

        await Meteor.callAsync('apiKeys.upsert', clientId, apiKey);

        const isValid = await Meteor.callAsync('apiKeys.verify', clientId, wrongKey);

        assert.strictEqual(isValid, false, "Invalid API key should be rejected");
      });

      it("should reject verification for non-existent client", async function () {
        const isValid = await Meteor.callAsync('apiKeys.verify', 'nonexistent.example.com', 'any-key-16-chars-long');

        assert.strictEqual(isValid, false, "Non-existent client should be rejected");
      });

      it("should delete an API key", async function () {
        const clientId = "test.example.com";
        const apiKey = "test-api-key-minimum-16-chars";

        await Meteor.callAsync('apiKeys.upsert', clientId, apiKey);

        const result = await Meteor.callAsync('apiKeys.delete', clientId);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.deleted, 1);

        // Verify the key was deleted
        const deletedKey = await ApiKeys.findOneAsync({ clientId });
        assert.strictEqual(deletedKey, undefined, "API key should be deleted");
      });

      it("should throw error when trying to delete non-existent key", async function () {
        try {
          await Meteor.callAsync('apiKeys.delete', 'nonexistent.example.com');
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert(error.error === 'not-found', "Should throw not-found error");
        }
      });

      it("should list all API keys without exposing hashed keys", async function () {
        await Meteor.callAsync('apiKeys.upsert', 'client1.example.com', 'api-key-1-minimum-16-chars');
        await Meteor.callAsync('apiKeys.upsert', 'client2.example.com', 'api-key-2-minimum-16-chars');

        const keys = await Meteor.callAsync('apiKeys.list');

        assert.strictEqual(keys.length, 2);
        assert(keys[0].clientId, "Should have clientId");
        assert(keys[0].createdAt, "Should have createdAt");
        assert.strictEqual(keys[0].hashedApiKey, undefined, "Should not expose hashed key");
      });

      it("should reject API keys shorter than 16 characters", async function () {
        try {
          await Meteor.callAsync('apiKeys.upsert', 'test.example.com', 'short');
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert(error.error === 'invalid-api-key', "Should throw invalid-api-key error");
        }
      });

      it("should update lastUsed timestamp on successful verification", async function () {
        const clientId = "test.example.com";
        const apiKey = "test-api-key-minimum-16-chars";

        await Meteor.callAsync('apiKeys.upsert', clientId, apiKey);
        
        const beforeVerification = await ApiKeys.findOneAsync({ clientId });
        assert.strictEqual(beforeVerification.lastUsed, null, "lastUsed should be null initially");

        await Meteor.callAsync('apiKeys.verify', clientId, apiKey);

        const afterVerification = await ApiKeys.findOneAsync({ clientId });
        assert(afterVerification.lastUsed, "lastUsed should be set after verification");
        assert(afterVerification.lastUsed instanceof Date, "lastUsed should be a Date object");
      });
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
  }
});
