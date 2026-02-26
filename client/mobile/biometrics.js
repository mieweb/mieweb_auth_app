import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";

export const initializeBiometrics = () => {
  Fingerprint.isAvailable(
    function (result) {
      Session.set("Biometrics", true);
    },
    function (error) {
      Session.set("Biometrics", false);
    },
  );
};
