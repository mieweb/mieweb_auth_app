import { Meteor } from "meteor/meteor";
import { Session } from 'meteor/session';

const createNotificationChannel = () => {
  PushNotification.createChannel(
    () => console.log('Android notification channel ready'),
    (error) => console.error('Channel error:', error),
    {
      id: 'default',
      name: 'Approval Channel',
      description: 'Critical security approvals',
      importance: 4,
      vibration: true,
      sound: 'default',
      visibility: 1,
      lights: true,
      lightColor: '#FF4081'
    }
  );
};

const configurePushNotifications = () => {
  return PushNotification.init({
    android: {
      forceShow: true,
      clearNotifications: false,
      icon: "ic_launcher",
      iconColor: "#4CAF50",
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
};

const setupRegistrationHandler = (push) => {
  push.on('registration', (data) => {
    console.log('Device token registered:', data.registrationId);
    Session.set('deviceToken', data.registrationId);
    Meteor.call('deviceDetails.storeFCMToken', data.registrationId);
  });
};

const setupNotificationHandler = (push) => {
  push.on('notification', (notification) => {
    console.log('Notification tapped');
    
    Meteor.startup(() => {
      const additionalData = notification.additionalData || {};
      
      if (additionalData.appId && additionalData.notificationId) {
        // Persist to localStorage for post-login modal display
        if (!Session.get("userProfile")) {
          localStorage.setItem('pendingNotification', JSON.stringify({
            appId: additionalData.appId,
            notificationId: additionalData.notificationId,
            timestamp: new Date().getTime()
          }));
          console.log('Notification saved for post-login modal');
        } else {
          // User is logged in - set session to show modal immediately
          Session.set('notificationReceivedId', {
            appId: additionalData.appId,
            notificationId: additionalData.notificationId,
            status: "pending",
            timestamp: new Date().getTime()
          });
        }
      }
    });
  });
};

const setupErrorHandler = (push) => {
  push.on('error', (error) => {
    console.error('Push system error:', error);
    Session.set('pushError', {
      message: error.message,
      code: error.code,
      details: JSON.stringify(error)
    });
  });
};

export const initializePushNotifications = () => {
  try {
    console.log('Initializing push notification system');
    
    // Android channel setup
    createNotificationChannel();

    // Initialize push service
    const push = configurePushNotifications();

    // Register handlers
    setupRegistrationHandler(push);
    setupNotificationHandler(push);
    setupErrorHandler(push);

    // Ensure default channel exists every 30 seconds
    setInterval(() => {
        console.warn('Re-creating default notification channel to ensure it exists');
        createNotificationChannel();
    }, 30000);

    console.log('Push notification system ready');
  } catch (error) {
    console.error('Critical push initialization error:', error);
    Session.set('pushInitError', error.toString());
  }
};