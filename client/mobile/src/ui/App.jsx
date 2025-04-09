import React from 'react';
import { useDeviceRegistration } from './hooks/useDeviceRegistration';
import { AppRoutes } from './components/AppRoutes';

// Remove unused imports
// import { useEffect, useState } from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import { Meteor } from 'meteor/meteor';
// import { DeviceDetails } from '../api/deviceDetails';
// import { Session } from 'meteor/session';
// import { Tracker } from 'meteor/tracker';
// import { LoginPage } from './Login';
// import { RegistrationPage } from './Registration';
// import { WelcomePage } from './Welcome';
// import { LandingPage } from './LandingPage';
// import { BiometricRegistrationModal} from './Modal/BiometricRegistrationModal';

const LoadingIndicator = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
    <p className="mt-4 text-lg font-semibold text-blue-600">
      Checking device registration...
    </p>
  </div>
);

export const App = () => {
  const { capturedDeviceUuid, boolRegisteredDevice, isLoading } = useDeviceRegistration();

  // Log initial state from hook
  console.log('App component rendering with:', { capturedDeviceUuid, boolRegisteredDevice, isLoading });

  // Show loading spinner while checking registration
  if (isLoading) {
    return <LoadingIndicator />;
  }

  // Main routing logic moved to AppRoutes
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <AppRoutes 
        isRegistered={boolRegisteredDevice} 
        deviceUuid={capturedDeviceUuid} 
      />
    </div>
  );
};