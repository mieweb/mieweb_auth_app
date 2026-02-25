import React from "react";
import { Meteor } from "meteor/meteor";
import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }) => {
  if (!Meteor.userId()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};
