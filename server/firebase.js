import admin from 'firebase-admin';
import serviceAccount from './private/miewebauthapp-8ca9b0d375f0.json';


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
/**
 * Sends a push notification to a specific device.
 * @param {string} registrationToken - The target device token.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @param {Array} actions - The actions to include in the notification.
 */
export const sendNotification = async (registrationToken, title, body, actions) => {
  const message = {
    token: registrationToken,
    notification: {
      title,
      body,
    },
    data: {
      appId: registrationToken,
      title,
      body,
      actions: JSON.stringify(actions),
      messageFrom: 'mie',
      notificationType: 'approval',
      foreground: 'true',
      coldstart: 'true',
      content_available: '1',
      notId: '10',
      surveyID: "ewtawgreg-gragrag-rgarhthgbad"
    },
    android: {
      priority: 'high',
      notification: {
        click_action: 'NOTIFICATION_CLICK',
        icon: "ic_launcher",
        color: "#4CAF50",
        channel_id: "default",
        sound: "default",
        priority: "high",
        visibility: "public",
        notification_priority: "PRIORITY_MAX"
      }
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title,
            body
          },
          badge: 1,
          sound: "default",
          category: "APPROVAL",
          content_available: true,
          mutable_content: true
        }
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Push notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};
export default admin;