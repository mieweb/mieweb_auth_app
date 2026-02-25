import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";

export const captureDeviceInfo = () => {
  if (Meteor.isCordova) {
    Session.set("capturedDeviceInfo", {
      model: device.model,
      platform: device.platform,
      uuid: device.uuid,
      version: device.version,
      manufacturer: device.manufacturer,
    });
  }
};
