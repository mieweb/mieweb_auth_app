import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { LoginPage } from "../Login";
import { RegistrationPage } from "../Registration";
import { LandingPage } from "../LandingPage";
import BiometricRegistrationModal from "../Modal/BiometricRegistrationModal";
import PendingRegistrationPage from "../PendingRegistrationPage";
import { Meteor } from "meteor/meteor";
import { ProtectedRoute } from "./ProtectedRoute";
import { Spinner } from "@mieweb/ui";

// Lazy-load web-only pages to reduce initial bundle for mobile
const WebLandingPage = lazy(() =>
  import("../../../../web/WebLandingPage").then((m) => ({
    default: m.WebLandingPage,
  })),
);
const WebNotificationPage = lazy(() =>
  import("../../../../WebNotificationPage").then((m) => ({
    default: m.WebNotificationPage,
  })),
);
const PrivacyPolicyPage = lazy(() =>
  import("../../../../web/PrivacyPolicyPage").then((m) => ({
    default: m.PrivacyPolicyPage,
  })),
);
const SupportPage = lazy(() =>
  import("../../../../web/SupportPage").then((m) => ({
    default: m.SupportPage,
  })),
);
const DeleteAccountPage = lazy(() =>
  import("../../../../web/DeleteAccountPage").then((m) => ({
    default: m.DeleteAccountPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("../../../../web/NotFoundPage").then((m) => ({
    default: m.NotFoundPage,
  })),
);
const MobileAppRequired = lazy(() =>
  import("../../../../web/MobileAppRequired").then((m) => ({
    default: m.MobileAppRequired,
  })),
);

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Spinner size="xl" />
  </div>
);

export const AppRoutes = ({ isRegistered, deviceUuid }) => {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
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
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/delete-account" element={<DeleteAccountPage />} />
          <Route
            path="/login"
            element={
              Meteor.isCordova ? (
                <LoginPage deviceDetails={deviceUuid} />
              ) : (
                <MobileAppRequired mode="login" />
              )
            }
          />
          <Route
            path="/register"
            element={
              Meteor.isCordova ? (
                <RegistrationPage deviceDetails={deviceUuid} />
              ) : (
                <MobileAppRequired mode="register" />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <LandingPage deviceDetails={deviceUuid} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/biometricModal"
            element={
              <ProtectedRoute>
                <BiometricRegistrationModal deviceDetails={deviceUuid} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pending-registration"
            element={<PendingRegistrationPage />}
          />
          <Route path="/test-notification" element={<WebNotificationPage />} />
          {/* 404 catch-all */}
          <Route
            path="*"
            element={
              Meteor.isCordova ? <Navigate to="/" replace /> : <NotFoundPage />
            }
          />
        </Routes>
      </Suspense>
    </Router>
  );
};
