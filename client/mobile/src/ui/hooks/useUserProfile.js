import { useState, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { DeviceDetails } from "../../../../../utils/api/deviceDetails";

export const useUserProfile = () => {
  const initialProfile = Session.get("userProfile") || {};
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: initialProfile.email || "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch user details on mount
  useEffect(() => {
    let isMounted = true;

    const fetchUserDetails = async () => {
      if (!initialProfile._id) return;
      try {
        const userDoc = await DeviceDetails.findOneAsync({
          userId: initialProfile._id,
        });
        if (isMounted && userDoc) {
          setProfile({
            firstName: userDoc.firstName || "",
            lastName: userDoc.lastName || "",
            email: userDoc.email || "",
          });
        } else if (isMounted) {
          setErrorMessage("User profile not found.");
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Failed to fetch profile.");
        }
      }
    };

    fetchUserDetails();

    return () => {
      isMounted = false;
    };
  }, [initialProfile._id]);

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
