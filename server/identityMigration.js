import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { DDPRateLimiter } from "meteor/ddp-rate-limiter";
import { Random } from "meteor/random";
import crypto from "crypto";
import { DeviceDetails } from "../utils/api/deviceDetails.js";
import { MigrationChallenges } from "../utils/api/migrationChallenges.js";
import { logMigrationEvent } from "../utils/api/migrationEvents.js";
import { timingSafeEquals } from "./deviceManagement.js";
import { sendNotification } from "./firebase.js";

/**
 * v1 -> v2 installation-identity migration (migration-plan.md Phase 1).
 *
 * A v2 device is bound to an ECDSA P-256 keypair generated on the device
 * (private key non-extractable, never sent to the server). An approved v1
 * device may be silently upgraded by proving possession of something that
 * stays on the original physical phone:
 *  - the device-bound biometric secret, or
 *  - a challenge delivered via FCM to the token already stored in Mongo.
 * Backup-restored replacement phones have neither, so they cannot inherit
 * trust and must go through manual approval (Phase 4).
 */

const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

const asP256KeyObject = (publicKeyB64) => {
  try {
    const keyObject = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    const isP256 =
      keyObject.asymmetricKeyType === "ec" &&
      keyObject.asymmetricKeyDetails?.namedCurve === "prime256v1";
    return isP256 ? keyObject : null;
  } catch {
    return null;
  }
};

// WebCrypto ECDSA produces IEEE P1363 (r||s) signatures over SHA-256.
const verifySignature = (publicKeyB64, message, signatureB64) => {
  const keyObject = asP256KeyObject(publicKeyB64);
  if (!keyObject) return false;
  try {
    return crypto.verify(
      "sha256",
      Buffer.from(message, "utf8"),
      { key: keyObject, dsaEncoding: "ieee-p1363" },
      Buffer.from(signatureB64, "base64"),
    );
  } catch {
    return false;
  }
};

const requireLogin = (context) => {
  if (!context.userId) {
    throw new Meteor.Error(
      "not-authorized",
      "You must be signed in to migrate this device.",
    );
  }
};

const getLiveChallengeOrThrow = async (userId, challengeId) => {
  const challenge = await MigrationChallenges.findOneAsync({
    _id: challengeId,
    userId,
  });
  if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date()) {
    throw new Meteor.Error(
      "challenge-invalid",
      "The migration challenge is invalid or expired. Please start over.",
    );
  }
  return challenge;
};

// Single-use guard: only the first concurrent prover can flip usedAt.
const consumeChallenge = async (challengeId) => {
  const updated = await MigrationChallenges.updateAsync(
    { _id: challengeId, usedAt: null },
    { $set: { usedAt: new Date() } },
  );
  if (updated !== 1) {
    throw new Meteor.Error(
      "challenge-invalid",
      "The migration challenge was already used. Please start over.",
    );
  }
};

const bindIdentity = async (userId, challenge, migrationProof) => {
  await DeviceDetails.updateAsync(
    { userId, "devices.deviceUUID": challenge.deviceUUID },
    {
      $set: {
        "devices.$.installationId": challenge.installationId,
        "devices.$.publicKey": challenge.publicKey,
        "devices.$.identityVersion": 2,
        "devices.$.migratedAt": new Date(),
        "devices.$.migrationProof": migrationProof,
        "devices.$.lastUpdated": new Date(),
        lastUpdated: new Date(),
      },
    },
  );
};

// Rollout observability (Phase 3): record every attempt's outcome so admins
// can measure v2 coverage and fix recurring failures before enforcement.
const logged = (action, handler) =>
  async function (options) {
    try {
      const result = await handler.call(this, options);
      logMigrationEvent({
        action,
        userId: this.userId,
        deviceUUID: options?.deviceUUID,
        outcome: "success",
      });
      return result;
    } catch (error) {
      logMigrationEvent({
        action,
        userId: this.userId,
        deviceUUID: options?.deviceUUID,
        outcome: error.error || "error",
        message: error.reason || error.message,
      });
      throw error;
    }
  };

