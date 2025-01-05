import admin from './server/firebase.js'; // Import the initialized Firebase Admin instance

(async () => {
  const registrationToken = 'c2PasM1eTNORleHw3cNdv9:APA91bGVXQ2oHZ3WNseXIcYHRd_Yk104XK28KRj0vEiQRRMNXbJSQBRNTpIg0G9UYOr48IiZOiY-yaAc8cSTkNkZUUkMM3IWL0pF-nvCq-PJ5G--ow10wz0'; // Replace with your actual token

  const message = {
    token: registrationToken, // The target device's token
    notification: {
      title: 'Test Notification',
      body: 'This is a test message sent directly via Firebase Admin SDK.',
    },
    data: {
      actions: JSON.stringify([
        {
          icon: 'approve',
          title: 'Approve',
          callback: 'approve',
          foreground: true,
        },
        {
          icon: 'reject',
          title: 'Reject',
          callback: 'reject',
          foreground: false,
        },
      ]),
    },
  };

  try {
    // Send the message using the Firebase Admin SDK
    const response = await admin.messaging().send(message);
    console.log('Push notification sent successfully:', response);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
})();
