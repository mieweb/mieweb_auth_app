import { Meteor } from "meteor/meteor";
import { Session } from 'meteor/session';

export const captureDeviceInfo = () => {
  if (Meteor.isCordova) {
    console.log("******************* Capture Device Info *******************");
    Session.set('capturedDeviceInfo', {
      model: device.model,
      platform: device.platform,
      uuid: device.uuid,
      version: device.version,
      manufacturer: device.manufacturer,
    });
  }
};

