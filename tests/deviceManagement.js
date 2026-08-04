import assert from "assert";

if (Meteor.isServer) {
  describe("Device management (My Devices)", function () {
    const { DeviceDetails } = require("../utils/api/deviceDetails");
    const { DeviceAuditLog } = require("../server/deviceManagement");

    const USER_A = "device-mgmt-user-a";
    const USER_B = "device-mgmt-user-b";
    const BIO_SECRET = "bio-secret-primary-device";

    const callMethod = (name, context, ...args) =>
      Meteor.server.method_handlers[name].call(context, ...args);

    const makeDevice = (overrides = {}) => ({
      deviceUUID: "uuid-primary",
      appId: "app-primary",
      biometricSecret: BIO_SECRET,
      fcmToken: "fcm-primary",
      deviceModel: "iPhone 15",
      devicePlatform: "iOS",
      isFirstDevice: true,
      isPrimary: true,
      isSecondaryDevice: false,
      deviceRegistrationStatus: "approved",
      lastUpdated: new Date(),
      ...overrides,
    });

    beforeEach(async function () {
      await DeviceDetails.removeAsync({ userId: { $in: [USER_A, USER_B] } });
      await DeviceAuditLog.removeAsync({ userId: { $in: [USER_A, USER_B] } });

      await DeviceDetails.insertAsync({
        userId: USER_A,
        username: "usera",
        email: "usera@example.com",
        devices: [
          makeDevice(),
          makeDevice({
            deviceUUID: "uuid-secondary",
            appId: "app-secondary",
            biometricSecret: "bio-secret-secondary",
            fcmToken: "fcm-secondary",
            deviceModel: "Pixel 9",
            devicePlatform: "Android",
            isFirstDevice: false,
            isPrimary: false,
            isSecondaryDevice: true,
          }),
        ],
        createdAt: new Date(),
        lastUpdated: new Date(),
      });
    });

    afterEach(async function () {
      await DeviceDetails.removeAsync({ userId: { $in: [USER_A, USER_B] } });
      await DeviceAuditLog.removeAsync({ userId: { $in: [USER_A, USER_B] } });
    });

    describe("devices.rename", function () {
      it("rejects unauthenticated callers", async function () {
        await assert.rejects(
          callMethod(
            "devices.rename",
            { userId: null },
            {
              deviceUUID: "uuid-primary",
              name: "My Phone",
            },
          ),
          /not-authorized/,
        );
      });

      it("rejects invalid names", async function () {
        await assert.rejects(
          callMethod(
            "devices.rename",
            { userId: USER_A },
            {
              deviceUUID: "uuid-primary",
              name: "  <script>  ",
            },
          ),
          /invalid-name/,
        );
      });

      it("rejects renaming a device the caller does not own", async function () {
        await assert.rejects(
          callMethod(
            "devices.rename",
            { userId: USER_B },
            {
              deviceUUID: "uuid-primary",
              name: "Hijack",
            },
          ),
          /not-found/,
        );
      });

      it("renames the caller's own device", async function () {
        await callMethod(
          "devices.rename",
          { userId: USER_A },
          {
            deviceUUID: "uuid-primary",
            name: "Work Phone",
          },
        );

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        const device = doc.devices.find((d) => d.deviceUUID === "uuid-primary");
        assert.strictEqual(device.customName, "Work Phone");
      });
    });

    describe("devices.updateInfo", function () {
      it("updates the calling device's model/platform and lastUsed", async function () {
        await callMethod(
          "devices.updateInfo",
          { userId: USER_A },
          {
            deviceUUID: "uuid-primary",
            deviceModel: "iPhone 17 Pro",
            devicePlatform: "iOS",
          },
        );

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        const device = doc.devices.find((d) => d.deviceUUID === "uuid-primary");
        assert.strictEqual(device.deviceModel, "iPhone 17 Pro");
        assert.strictEqual(device.devicePlatform, "iOS");
        assert.ok(device.lastUsed instanceof Date);
      });

      it("repairs the primary invariant when no approved device is primary", async function () {
        await DeviceDetails.updateAsync(
          { userId: USER_A },
          { $set: { "devices.$[].isPrimary": false } },
        );

        await callMethod(
          "devices.updateInfo",
          { userId: USER_A },
          { deviceUUID: "uuid-secondary" },
        );

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        const primaries = doc.devices.filter((d) => d.isPrimary);
        assert.strictEqual(primaries.length, 1);
      });

      it("rejects a device not owned by the caller", async function () {
        await assert.rejects(
          callMethod(
            "devices.updateInfo",
            { userId: USER_B },
            { deviceUUID: "uuid-primary" },
          ),
          /not-found/,
        );
      });
    });

    describe("devices.setPrimary", function () {
      it("rejects non-approved devices", async function () {
        await DeviceDetails.updateAsync(
          { userId: USER_A, "devices.deviceUUID": "uuid-secondary" },
          { $set: { "devices.$.deviceRegistrationStatus": "pending" } },
        );

        await assert.rejects(
          callMethod(
            "devices.setPrimary",
            { userId: USER_A },
            {
              deviceUUID: "uuid-secondary",
            },
          ),
          /device-not-approved/,
        );
      });

      it("moves the primary flag atomically to the target device", async function () {
        await callMethod(
          "devices.setPrimary",
          { userId: USER_A },
          {
            deviceUUID: "uuid-secondary",
          },
        );

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        const primaries = doc.devices.filter((d) => d.isPrimary);
        assert.strictEqual(primaries.length, 1);
        assert.strictEqual(primaries[0].deviceUUID, "uuid-secondary");
      });
    });

    describe("devices.revoke", function () {
      it("rejects an invalid step-up proof", async function () {
        await assert.rejects(
          callMethod(
            "devices.revoke",
            { userId: USER_A },
            {
              deviceUUID: "uuid-secondary",
              actorDeviceUUID: "uuid-primary",
              reAuth: { biometricSecret: "wrong-secret" },
            },
          ),
          /reauth-failed/,
        );

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        assert.strictEqual(doc.devices.length, 2);
      });

      it("removes the device and promotes a new primary when needed", async function () {
        await callMethod(
          "devices.revoke",
          { userId: USER_A },
          {
            deviceUUID: "uuid-primary",
            actorDeviceUUID: "uuid-secondary",
            reAuth: { biometricSecret: BIO_SECRET },
          },
        );

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        assert.strictEqual(doc.devices.length, 1);
        assert.strictEqual(doc.devices[0].deviceUUID, "uuid-secondary");
        assert.strictEqual(doc.devices[0].isPrimary, true);

        const audit = await DeviceAuditLog.findOneAsync({
          userId: USER_A,
          action: "revoke",
        });
        assert.ok(audit, "revocation should be audit-logged");
      });

      it("deregisters the whole account when the last device is removed", async function () {
        const userId = await Meteor.users.insertAsync({
          username: "lastdevice",
          emails: [{ address: "last@example.com", verified: false }],
        });
        await DeviceDetails.insertAsync({
          userId,
          username: "lastdevice",
          email: "last@example.com",
          devices: [makeDevice({ biometricSecret: "last-bio" })],
          createdAt: new Date(),
          lastUpdated: new Date(),
        });

        const result = await callMethod(
          "devices.revoke",
          { userId },
          {
            deviceUUID: "uuid-primary",
            actorDeviceUUID: "uuid-primary",
            reAuth: { biometricSecret: "last-bio" },
          },
        );

        assert.strictEqual(result.accountRemoved, true);
        assert.strictEqual(
          await Meteor.users.find({ _id: userId }).countAsync(),
          0,
        );
        assert.strictEqual(
          await DeviceDetails.find({ userId }).countAsync(),
          0,
        );
      });
    });

    describe("devices.approvePending", function () {
      beforeEach(async function () {
        await DeviceDetails.updateAsync(
          { userId: USER_A, "devices.deviceUUID": "uuid-secondary" },
          { $set: { "devices.$.deviceRegistrationStatus": "pending" } },
        );
      });

      it("rejects when the acting device is not approved", async function () {
        await assert.rejects(
          callMethod(
            "devices.approvePending",
            { userId: USER_A },
            {
              deviceUUID: "uuid-primary",
              actorDeviceUUID: "uuid-secondary", // pending device acting
              approve: true,
              reAuth: { biometricSecret: BIO_SECRET },
            },
          ),
          /device-not-approved|invalid-status/,
        );
      });

      it("approves a pending device from an approved device", async function () {
        await callMethod(
          "devices.approvePending",
          { userId: USER_A },
          {
            deviceUUID: "uuid-secondary",
            actorDeviceUUID: "uuid-primary",
            approve: true,
            reAuth: { biometricSecret: BIO_SECRET },
          },
        );

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        const device = doc.devices.find(
          (d) => d.deviceUUID === "uuid-secondary",
        );
        assert.strictEqual(device.deviceRegistrationStatus, "approved");
      });

      it("removes a pending device on rejection", async function () {
        await callMethod(
          "devices.approvePending",
          { userId: USER_A },
          {
            deviceUUID: "uuid-secondary",
            actorDeviceUUID: "uuid-primary",
            approve: false,
            reAuth: { biometricSecret: BIO_SECRET },
          },
        );

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        assert.strictEqual(doc.devices.length, 1);
        assert.strictEqual(doc.devices[0].deviceUUID, "uuid-primary");
      });
    });

    describe("publications", function () {
      it("deviceDetails.byUser returns nothing for another user's data", function () {
        const handler = Meteor.server.publish_handlers["deviceDetails.byUser"];
        const readySentinel = Symbol("ready");
        const result = handler.call(
          { userId: USER_B, ready: () => readySentinel },
          USER_A,
        );
        assert.strictEqual(result, readySentinel);
      });

      it("deviceDetails.byUser returns nothing when unauthenticated", function () {
        const handler = Meteor.server.publish_handlers["deviceDetails.byUser"];
        const readySentinel = Symbol("ready");
        const result = handler.call(
          { userId: null, ready: () => readySentinel },
          USER_A,
        );
        assert.strictEqual(result, readySentinel);
      });

      it("never publishes biometric secrets or FCM tokens", async function () {
        const handler = Meteor.server.publish_handlers["deviceDetails.byUser"];
        const cursor = handler.call(
          { userId: USER_A, ready: () => {} },
          USER_A,
        );
        const docs = await cursor.fetchAsync();
        assert.ok(docs.length > 0, "expected the user's own document");
        docs.forEach((doc) => {
          doc.devices.forEach((device) => {
            assert.strictEqual(device.biometricSecret, undefined);
            assert.strictEqual(device.fcmToken, undefined);
            // Whitelisted fields still come through.
            assert.ok(device.deviceUUID);
          });
        });
      });
    });

    describe("internal-only methods", function () {
      it("users.removeCompletely cannot be called from a client connection", async function () {
        // server/main.js (where the method lives) is only loaded in full-app
        // test mode; skip in the unit-test build.
        if (!Meteor.server.method_handlers["users.removeCompletely"]) {
          this.skip();
          return;
        }

        await assert.rejects(
          callMethod(
            "users.removeCompletely",
            { userId: USER_A, connection: { id: "fake-client-connection" } },
            USER_A,
          ),
          /not-authorized/,
        );
      });

      it("FCM token lookups are no longer exposed as Meteor methods", function () {
        [
          "deviceDetails",
          "deviceDetails.updateToken",
          "deviceDetails.getFCMTokenByUsername",
          "deviceDetails.getApprovedFCMTokensByUsername",
          "deviceDetails.getApprovedFCMTokensByUserId",
          "deviceDetails.getFCMTokenByUserId",
          "deviceDetails.getFCMTokenByDeviceId",
          "deviceDetails.getByAppId",
          "deviceDetails.getByUserId",
        ].forEach((name) => {
          assert.strictEqual(
            Meteor.server.method_handlers[name],
            undefined,
            `${name} must not be a callable Meteor method`,
          );
        });
      });
    });
  });
}