Meteor.methods({
  /**
   * Start a v2 identity migration for the caller's own approved device.
   * Returns a signing challenge (proves possession of the new private key).
   * The separate push challenge is only ever delivered via FCM.
   */
  "devices.beginIdentityMigration": logged("begin", async function (options) {
    check(options, {
      deviceUUID: String,
      installationId: String,
      publicKey: String,
    });
    requireLogin(this);

    const { deviceUUID, installationId, publicKey } = options;

    if (!asP256KeyObject(publicKey)) {
      throw new Meteor.Error(
        "invalid-public-key",
        "The installation public key must be an ECDSA P-256 SPKI key.",
      );
    }

    const userDoc = await DeviceDetails.findOneAsync({ userId: this.userId });
    const device = userDoc?.devices?.find((d) => d.deviceUUID === deviceUUID);

    if (!device) {
      throw new Meteor.Error("not-found", "Device not found.");
    }
    if (device.deviceRegistrationStatus !== "approved") {
      throw new Meteor.Error(
        "device-not-approved",
        "Only approved devices can migrate.",
      );
    }
    if (device.identityVersion === 2) {
      throw new Meteor.Error(
        "already-migrated",
        "This device already has a v2 identity.",
      );
    }

    // One live challenge per device — restarting invalidates older attempts.
    await MigrationChallenges.removeAsync({ userId: this.userId, deviceUUID });

    const now = new Date();
    const challengeId = await MigrationChallenges.insertAsync({
      userId: this.userId,
      deviceUUID,
      installationId,
      publicKey,
      signingChallenge: Random.secret(32),
      pushChallenge: Random.secret(32),
      createdAt: now,
      expiresAt: new Date(now.getTime() + CHALLENGE_EXPIRY_MS),
      usedAt: null,
    });

    const challenge = await MigrationChallenges.findOneAsync(challengeId);
    return {
      challengeId,
      signingChallenge: challenge.signingChallenge,
      expiresAt: challenge.expiresAt,
    };
  }),

  /**
   * Prove the migration with the device-bound biometric secret plus a
   * signature over the signing challenge by the new installation key.
   */
  "devices.proveMigrationByBiometric": logged(
    "prove-biometric",
    async function (options) {
      check(options, {
        challengeId: String,
        biometricSecret: String,
        signedChallenge: String,
      });
      requireLogin(this);

      const { challengeId, biometricSecret, signedChallenge } = options;
      const challenge = await getLiveChallengeOrThrow(this.userId, challengeId);

      const userDoc = await DeviceDetails.findOneAsync({ userId: this.userId });
      const device = userDoc?.devices?.find(
        (d) => d.deviceUUID === challenge.deviceUUID,
      );

      if (
        !device?.biometricSecret ||
        !timingSafeEquals(device.biometricSecret, biometricSecret)
      ) {
        throw new Meteor.Error(
          "proof-failed",
          "Biometric verification failed.",
        );
      }
      if (
        !verifySignature(
          challenge.publicKey,
          challenge.signingChallenge,
          signedChallenge,
        )
      ) {
        throw new Meteor.Error(
          "proof-failed",
          "Signature verification failed.",
        );
      }

      await consumeChallenge(challengeId);
      await bindIdentity(this.userId, challenge, "biometric");
      return { success: true, migrationProof: "biometric" };
    },
  ),

  /**
   * Deliver the push challenge to the FCM token ALREADY STORED in Mongo for
   * the device under migration — never to a caller-supplied token. Only the
   * physical phone holding that registration can receive it.
   */
  "devices.requestMigrationPushChallenge": logged(
    "request-push",
    async function (options) {
      check(options, { challengeId: String });
      requireLogin(this);

      const challenge = await getLiveChallengeOrThrow(
        this.userId,
        options.challengeId,
      );

      const userDoc = await DeviceDetails.findOneAsync({ userId: this.userId });
      const device = userDoc?.devices?.find(
        (d) => d.deviceUUID === challenge.deviceUUID,
      );

      if (!device?.fcmToken) {
        throw new Meteor.Error(
          "no-stored-token",
          "No FCM token is stored for this device — push proof is unavailable.",
        );
      }

      // Empty title/body + isSync makes this a silent data-only push.
      const messageId = await sendNotification(device.fcmToken, "", "", {
        notificationType: "migration_challenge",
        isSync: "true",
        challengeId: options.challengeId,
        pushChallenge: challenge.pushChallenge,
      });

      return { success: true, sent: !!messageId };
    },
  ),

  /**
   * Prove the migration by echoing the push-delivered challenge plus a
   * signature over the signing challenge by the new installation key.
   */
  "devices.proveMigrationByPush": logged(
    "prove-push",
    async function (options) {
      check(options, {
        challengeId: String,
        pushChallenge: String,
        signedChallenge: String,
      });
      requireLogin(this);

      const { challengeId, pushChallenge, signedChallenge } = options;
      const challenge = await getLiveChallengeOrThrow(this.userId, challengeId);

      if (!timingSafeEquals(challenge.pushChallenge, pushChallenge)) {
        throw new Meteor.Error("proof-failed", "Push challenge did not match.");
      }
      if (
        !verifySignature(
          challenge.publicKey,
          challenge.signingChallenge,
          signedChallenge,
        )
      ) {
        throw new Meteor.Error(
          "proof-failed",
          "Signature verification failed.",
        );
      }

      await consumeChallenge(challengeId);
      await bindIdentity(this.userId, challenge, "fcm-challenge");
      return { success: true, migrationProof: "fcm-challenge" };
    },
  ),
});

const MIGRATION_METHODS = new Set([
  "devices.beginIdentityMigration",
  "devices.proveMigrationByBiometric",
  "devices.requestMigrationPushChallenge",
  "devices.proveMigrationByPush",
]);

DDPRateLimiter.addRule(
  {
    type: "method",
    name: (name) => MIGRATION_METHODS.has(name),
    connectionId: () => true,
  },
  10,
  60 * 1000,
);
