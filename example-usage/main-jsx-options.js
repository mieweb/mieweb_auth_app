// Updated client/main.jsx to demonstrate both original and package usage
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import './main.css';

// You can choose to use either:
// 1. The original implementation (keeping all the existing code)
// 2. The packaged version (using the mieweb:auth package)

// Option 1: Original implementation (ORIGINAL CODE - KEEP AS IS)
import { App } from './mobile/src/ui/App';
import { captureDeviceInfo } from './mobile/capture-device-info';
import { initializeBiometrics } from './mobile/biometrics';
import { initializePushNotifications } from './mobile/push-notifications';

// Option 2: Package implementation (UNCOMMENT TO USE PACKAGE)
// import { initializeMiewebAuth } from 'meteor/mieweb:auth';

Meteor.startup(() => {
  const container = document.getElementById('react-target');
  const root = createRoot(container);

  // CURRENT: Using original implementation
  if (Meteor.isCordova) {
    document.addEventListener('deviceready', () => {
      console.log(" ### Log Step 1: inside main.jsx and about to call configuration methods");
      captureDeviceInfo();
      initializeBiometrics();
      initializePushNotifications();
    }, false);
  }
  else {
    console.log("user is not on Cordova, skipping device capture and push notifications initialization");
  }

  root.render(<App />);

  // ALTERNATIVE: Using package implementation (uncomment to switch)
  // initializeMiewebAuth('react-target');
});
