import assert from "assert";
import crypto from "crypto";

if (Meteor.isServer) {
  describe("Identity migration (v1 -> v2)", function () {
    require("../server/identityMigration.js"); // Registers the Meteor methods
    const { DeviceDetails } = require("../utils/api/deviceDetails");
    const { MigrationChallenges } = require("../utils/api/migrationChallenges");

    const USER_A = "identity-user-a";
    const USER_B = "identity-user-b";
    const BIO_SECRET = "identity-bio-secret";

    const callMethod = (name, context, ...args) =>
      Meteor.server.method_handlers[name].call(context, ...args);

    // WebCrypto-equivalent keypair: P-256, SPKI DER public key, P1363 signatures.
    const makeKeyPair = () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
        namedCurve: "prime256v1",
      });
      return {
        publicKeyB64: publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64"),
        sign: (message) =>
          crypto
            .sign("sha256", Buffer.from(message, "utf8"), {
              key: privateKey,
              dsaEncoding: "ieee-p1363",
            })
            .toString("base64"),
      };
    };

    const beginMigration = async (keyPair, overrides = {}) =>
      callMethod(
        "devices.beginIdentityMigration",
        { userId: USER_A },
        {
          deviceUUID: "uuid-v1",
          installationId: "install-1",
          publicKey: keyPair.publicKeyB64,
          ...overrides,
        },
      );

    beforeEach(async function () {
      await DeviceDetails.removeAsync({ userId: { $in: [USER_A, USER_B] } });
      await MigrationChallenges.removeAsync({
        userId: { $in: [USER_A, USER_B] },
      });

      await DeviceDetails.insertAsync({
        userId: USER_A,
        username: "identitya",
        email: "identitya@example.com",
        devices: [
          {
            deviceUUID: "uuid-v1",
            appId: "app-v1",
            biometricSecret: BIO_SECRET,
            fcmToken: "fcm-v1",
            deviceRegistrationStatus: "approved",
            isPrimary: true,
            lastUpdated: new Date(),
          },
          {
            deviceUUID: "uuid-pending",
            appId: "app-pending",
            biometricSecret: "other-secret",
            fcmToken: "fcm-pending",
            deviceRegistrationStatus: "pending",
            isPrimary: false,
            lastUpdated: new Date(),
          },
        ],
        createdAt: new Date(),
        lastUpdated: new Date(),
      });
    });

    afterEach(async function () {
      await DeviceDetails.removeAsync({ userId: { $in: [USER_A, USER_B] } });
      await MigrationChallenges.removeAsync({
        userId: { $in: [USER_A, USER_B] },
      });
    });

    describe("devices.beginIdentityMigration", function () {
      it("rejects unauthenticated callers", async function () {
        const keyPair = makeKeyPair();
        await assert.rejects(
          callMethod(
            "devices.beginIdentityMigration",
            { userId: null },
            {
              deviceUUID: "uuid-v1",
              installationId: "install-1",
              publicKey: keyPair.publicKeyB64,
            },
          ),
          /not-authorized/,
        );
      });

      it("rejects a malformed public key", async function () {
        await assert.rejects(
          beginMigration(makeKeyPair(), { publicKey: "not-a-key" }),
          /invalid-public-key/,
        );
      });

      it("rejects a non-P-256 public key", async function () {
        const { publicKey } = crypto.generateKeyPairSync("rsa", {
          modulusLength: 2048,
        });
        await assert.rejects(
          beginMigration(makeKeyPair(), {
            publicKey: publicKey
              .export({ format: "der", type: "spki" })
              .toString("base64"),
          }),
          /invalid-public-key/,
        );
      });

      it("rejects an unapproved device", async function () {
        await assert.rejects(
          beginMigration(makeKeyPair(), { deviceUUID: "uuid-pending" }),
          /device-not-approved/,
        );
      });

      it("rejects another user's device", async function () {
        const keyPair = makeKeyPair();
        await assert.rejects(
          callMethod(
            "devices.beginIdentityMigration",
            { userId: USER_B },
            {
              deviceUUID: "uuid-v1",
              installationId: "install-x",
              publicKey: keyPair.publicKeyB64,
            },
          ),
          /not-found/,
        );
      });

      it("returns a signing challenge but never the push challenge", async function () {
        const result = await beginMigration(makeKeyPair());
        assert.ok(result.challengeId);
        assert.ok(result.signingChallenge);
        assert.strictEqual(result.pushChallenge, undefined);
      });

      it("invalidates older challenges for the same device", async function () {
        const first = await beginMigration(makeKeyPair());
        await beginMigration(makeKeyPair());
        const stale = await MigrationChallenges.findOneAsync(first.challengeId);
        assert.strictEqual(stale, undefined);
      });
    });

    describe("devices.proveMigrationByBiometric", function () {
      it("binds the v2 identity on a valid proof", async function () {
        const keyPair = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);

        const result = await callMethod(
          "devices.proveMigrationByBiometric",
          { userId: USER_A },
          {
            challengeId,
            biometricSecret: BIO_SECRET,
            signedChallenge: keyPair.sign(signingChallenge),
          },
        );
        assert.strictEqual(result.success, true);

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        const device = doc.devices.find((d) => d.deviceUUID === "uuid-v1");
        assert.strictEqual(device.identityVersion, 2);
        assert.strictEqual(device.migrationProof, "biometric");
        assert.strictEqual(device.installationId, "install-1");
        assert.strictEqual(device.publicKey, keyPair.publicKeyB64);
        assert.strictEqual(device.deviceRegistrationStatus, "approved");
      });

      it("rejects a wrong biometric secret and leaves state unchanged", async function () {
        const keyPair = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);

        await assert.rejects(
          callMethod(
            "devices.proveMigrationByBiometric",
            { userId: USER_A },
            {
              challengeId,
              biometricSecret: "wrong-secret",
              signedChallenge: keyPair.sign(signingChallenge),
            },
          ),
          /proof-failed/,
        );

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        const device = doc.devices.find((d) => d.deviceUUID === "uuid-v1");
        assert.strictEqual(device.identityVersion, undefined);
      });

      it("rejects a signature from a different key", async function () {
        const keyPair = makeKeyPair();
        const attacker = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);

        await assert.rejects(
          callMethod(
            "devices.proveMigrationByBiometric",
            { userId: USER_A },
            {
              challengeId,
              biometricSecret: BIO_SECRET,
              signedChallenge: attacker.sign(signingChallenge),
            },
          ),
          /proof-failed/,
        );
      });

      it("rejects an expired challenge", async function () {
        const keyPair = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);
        await MigrationChallenges.updateAsync(
          { _id: challengeId },
          { $set: { expiresAt: new Date(Date.now() - 1000) } },
        );

        await assert.rejects(
          callMethod(
            "devices.proveMigrationByBiometric",
            { userId: USER_A },
            {
              challengeId,
              biometricSecret: BIO_SECRET,
              signedChallenge: keyPair.sign(signingChallenge),
            },
          ),
          /challenge-invalid/,
        );
      });

      it("rejects a reused challenge", async function () {
        const keyPair = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);
        const proof = {
          challengeId,
          biometricSecret: BIO_SECRET,
          signedChallenge: keyPair.sign(signingChallenge),
        };

        await callMethod(
          "devices.proveMigrationByBiometric",
          { userId: USER_A },
          proof,
        );
        await assert.rejects(
          callMethod(
            "devices.proveMigrationByBiometric",
            { userId: USER_A },
            proof,
          ),
          /challenge-invalid/,
        );
      });

      it("blocks a second migration of an already-migrated device", async function () {
        const keyPair = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);
        await callMethod(
          "devices.proveMigrationByBiometric",
          { userId: USER_A },
          {
            challengeId,
            biometricSecret: BIO_SECRET,
            signedChallenge: keyPair.sign(signingChallenge),
          },
        );

        await assert.rejects(beginMigration(makeKeyPair()), /already-migrated/);
      });
    });

    describe("devices.proveMigrationByPush", function () {
      it("binds the v2 identity when the pushed challenge is echoed", async function () {
        const keyPair = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);
        // The push payload is unavailable in tests (Firebase disabled); read
        // the value the server would have sent.
        const challenge = await MigrationChallenges.findOneAsync(challengeId);

        const result = await callMethod(
          "devices.proveMigrationByPush",
          { userId: USER_A },
          {
            challengeId,
            pushChallenge: challenge.pushChallenge,
            signedChallenge: keyPair.sign(signingChallenge),
          },
        );
        assert.strictEqual(result.migrationProof, "fcm-challenge");

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        const device = doc.devices.find((d) => d.deviceUUID === "uuid-v1");
        assert.strictEqual(device.identityVersion, 2);
      });

      it("rejects a wrong push challenge", async function () {
        const keyPair = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);

        await assert.rejects(
          callMethod(
            "devices.proveMigrationByPush",
            { userId: USER_A },
            {
              challengeId,
              pushChallenge: "guessed-value",
              signedChallenge: keyPair.sign(signingChallenge),
            },
          ),
          /proof-failed/,
        );
      });

      it("rejects another user's challenge", async function () {
        const keyPair = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);
        const challenge = await MigrationChallenges.findOneAsync(challengeId);

        await assert.rejects(
          callMethod(
            "devices.proveMigrationByPush",
            { userId: USER_B },
            {
              challengeId,
              pushChallenge: challenge.pushChallenge,
              signedChallenge: keyPair.sign(signingChallenge),
            },
          ),
          /challenge-invalid/,
        );
      });
    });

    describe("devices.requestMigrationPushChallenge", function () {
      it("refuses when the device has no stored FCM token", async function () {
        const keyPair = makeKeyPair();
        const { challengeId } = await beginMigration(keyPair);
        await DeviceDetails.updateAsync(
          { userId: USER_A, "devices.deviceUUID": "uuid-v1" },
          { $unset: { "devices.$.fcmToken": "" } },
        );

        await assert.rejects(
          callMethod(
            "devices.requestMigrationPushChallenge",
            { userId: USER_A },
            { challengeId },
          ),
          /no-stored-token/,
        );
      });
    });

    describe("devices.approveIdentityMigration", function () {
      // uuid-pending is unapproved; add a second APPROVED device to act as
      // the vouching device.
      beforeEach(async function () {
        await DeviceDetails.updateAsync(
          { userId: USER_A },
          {
            $push: {
              devices: {
                deviceUUID: "uuid-other-approved",
                appId: "app-other",
                biometricSecret: "other-approved-secret",
                fcmToken: "fcm-other",
                deviceRegistrationStatus: "approved",
                isPrimary: false,
                lastUpdated: new Date(),
              },
            },
          },
        );
      });

      const approve = (overrides = {}) =>
        callMethod(
          "devices.approveIdentityMigration",
          { userId: USER_A },
          {
            deviceUUID: "uuid-v1",
            actorDeviceUUID: "uuid-other-approved",
            reAuth: { biometricSecret: "other-approved-secret" },
            ...overrides,
          },
        );

      it("binds the identity when vouched from another approved device", async function () {
        await beginMigration(makeKeyPair());

        const result = await approve();
        assert.strictEqual(result.migrationProof, "manual-approval");

        const doc = await DeviceDetails.findOneAsync({ userId: USER_A });
        const device = doc.devices.find((d) => d.deviceUUID === "uuid-v1");
        assert.strictEqual(device.identityVersion, 2);
        assert.strictEqual(device.migrationProof, "manual-approval");
      });

      it("rejects approval from the device under migration itself", async function () {
        await beginMigration(makeKeyPair());
        await assert.rejects(
          approve({
            actorDeviceUUID: "uuid-v1",
            reAuth: { biometricSecret: BIO_SECRET },
          }),
          /not-authorized/,
        );
      });

      it("rejects approval from an unapproved device", async function () {
        await beginMigration(makeKeyPair());
        await assert.rejects(
          approve({ actorDeviceUUID: "uuid-pending" }),
          /not-authorized/,
        );
      });

      it("rejects a bad step-up proof", async function () {
        await beginMigration(makeKeyPair());
        await assert.rejects(
          approve({ reAuth: { biometricSecret: "wrong" } }),
          /reauth-failed/,
        );
      });

      it("rejects when the device has no live challenge", async function () {
        await assert.rejects(approve(), /challenge-invalid/);
      });
    });

    describe("identity enforcement (IDENTITY_ENFORCEMENT flag)", function () {
      const migrateDeviceV1ToV2 = async () => {
        const keyPair = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);
        await callMethod(
          "devices.proveMigrationByBiometric",
          { userId: USER_A },
          {
            challengeId,
            biometricSecret: BIO_SECRET,
            signedChallenge: keyPair.sign(signingChallenge),
          },
        );
        return keyPair;
      };

      afterEach(function () {
        delete process.env.IDENTITY_ENFORCEMENT;
      });

      it("flag off: token update succeeds without a proof", async function () {
        const result = await callMethod(
          "devices.updateFCMToken",
          { userId: USER_A },
          { deviceUUID: "uuid-v1", fcmToken: "fcm-rotated" },
        );
        assert.strictEqual(result.updated, true);
      });

      it("flag on: rejects a v1 device without identity", async function () {
        process.env.IDENTITY_ENFORCEMENT = "true";
        await assert.rejects(
          callMethod(
            "devices.updateFCMToken",
            { userId: USER_A },
            { deviceUUID: "uuid-v1", fcmToken: "fcm-rotated" },
          ),
          /identity-required/,
        );
      });

      it("flag on: rejects a missing or stale proof from a v2 device", async function () {
        const keyPair = await migrateDeviceV1ToV2();
        process.env.IDENTITY_ENFORCEMENT = "true";

        await assert.rejects(
          callMethod(
            "devices.updateFCMToken",
            { userId: USER_A },
            { deviceUUID: "uuid-v1", fcmToken: "fcm-rotated" },
          ),
          /identity-proof-invalid/,
        );

        const staleSignedAt = Date.now() - 10 * 60 * 1000;
        await assert.rejects(
          callMethod(
            "devices.updateFCMToken",
            { userId: USER_A },
            {
              deviceUUID: "uuid-v1",
              fcmToken: "fcm-rotated",
              identityProof: {
                signedAt: staleSignedAt,
                signature: keyPair.sign(
                  `updateFCMToken:uuid-v1:fcm-rotated|${staleSignedAt}`,
                ),
              },
            },
          ),
          /identity-proof-invalid/,
        );
      });

      it("flag on: accepts a fresh valid proof from a v2 device", async function () {
        const keyPair = await migrateDeviceV1ToV2();
        process.env.IDENTITY_ENFORCEMENT = "true";

        const signedAt = Date.now();
        const result = await callMethod(
          "devices.updateFCMToken",
          { userId: USER_A },
          {
            deviceUUID: "uuid-v1",
            fcmToken: "fcm-rotated",
            identityProof: {
              signedAt,
              signature: keyPair.sign(
                `updateFCMToken:uuid-v1:fcm-rotated|${signedAt}`,
              ),
            },
          },
        );
        assert.strictEqual(result.updated, true);
      });

      it("flag on: rejects a proof signed by a different key", async function () {
        await migrateDeviceV1ToV2();
        const attacker = makeKeyPair();
        process.env.IDENTITY_ENFORCEMENT = "true";

        const signedAt = Date.now();
        await assert.rejects(
          callMethod(
            "devices.updateFCMToken",
            { userId: USER_A },
            {
              deviceUUID: "uuid-v1",
              fcmToken: "fcm-rotated",
              identityProof: {
                signedAt,
                signature: attacker.sign(
                  `updateFCMToken:uuid-v1:fcm-rotated|${signedAt}`,
                ),
              },
            },
          ),
          /identity-proof-invalid/,
        );
      });

      it("devices.checkDeviceApproval reports device state and flag", async function () {
        const result = await callMethod(
          "devices.checkDeviceApproval",
          { userId: USER_A },
          { deviceUUID: "uuid-v1" },
        );
        assert.strictEqual(result.registered, true);
        assert.strictEqual(result.approved, true);
        assert.strictEqual(result.identityVersion, 1);
        assert.strictEqual(result.enforced, false);
      });
    });

    describe("migration event logging", function () {
      const { MigrationEvents } = require("../utils/api/migrationEvents");

      // logMigrationEvent is fire-and-forget; give the insert a beat to land.
      const waitForEvents = () => new Promise((r) => setTimeout(r, 50));

      afterEach(async function () {
        await MigrationEvents.removeAsync({
          userId: { $in: [USER_A, USER_B] },
        });
      });

      it("records successful and failed attempts", async function () {
        const keyPair = makeKeyPair();
        const { challengeId, signingChallenge } = await beginMigration(keyPair);

        await assert.rejects(
          callMethod(
            "devices.proveMigrationByBiometric",
            { userId: USER_A },
            {
              challengeId,
              biometricSecret: "wrong-secret",
              signedChallenge: keyPair.sign(signingChallenge),
            },
          ),
          /proof-failed/,
        );
        await waitForEvents();

        const events = await MigrationEvents.find({
          userId: USER_A,
        }).fetchAsync();
        const outcomes = events.map((e) => `${e.action}:${e.outcome}`);
        assert.ok(outcomes.includes("begin:success"));
        assert.ok(outcomes.includes("prove-biometric:proof-failed"));
      });
    });
  });
}
