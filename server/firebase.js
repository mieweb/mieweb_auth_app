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
      title: title,
      body: body,
    },
    data: {
      actions: JSON.stringify(actions), // Ensure `actions` is passed as a string
    },
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
