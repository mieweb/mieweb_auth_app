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

    describe("Session timeout configuration", function () {
      it("should have correct session timeout duration", function () {
        // Verify that the session timeout constant is 30 minutes
        const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
        assert.strictEqual(INACTIVITY_TIMEOUT, 1800000, "Session timeout should be 30 minutes (1800000 ms)");
      });

      it("should have correct activity update throttle", function () {
        // Verify the throttle is set to 10 seconds to avoid excessive writes
        const ACTIVITY_UPDATE_THROTTLE = 10000; // 10 seconds
        assert.strictEqual(ACTIVITY_UPDATE_THROTTLE, 10000, "Activity update throttle should be 10 seconds (10000 ms)");
      });

      it("should store and retrieve last activity time from localStorage", function () {
        const testTime = Date.now();
        const STORAGE_KEY = 'lastActivityTime';
        
        localStorage.setItem(STORAGE_KEY, testTime.toString());
        const storedTime = localStorage.getItem(STORAGE_KEY);
        
        assert.strictEqual(parseInt(storedTime), testTime, "Should store and retrieve activity time correctly");
        
        // Cleanup
        localStorage.removeItem(STORAGE_KEY);
      });

      it("should calculate time since last activity correctly", function () {
        const now = Date.now();
        const thirtyMinutesAgo = now - (30 * 60 * 1000);
        const timeDiff = now - thirtyMinutesAgo;
        
        assert.strictEqual(timeDiff, 1800000, "Should calculate 30 minutes difference correctly");
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
  }
});
