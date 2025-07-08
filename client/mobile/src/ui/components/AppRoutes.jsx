import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LoginPage } from '../Login';
import { RegistrationPage } from '../Registration';
import { WelcomePage } from '../Welcome';
import { LandingPage } from '../LandingPage';
import { BiometricRegistrationModal } from '../Modal/BiometricRegistrationModal';
import PendingRegistrationPage from '../PendingRegistrationPage';
import { WebNotificationPage } from '../../../../WebNotificationPage';
import { Meteor } from 'meteor/meteor';

// separate component for the redirect logic
const BrowserRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!Meteor.isCordova) {
      console.log("Web browser detected — redirecting to /send-notification");
      navigate('/send-notification');
    }
  }, [navigate]);

  return null;
};

export const AppRoutes = ({ isRegistered, deviceUuid }) => {
  console.log(' ### Log Step 3 : inside AppRoutes.jsx, App routes called with:', JSON.stringify({ isRegistered, deviceUuid }));
  
  return (
    <Router>
      <BrowserRedirect />
      <Routes>
        <Route
          path="/"
          element={isRegistered ? (
            <Navigate to="/login" replace />
          ) : (
            <Navigate to="/register" replace />
          )}
        />
        <Route
          path="/login"
          element={<LoginPage deviceDetails={deviceUuid} />}
        />
        <Route
          path="/register"
          element={<RegistrationPage deviceDetails={deviceUuid} />}
        />
        <Route
          path="/dashboard"
          element={<LandingPage deviceDetails={deviceUuid} />}
        />
        <Route
          path="/welcome"
          element={<WelcomePage deviceDetails={deviceUuid} />}
        />
        <Route
          path="/biometricModal"
          element={<BiometricRegistrationModal deviceDetails={deviceUuid} />}
        />
        <Route
          path="/pending-registration"
          element={<PendingRegistrationPage />}
        />
        <Route
          path="/send-notification"
          element={<WebNotificationPage />}
        />
      </Routes>
    </Router>
  );
};