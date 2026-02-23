import { Mongo } from "meteor/mongo";
import { check } from "meteor/check";
import crypto from "crypto";
import { promisify } from "util";

// Guard against double-instantiation (Meteor + rspack both load this module)
export const ApiKeys = (globalThis.__collections_apiKeys ??=
  new Mongo.Collection("apiKeys"));

// Promisify pbkdf2 for async usage
const pbkdf2Async = promisify(crypto.pbkdf2);

// Centralized PBKDF2 parameters - shared with CLI tool
export const PBKDF2_ITERATIONS = 100000;
export const PBKDF2_KEY_LENGTH = 64;
export const PBKDF2_DIGEST = "sha512";
export const SALT_BYTES = 32;

// Create indexes for better query performance
if (Meteor.isServer) {
  Meteor.startup(() => {
    ApiKeys.createIndex({ clientId: 1 }, { unique: true });
    ApiKeys.createIndex({ hashedKey: 1 });
  });
}

/**
 * Hash an API key using PBKDF2 (synchronous version for tests)
 * @param {string} apiKey - The plain API key
 * @param {string} salt - Optional salt (generated if not provided)
 * @returns {object} Object with hashedKey and salt
 */
export const hashApiKey = (apiKey, salt = null) => {
  const actualSalt = salt || crypto.randomBytes(SALT_BYTES).toString("hex");
  // Use PBKDF2 - 100k iterations with SHA-512 provides strong security
  const hashedKey = crypto
    .pbkdf2Sync(
      apiKey,
      actualSalt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LENGTH,
      PBKDF2_DIGEST,
    )
    .toString("hex");
  return { hashedKey, salt: actualSalt };
};

/**
 * Hash an API key using PBKDF2 (async version - non-blocking)
 * @param {string} apiKey - The plain API key
 * @param {string} salt - Optional salt (generated if not provided)
 * @returns {Promise<object>} Object with hashedKey and salt
 */
export const hashApiKeyAsync = async (apiKey, salt = null) => {
  const actualSalt = salt || crypto.randomBytes(SALT_BYTES).toString("hex");
  const hashedKeyBuffer = await pbkdf2Async(
    apiKey,
    actualSalt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST,
  );
  return { hashedKey: hashedKeyBuffer.toString("hex"), salt: actualSalt };
};

/**
 * Verify an API key against a stored hash using timing-safe comparison
 * @param {string} apiKey - The plain API key to verify
 * @param {string} storedHash - The stored hash
 * @param {string} salt - The salt used for hashing
 * @returns {boolean} True if the key matches
 */
export const verifyApiKey = (apiKey, storedHash, salt) => {
  const { hashedKey } = hashApiKey(apiKey, salt);

  // Use timing-safe comparison to prevent timing attacks
  const hashedKeyBuffer = Buffer.from(hashedKey, "hex");
  const storedHashBuffer = Buffer.from(storedHash, "hex");

  if (hashedKeyBuffer.length !== storedHashBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashedKeyBuffer, storedHashBuffer);
};

/**
 * Verify an API key against a stored hash using timing-safe comparison (async version)
 * @param {string} apiKey - The plain API key to verify
 * @param {string} storedHash - The stored hash
 * @param {string} salt - The salt used for hashing
 * @returns {Promise<boolean>} True if the key matches
 */
export const verifyApiKeyAsync = async (apiKey, storedHash, salt) => {
  const { hashedKey } = await hashApiKeyAsync(apiKey, salt);

  // Use timing-safe comparison to prevent timing attacks
  const hashedKeyBuffer = Buffer.from(hashedKey, "hex");
  const storedHashBuffer = Buffer.from(storedHash, "hex");

  if (hashedKeyBuffer.length !== storedHashBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashedKeyBuffer, storedHashBuffer);
};

