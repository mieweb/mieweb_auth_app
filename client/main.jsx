import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import './main.css';
import '../imports/api/deviceLogs';
import { App } from '../imports/ui/App';
import { Session } from 'meteor/session';

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
          clearNotifications: false,
          icon: "ic_launcher",
          iconColor: "#4CAF50",
          background: true,
          // click_action: "NOTIFICATION_CLICK",
          // notification: {
          //   click_action: "NOTIFICATION_CLICK",
          // },
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

        push.on('notification', (notification) => {
          console.log('Notification received:', JSON.stringify(notification, null, 2));

          if (notification.additionalData) {
            const { appId } = notification.additionalData;
            Session.set('notificationReceivedId', appId)
          }
        });

        push.on('reject', (notification) => {
          if (notification.additionalData) {
            const { appId } = notification.additionalData;
            if(Session.get("userProfile")){
              sendUserAction(appId, 'reject');    
            } else {
              Session.set('notificationReceivedId', appId)
            }
          }
        });

        push.on('approve', (notification) => {
          if (notification.additionalData) {
            const { appId } = notification.additionalData;
            if(Session.get("userProfile")){
              sendUserAction(appId, 'approve');    
            } else {
              Session.set('notificationReceivedId', appId)
            }
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