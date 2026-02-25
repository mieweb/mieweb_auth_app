import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { openSupportLink } from "../../../../utils/openExternal";
import { User, Mail, Lock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { Button, Input, Alert, AlertDescription } from "@mieweb/ui";
import BiometricRegistrationModal from "./Modal/BiometricRegistrationModal";
import { Random } from "meteor/random";

export const RegistrationPage = ({ deviceDetails }) => {
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    firstName: "",
    lastName: "",
    pin: "",
  });
  const [loading, setLoading] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [error, setError] = useState(null);
  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [showPendingScreen, setShowPendingScreen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Component mount/unmount lifecycle
    return () => {};
  }, []);

  const inputFields = useMemo(
    () => [
      {
        name: "email",
        icon: Mail,
        type: "email",
        placeholder: "Enter your email",
      },
      {
        name: "username",
        icon: User,
        type: "text",
        placeholder: "Enter your username",
        autoCapitalize: "none",
      },
      {
        name: "firstName",
        icon: User,
        type: "text",
        placeholder: "First Name",
      },
      { name: "lastName", icon: User, type: "text", placeholder: "Last Name" },
      {
        name: "pin",
        icon: Lock,
        type: "password",
        placeholder: "Create a PIN (4-6 digits)",
        minLength: "4",
        maxLength: "6",
        pattern: "[0-9]*",
        inputMode: "numeric",
      },
    ],
    [],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const sessionDeviceInfo = Session.get("capturedDeviceInfo");
      const fcmDeviceToken = Session.get("deviceToken");

      if (!sessionDeviceInfo?.uuid || !fcmDeviceToken) {
        throw new Error("Device information or FCM token not available");
      }

      if (sessionDeviceInfo.uuid !== deviceDetails) {
        throw new Error("Device UUID mismatch");
      }

      const biometricSecret = Random.secret(32);

      const registerUser = await Meteor.callAsync("users.register", {
        ...formData,
        sessionDeviceInfo,
        fcmDeviceToken,
        biometricSecret,
      });

      // Handle secondary device approval flow
      if (registerUser?.userAction && registerUser.isSecondaryDevice) {
        if (registerUser.userAction === "approve") {
          // Approved by primary device - proceed biometric modal or app flow
          const userPayload = {
            userId: registerUser.userId,
            email: formData.email,
            username: formData.username,
            biometricSecret,
            isFirstDevice: false,
            registrationStatus: "approved",
          };
          setRegisteredUser(userPayload);

          setTimeout(() => {
            setShowBiometricModal(true);
          }, 0);
        } else if (registerUser.userAction === "reject") {
          setError(
            "Your secondary device registration was rejected by the primary device.",
          );
        } else if (registerUser.userAction === "timeout") {
          setError(
            "Secondary device approval request timed out. Please try again later.",
          );
        }
        // Stop further flow here
        return;
      }

      // Handle first device / regular flow
      if (registerUser?.userId) {
        const userPayload = {
          userId: registerUser.userId,
          email: formData.email,
          username: formData.username,
          biometricSecret,
          isFirstDevice: registerUser.isFirstDevice,
          registrationStatus: registerUser.registrationStatus,
        };

        setRegisteredUser(userPayload);

        // Open biometric modal immediately after successful registration
        setTimeout(() => {
          setShowBiometricModal(true);
        }, 0);
      } else if (registerUser?.registrationStatus) {
        const regStatus = registerUser.registrationStatus;

        if (regStatus === "pending") {
          setRegistrationStatus("pending");
          setShowPendingScreen(true);
        } else if (regStatus === "approved") {
          navigate("/login");
        } else if (regStatus === "rejected") {
          setError(
            "Your registration has been rejected. Please contact support.",
          );
        } else {
          navigate("/login");
        }
      } else {
        navigate("/login");
      }
    } catch (err) {
      console.error("### Log Step ERROR:", err);
      setError(err.reason || err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricComplete = useCallback(
    (wasSuccessful) => {
      setShowBiometricModal(false);

      //Now check registration status after biometric handling is done
      if (registeredUser) {
        if (
          registeredUser.isFirstDevice &&
          registeredUser.registrationStatus === "pending"
        ) {
          setRegistrationStatus("pending");
          setShowPendingScreen(true);
        } else {
          navigate("/login");
        }
      } else {
        navigate("/login");
      }
    },
    [navigate, registeredUser],
  );

  const goToLogin = useCallback(() => {
    navigate("/login");
  }, [navigate]);

  // If showing the pending screen
  if (showPendingScreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex flex-col items-center justify-center p-4"
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg"
        >
          <div className="text-center space-y-4">
            <motion.h2
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="text-3xl font-bold text-foreground"
            >
              Registration Pending
            </motion.h2>
            <div className="flex justify-center">
              <div className="animate-pulse w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
            </div>
            <p className="text-muted-foreground">
              Since this is your first device registered with us, your account
              needs to be approved by an administrator.
            </p>
            <p className="text-muted-foreground">
              You will receive a notification once your registration has been
              processed.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={goToLogin}
            className="w-full py-3 px-4 rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors"
          >
            Back to Login
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  // Regular registration form
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg"
      >
        <div className="text-center space-y-2">
          <motion.h2
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="text-3xl font-bold text-foreground"
          >
            Create Account
          </motion.h2>
          <p className="text-muted-foreground">Join our community today</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputFields.map((field, index) => (
              <motion.div
                key={field.name}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={field.name === "email" ? "md:col-span-2" : ""}
              >
                <label className="text-sm font-medium text-foreground/70">
                  {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
                </label>
                <div className="mt-1 relative">
                  <field.icon className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    name={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    required
                    value={formData[field.name]}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [e.target.name]: e.target.value,
                      }))
                    }
                    className="pl-10 rounded-xl"
                    pattern={field.pattern}
                    inputMode={field.inputMode}
                    minLength={field.minLength}
                    maxLength={field.maxLength}
                    autoCapitalize={field.autoCapitalize}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </motion.button>

          <div className="text-center text-sm text-gray-600">
            Need help?{" "}
            <button
              type="button"
              onClick={() => openSupportLink()}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Contact Support
            </button>
          </div>
        </form>
      </motion.div>

      {showBiometricModal && (
        <BiometricRegistrationModal
          key={Date.now()}
          isOpen={showBiometricModal}
          onClose={() => setShowBiometricModal(false)}
          userData={registeredUser}
          onComplete={handleBiometricComplete}
        />
      )}
    </motion.div>
  );
};
