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
 */
export const sendNotification = async (registrationToken, title, body, actions) => {
  const message = {
    token: registrationToken,
    data: {
      title,
      body,
      appId: registrationToken,
      actions: JSON.stringify(actions),
      messageFrom: 'mie',
      notificationType: 'approval',
      content_available: '1',
      notId: '10',
      // surveyID: "ewtawgreg-gragrag-rgarhthgbad"
    },
    android: {
      priority: 'high',
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
          content_available: 1,
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