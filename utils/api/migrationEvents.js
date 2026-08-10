import { Mongo } from "meteor/mongo";

// Observation log for the v1 -> v2 identity migration rollout
// (migration-plan.md Phase 3). One document per begin/prove attempt, so
// admins can measure coverage and diagnose recurring silent-migration
// failures before enforcement (Phase 5).
export const MigrationEvents = new Mongo.Collection("migrationEvents");

const EVENT_TTL_SECONDS = 30 * 24 * 60 * 60;

if (Meteor.isServer) {
  Meteor.startup(() => {
    try {
      MigrationEvents.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: EVENT_TTL_SECONDS },
      );
      MigrationEvents.createIndex({ outcome: 1, createdAt: -1 });
    } catch (error) {
      console.error("Error creating MigrationEvents indexes:", error);
    }
  });
}

/** Fire-and-forget insert — observability must never break a migration. */
export const logMigrationEvent = (event) => {
  MigrationEvents.insertAsync({ ...event, createdAt: new Date() }).catch(
    (error) => console.error("Failed to log migration event:", error),
  );
};
