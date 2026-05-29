#!/usr/bin/env node

/**
 * CLI tool for managing Duo Auth API integrations (credentials used by
 * Authentik / duo_client to talk to MIEAuth's /auth/v2 endpoints).
 *
 * Usage:
 *   node manage-duo-integrations.js generate <name>     - Create an integration
 *   node manage-duo-integrations.js list                - List integrations
 *   node manage-duo-integrations.js enable <name>       - Enable an integration
 *   node manage-duo-integrations.js disable <name>      - Disable an integration
 *   node manage-duo-integrations.js delete <name>       - Delete an integration
 *   node manage-duo-integrations.js regenerate <name>   - Rotate ikey/skey
 *
 * The integration key (ikey) and secret key (skey) are printed ONCE on
 * generation/regeneration. The skey is stored encrypted at rest using
 * DUO_SECRET_ENCRYPTION_KEY (64 hex chars). If that env var is unset the skey
 * is stored in PLAINTEXT (development only) — set it in production.
 *
 * IMPORTANT: The ikey/skey formats and the AES-256-GCM encryption scheme here
 * MUST match utils/api/duoIntegrations.js. If you change one, change both.
 */

const readline = require("readline-sync");
const { MongoClient } = require("mongodb");
const crypto = require("crypto");

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:3001/meteor";
const COLLECTION = "duoIntegrations";

const IKEY_PREFIX = "DI";
const IKEY_BODY_LENGTH = 18;
const SKEY_BYTES = 30;

const base32ish = (buf) =>
  buf
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

const generateIkey = () =>
  IKEY_PREFIX + base32ish(crypto.randomBytes(16)).slice(0, IKEY_BODY_LENGTH);

const generateSkey = () =>
  crypto.randomBytes(SKEY_BYTES).toString("hex").slice(0, 40);

const getMasterKey = () => {
  const raw = process.env.DUO_SECRET_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw.trim(), "hex");
  if (key.length !== 32) {
    throw new Error(
      "DUO_SECRET_ENCRYPTION_KEY must be 64 hex characters (32 bytes)",
    );
  }
  return key;
};

