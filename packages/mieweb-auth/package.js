Package.describe({
  name: 'mieweb:auth',
  version: '1.0.0',
  summary: 'Mieweb Authentication App - Mobile push notification and biometric authentication system',
  git: 'https://github.com/mieweb/mieweb_auth_app',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('2.8.0');
  
  // Core Meteor packages
  api.use([
    'ecmascript',
    'meteor-base',
    'mongo',
    'accounts-base',
    'accounts-password', 
    'check',
    'random',
    'session',
    'sha',
    'email',
    'http',
    'webapp',
    'static-html',
    'react-meteor-data'
  ]);

  // NPM dependencies that need to be available
  api.use([
    'typescript@5.4.3'
  ]);

  // Main package exports (both client and server)
  api.addFiles([
    'index.js'
  ], ['client', 'server']);

  // Shared library files (both client and server)
  api.addFiles([
    'lib/collections.js',
    'lib/methods.js',
    'lib/constants.js',
    'lib/utils.js'
  ], ['client', 'server']);

  // Server-only files
  api.addFiles([
    'server/index.js',
    'server/firebase.js',
    'server/main.js',
    'server/templates/email.js',
    'server/publications.js'
  ], 'server');

  // Client-only files
  api.addFiles([
    'client/main.js',
    'client/styles.css',
    'client/mobile/biometrics.js',
    'client/mobile/capture-device-info.js', 
    'client/mobile/push-notifications.js'
  ], 'client');

  // React components (client-only)
  api.addFiles([
    'client/components/App.jsx',
    'client/components/AppRoutes.jsx',
    'client/components/LandingPage.jsx',
    'client/components/Login.jsx',
    'client/components/Registration.jsx',
    'client/components/Welcome.jsx',
    'client/components/PendingRegistrationPage.jsx',
    'client/components/DashboardHeader.jsx',
    'client/components/DeviceSection.jsx',
    'client/components/NotificationFilters.jsx',
    'client/components/NotificationList.jsx',
    'client/components/ProfileSection.jsx',
    'client/components/ActionsModal.jsx',
    'client/components/BiometricRegistrationModal.jsx',
    'client/components/ResultModal.jsx',
    'client/components/Pagination.jsx',
    'client/components/SuccessToaster.jsx'
  ], 'client');

  // React hooks (client-only)
  api.addFiles([
    'client/hooks/useDarkMode.js',
    'client/hooks/useDeviceRegistration.js',
    'client/hooks/useNotificationData.js',
    'client/hooks/useNotificationHandler.js',
    'client/hooks/useUserProfile.js'
  ], 'client');

  // Export main APIs and collections
  api.export([
    'DeviceDetails',
    'NotificationHistory', 
    'PendingResponses',
    'ApprovalTokens',
    'MiewebAuth'
  ]);

  // Export React components for customization
  api.export([
    'MiewebAuthApp',
    'LoginComponent',
    'RegistrationComponent',
    'WelcomeComponent',
    'LandingPageComponent'
  ], 'client');

  // Export server utilities
  api.export([
    'sendNotification',
    'sendDeviceApprovalNotification', 
    'MiewebAuthServer'
  ], 'server');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('mieweb:auth');
  api.addFiles('tests/package-tests.js');
});

Npm.depends({
  'firebase-admin': '13.0.2',
  'dotenv': '16.5.0',
  'axios': '1.7.9',
  'react': '18.2.0',
  'react-dom': '18.2.0',
  'react-router': '6.22.0',
  'react-router-dom': '6.28.1',
  'react-icons': '5.4.0',
  'react-toastify': '11.0.2',
  'framer-motion': '11.18.2',
  'lucide-react': '0.469.0'
});
