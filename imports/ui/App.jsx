import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { DeviceLogs } from '../api/deviceLogs'
import { Session } from 'meteor/session';
import { Tracker } from 'meteor/tracker';
import { LoginPage } from './Login';
import { RegistrationPage } from './Registration';
import { WelcomePage } from './Welcome';
import { LandingPage } from './LandingPage';

export const App = () => {
  
  const [capturedDeviceUuid, setCapturedDeviceUuid] = useState(null);
  const [boolRegisteredDevice, setBoolRegisteredDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('Initializing App component...');
    
    // Setup Tracker autorun for Session changes
    const sessionTracker = Tracker.autorun(() => {
      const deviceInfo = Session.get('capturedDeviceInfo');
      console.log('Session deviceInfo:', deviceInfo);

      if (!deviceInfo || !deviceInfo.uuid) {
        console.log('No valid device info in session');
        setCapturedDeviceUuid(null);
        setBoolRegisteredDevice(false);
        setIsLoading(false);
        return;
      }

      setCapturedDeviceUuid(deviceInfo.uuid);
      
      // Subscribe to deviceLogs
      const subscriber = Meteor.subscribe('deviceLogs.byDevice', deviceInfo.uuid, {
        onStop: (error) => {
          if (error) {
            console.error('Subscription error:', error);
          }
        },
        onReady: () => {
          console.log('Subscription is ready');
          // Query the collection
          const storedDeviceInfo = DeviceLogs.find({ 
            deviceUUID: deviceInfo.uuid 
          }).fetch();
          
          console.log('Fetched Device Info:', JSON.stringify({storedDeviceInfo}));
          setBoolRegisteredDevice(storedDeviceInfo.length > 0);
          setIsLoading(false);
        }
      });

      // Cleanup function
      return () => {
        console.log('Cleaning up subscription...');
        if (subscriber) {
          subscriber.stop();
        }
      };
    });

    // Cleanup function for the effect
    return () => {
      console.log('Cleaning up session tracker...');
      sessionTracker.stop();
    };
  }, []); // Empty dependency array - only run on mount

  // Debug logging for state changes
  useEffect(() => {
    console.log('State updated:', {
      capturedDeviceUuid,
      boolRegisteredDevice,
      isLoading
    });
  }, [capturedDeviceUuid, boolRegisteredDevice, isLoading]);


  // Show loading spinner while checking registration
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
        <p className="mt-4 text-lg font-semibold text-blue-600">
          Checking device registration...
        </p>
      </div>
    );
  }

  // Main routing logic
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              boolRegisteredDevice ? (
                <Navigate to="/login" replace />
              ) : (
                <Navigate to="/register" replace />
              )
            }
          />
          <Route 
            path="/login" 
            element={<LoginPage deviceDetails={capturedDeviceUuid} />} 
          />
          <Route 
            path="/register" 
            element={<RegistrationPage deviceDetails={capturedDeviceUuid} />} 
          />
          <Route 
            path="/dashboard" 
            element={<LandingPage deviceDetails={capturedDeviceUuid} />} 
          />
          <Route 
            path="/welcome" 
            element={<WelcomePage deviceDetails={capturedDeviceUuid} />} 
          />
        </Routes>
      </Router>
    </div>
  );
};