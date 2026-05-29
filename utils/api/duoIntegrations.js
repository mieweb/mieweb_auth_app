import { Mongo } from "meteor/mongo";
import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import crypto from "crypto";

/**
 * Duo Auth API "integrations" (a.k.a. applications).
 *
 * Each integration represents one consuming application (e.g. an Authentik
 * Duo stage) and holds the credentials Duo client libraries use to sign
 * requests:
 *   - ikey  : integration key  (sent as the HTTP Basic "username")
 *   - skey  : secret key       (HMAC key used to sign every request)
 *
 * IMPORTANT: Unlike `apiKeys`, the Duo secret key CANNOT be stored as a
 * one-way hash. The client never transmits the skey itself — it transmits an
 * HMAC signature computed with the skey — so the server must recompute that
 * HMAC, which requires the original skey. We therefore store the skey
 * encrypted at rest (AES-256-GCM) using a master key from the environment.
 */
export const DuoIntegrations = new Mongo.Collection("duoIntegrations");

const IKEY_PREFIX = "DI";
const IKEY_BODY_LENGTH = 18; // total ikey length 20, Duo-style
const SKEY_BYTES = 30; // ~40 base32-ish chars; Duo skeys are 40 chars

if (Meteor.isServer) {
  Meteor.startup(() => {
    DuoIntegrations.createIndex({ ikey: 1 }, { unique: true });
    DuoIntegrations.createIndex({ name: 1 }, { unique: true });
  });
}

const base32ish = (buf) =>
  buf
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

export const generateIkey = () =>
  IKEY_PREFIX + base32ish(crypto.randomBytes(16)).slice(0, IKEY_BODY_LENGTH);

export const generateSkey = () =>
  crypto.randomBytes(SKEY_BYTES).toString("hex").slice(0, 40);

/**
 * Resolve the 32-byte AES master key used to encrypt skeys at rest.
 * Reads DUO_SECRET_ENCRYPTION_KEY (64 hex chars). Returns null if unset.
 */
const getMasterKey = () => {
  const raw = process.env.DUO_SECRET_ENCRYPTION_KEY;
  if (!raw) {
    return null;
  }
  const key = Buffer.from(raw.trim(), "hex");
  if (key.length !== 32) {
    throw new Error(
      "DUO_SECRET_ENCRYPTION_KEY must be 64 hex characters (32 bytes)",
    );
  }
  return key;
};

/**
 * Encrypt a skey for storage. Returns an object describing how it was stored.
 * Falls back to plaintext (with a loud warning) when no master key is set so
 * the feature is still usable in development.
 */
export const encryptSkey = (skey) => {
  const masterKey = getMasterKey();
  if (!masterKey) {
    console.warn(
      "[duo] DUO_SECRET_ENCRYPTION_KEY is not set — storing Duo skey in PLAINTEXT. Set it in production.",
    );
    return { enc: "plain", skey };
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(skey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    enc: "aes-256-gcm",
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
  };
};

/**
 * Decrypt a stored skey back to plaintext for HMAC verification.
 */
export const decryptSkey = (stored) => {
  if (!stored) {
    return null;
  }
  if (stored.enc === "plain") {
    return stored.skey;
  }
  if (stored.enc === "aes-256-gcm") {
    const masterKey = getMasterKey();
    if (!masterKey) {
      throw new Error(
        "Duo skey is encrypted but DUO_SECRET_ENCRYPTION_KEY is not set",
      );
    }
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      masterKey,
      Buffer.from(stored.iv, "hex"),
    );
    decipher.setAuthTag(Buffer.from(stored.tag, "hex"));
    return (
      decipher.update(
        Buffer.from(stored.ciphertext, "hex"),
        undefined,
        "utf8",
      ) + decipher.final("utf8")
    );
  }
  throw new Error(`Unknown skey encryption scheme: ${stored.enc}`);
};

/**
 * Look up an enabled integration by ikey and return it with the decrypted
 * skey attached as `skey`. Returns null when not found or disabled.
 */
export const findIntegrationByIkey = async (ikey) => {
  if (!ikey) {
    return null;
  }
  const doc = await DuoIntegrations.findOneAsync({ ikey, enabled: true });
  if (!doc) {
    return null;
  }
  return { ...doc, skey: decryptSkey(doc.storedSkey) };
};

/**
 * Create a new Duo integration. Server-only (no DDP connection allowed).
 * Returns the plaintext ikey/skey ONCE — the skey is not retrievable later.
 */
export const createDuoIntegration = async ({ name }) => {
  check(name, String);
  const existing = await DuoIntegrations.findOneAsync({ name });
  if (existing) {
    throw new Meteor.Error(
      "integration-exists",
      `A Duo integration named "${name}" already exists`,
    );
  }
  const ikey = generateIkey();
  const skey = generateSkey();
  await DuoIntegrations.insertAsync({
    name,
    ikey,
    storedSkey: encryptSkey(skey),
    enabled: true,
    createdAt: new Date(),
    lastUsed: null,
  });
  return { name, ikey, skey };
};

if (Meteor.isServer) {
  Meteor.methods({
    "duoIntegrations.create": async function (name) {
      if (this.connection) {
        throw new Meteor.Error(
          "unauthorized",
          "This method can only be called from the server",
        );
      }
      check(name, String);
      return createDuoIntegration({ name });
    },

    "duoIntegrations.list": async function () {
      if (this.connection) {
        throw new Meteor.Error(
          "unauthorized",
          "This method can only be called from the server",
        );
      }
      const docs = await DuoIntegrations.find(
        {},
        { fields: { name: 1, ikey: 1, enabled: 1, createdAt: 1, lastUsed: 1 } },
      ).fetchAsync();
      return docs;
    },

    "duoIntegrations.setEnabled": async function (name, enabled) {
      if (this.connection) {
        throw new Meteor.Error(
          "unauthorized",
          "This method can only be called from the server",
        );
      }
      check(name, String);
      check(enabled, Boolean);
      const n = await DuoIntegrations.updateAsync(
        { name },
        { $set: { enabled } },
      );
      return n > 0;
    },

    "duoIntegrations.delete": async function (name) {
      if (this.connection) {
        throw new Meteor.Error(
          "unauthorized",
          "This method can only be called from the server",
        );
      }
      check(name, String);
      const n = await DuoIntegrations.removeAsync({ name });
      return n > 0;
    },

    "duoIntegrations.regenerate": async function (name) {
      if (this.connection) {
        throw new Meteor.Error(
          "unauthorized",
          "This method can only be called from the server",
        );
      }
      check(name, String);
      const existing = await DuoIntegrations.findOneAsync({ name });
      if (!existing) {
        throw new Meteor.Error(
          "integration-not-found",
          `No Duo integration named "${name}"`,
        );
      }
      const ikey = generateIkey();
      const skey = generateSkey();
      await DuoIntegrations.updateAsync(
        { name },
        {
          $set: {
            ikey,
            storedSkey: encryptSkey(skey),
            createdAt: new Date(),
            lastUsed: null,
          },
        },
      );
      return { name, ikey, skey };
    },
  });
}

// Touch lastUsed without blocking the request path.
export const touchIntegration = (ikey) => {
  DuoIntegrations.updateAsync(
    { ikey },
    { $set: { lastUsed: new Date() } },
  ).catch((err) =>
    console.error("[duo] failed to update integration lastUsed:", err),
  );
};

// Re-export Match for callers that build checks.
export { Match };
