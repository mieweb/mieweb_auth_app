import React from "react";
import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { Session } from "meteor/session";
import { useTracker } from "meteor/react-meteor-data";
import { Navigate } from "react-router-dom";

// Runs on explicit logouts and when the server revokes this session (e.g. an
// admin PIN reset), so a cached profile can't keep protected pages open.
// Biometric enrollment in localStorage is left intact for re-authentication.
Accounts.onLogout(() => Session.set("userProfile", null));

export const ProtectedRoute = ({ children }) => {
  // Check both Meteor login (PIN) and Session (biometric) auth states
  const isSignedIn = useTracker(
    () => !!Meteor.userId() || !!Session.get("userProfile"),
    [],
  );
  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
};
