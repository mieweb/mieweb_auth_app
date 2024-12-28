import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { LinksCollection } from '/imports/api/links';
import { sendNotification } from './firebase';

// Global error handlers
process.on('uncaughtException', error => console.error('Uncaught Exception:', error));
process.on('unhandledRejection', error => console.error('Unhandled Rejection:', error));

// Notification endpoint
WebApp.connectHandlers.use('/send-notification', async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
  }

  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error('Invalid JSON payload'));
        }
      });
    });

    const response = await sendNotification(
      body.token,
      body.title,
      body.body,
      body.data || {}
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, messageId: response }));

  } catch (error) {
    console.error('Notification error:', error);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});

// Meteor methods
Meteor.methods({
  'saveFCMToken': token => console.log('Received FCM token:', token),
  'updateFCMToken': token => console.log('Updated FCM token:', token)
});

// Meteor startup
if (Meteor.isCordova) {
  Meteor.startup(async () => {
    // Initialize Links collection if empty
    if (await LinksCollection.find().countAsync() === 0) {
      const defaultLinks = [
        { title: 'Do the Tutorial', url: 'https://www.meteor.com/tutorials/react/creating-an-app' },
        { title: 'Follow the Guide', url: 'https://guide.meteor.com' },
        { title: 'Read the Docs', url: 'https://docs.meteor.com' },
        { title: 'Discussions', url: 'https://forums.meteor.com' }
      ];
      
      for (const link of defaultLinks) {
        await LinksCollection.insertAsync({ ...link, createdAt: new Date() });
      }
    }

    // Publish Links collection
    Meteor.publish('links', () => LinksCollection.find());
  });
}