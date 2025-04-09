import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../Login';
import { RegistrationPage } from '../Registration';
import { WelcomePage } from '../Welcome';
import { LandingPage } from '../LandingPage';
import { BiometricRegistrationModal } from '../Modal/BiometricRegistrationModal';

export const AppRoutes = ({ isRegistered, deviceUuid }) => {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            isRegistered ? (
              <Navigate to="/login" replace />
            ) : (
              <Navigate to="/register" replace />
            )
          }
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
      </Routes>
    </Router>
  );
}; 