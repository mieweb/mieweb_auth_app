import { Mongo } from "meteor/mongo";

// Short-lived, single-use challenges for the v1 -> v2 installation-identity
// migration (see migration-plan.md Phase 1).
//
// Two independent secrets per challenge:
//  - signingChallenge: returned to the caller by devices.beginIdentityMigration;
//    signing it proves possession of the new installation private key.
//  - pushChallenge: NEVER returned over DDP — only delivered via FCM to the
//    token already stored in Mongo, so echoing it proves possession of the
//    previously registered device.
export const MigrationChallenges = new Mongo.Collection("migrationChallenges");

if (Meteor.isServer) {
  Meteor.startup(() => {
    try {
      // Mongo TTL removes expired challenges automatically.
      MigrationChallenges.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
      );
      MigrationChallenges.createIndex({ userId: 1, deviceUUID: 1 });
    } catch (error) {
      console.error("Error creating MigrationChallenges indexes:", error);
    }
  });
}
