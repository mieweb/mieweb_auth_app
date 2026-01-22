import { Meteor } from 'meteor/meteor';
import { Email } from 'meteor/email';
import { WebApp } from 'meteor/webapp';

// Import all server functionality
import './main.js'; // Main server methods and startup code
import './firebase.js'; // Firebase integration
import './publications.js'; // Meteor publications
import { sendNotification, sendDeviceApprovalNotification } from './firebase.js';

// Import collections and methods
import { 
  DeviceDetails, 
  NotificationHistory, 
  PendingResponses, 
  ApprovalTokens 
} from '../lib/collections.js';
import { MiewebAuthMethods } from '../lib/methods.js';
import { isValidToken } from '../lib/utils.js';

// Main server export object
export const MiewebAuthServer = {
  // Collections
  collections: {
    DeviceDetails,
    NotificationHistory,
    PendingResponses,
    ApprovalTokens
  },
  
  // Methods
  methods: MiewebAuthMethods,
  
  // Firebase functions
  notifications: {
    sendNotification,
    sendDeviceApprovalNotification
  },
  
  // Utilities
  utils: {
    isValidToken
  },
  
  // Configuration function for the consuming app
  configure: (options = {}) => {
    const {
      firebaseServiceAccount,
      emailSettings,
      customSettings = {}
    } = options;
    
    if (firebaseServiceAccount) {
      // Firebase configuration would be handled here
      console.log('MiewebAuth: Firebase service account configured');
    }
    
    if (emailSettings) {
      // Email configuration
      process.env.MAIL_URL = emailSettings.mailUrl || process.env.MAIL_URL;
      console.log('MiewebAuth: Email settings configured');
    }
    
    // Store custom settings for use by the package
    Meteor.settings.miewebAuth = {
      ...Meteor.settings.miewebAuth,
      ...customSettings
    };
    
    console.log('MiewebAuth server package configured successfully');
  }
};

// Export individual components for direct access
export {
  DeviceDetails,
  NotificationHistory,
  PendingResponses,
  ApprovalTokens,
  sendNotification,
  sendDeviceApprovalNotification,
  isValidToken
};
