#!/usr/bin/env node

/**
 * CLI tool for managing API keys for the /send-notification endpoint
 * 
 * Usage:
 *   node manage-api-keys.js generate <client_id>     - Generate a new API key
 *   node manage-api-keys.js list                     - List all API keys
 *   node manage-api-keys.js delete <client_id>       - Delete an API key
 *   node manage-api-keys.js regenerate <client_id>   - Regenerate an API key
 * 
 * Note: The 'unspecified' client ID is reserved and cannot be used.
 */

const readline = require('readline-sync');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

// MongoDB connection URL (default Meteor local)
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:3001/meteor';

/**
 * Hash an API key using PBKDF2
 */
function hashApiKey(apiKey, salt = null) {
  const actualSalt = salt || crypto.randomBytes(32).toString('hex');
  const hashedKey = crypto.pbkdf2Sync(apiKey, actualSalt, 100000, 64, 'sha512').toString('hex');
  return { hashedKey, salt: actualSalt };
}

/**
 * Generate a new API key for a client
 */
async function generateApiKey(clientId) {
  if (!clientId) {
    console.error('Error: client_id is required');
    console.log('Usage: node manage-api-keys.js generate <client_id>');
    process.exit(1);
  }

  if (clientId.toLowerCase() === 'unspecified') {
    console.error('Error: "unspecified" is a reserved client ID and cannot be used');
    process.exit(1);
  }

  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db();
  const collection = db.collection('apiKeys');

  try {
    // Check if client already exists
    const existing = await collection.findOne({ clientId });
    if (existing) {
      console.error(`Error: API key already exists for client: ${clientId}`);
      console.log('Use "regenerate" command to create a new key for this client');
      process.exit(1);
    }

    // Generate API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    const { hashedKey, salt } = hashApiKey(apiKey);

    // Insert into database
    await collection.insertOne({
      clientId,
      hashedKey,
      salt,
      createdAt: new Date(),
      lastUsed: null
    });

    console.log('\n✓ API key generated successfully!');
    console.log('\nClient ID:', clientId);
    console.log('API Key:', apiKey);
    console.log('\n⚠ IMPORTANT: Store this API key securely. It will not be shown again.');
    console.log('\nTo use this key, include it in your POST request to /send-notification:');
    console.log('{\n  "username": "...",\n  "title": "...",\n  "body": "...",\n  "actions": [...],\n  "apikey": "' + apiKey + '",\n  "client_id": "' + clientId + '"\n}');
  } finally {
    await client.close();
  }
}

/**
 * List all API keys
 */
async function listApiKeys() {
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db();
  const collection = db.collection('apiKeys');

  try {
    const keys = await collection.find({}, {
      projection: { clientId: 1, createdAt: 1, lastUsed: 1 }
    }).toArray();

    if (keys.length === 0) {
      console.log('No API keys found');
      return;
    }

    console.log('\nAPI Keys:\n');
    console.log('Client ID'.padEnd(40), 'Created'.padEnd(25), 'Last Used');
    console.log('-'.repeat(90));
    
    keys.forEach(key => {
      const created = key.createdAt ? key.createdAt.toISOString() : 'N/A';
      const lastUsed = key.lastUsed ? key.lastUsed.toISOString() : 'Never';
      console.log(
        key.clientId.padEnd(40),
        created.padEnd(25),
        lastUsed
      );
    });
    
    console.log('');
  } finally {
    await client.close();
  }
}

/**
 * Delete an API key
 */
async function deleteApiKey(clientId) {
  if (!clientId) {
    console.error('Error: client_id is required');
    console.log('Usage: node manage-api-keys.js delete <client_id>');
    process.exit(1);
  }

  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db();
  const collection = db.collection('apiKeys');

  try {
    // Check if key exists
    const existing = await collection.findOne({ clientId });
    if (!existing) {
      console.error(`Error: No API key found for client: ${clientId}`);
      process.exit(1);
    }

    // Confirm deletion
    const answer = readline.question(`Are you sure you want to delete the API key for "${clientId}"? (yes/no): `);
    if (answer.toLowerCase() !== 'yes') {
      console.log('Deletion cancelled');
      return;
    }

    await collection.deleteOne({ clientId });
    console.log(`✓ API key deleted for client: ${clientId}`);
  } finally {
    await client.close();
  }
}

/**
 * Regenerate an API key
 */
async function regenerateApiKey(clientId) {
  if (!clientId) {
    console.error('Error: client_id is required');
    console.log('Usage: node manage-api-keys.js regenerate <client_id>');
    process.exit(1);
  }

  if (clientId.toLowerCase() === 'unspecified') {
    console.error('Error: "unspecified" is a reserved client ID and cannot be used');
    process.exit(1);
  }

  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db();
  const collection = db.collection('apiKeys');

  try {
    // Check if key exists
    const existing = await collection.findOne({ clientId });
    if (!existing) {
      console.error(`Error: No API key found for client: ${clientId}`);
      console.log('Use "generate" command to create a new key');
      process.exit(1);
    }

    // Confirm regeneration
    const answer = readline.question(`Are you sure you want to regenerate the API key for "${clientId}"? The old key will stop working. (yes/no): `);
    if (answer.toLowerCase() !== 'yes') {
      console.log('Regeneration cancelled');
      return;
    }

    // Generate new API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    const { hashedKey, salt } = hashApiKey(apiKey);

    // Update database
    await collection.updateOne(
      { clientId },
      {
        $set: {
          hashedKey,
          salt,
          createdAt: new Date(),
          lastUsed: null
        }
      }
    );

    console.log('\n✓ API key regenerated successfully!');
    console.log('\nClient ID:', clientId);
    console.log('New API Key:', apiKey);
    console.log('\n⚠ IMPORTANT: Store this API key securely. It will not be shown again.');
    console.log('⚠ The old API key is now invalid.');
  } finally {
    await client.close();
  }
}

// Main execution
const command = process.argv[2];
const arg = process.argv[3];

(async () => {
  try {
    switch (command) {
      case 'generate':
        await generateApiKey(arg);
        break;
      case 'list':
        await listApiKeys();
        break;
      case 'delete':
        await deleteApiKey(arg);
        break;
      case 'regenerate':
        await regenerateApiKey(arg);
        break;
      default:
        console.log('API Key Management Tool');
        console.log('\nUsage:');
        console.log('  node manage-api-keys.js generate <client_id>     - Generate a new API key');
        console.log('  node manage-api-keys.js list                     - List all API keys');
        console.log('  node manage-api-keys.js delete <client_id>       - Delete an API key');
        console.log('  node manage-api-keys.js regenerate <client_id>   - Regenerate an API key');
        console.log('\nNote: The "unspecified" client ID is reserved and cannot be used.');
        console.log('\nEnvironment Variables:');
        console.log('  MONGO_URL - MongoDB connection URL (default: mongodb://localhost:3001/meteor)');
        console.log('  SEND_NOTIFICATION_FORCE_AUTH - Set to "true" to require API key authentication');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
