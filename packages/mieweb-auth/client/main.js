import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import './styles.css';

// Import all components
import { App } from './components/App';
import { WelcomePage } from './components/Welcome';
import { LoginPage } from './components/Login';
import { RegistrationPage } from './components/Registration';
import { LandingPage } from './components/LandingPage';
import { PendingRegistrationPage } from './components/PendingRegistrationPage';

// Import mobile utilities
import { captureDeviceInfo } from './mobile/capture-device-info';
import { initializeBiometrics } from './mobile/biometrics';
import { initializePushNotifications } from './mobile/push-notifications';

// Import hooks
import { useDarkMode } from './hooks/useDarkMode';
import { useDeviceRegistration } from './hooks/useDeviceRegistration';
import { useNotificationData } from './hooks/useNotificationData';
import { useNotificationHandler } from './hooks/useNotificationHandler';
import { useUserProfile } from './hooks/useUserProfile';

// Main App component that can be rendered
export const MiewebAuthApp = ({ containerId = 'react-target' }) => {
  React.useEffect(() => {
    if (Meteor.isCordova) {
      document.addEventListener('deviceready', () => {
        console.log("MiewebAuth: Initializing Cordova device features");
        captureDeviceInfo();
        initializeBiometrics();
        initializePushNotifications();
      }, false);
    } else {
      console.log("MiewebAuth: Not on Cordova, skipping device initialization");
    }
  }, []);

  return <App />;
};

// Initialize function for easy setup
export const initializeMiewebAuth = (containerId = 'react-target') => {
  Meteor.startup(() => {
    const container = document.getElementById(containerId);
    if (container) {
      const root = createRoot(container);
      root.render(<MiewebAuthApp containerId={containerId} />);
    } else {
      console.error(`MiewebAuth: Container with id '${containerId}' not found`);
    }
  });
};

// Export individual components for customization
export {
  App as MiewebAuthMainApp,
  WelcomePage as LoginComponent,
  LoginPage as RegistrationComponent, 
  RegistrationPage as WelcomeComponent,
  LandingPage as LandingPageComponent,
  PendingRegistrationPage
};

// Export hooks for custom implementations
export {
  useDarkMode,
  useDeviceRegistration,
  useNotificationData,
  useNotificationHandler,
  useUserProfile
};

// Export mobile utilities
export {
  captureDeviceInfo,
  initializeBiometrics,
  initializePushNotifications
};
