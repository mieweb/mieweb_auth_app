import React from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }) => {
  // Check both Meteor login (PIN) and Session (biometric) auth states
  if (!Meteor.userId() && !Session.get("userProfile")) {
    return <Navigate to="/login" replace />;
  }
  return children;
};
