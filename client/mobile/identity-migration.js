import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { Tracker } from "meteor/tracker";
import { getOrCreateIdentity } from "./installation-identity";

// Silent v1 -> v2 identity migration (migration-plan.md Phase 2).
//
// Never blocks the UI and never surfaces errors to the user; devices that
// cannot be proven silently stay v1 until the Phase 4 fallback UX.

// Challenge awaiting its push-delivered proof for this launch.
let pendingPushMigration = null;
// At most one automatic attempt per app launch.
let attemptedThisLaunch = false;

const begin = async (identity, deviceUUID) =>
  Meteor.callAsync("devices.beginIdentityMigration", {
    deviceUUID,
    installationId: identity.installationId,
    publicKey: identity.publicKeyB64,
  });

const isExpectedHalt = (error) =>
  [
    "already-migrated",
    "device-not-approved",
    "not-found",
    "challenge-invalid",
  ].includes(error?.error);

/**
 * Fast path: called right after a successful biometric login, when the
 * device-bound secret is already in hand — no extra prompt, no push needed.
 */
export const migrateWithBiometricSecret = async (biometricSecret) => {
  try {
    const deviceUUID = Session.get("capturedDeviceInfo")?.uuid;
    if (!deviceUUID) return;

    // Claim this launch's attempt so the background push path doesn't race
    // and invalidate our challenge mid-proof.
    attemptedThisLaunch = true;

    const identity = await getOrCreateIdentity();
    const { challengeId, signingChallenge } = await begin(identity, deviceUUID);

    await Meteor.callAsync("devices.proveMigrationByBiometric", {
      challengeId,
      biometricSecret,
      signedChallenge: await identity.sign(signingChallenge),
    });
    console.log("[IdentityMigration] migrated via biometric proof");
  } catch (error) {
    if (!isExpectedHalt(error)) {
      console.warn("[IdentityMigration] biometric path failed:", error.reason);
    }
  }
};

/**
 * Completes a migration when the server's challenge arrives via FCM (sent to
 * the token stored in Mongo — receiving it proves this is the registered
 * physical device). Called from the push notification handler.
 */
export const completePushMigration = async (additionalData) => {
  const { challengeId, pushChallenge } = additionalData || {};
  if (!challengeId || !pushChallenge || !pendingPushMigration) return;
  if (pendingPushMigration.challengeId !== challengeId) return;

  try {
    await Meteor.callAsync("devices.proveMigrationByPush", {
      challengeId,
      pushChallenge,
      signedChallenge: await pendingPushMigration.identity.sign(
        pendingPushMigration.signingChallenge,
      ),
    });
    console.log("[IdentityMigration] migrated via push-challenge proof");
  } catch (error) {
    if (!isExpectedHalt(error)) {
      console.warn("[IdentityMigration] push proof failed:", error.reason);
    }
  } finally {
    pendingPushMigration = null;
  }
};

/**
 * Background path: once logged in with device info available, start a
 * migration and ask the server to push the challenge to the stored token.
 */
export const initializeIdentityMigration = () => {
  Tracker.autorun(async (computation) => {
    const userId = Meteor.userId();
    const deviceUUID = Session.get("capturedDeviceInfo")?.uuid;
    if (!userId || !deviceUUID || attemptedThisLaunch) return;

    computation.stop();
    attemptedThisLaunch = true;

    try {
      const identity = await getOrCreateIdentity();
      const { challengeId, signingChallenge } = await begin(
        identity,
        deviceUUID,
      );

      pendingPushMigration = { challengeId, signingChallenge, identity };
      await Meteor.callAsync("devices.requestMigrationPushChallenge", {
        challengeId,
      });
    } catch (error) {
      pendingPushMigration = null;
      if (!isExpectedHalt(error)) {
        console.warn(
          "[IdentityMigration] background path failed:",
          error.reason,
        );
      }
    }
  });
};
