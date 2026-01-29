import { Meteor } from "meteor/meteor";
import { Session } from 'meteor/session';

/**
 * For cold start scenarios (app closed, notification tapped):
 * - Store notification data in localStorage
 * - Navigate to /approval page instead of validating session
 * - Approval page will handle biometric auth and response
 * 
 * This allows quick response without full app login, reducing timeouts
 */
const handleColdStartNotification = (notification) => {
  const additionalData = notification.additionalData || {};
  
  if (!additionalData.appId) {
    console.warn('Cold start notification missing appId');
    return;
  }

  // Store notification for approval page
  const notificationData = {
    appId: additionalData.appId,
    status: 'pending',
    coldstart: true,
    timestamp: new Date().getTime()
  };

  localStorage.setItem('pendingNotification', JSON.stringify(notificationData));
  Session.set('notificationReceivedId', notificationData);
  
  // Navigate to approval page after brief delay to ensure app is ready
  setTimeout(() => {
    window.location.href = '/approval';
  }, 1000);
};

// Session validation with retry logic (used for non-cold-start scenarios)
const validateSessionWithRetry = (callback, retries = 3, interval = 1000) => {
  let attempts = 0;
  const checkSession = () => {
    if (Session.get("userProfile")) {
      callback();
    } else if (attempts < retries) {
      attempts++;
      setTimeout(checkSession, interval);
    } else {
      console.warn("Session validation failed after retries");
    }
  };
  checkSession();
};

const sendUserAction = (appId, action) => {
  console.log(`Initiating ${action} action for: ${appId}`);
  
  validateSessionWithRetry(() => {
    Meteor.call('notifications.handleResponse', appId, action, (error, result) => {
      if (error) {
        console.error('Action failed:', error);
        Session.set('notificationReceivedId', { 
          appId, 
          status: "error",
          error: error.message
        });
      } else {
        console.log('Action processed successfully');
        Session.set('notificationReceivedId', {
          appId,
          status: action === 'approve' ? "approved" : "rejected",
          timestamp: new Date().getTime()
        });
      }
    });
  });
};

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
      actions: [
        { id: 'approve', title: 'Approve' },
        { id: 'reject', title: 'Reject' }
      ],
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
    console.log('Raw notification:', JSON.stringify(notification));
    
    const additionalData = notification.additionalData || {};
    
    // Cold start handling - redirect to approval page immediately
    if (additionalData.coldstart) {
      console.log('Cold start detected - redirecting to approval page');
      handleColdStartNotification(notification);
      return;
    }

    // Standard notification handling (app in foreground/background)
    Meteor.startup(() => {
      if (additionalData.appId) {
        Session.set('notificationReceivedId', {
          appId: additionalData.appId,
          status: "pending",
          rawData: JSON.stringify(additionalData),
          timestamp: new Date().getTime()
        });
      }
    });
  });
};

const setupApproveHandler = (push) => {
  push.on('approve', (notification) => {
    console.log('Approve action triggered');
    
    Meteor.startup(() => {
      const additionalData = notification.additionalData || {};
      const appId = additionalData.appId;

      if (appId) {
        validateSessionWithRetry(() => {
          console.log('Processing approve action');
          sendUserAction(appId, 'approve');
          Session.set('notificationReceivedId', {
            appId,
            status: "approved",
            timestamp: new Date().getTime()
          });
        });
      }
    });
  });
};

const setupRejectHandler = (push) => {
  push.on('reject', (notification) => {
    console.log('Reject action triggered');
    
    Meteor.startup(() => {
      const additionalData = notification.additionalData || {};
      const appId = additionalData.appId;

      if (appId) {
        validateSessionWithRetry(() => {
          console.log('Processing reject action');
          sendUserAction(appId, 'reject');
          Session.set('notificationReceivedId', {
            appId,
            status: "rejected",
            timestamp: new Date().getTime()
          });
        });
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
    setupApproveHandler(push);
    setupRejectHandler(push);
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