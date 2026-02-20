import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LoginPage } from '../Login';
import { RegistrationPage } from '../Registration';
import { WelcomePage } from '../Welcome';
import { LandingPage } from '../LandingPage';
import { BiometricRegistrationModal } from '../Modal/BiometricRegistrationModal';
import PendingRegistrationPage from '../PendingRegistrationPage';
import { WebNotificationPage } from '../../../../WebNotificationPage';
import { WebLandingPage } from '../../../../web/WebLandingPage';
import { PrivacyPolicyPage } from '../../../../web/PrivacyPolicyPage';
import { SupportPage } from '../../../../web/SupportPage';
import { DeleteAccountPage } from '../../../../web/DeleteAccountPage';
import { FAQPage } from '../../../../web/FAQPage';
import { Meteor } from 'meteor/meteor';

export const AppRoutes = ({ isRegistered, deviceUuid }) => {
  console.log(' ### Log Step 3 : inside AppRoutes.jsx, App routes called with:', JSON.stringify({ isRegistered, deviceUuid }));
  
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            Meteor.isCordova ? (
              isRegistered ? (
                <Navigate to="/login" replace />
              ) : (
                <Navigate to="/register" replace />
              )
            ) : (
              <WebLandingPage />
            )
          }
        />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/delete-account" element={<DeleteAccountPage />} />
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
          path="/test-notification"
          element={<WebNotificationPage />}
        />
      </Routes>
    </Router>
  );
};