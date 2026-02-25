import { Meteor } from "meteor/meteor";
import { Mongo } from "meteor/mongo";

/**
 * EmailLog collection — tracks every outgoing email sent by the system.
 *
 * PII fields (to, email, username) are masked before storage to minimise
 * exposure while preserving enough context for debugging.
 * A TTL index on createdAt automatically purges entries after 90 days.
 *
 * Schema:
 *   _id           String   (Mongo default)
 *   type          String   'registration_approval' | 'support_request' |
 *                          'account_deletion_admin' | 'account_deletion_user'
 *   to            String   masked recipient address
 *   from          String   sender address (system address, not PII)
 *   subject       String   email subject line
 *   userId        String   (optional) related Meteor user _id
 *   username      String   (optional) masked username
 *   email         String   (optional) masked user email
 *   status        String   'sent' | 'failed'
 *   error         String   (optional) error message if status === 'failed'
 *   createdAt     Date
 */
export const EmailLog = new Mongo.Collection("emailLog");

/**
 * Mask an email address for storage: keep first 2 chars of local part + domain.
 * e.g. "john.doe@example.com" → "jo***@example.com"
 * Comma-separated lists are masked individually.
 */
const maskEmail = (addr) => {
  if (!addr || typeof addr !== "string") return addr;
  return addr
    .split(",")
    .map((a) => {
      const trimmed = a.trim();
      const at = trimmed.indexOf("@");
      if (at < 1) return trimmed;
      const local = trimmed.substring(0, Math.min(2, at));
      return local + "***" + trimmed.substring(at);
    })
    .join(", ");
};

/**
 * Mask a username for storage: keep first 3 chars.
 * e.g. "johndoe" → "joh***"
 */
const maskUsername = (name) => {
  if (!name || typeof name !== "string") return name;
  if (name.length <= 3) return name[0] + "***";
  return name.substring(0, 3) + "***";
};

/**
 * Insert an email log entry with PII fields automatically masked.
 * Always sets createdAt so the TTL index works.
 * @param {Object} doc - The log entry fields
 * @returns {Promise<String>} Inserted document _id
 */
export const createEmailLog = async (doc) => {
  const masked = { ...doc };
  if (masked.to) masked.to = maskEmail(masked.to);
  if (masked.email) masked.email = maskEmail(masked.email);
  if (masked.username) masked.username = maskUsername(masked.username);
  if (!masked.createdAt) masked.createdAt = new Date();
  return EmailLog.insertAsync(masked);
};

if (Meteor.isServer) {
  Meteor.startup(async () => {
    try {
      const raw = EmailLog.rawCollection();
      await raw.createIndex({ createdAt: -1 });
      await raw.createIndex({ type: 1, createdAt: -1 });
      // TTL index: automatically purge entries older than 90 days
      await raw.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 90 * 24 * 60 * 60 },
      );
    } catch (error) {
      console.error("Failed to create EmailLog indexes:", error);
    }
  });
}
