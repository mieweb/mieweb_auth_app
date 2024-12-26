import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import { App } from '/imports/ui/App';

Meteor.startup(() => {
  const container = document.getElementById('react-target');
  const root = createRoot(container);

  if (Meteor.isCordova) {
    // Wait for Cordova to load
    document.addEventListener('deviceready', () => {
      console.log("Cordova device is ready");

      // Firebase Plugin is loaded
      if (window.FirebasePlugin) {
        console.log("Firebase Plugin is available");

        // Get the FCM token
        window.FirebasePlugin.getToken((token) => {
          console.log("FCM Token:", token);
          Meteor.call('saveFCMToken', token); // Save the token to the backend if needed
        }, (error) => {
          console.error("Error getting FCM token:", error);
        });

        // Handle token refresh
        window.FirebasePlugin.onTokenRefresh((token) => {
          console.log("FCM Token refreshed:", token);
          Meteor.call('updateFCMToken', token); // Update the token in the backend
        });

        // Handle incoming notifications
        window.FirebasePlugin.onMessageReceived((message) => {
          console.log("Notification received:", message);

          if (message.tap) {
            // Notification tapped by the user (background)
            console.log(`Notification tapped in ${message.tap}`);
            // Handle navigation or other actions based on notification data
            if (message.data && message.data.url) {
              window.location.href = message.data.url; // Example: Open a specific page
            }
          } else {
            // Notification received while the app is in foreground
            console.log("Notification received in foreground");

            // Example: Show an alert
            alert(`New notification: ${message.body || message.message}`);
          }
        }, (error) => {
          console.error("Error receiving notification:", error);
        });

        // Request notification permissions (for iOS)
        if (Meteor.isCordova && Meteor.isIOS) {
          window.FirebasePlugin.grantPermission();
        }

        // Enable analytics collection
        window.FirebasePlugin.setAnalyticsCollectionEnabled(true);

      } else {
        console.error("Firebase Plugin is not available");
      }
    }, false);
  }

  // Render the main React application
  root.render(<App />);
});
