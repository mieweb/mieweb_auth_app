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

  if (Meteor.isCordova) {
    document.addEventListener('deviceready', () => {
      console.log("Cordova device is ready");

      const push = PushNotification.init({
        android: {
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
        // Store FCM token in session for later use during registration
        Session.set('deviceToken', data.registrationId);
      });

      // Handle notification reception
      push.on('notification', (data) => {
        if (data.additionalData.actionButtons) {
          const { actionType } = data.additionalData;
          if (actionType === 'approve' || actionType === 'reject') {
            Meteor.call('handleNotificationAction', {
              action: actionType,
              userId: Session.get('userProfile').id,
              timestamp: new Date()
            });
          }
        }
    
        if (!data.additionalData.foreground) {
          navigator.notification.alert(
            'Please login to continue',
            () => window.location.href = '/login',
            'Action Required'
          );
        }
      });

      push.on('error', (error) => {
        console.error("Push notification error:", error);
      });

    }, false);
  }
  root.render(<App />);
});