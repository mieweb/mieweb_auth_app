import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import './main.css';
import '../imports/api/deviceLogs';
import { App } from '../imports/ui/App';
import { Session } from 'meteor/session';
import { notificationData } from '../imports/api/state';

const sendUserAction = (appId, action) => {
  console.log(`Sending user action: ${action} for appId: ${appId}`);

  Meteor.call('notifications.handleResponse', appId, action, (error, result) => {
    if (error) {
      console.error('Error sending notification response:', error);
    } else {
      console.log('Server processed action:', result);
    }
  });
}

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


  if (Meteor.isCordova) {
    document.addEventListener('deviceready', () => {
      console.log("Cordova device is ready");

      // Create notification channel
      PushNotification.createChannel(
        () => {
          console.log('Channel created successfully');
        },
        () => {
          console.error('Channel creation failed');
        },
        {
          id: 'default',
          description: 'Default channel',
          importance: 4,
          vibration: true,
          sound: 'default'
        }
      );

      const push = PushNotification.init({
        android: {
          forceShow: true,
          click_action: "NOTIFICATION_CLICK",
          notification: {
            click_action: "NOTIFICATION_CLICK",
          },
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

      try {
        // Handle registration
        push.on('registration', (data) => {
          console.log("Registration handler attached");
          console.log('Registration data:', data);
          Session.set('deviceToken', data.registrationId);
        });

        // push.on('notification', (notification) => {
        //   console.log('Notification received:', JSON.stringify(notification, null, 2));

        //   if (notification.additionalData) {
        //     const { appId } = notification.additionalData;
        //     console.log("Processing notification for appId:", appId);
        //     Session.set('notificationReceivedId', {appId})
         
        //   }

        //   // if (window.location.pathname !== '/dashboard') {
        //     window.location.href = '/dashboard';
        //   // }
        // });

        push.on('notification', (notification) => {
          // console.log('Notification received:', notification);
          console.log('Notification received:', JSON.stringify(notification, null, 2));
          // console.log(notification.additionalData)
        
          if (notification.additionalData && notification.additionalData.foreground) {
            // Handle foreground notification
            console.log('Notification received in foreground:', notification);
        
            // Update app state without reloading
            const { appId } = notification.additionalData;
            if (appId) {
              // Update ReactiveVar, Session, or Context
              notificationData.set({ appId, data: notification });
            }
          } else if (notification.additionalData && notification.additionalData.coldstart) {
            // App launched by clicking on a notification
            console.log('Notification received on cold start:', notification);
        
            // Navigate to a specific route if needed (React Router example)
            window.location.href = '/dashboard';
          }
        });
        

        push.on('reject', (notification) => {
          console.log('Notification received:', JSON.stringify(notification, null, 2));

          if (notification.additionalData) {
            const { appId } = notification.additionalData;

            sendUserAction(appId, 'reject');
          }
        });

        push.on('approve', (notification) => {
          console.log('Notification received:', JSON.stringify(notification, null, 2));
          if (notification.additionalData) {
            const { appId } = notification.additionalData;

            sendUserAction(appId, 'approve');
          }
        });

        // Handle errors
        push.on('error', (error) => {
          console.log("Error handler attached");
          console.error('Push notification error:', error);
        });

        console.log("All handlers attached successfully");

      } catch (error) {
        console.error("Error attaching push notification handlers:", error);

      }

    }, false);
  }
  root.render(<App />);
});