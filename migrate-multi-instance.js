#!/usr/bin/env node

/**
 * Migration script for Multi-Instance MongoDB Solution
 *
 * This script helps with:
 * 1. Creating necessary database indexes
 * 2. Cleaning up any existing pending responses
 * 3. Verifying the setup
 */

const { MongoClient } = require("mongodb");

const MONGO_URL =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/meteor";

async function createIndexes(db) {
  console.log("Creating database indexes...");

  const collection = db.collection("pendingResponses");

  try {
    // Create username index
    await collection.createIndex({ username: 1 });
    console.log("✅ Created username index");

    // Create requestId index
    await collection.createIndex({ requestId: 1 });
    console.log("✅ Created requestId index");

    // Create TTL index for automatic cleanup
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    console.log("✅ Created TTL index for automatic cleanup");

    // Create compound index for efficient queries
    await collection.createIndex({ username: 1, status: 1 });
    console.log("✅ Created compound index (username + status)");
  } catch (error) {
    console.error("❌ Error creating indexes:", error.message);
    throw error;
  }
}

async function cleanupExistingData(db) {
  console.log("Cleaning up existing pending responses...");

  const collection = db.collection("pendingResponses");

  try {
    const result = await collection.deleteMany({});
    console.log(
      `✅ Cleaned up ${result.deletedCount} existing pending responses`,
    );
  } catch (error) {
    console.error("❌ Error cleaning up data:", error.message);
    throw error;
  }
}

async function verifySetup(db) {
  console.log("Verifying setup...");

  const collection = db.collection("pendingResponses");

  try {
    // Check indexes
    const indexes = await collection.indexes();
    const requiredIndexes = ["username_1", "requestId_1", "expiresAt_1"];

    const existingIndexNames = indexes.map((idx) => idx.name);
    const missingIndexes = requiredIndexes.filter(
      (name) => !existingIndexNames.includes(name),
    );

    if (missingIndexes.length === 0) {
      console.log("✅ All required indexes are present");
    } else {
      console.log("❌ Missing indexes:", missingIndexes);
      return false;
    }

    // Test insert and query
    const testDoc = {
      username: "migration-test",
      requestId: "test-123",
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30000),
    };

    await collection.insertOne(testDoc);
    console.log("✅ Test document inserted");

    const found = await collection.findOne({ username: "migration-test" });
    if (found) {
      console.log("✅ Test document retrieved");
    } else {
      console.log("❌ Could not retrieve test document");
      return false;
    }

    // Clean up test document
    await collection.deleteOne({ username: "migration-test" });
    console.log("✅ Test document cleaned up");

    return true;
  } catch (error) {
    console.error("❌ Error during verification:", error.message);
    return false;
  }
}

async function showCollectionStats(db) {
  console.log("Collection statistics:");

  try {
    const stats = await db.command({ collStats: "pendingResponses" });
    console.log(`📊 Documents: ${stats.count || 0}`);
    console.log(
      `📊 Average document size: ${Math.round(((stats.avgObjSize || 0) / 1024) * 100) / 100} KB`,
    );
    console.log(
      `📊 Total collection size: ${Math.round(((stats.size || 0) / 1024 / 1024) * 100) / 100} MB`,
    );
    console.log(`📊 Indexes: ${stats.nindexes || 0}`);
  } catch (error) {
    // Collection might not exist yet
    console.log(
      "📊 Collection does not exist yet (will be created on first use)",
    );
  }
}

async function main() {
  console.log("🚀 Starting Multi-Instance MongoDB Migration\n");

  if (!MONGO_URL) {
    console.error("❌ MONGO_URL environment variable is required");
    process.exit(1);
  }

  console.log(
    `📡 Connecting to: ${MONGO_URL.replace(/\/\/.*@/, "//***:***@")}`,
  );

  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB\n");

    const db = client.db();

    // Show current stats
    await showCollectionStats(db);
    console.log("");

    // Clean up existing data
    await cleanupExistingData(db);
    console.log("");

    // Create indexes
    await createIndexes(db);
    console.log("");

    // Verify setup
    const isValid = await verifySetup(db);
    console.log("");

    if (isValid) {
      console.log("🎉 Migration completed successfully!");
      console.log("");
      console.log("Next steps:");
      console.log("1. Deploy the updated application code");
      console.log("2. Monitor /api/pending-responses endpoint");
      console.log("3. Test with a sample notification");
      console.log("");
      console.log("Monitoring:");
      console.log("- Pending responses: GET /api/pending-responses");
      console.log("- Database cleanup runs automatically every minute");
      console.log("- TTL index will auto-delete expired documents");
    } else {
      console.log("❌ Migration failed verification");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log("📡 Database connection closed");
  }
}

// Handle CLI arguments
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Multi-Instance MongoDB Migration Script

Usage:
  node migrate-multi-instance.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be done without making changes
  --force        Skip confirmation prompts

Environment Variables:
  MONGO_URL      MongoDB connection string (required)

Examples:
  # Basic migration
  MONGO_URL="mongodb://localhost:27017/meteor" node migrate-multi-instance.js
  
  # With custom MongoDB Atlas connection
  MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net/myapp" node migrate-multi-instance.js
  
  # Dry run to see what would happen
  node migrate-multi-instance.js --dry-run
`);
  process.exit(0);
}

if (args.includes("--dry-run")) {
  console.log("🔍 DRY RUN MODE - No changes will be made\n");
  console.log("Would perform the following actions:");
  console.log("1. Clean up existing pendingResponses collection");
  console.log("2. Create indexes: username_1, requestId_1, expiresAt_1");
  console.log("3. Create compound index: username_1_status_1");
  console.log("4. Verify setup with test document");
  console.log("\nTo perform actual migration, run without --dry-run");
  process.exit(0);
}

// Run migration
main().catch(console.error);

module.exports = {
  createIndexes,
  cleanupExistingData,
  verifySetup,
};
