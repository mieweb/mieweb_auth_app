import React from "react";
import { Navigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";

export const ProtectedRoute = ({ children }) => {
  if (!Meteor.userId()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};
