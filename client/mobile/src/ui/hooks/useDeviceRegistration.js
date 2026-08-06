import { useState, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { Tracker } from "meteor/tracker";

export const useDeviceRegistration = () => {
  const [capturedDeviceUuid, setCapturedDeviceUuid] = useState(null);
  const [boolRegisteredDevice, setBoolRegisteredDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let lastCheckedUuid = null;

    // Uses the devices.checkRegistrationByUUID method instead of subscribing
    // to a publication: a second subscription over DeviceDetails published a
    // conflicting projection of the `devices` field and clobbered the full
    // device list in Minimongo (DDP merges top-level fields only).
    const sessionTracker = Tracker.autorun(() => {
      const deviceInfo = Session.get("capturedDeviceInfo");

      if (!deviceInfo || !deviceInfo.uuid) {
        setCapturedDeviceUuid(null);
        setBoolRegisteredDevice(false);
        setIsLoading(false);
        return;
      }
      setCapturedDeviceUuid(deviceInfo.uuid);

      if (deviceInfo.uuid === lastCheckedUuid) return;
      lastCheckedUuid = deviceInfo.uuid;

      Meteor.call(
        "devices.checkRegistrationByUUID",
        deviceInfo.uuid,
        (error, result) => {
          setBoolRegisteredDevice(!error && !!result?.registered);
          setIsLoading(false);
        },
      );
    });

    return () => {
      sessionTracker.stop();
    };
  }, []);

  return { capturedDeviceUuid, boolRegisteredDevice, isLoading };
};
