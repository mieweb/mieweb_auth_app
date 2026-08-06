import { useState, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { useTracker } from "meteor/react-meteor-data";
import { DeviceDetails } from "../../../../../utils/api/deviceDetails";

export const useUserProfile = () => {
  const initialProfile = Session.get("userProfile") || {};
  const [profile, setProfile] = useState({
    firstName: initialProfile.firstName || "",
    lastName: initialProfile.lastName || "",
    email: initialProfile.email || "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Reactive profile source: subscribe to the user's own device document and
  // re-run whenever it arrives/changes. (A one-shot Minimongo read at mount
  // races the subscription and misses the data, showing "User" forever.)
  const userDoc = useTracker(() => {
    if (!initialProfile._id) return null;
    Meteor.subscribe("deviceDetails.byUser", initialProfile._id);
    return DeviceDetails.findOne({ userId: initialProfile._id });
  }, [initialProfile._id]);

  useEffect(() => {
    // Don't clobber in-progress edits with a reactive refresh.
    if (!userDoc || isEditing) return;
    setProfile({
      firstName: userDoc.firstName || "",
      lastName: userDoc.lastName || "",
      email: userDoc.email || initialProfile.email || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDoc?.firstName, userDoc?.lastName, userDoc?.email, isEditing]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileUpdate = async () => {
    if (!initialProfile._id) return;
    setIsSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      await Meteor.callAsync("updateUserProfile", {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
      });

      // Keep the in-memory session profile in sync so the dashboard greeting
      // reflects the new name without a reload.
      const current = Session.get("userProfile") || {};
      Session.set("userProfile", {
        ...current,
        firstName: profile.firstName,
        lastName: profile.lastName,
      });

      setSuccessMessage("Profile updated successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(
        error?.reason || error?.message || "Failed to update profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEdit = () => setIsEditing((prev) => !prev);

  return {
    profile,
    isEditing,
    isSaving,
    successMessage,
    errorMessage,
    handleProfileChange,
    handleProfileUpdate,
    toggleEdit,
    setSuccessMessage, // Expose setter if needed externally (e.g., for Toaster)
  };
};
