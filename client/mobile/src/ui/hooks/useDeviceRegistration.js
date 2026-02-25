import { useState, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { Tracker } from "meteor/tracker";
import { DeviceDetails } from "../../../../../utils/api/deviceDetails";

export const useDeviceRegistration = () => {
  const [capturedDeviceUuid, setCapturedDeviceUuid] = useState(null);
  const [boolRegisteredDevice, setBoolRegisteredDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionTracker = Tracker.autorun(() => {
      const deviceInfo = Session.get("capturedDeviceInfo");

      if (!deviceInfo || !deviceInfo.uuid) {
        setCapturedDeviceUuid(null);
        setBoolRegisteredDevice(false);
        setIsLoading(false);
        return;
      }
      setCapturedDeviceUuid(deviceInfo.uuid);

      const subscriber = Meteor.subscribe(
        "deviceDetails.byDevice",
        deviceInfo.uuid,
        {
          onStop: (error) => {
            if (error) {
              console.error("Subscription error (hook):", error);
              setIsLoading(false); // loading stops on error
            }
          },
          onReady: () => {
            const deviceDetailsDoc = DeviceDetails.findOne({
              "devices.deviceUUID": deviceInfo.uuid,
            });

            setBoolRegisteredDevice(!!deviceDetailsDoc);
            setIsLoading(false);
          },
        },
      );

      return () => {
        if (subscriber) {
          subscriber.stop();
        }
      };
    });

    return () => {
      sessionTracker.stop();
    };
  }, []); // only run on mount

  return { capturedDeviceUuid, boolRegisteredDevice, isLoading };
};
