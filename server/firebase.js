import admin from 'firebase-admin';
import serviceAccount from '../miewebauthapp-97c46635fcd5.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export const sendNotification = async (token, title, body, data = {}) => {
  if (!token || !title || !body) {
    throw new Error('Missing required fields: token, title, or body');
  }

  const message = {
    token,
    android: {
      priority: 'high',
      notification: {
        channelId: 'push-channel',
        title,
        body,
        icon: 'notification_icon',
        color: '#0088ff',
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true
      }
    },
    data: {
      ...data,
      title,
      message: body,
      forceShow: 'true'
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Firebase send notification error:', error);
    throw error;
  }
};