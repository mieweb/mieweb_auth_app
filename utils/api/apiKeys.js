import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { SHA256 } from 'meteor/sha';

// Initialize collection
const ApiKeys = new Mongo.Collection('apiKeys');

// Export the collection
export { ApiKeys };

/**
 * Hash an API key with salt
 * @param {String} apiKey - Plain text API key
 * @param {String} clientId - Client identifier (used as salt)
 * @returns {String} Hashed API key
 */
const hashApiKey = (apiKey, clientId) => {
  // Use client ID as salt for additional security
  const saltedKey = `${clientId}:${apiKey}`;
  return SHA256(saltedKey);
};

// Create indexes for better query performance
if (Meteor.isServer) {
  Meteor.startup(() => {
    try {
      // Primary index for client lookups
      ApiKeys.createIndex({ clientId: 1 }, { unique: true });
      
      // Index for hash lookups (for verification)
      ApiKeys.createIndex({ hashedApiKey: 1 });
      
      console.log('ApiKeys indexes created successfully');
    } catch (error) {
      console.error('Error creating ApiKeys indexes:', error);
    }
  });
}

// Define methods for ApiKeys
// NOTE: These methods should be restricted to admin users in production.
// Consider adding role-based access control using packages like alanning:roles
// Example: if (!Roles.userIsInRole(this.userId, 'admin')) throw new Meteor.Error('unauthorized');
Meteor.methods({
  /**
   * Create or update an API key for a client
   * @param {String} clientId - Client identifier (e.g., ldap.example.com)
   * @param {String} apiKey - Plain text API key
   * @returns {Object} Result with success status
   */
  'apiKeys.upsert': async function(clientId, apiKey) {
    check(clientId, String);
    check(apiKey, String);
    
    // Trim inputs
    clientId = clientId.trim();
    apiKey = apiKey.trim();
    
    if (!clientId || clientId === '') {
      throw new Meteor.Error('invalid-client-id', 'Client ID cannot be empty');
    }
    
    if (!apiKey || apiKey === '' || apiKey.length < 16) {
      throw new Meteor.Error('invalid-api-key', 'API key must be at least 16 characters long');
    }
    
    const hashedApiKey = hashApiKey(apiKey, clientId);
    
    const existingKey = await ApiKeys.findOneAsync({ clientId });
    
    if (existingKey) {
      // Update existing key
      await ApiKeys.updateAsync(
        { clientId },
        {
          $set: {
            hashedApiKey,
            updatedAt: new Date()
          }
        }
      );
      console.log(`API key updated for client: ${clientId}`);
      return { success: true, action: 'updated' };
    } else {
      // Insert new key
      await ApiKeys.insertAsync({
        clientId,
        hashedApiKey,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsed: null
      });
      console.log(`API key created for client: ${clientId}`);
      return { success: true, action: 'created' };
    }
  },
  
  /**
   * Verify an API key for a client
   * @param {String} clientId - Client identifier
   * @param {String} apiKey - Plain text API key to verify
   * @returns {Boolean} True if valid, false otherwise
   */
  'apiKeys.verify': async function(clientId, apiKey) {
    check(clientId, String);
    check(apiKey, String);
    
    const keyDoc = await ApiKeys.findOneAsync({ clientId });
    
    if (!keyDoc) {
      console.log(`No API key found for client: ${clientId}`);
      return false;
    }
    
    const hashedProvidedKey = hashApiKey(apiKey, clientId);
    const isValid = hashedProvidedKey === keyDoc.hashedApiKey;
    
    if (isValid) {
      // Update last used timestamp
      await ApiKeys.updateAsync(
        { clientId },
        {
          $set: {
            lastUsed: new Date()
          }
        }
      );
      console.log(`API key verified successfully for client: ${clientId}`);
    } else {
      console.log(`Invalid API key provided for client: ${clientId}`);
    }
    
    return isValid;
  },
  
  /**
   * Delete an API key for a client
   * @param {String} clientId - Client identifier
   * @returns {Object} Result with success status
   */
  'apiKeys.delete': async function(clientId) {
    check(clientId, String);
    
    const result = await ApiKeys.removeAsync({ clientId });
    
    if (result > 0) {
      console.log(`API key deleted for client: ${clientId}`);
      return { success: true, deleted: result };
    } else {
      throw new Meteor.Error('not-found', 'No API key found for this client');
    }
  },
  
  /**
   * List all API keys (without exposing the hashed keys)
   * @returns {Array} List of client IDs with metadata
   */
  'apiKeys.list': async function() {
    const keys = await ApiKeys.find({}, {
      fields: {
        clientId: 1,
        createdAt: 1,
        updatedAt: 1,
        lastUsed: 1,
        hashedApiKey: 0 // Exclude hashed key from response
      }
    }).fetchAsync();
    
    return keys;
  },
  
  /**
   * Check if a client has an API key configured
   * @param {String} clientId - Client identifier
   * @returns {Boolean} True if exists, false otherwise
   */
  'apiKeys.exists': async function(clientId) {
    check(clientId, String);
    
    const count = await ApiKeys.find({ clientId }).countAsync();
    return count > 0;
  }
});

// Publish API keys (without exposing hashed keys)
if (Meteor.isServer) {
  Meteor.publish('apiKeys.list', function() {
    // Only publish metadata, not the hashed keys
    return ApiKeys.find({}, {
      fields: {
        clientId: 1,
        createdAt: 1,
        updatedAt: 1,
        lastUsed: 1,
        hashedApiKey: 0
      }
    });
  });
}
