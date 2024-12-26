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

      // Initialize PushNotification plugin
      const push = PushNotification.init({
        android: {
          sound: true,
          vibrate: true,
          clearNotifications: true,
          forceShow: true, // Ensures notification is shown even when app is in foreground
          icon: "notification_icon", // Your notification icon name
        },
        ios: {
          alert: true,
          badge: true,
          sound: true,
        }
      });

      // Get the FCM token (equivalent to your previous getToken)
      push.on('registration', (data) => {
        console.log("FCM Token:", data.registrationId);
        Meteor.call('saveFCMToken', data.registrationId); // Save the token to the backend
      });

      // Handle token refresh (this is handled automatically by the plugin)
      // The 'registration' event will fire again with the new token

      // Handle incoming notifications
      push.on('notification', (data) => {
        console.log("Notification received:", data);

        // Check if notification was tapped (background)
        if (data.additionalData.coldstart || data.additionalData.foreground === false) {
          console.log("Notification tapped in background");
          
          // Handle navigation or other actions based on notification data
          if (data.additionalData.url) {
            window.location.href = data.additionalData.url;
          }
        } else {
          // Notification received in foreground
          console.log("Notification received in foreground");

          // Show an alert for foreground notifications
          alert(`New notification: ${data.message || data.body}`);
        }
      });

      // Handle any errors
      push.on('error', (error) => {
        console.error("Push notification error:", error);
      });

      // For iOS, permission is handled automatically by the plugin
      // The registration event won't fire until permission is granted

    }, false);
  }

  // Render the main React application
  root.render(<App />);
});