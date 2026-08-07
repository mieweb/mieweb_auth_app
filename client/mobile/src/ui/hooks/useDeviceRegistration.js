import { useState, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { Tracker } from "meteor/tracker";

export const useDeviceRegistration = () => {
  const [capturedDeviceUuid, setCapturedDeviceUuid] = useState(null);
  const [boolRegisteredDevice, setBoolRegisteredDevice] = useState(null);
  const [registrationError, setRegistrationError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Web browsers have no Cordova device UUID — device registration only
    // applies to the mobile app. Without this guard the hook waits forever
    // for device info that never arrives and the web landing page is
    // replaced by the Connection Issues screen after the loading timeout.
    if (!Meteor.isCordova) {
      setCapturedDeviceUuid(null);
      setBoolRegisteredDevice(false);
      setRegistrationError(null);
      setIsLoading(false);
      return undefined;
    }

    let lastCheckedUuid = null;

    // Uses the devices.checkRegistrationByUUID method instead of subscribing
    // to a publication: a second subscription over DeviceDetails published a
    // conflicting projection of the `devices` field and clobbered the full
    // device list in Minimongo (DDP merges top-level fields only).
    const sessionTracker = Tracker.autorun(() => {
      const deviceInfo = Session.get("capturedDeviceInfo");

      if (!deviceInfo || !deviceInfo.uuid) {
        setCapturedDeviceUuid(null);
        setBoolRegisteredDevice(null);
        setIsLoading(true);
        return;
      }
      setCapturedDeviceUuid(deviceInfo.uuid);

      if (deviceInfo.uuid === lastCheckedUuid) return;
      lastCheckedUuid = deviceInfo.uuid;
      setRegistrationError(null);
      setIsLoading(true);

      Meteor.call(
        "devices.checkRegistrationByUUID",
        deviceInfo.uuid,
        (error, result) => {
          if (error || typeof result?.registered !== "boolean") {
            console.error("Unable to check device registration:", error);
            setRegistrationError(
              error || new Error("Invalid device registration response"),
            );
            setIsLoading(false);
            return;
          }

          setRegistrationError(null);
          setBoolRegisteredDevice(result.registered);
          setIsLoading(false);
        },
      );
    });

    return () => {
      sessionTracker.stop();
    };
  }, []);

  return {
    capturedDeviceUuid,
    boolRegisteredDevice,
    registrationError,
    isLoading,
  };
};