const encryptSkey = (skey) => {
  const masterKey = getMasterKey();
  if (!masterKey) {
    console.warn(
      "\n⚠ DUO_SECRET_ENCRYPTION_KEY is not set — storing skey in PLAINTEXT.",
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

const withCollection = async (fn) => {
  const client = await MongoClient.connect(MONGO_URL);
  try {
    return await fn(client.db().collection(COLLECTION));
  } finally {
    await client.close();
  }
};

const printCredentials = (name, ikey, skey) => {
  console.log("\n✓ Duo integration credentials:");
  console.log("\nName        :", name);
  console.log("Integration key (ikey):", ikey);
  console.log("Secret key (skey)     :", skey);
  console.log(
    "\n⚠ IMPORTANT: Store the skey securely. It will not be shown again.",
  );
  console.log("\nConfigure your Duo client / Authentik Duo stage with:");
  console.log("  API hostname     : <this server's host>");
  console.log("  Integration key  :", ikey);
  console.log("  Secret key       :", skey);
};

async function generate(name) {
  if (!name) {
    console.error("Error: name is required\nUsage: generate <name>");
    return false;
  }
  return withCollection(async (col) => {
    if (await col.findOne({ name })) {
      console.error(`Error: integration "${name}" already exists`);
      console.log('Use "regenerate" to rotate its credentials.');
      return false;
    }
    const ikey = generateIkey();
    const skey = generateSkey();
    await col.insertOne({
      name,
      ikey,
      storedSkey: encryptSkey(skey),
      enabled: true,
      createdAt: new Date(),
      lastUsed: null,
    });
    printCredentials(name, ikey, skey);
    return true;
  });
}

async function list() {
  return withCollection(async (col) => {
    const docs = await col
      .find(
        {},
        {
          projection: {
            name: 1,
            ikey: 1,
            enabled: 1,
            createdAt: 1,
            lastUsed: 1,
          },
        },
      )
      .toArray();
    if (docs.length === 0) {
      console.log("No Duo integrations found");
      return true;
    }
    console.log("\nDuo Integrations:\n");
    console.log(
      "Name".padEnd(24),
      "ikey".padEnd(22),
      "Enabled".padEnd(9),
      "Last Used",
    );
    console.log("-".repeat(80));
    docs.forEach((d) => {
      console.log(
        String(d.name).padEnd(24),
        String(d.ikey).padEnd(22),
        String(Boolean(d.enabled)).padEnd(9),
        d.lastUsed ? d.lastUsed.toISOString() : "Never",
      );
    });
    console.log("");
    return true;
  });
}

async function setEnabled(name, enabled) {
  if (!name) {
    console.error("Error: name is required");
    return false;
  }
  return withCollection(async (col) => {
    const res = await col.updateOne({ name }, { $set: { enabled } });
    if (res.matchedCount === 0) {
      console.error(`Error: no integration named "${name}"`);
      return false;
    }
    console.log(`✓ Integration "${name}" ${enabled ? "enabled" : "disabled"}`);
    return true;
  });
}

async function remove(name) {
  if (!name) {
    console.error("Error: name is required");
    return false;
  }
  return withCollection(async (col) => {
    if (!(await col.findOne({ name }))) {
      console.error(`Error: no integration named "${name}"`);
      return false;
    }
    const answer = readline.question(
      `Are you sure you want to delete Duo integration "${name}"? (yes/no): `,
    );
    if (answer.toLowerCase() !== "yes") {
      console.log("Deletion cancelled");
      return true;
    }
    await col.deleteOne({ name });
    console.log(`✓ Deleted Duo integration "${name}"`);
    return true;
  });
}

async function regenerate(name) {
  if (!name) {
    console.error("Error: name is required");
    return false;
  }
  return withCollection(async (col) => {
    if (!(await col.findOne({ name }))) {
      console.error(`Error: no integration named "${name}"`);
      console.log('Use "generate" to create one.');
      return false;
    }
    const answer = readline.question(
      `Rotate credentials for "${name}"? The old ikey/skey will stop working. (yes/no): `,
    );
    if (answer.toLowerCase() !== "yes") {
      console.log("Regeneration cancelled");
      return true;
    }
    const ikey = generateIkey();
    const skey = generateSkey();
    await col.updateOne(
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
    printCredentials(name, ikey, skey);
    console.log("⚠ The old credentials are now invalid.");
    return true;
  });
}

const command = process.argv[2];
const arg = process.argv[3];

(async () => {
  let success = true;
  try {
    switch (command) {
      case "generate":
        success = await generate(arg);
        break;
      case "list":
        success = await list();
        break;
      case "enable":
        success = await setEnabled(arg, true);
        break;
      case "disable":
        success = await setEnabled(arg, false);
        break;
      case "delete":
        success = await remove(arg);
        break;
      case "regenerate":
        success = await regenerate(arg);
        break;
      default:
        console.log("Duo Integration Management Tool");
        console.log("\nUsage:");
        console.log("  node manage-duo-integrations.js generate <name>");
        console.log("  node manage-duo-integrations.js list");
        console.log("  node manage-duo-integrations.js enable <name>");
        console.log("  node manage-duo-integrations.js disable <name>");
        console.log("  node manage-duo-integrations.js delete <name>");
        console.log("  node manage-duo-integrations.js regenerate <name>");
        console.log("\nEnvironment Variables:");
        console.log("  MONGO_URL                   - MongoDB connection URL");
        console.log(
          "  DUO_SECRET_ENCRYPTION_KEY   - 64 hex chars; encrypts skey at rest",
        );
        success = false;
    }
  } catch (error) {
    console.error("Error:", error.message);
    success = false;
  }
  process.exit(success ? 0 : 1);
})();
