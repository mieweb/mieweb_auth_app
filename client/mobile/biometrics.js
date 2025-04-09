import { Meteor } from "meteor/meteor";
import { Session } from 'meteor/session';

export const initializeBiometrics = () => {
  console.log("******************* Biometric Info *******************");
  Fingerprint.isAvailable(
    function(result) {
      console.log("Biometric available:", result);
      Session.set('Biometrics', true);
    },
    function(error) {
      Session.set('Biometrics', false);
      console.error("Biometric not available:", error);
    }
  );
}; 