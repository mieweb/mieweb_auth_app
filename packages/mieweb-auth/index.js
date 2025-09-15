// Main package export - available on both client and server
import { 
  DeviceDetails, 
  NotificationHistory, 
  PendingResponses, 
  ApprovalTokens,
  generateAppId
} from './lib/collections.js';

import { MiewebAuthMethods } from './lib/methods.js';
import { isValidToken } from './lib/utils.js';

// Main package object
export const MiewebAuth = {
  // Collections available on both client and server
  collections: {
    DeviceDetails,
    NotificationHistory,
    PendingResponses,
    ApprovalTokens
  },
  
  // Method names for easy reference
  methods: MiewebAuthMethods,
  
  // Utility functions
  utils: {
    isValidToken,
    generateAppId
  },
  
  // Version info
  version: '1.0.0'
};

// Export collections individually for direct access
export {
  DeviceDetails,
  NotificationHistory,
  PendingResponses,
  ApprovalTokens
};

// Export utilities
export {
  isValidToken,
  generateAppId,
  MiewebAuthMethods
};
