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

// Centralized PBKDF2 parameters - must match utils/api/apiKeys.js
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = 'sha512';
const SALT_BYTES = 32;

/**
 * Hash an API key using PBKDF2
 * Uses same parameters as utils/api/apiKeys.js to ensure consistency
 */
function hashApiKey(apiKey, salt = null) {
  const actualSalt = salt || crypto.randomBytes(SALT_BYTES).toString('hex');
  const hashedKey = crypto.pbkdf2Sync(apiKey, actualSalt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST).toString('hex');
  return { hashedKey, salt: actualSalt };
}

/**
 * Validate arguments before connecting to database
 * Returns error message or null if valid
 */
function validateGenerateArgs(clientId) {
  if (!clientId) {
    return 'Error: client_id is required\nUsage: node manage-api-keys.js generate <client_id>';
  }
  if (clientId.toLowerCase() === 'unspecified') {
    return 'Error: "unspecified" is a reserved client ID and cannot be used';
  }
  return null;
}

/**
 * Generate a new API key for a client
 */
async function generateApiKey(clientId) {
  const validationError = validateGenerateArgs(clientId);
  if (validationError) {
    console.error(validationError);
    return false;
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
      return false;
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
    return true;
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
    return false;
  }

  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db();
  const collection = db.collection('apiKeys');

  try {
    // Check if key exists
    const existing = await collection.findOne({ clientId });
    if (!existing) {
      console.error(`Error: No API key found for client: ${clientId}`);
      return false;
    }

    // Confirm deletion
    const answer = readline.question(`Are you sure you want to delete the API key for "${clientId}"? (yes/no): `);
    if (answer.toLowerCase() !== 'yes') {
      console.log('Deletion cancelled');
      return true; // Not an error, user cancelled
    }

    await collection.deleteOne({ clientId });
    console.log(`✓ API key deleted for client: ${clientId}`);
    return true;
  } finally {
    await client.close();
  }
}

/**
 * Validate arguments for regenerate command
 */
function validateRegenerateArgs(clientId) {
  if (!clientId) {
    return 'Error: client_id is required\nUsage: node manage-api-keys.js regenerate <client_id>';
  }
  if (clientId.toLowerCase() === 'unspecified') {
    return 'Error: "unspecified" is a reserved client ID and cannot be used';
  }
  return null;
}

/**
 * Regenerate an API key
 */
async function regenerateApiKey(clientId) {
  const validationError = validateRegenerateArgs(clientId);
  if (validationError) {
    console.error(validationError);
    return false;
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
      return false;
    }

    // Confirm regeneration
    const answer = readline.question(`Are you sure you want to regenerate the API key for "${clientId}"? The old key will stop working. (yes/no): `);
    if (answer.toLowerCase() !== 'yes') {
      console.log('Regeneration cancelled');
      return true; // Not an error, user cancelled
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
    return true;
  } finally {
    await client.close();
  }
}

// Main execution
const command = process.argv[2];
const arg = process.argv[3];

(async () => {
  let success = true;
  
  try {
    switch (command) {
      case 'generate':
        success = await generateApiKey(arg);
        break;
      case 'list':
        await listApiKeys();
        break;
      case 'delete':
        success = await deleteApiKey(arg);
        break;
      case 'regenerate':
        success = await regenerateApiKey(arg);
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
        success = false;
    }
  } catch (error) {
    console.error('Error:', error.message);
    success = false;
  }
  
  // Exit with proper code after all cleanup is done
  process.exit(success ? 0 : 1);
})();
