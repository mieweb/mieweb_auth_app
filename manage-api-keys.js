#!/usr/bin/env node

/**
 * API Key Management CLI Tool
 * 
 * This script provides a command-line interface for managing API keys
 * for the send-notification endpoint authentication.
 * 
 * Usage:
 *   node manage-api-keys.js create <client_id> <api_key>
 *   node manage-api-keys.js verify <client_id> <api_key>
 *   node manage-api-keys.js delete <client_id>
 *   node manage-api-keys.js list
 * 
 * Note: This script requires the Meteor server to be running.
 */

const readline = require('readline');
const crypto = require('crypto');

// Generate a secure random API key
function generateApiKey(length = 32) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

// Print usage instructions
function printUsage() {
  console.log(`
API Key Management Tool
=======================

Usage:
  node manage-api-keys.js <command> [arguments]

Commands:
  create <client_id> [api_key]  Create or update an API key for a client
                                If api_key is not provided, one will be generated
  verify <client_id> <api_key>  Verify an API key for a client
  delete <client_id>            Delete an API key for a client
  list                          List all configured clients
  generate                      Generate a secure random API key

Examples:
  node manage-api-keys.js create ldap.example.com my-secure-api-key-123456
  node manage-api-keys.js create ldap.example.com  # Auto-generate key
  node manage-api-keys.js verify ldap.example.com my-secure-api-key-123456
  node manage-api-keys.js delete ldap.example.com
  node manage-api-keys.js list
  node manage-api-keys.js generate

Notes:
  - API keys must be at least 16 characters long
  - This script requires connection to a running Meteor server
  - Use the Meteor shell or DDP connection for production environments
  `);
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'create':
    const createClientId = args[1];
    let createApiKey = args[2];
    
    if (!createClientId) {
      console.error('Error: client_id is required');
      printUsage();
      process.exit(1);
    }
    
    if (!createApiKey) {
      createApiKey = generateApiKey();
      console.log(`Generated API key: ${createApiKey}`);
    }
    
    if (createApiKey.length < 16) {
      console.error('Error: API key must be at least 16 characters long');
      process.exit(1);
    }
    
    console.log(`
To create this API key, run the following command in the Meteor shell:

  Meteor.callAsync('apiKeys.upsert', '${createClientId}', '${createApiKey}')

Save this API key securely - you will need it to authenticate requests:
Client ID: ${createClientId}
API Key:   ${createApiKey}

IMPORTANT: Store this API key securely. It cannot be recovered if lost.
    `);
    break;
    
  case 'verify':
    const verifyClientId = args[1];
    const verifyApiKey = args[2];
    
    if (!verifyClientId || !verifyApiKey) {
      console.error('Error: client_id and api_key are required');
      printUsage();
      process.exit(1);
    }
    
    console.log(`
To verify this API key, run the following command in the Meteor shell:

  Meteor.callAsync('apiKeys.verify', '${verifyClientId}', '${verifyApiKey}')
  
This will return 'true' if the key is valid, 'false' otherwise.
    `);
    break;
    
  case 'delete':
    const deleteClientId = args[1];
    
    if (!deleteClientId) {
      console.error('Error: client_id is required');
      printUsage();
      process.exit(1);
    }
    
    console.log(`
To delete this API key, run the following command in the Meteor shell:

  Meteor.callAsync('apiKeys.delete', '${deleteClientId}')
    `);
    break;
    
  case 'list':
    console.log(`
To list all API keys, run the following command in the Meteor shell:

  Meteor.callAsync('apiKeys.list')
    `);
    break;
    
  case 'generate':
    const newKey = generateApiKey();
    console.log(`
Generated secure API key: ${newKey}

This key is ${newKey.length} characters long and cryptographically secure.
Save it securely - it cannot be recovered if lost.
    `);
    break;
    
  default:
    printUsage();
    process.exit(command ? 1 : 0);
}
