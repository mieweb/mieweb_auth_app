import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import './main.css';
import '../imports/api/deviceLogs';
import { App } from '../imports/ui/App';
import { Session } from 'meteor/session';




Meteor.startup(() => {
  const container = document.getElementById('react-target');
  const root = createRoot(container);

  if (Meteor.isCordova) {
    if (device.cordova) {
      Session.set('capturedDeviceInfo', {
        model: device.model,
        platform: device.platform,
        uuid: device.uuid,
        version: device.version,
        manufacturer: device.manufacturer,
      });
    }
  }
  console.log(Session.get('capturedDeviceInfo'));

  if (Meteor.isCordova) {
    document.addEventListener('deviceready', () => {
      console.log("Cordova device is ready");

      const push = PushNotification.init({
        android: {
          // These settings ensure proper foreground notification handling
          forceShow: true,
          priority: "high",
          sound: true,
          vibrate: true,
          channel: {
            id: "default",
            importance: "high",
            sound: "default",
            vibration: true
          }
        },
        ios: {
          alert: true,
          badge: true,
          sound: true,
          priority: "high",
          foreground: true
        }
      });

      // Handle registration
      push.on('registration', (data) => {
        console.log("Registration ID (token):", data.registrationId);
        Meteor.call('saveFCMToken', data.registrationId, (error) => {
          if (error) {
            console.error("Error saving token:", error);
          }
        });
      });

      // Handle notification reception
      push.on('notification', (data) => {
        try {
          console.log("Received notification:", data);

          // Handle foreground notifications
          if (data.additionalData.foreground) {
            // Show notification even when app is in foreground
            push.createChannel(
              {
                id: "default",
                description: "Default channel for notifications",
                importance: 4,
                vibration: true
              },
              () => {
                console.log('Channel created successfully');
              },
              (error) => {
                console.error('Channel creation failed:', error);
              }
            );

            // You can also show an in-app alert or custom UI
            if (data.message) {
              // Optional: Show in-app alert
              navigator.notification.alert(
                data.message,
                null,
                data.title || 'Notification',
                'OK'
              );
            }
          }

          // Handle background notifications
          if (data.additionalData.coldstart || !data.additionalData.foreground) {
            console.log("Notification received in background");
            // Handle any background-specific logic here
            if (data.additionalData.url) {
              window.location.href = data.additionalData.url;
            }
          }
        } catch (error) {
          console.error("Error handling notification:", error);
        }
      });

      // Handle errors
      push.on('error', (error) => {
        console.error("Push notification error:", error);
      });

    }, false);
  }
  root.render(<App />);
});