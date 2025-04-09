import { useState, useEffect } from 'react';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { Tracker } from 'meteor/tracker';
import { DeviceDetails } from '../../../../../utils/api/deviceDetails';


export const useDeviceRegistration = () => {
  const [capturedDeviceUuid, setCapturedDeviceUuid] = useState(null);
  const [boolRegisteredDevice, setBoolRegisteredDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('Initializing useDeviceRegistration hook...');

    const sessionTracker = Tracker.autorun(() => {
      const deviceInfo = Session.get('capturedDeviceInfo');
      console.log('Session deviceInfo (hook):', JSON.stringify(deviceInfo));

      if (!deviceInfo || !deviceInfo.uuid) {
        console.log('No valid device info in session (hook)');
        setCapturedDeviceUuid(null);
        setBoolRegisteredDevice(false);
        setIsLoading(false); // Set loading to false even if no device info
        return;
      }

      // Reset loading state when device info changes but hasn't been checked yet
      setIsLoading(true); 
      setCapturedDeviceUuid(deviceInfo.uuid);

      const subscriber = Meteor.subscribe('deviceDetails.byDevice', deviceInfo.uuid, {
        onStop: (error) => {
          if (error) {
            console.error('Subscription error (hook):', error);
            setIsLoading(false); // Ensure loading stops on error
          }
        },
        onReady: () => {
          console.log('Subscription is ready (hook)');
          const deviceDetailsDoc = DeviceDetails.findOne({ 
            'devices.deviceUUID': deviceInfo.uuid 
          });
          
          console.log('Fetched Device Info (hook):', JSON.stringify({ deviceDetailsDoc }));          
          
          setBoolRegisteredDevice(!!deviceDetailsDoc);
          setIsLoading(false);
        }
      });

      return () => {
        console.log('Cleaning up subscription (hook)...');
        if (subscriber) {
          subscriber.stop();
        }
      };
    });

    return () => {
      console.log('Cleaning up session tracker (hook)...');
      sessionTracker.stop();
    };
  }, []); // Empty dependency array - only run on mount

  // Debug logging for state changes within the hook
  useEffect(() => {
    console.log('Hook state updated:', {
      capturedDeviceUuid,
      boolRegisteredDevice,
      isLoading
    });
  }, [capturedDeviceUuid, boolRegisteredDevice, isLoading]);


  return { capturedDeviceUuid, boolRegisteredDevice, isLoading };
}; 