Meteor.methods({
  /**
   * Create a new API key for a client
   * Server-only method - cannot be called from client
   * @param {string} clientId - The client identifier (e.g., ldap.example.com)
   * @returns {string} The generated API key (only returned once)
   */
  "apiKeys.create": async function (clientId) {
    // Authorization: Only allow server-side calls (no DDP connection)
    if (this.connection) {
      throw new Meteor.Error(
        "unauthorized",
        "This method can only be called from the server",
      );
    }

    check(clientId, String);

    // Reject 'unspecified' as a client ID
    if (clientId.toLowerCase() === "unspecified") {
      throw new Meteor.Error(
        "invalid-client-id",
        'Client ID "unspecified" is reserved and cannot be used',
      );
    }

    // Check if client already has an API key
    const existing = await ApiKeys.findOneAsync({ clientId });
    if (existing) {
      throw new Meteor.Error(
        "client-exists",
        `API key already exists for client: ${clientId}`,
      );
    }

    // Generate a secure random API key
    const apiKey = crypto.randomBytes(32).toString("hex");
    const { hashedKey, salt } = await hashApiKeyAsync(apiKey);

    // Store the hashed key
    await ApiKeys.insertAsync({
      clientId,
      hashedKey,
      salt,
      createdAt: new Date(),
      lastUsed: null,
    });

    console.log(`API key created for client: ${clientId}`);

    // Return the plain API key (only time it will be shown)
    return apiKey;
  },

  /**
   * Verify an API key for a client
   * This method is intentionally callable from anywhere (needed for endpoint auth)
   * @param {string} apiKey - The API key to verify
   * @param {string} clientId - Optional client ID to speed up lookup
   * @returns {object} Object with isValid and clientId
   */
  "apiKeys.verify": async function (apiKey, clientId = null) {
    check(apiKey, String);
    check(clientId, Match.Maybe(String));

    // Reject if trying to use 'unspecified' as client ID
    if (clientId && clientId.toLowerCase() === "unspecified") {
      console.log(
        "Rejected API key verification for reserved client ID: unspecified",
      );
      return { isValid: false, clientId: null };
    }

    let keyDoc;

    if (clientId) {
      // Fast path: lookup by client ID first
      keyDoc = await ApiKeys.findOneAsync({ clientId });

      if (!keyDoc) {
        return { isValid: false, clientId: null };
      }

      // Use async version to avoid blocking event loop
      const isValid = await verifyApiKeyAsync(
        apiKey,
        keyDoc.hashedKey,
        keyDoc.salt,
      );

      if (isValid) {
        // Update last used timestamp
        await ApiKeys.updateAsync(
          { _id: keyDoc._id },
          { $set: { lastUsed: new Date() } },
        );

        return { isValid: true, clientId: keyDoc.clientId };
      }

      return { isValid: false, clientId: null };
    }

    // Slow path: check all keys if no client ID provided
    const allKeys = await ApiKeys.find({}).fetchAsync();

    for (const doc of allKeys) {
      // Skip 'unspecified' entries
      if (doc.clientId.toLowerCase() === "unspecified") {
        continue;
      }

      // Use async version to avoid blocking event loop
      if (await verifyApiKeyAsync(apiKey, doc.hashedKey, doc.salt)) {
        // Update last used timestamp
        await ApiKeys.updateAsync(
          { _id: doc._id },
          { $set: { lastUsed: new Date() } },
        );

        return { isValid: true, clientId: doc.clientId };
      }
    }

    return { isValid: false, clientId: null };
  },

  /**
   * List all API keys (without revealing the actual keys)
   * Server-only method - cannot be called from client
   * @returns {Array} Array of client IDs with metadata
   */
  "apiKeys.list": async function () {
    // Authorization: Only allow server-side calls (no DDP connection)
    if (this.connection) {
      throw new Meteor.Error(
        "unauthorized",
        "This method can only be called from the server",
      );
    }

    const keys = await ApiKeys.find(
      {},
      { fields: { clientId: 1, createdAt: 1, lastUsed: 1 } },
    ).fetchAsync();

    return keys.map((k) => ({
      clientId: k.clientId,
      createdAt: k.createdAt,
      lastUsed: k.lastUsed,
    }));
  },

  /**
   * Delete an API key for a client
   * Server-only method - cannot be called from client
   * @param {string} clientId - The client identifier
   * @returns {boolean} True if deleted
   */
  "apiKeys.delete": async function (clientId) {
    // Authorization: Only allow server-side calls (no DDP connection)
    if (this.connection) {
      throw new Meteor.Error(
        "unauthorized",
        "This method can only be called from the server",
      );
    }

    check(clientId, String);

    const result = await ApiKeys.removeAsync({ clientId });
    console.log(`API key deleted for client: ${clientId}`);

    return result > 0;
  },

  /**
   * Regenerate an API key for a client
   * Server-only method - cannot be called from client
   * @param {string} clientId - The client identifier
   * @returns {string} The new API key
   */
  "apiKeys.regenerate": async function (clientId) {
    // Authorization: Only allow server-side calls (no DDP connection)
    if (this.connection) {
      throw new Meteor.Error(
        "unauthorized",
        "This method can only be called from the server",
      );
    }

    check(clientId, String);

    // Reject 'unspecified' as a client ID
    if (clientId.toLowerCase() === "unspecified") {
      throw new Meteor.Error(
        "invalid-client-id",
        'Client ID "unspecified" is reserved and cannot be used',
      );
    }

    // Check if client exists
    const existing = await ApiKeys.findOneAsync({ clientId });
    if (!existing) {
      throw new Meteor.Error(
        "client-not-found",
        `No API key found for client: ${clientId}`,
      );
    }

    // Generate a new API key
    const apiKey = crypto.randomBytes(32).toString("hex");
    const { hashedKey, salt } = await hashApiKeyAsync(apiKey);

    // Update the key
    await ApiKeys.updateAsync(
      { clientId },
      {
        $set: {
          hashedKey,
          salt,
          createdAt: new Date(),
          lastUsed: null,
        },
      },
    );

    console.log(`API key regenerated for client: ${clientId}`);

    return apiKey;
  },
});
