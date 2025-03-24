import admin from 'firebase-admin';
import serviceAccount from '../server/private/miewebauthapp-ffab4fc33682.json';


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
/**
 * Sends a push notification to a specific device.
 * @param {string} registrationToken - The target device token.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @param {Array} actions - The actions to include in the notification.
 * @param {boolean} isDismissal - Whether this is a dismissal notification.
 * @param {Object} syncData - Optional data for syncing across devices.
 */
export const sendNotification = async (fcmToken, title, body, data = {}) => {
  try {
    console.log("Sending notification to token:", fcmToken);
    console.log("Notification data:", { title, body, data });

    // Convert all data values to strings
    const stringifiedData = {};
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'object') {
        stringifiedData[key] = JSON.stringify(value);
      } else {
        stringifiedData[key] = String(value);
      }
    });

    // Create base message object
    const message = {
      token: fcmToken,
      notification: {
        title,
        body
      },
      data: {
        ...stringifiedData,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "high_importance_channel"
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: body
            },
            sound: "default",
            badge: 1,
            'mutable-content': 1,
            'content-available': 1
          },
          // Add custom data for iOS
          notificationType: data.notificationType || 'approval',
          actions: data.actions || '[]',
          appId: data.appId || '',
          messageFrom: data.messageFrom || 'mie'
        },
        headers: {
          'apns-priority': '10'
        }
      }
    };

    // For dismissal/sync notifications, modify the payload
    if (data.isDismissal === 'true' || data.isSync === 'true') {
      message.android.notification.sound = null;
      message.apns.payload.aps.sound = null;
      message.apns.payload.aps['content-available'] = 1;
      message.apns.headers['apns-priority'] = '5';
    }

    console.log("Final message payload:", JSON.stringify(message, null, 2));

    const response = await admin.messaging().send(message);
    console.log("Successfully sent push notification:", response);
    return response;
  } catch (error) {
    console.error("Error sending push notification:", error);
    // Log more details about the error
    if (error.code === 'messaging/invalid-registration-token') {
      console.error("Invalid registration token - device may need to re-register");
    } else if (error.code === 'messaging/registration-token-not-registered') {
      console.error("Token not registered - device may need to re-register");
    }
    throw error;
  }
};
export default admin;