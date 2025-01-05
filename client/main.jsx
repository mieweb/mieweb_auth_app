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
  console.log(Session.get('capturedDeviceInfo'));

  root.render(<App />);
});