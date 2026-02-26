import React, { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { Spinner } from "@mieweb/ui";
import { ProtectedRoute } from "./ProtectedRoute";

// --- Eagerly loaded (always needed) ---
import { LoginPage } from "../Login";
import { RegistrationPage } from "../Registration";
import { WelcomePage } from "../Welcome";

// --- Lazy-loaded mobile pages ---
const LandingPage = lazy(() =>
  import("../LandingPage").then((m) => ({ default: m.LandingPage })),
);
const PendingRegistrationPage = lazy(
  () => import("../PendingRegistrationPage"),
);
const BiometricRegistrationModal = lazy(() =>
  import("../Modal/BiometricRegistrationModal").then((m) => ({
    default: m.BiometricRegistrationModal,
  })),
);

// --- Lazy-loaded web pages ---
const WebLandingPage = lazy(() =>
  import("../../../../web/WebLandingPage").then((m) => ({
    default: m.WebLandingPage,
  })),
);
const FAQPage = lazy(() =>
  import("../../../../web/FAQPage").then((m) => ({ default: m.FAQPage })),
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
const WebNotificationPage = lazy(() =>
  import("../../../../WebNotificationPage").then((m) => ({
    default: m.WebNotificationPage,
  })),
);
const MobileAppRequired = lazy(
  () => import("../../../../web/MobileAppRequired"),
);
const NotFoundPage = lazy(() => import("../../../../web/NotFoundPage"));

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <Spinner size="lg" />
  </div>
);

export const AppRoutes = ({ isRegistered, deviceUuid }) => {
  const isMobile = Meteor.isCordova;

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* --- Root redirect --- */}
          <Route
            path="/"
            element={
              isMobile ? (
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

          {/* --- Public web pages --- */}
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/delete-account" element={<DeleteAccountPage />} />
          <Route path="/test-notification" element={<WebNotificationPage />} />

          {/* --- Mobile-only auth routes (redirect web visitors) --- */}
          <Route
            path="/login"
            element={
              isMobile ? (
                <LoginPage deviceDetails={deviceUuid} />
              ) : (
                <MobileAppRequired mode="login" />
              )
            }
          />
          <Route
            path="/register"
            element={
              isMobile ? (
                <RegistrationPage deviceDetails={deviceUuid} />
              ) : (
                <MobileAppRequired mode="register" />
              )
            }
          />
          <Route
            path="/welcome"
            element={
              isMobile ? (
                <WelcomePage deviceDetails={deviceUuid} />
              ) : (
                <MobileAppRequired />
              )
            }
          />

          {/* --- Protected mobile routes --- */}
          <Route
            path="/dashboard"
            element={
              isMobile ? (
                <ProtectedRoute>
                  <LandingPage deviceDetails={deviceUuid} />
                </ProtectedRoute>
              ) : (
                <MobileAppRequired />
              )
            }
          />
          <Route
            path="/biometricModal"
            element={
              isMobile ? (
                <BiometricRegistrationModal deviceDetails={deviceUuid} />
              ) : (
                <MobileAppRequired />
              )
            }
          />
          <Route
            path="/pending-registration"
            element={<PendingRegistrationPage />}
          />

          {/* --- Catch-all 404 --- */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Router>
  );
};
