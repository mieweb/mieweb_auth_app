import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { openSupportLink } from "../../../../utils/openExternal";
import {
  Mail,
  User,
  KeyRound,
  Clock,
  Home,
  CircleDot,
  Circle,
  Shield,
  Fingerprint,
  Bell,
  Smartphone,
} from "lucide-react";
import { motion } from "framer-motion";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import BiometricRegistrationModal from "./Modal/BiometricRegistrationModal";
import { Random } from "meteor/random";
import { Input, Button, Alert, AlertDescription, Badge } from "@mieweb/ui";

const marketingFeatures = [
  {
    icon: Fingerprint,
    title: "Biometric Authentication",
    description:
      "Face ID, Touch ID, and fingerprint login — authenticate in milliseconds.",
  },
  {
    icon: Bell,
    title: "Push Notification 2FA",
    description:
      "Approve or reject login requests with a single tap on your device.",
  },
  {
    icon: Smartphone,
    title: "Multi-Device Support",
    description:
      "Register multiple devices with primary/secondary cross-device approval.",
  },
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    description:
      "Bcrypt hashing, timing-safe comparisons, and defense-in-depth.",
  },
];

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
        className="min-h-screen flex flex-col items-center justify-center p-4 bg-background"
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-md w-full space-y-6 bg-card text-card-foreground p-8 rounded-3xl shadow-xl border border-border"
        >
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 bg-warning/10 rounded-2xl flex items-center justify-center">
              <Clock className="h-7 w-7 text-warning" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Registration Pending
            </h2>
            <Badge variant="warning" size="sm">
              Awaiting Approval
            </Badge>
          </div>

          {/* Status message */}
          <Alert variant="warning">
            <AlertDescription>
              <p>
                Since this is your first device registered with us, your account
                needs to be approved by an administrator.
              </p>
              <p className="mt-1 text-xs opacity-75">
                You will receive a notification once your registration has been
                processed.
              </p>
            </AlertDescription>
          </Alert>

          <Button
            onClick={goToLogin}
            fullWidth
            leftIcon={<Home className="h-4 w-4" />}
          >
            Back to Login
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // Regular registration form
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col lg:flex-row"
    >
      {/* ===== LEFT: Marketing Panel (desktop only) ===== */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-gray-950 via-gray-900 to-blue-950 text-white overflow-hidden">
        {/* Glow orbs */}
        <div
          className="absolute top-1/4 -left-32 w-[400px] h-[400px] bg-blue-600 rounded-full blur-[128px] opacity-20"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 -right-32 w-[300px] h-[300px] bg-indigo-500 rounded-full blur-[128px] opacity-15"
          aria-hidden="true"
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 py-16 max-w-xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-10">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <img
                  src="/logo.png"
                  alt=""
                  className="h-7 w-7 brightness-0 invert"
                />
              </div>
              <span className="text-xl font-bold">MIE Auth</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="text-4xl xl:text-5xl font-black tracking-tight leading-tight mb-4"
          >
            Authentication{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              reimagined.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-gray-400 text-lg leading-relaxed mb-12"
          >
            Secure your applications with biometric login, push notification
            2FA, and multi-device management — all open source and free.
          </motion.p>

          {/* Feature list */}
          <div className="space-y-6">
            {marketingFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                className="flex items-start gap-4"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Social proof / stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="mt-14 pt-8 border-t border-white/10 grid grid-cols-3 gap-4"
          >
            {[
              { value: "100%", label: "Open Source" },
              { value: "< 1s", label: "Auth Speed" },
              { value: "2", label: "Platforms" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ===== RIGHT: Registration Form ===== */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-b from-background to-muted/30 lg:bg-background lg:overflow-y-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-lg w-full bg-card text-card-foreground p-8 rounded-2xl shadow-lg border border-border lg:shadow-none lg:border-0 lg:bg-transparent"
        >
          {/* Header with logo */}
          <div className="text-center lg:text-left space-y-3 mb-8">
            {/* Show logo on mobile only */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="mx-auto lg:hidden w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center"
            >
              <img src="/logo.png" alt="MIE Auth" className="h-8 w-8" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground">
              Create your account
            </h2>
            <p className="text-sm text-muted-foreground">
              Get started with MIE Auth in just a few steps
            </p>
          </div>

          {error && (
            <Alert variant="danger" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section: Account */}
            <fieldset className="space-y-4">
              <legend className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                <Mail className="h-3.5 w-3.5" />
                Account
              </legend>
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <Input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  label="Email"
                  autoComplete="email"
                />
              </motion.div>
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                <Input
                  name="username"
                  type="text"
                  placeholder="Choose a username"
                  required
                  value={formData.username}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  label="Username"
                  autoCapitalize="none"
                  autoComplete="username"
                />
              </motion.div>
            </fieldset>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Section: Personal Info */}
            <fieldset className="space-y-4">
              <legend className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                <User className="h-3.5 w-3.5" />
                Personal Info
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Input
                    name="firstName"
                    type="text"
                    placeholder="First name"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                    label="First Name"
                    autoComplete="given-name"
                  />
                </motion.div>
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.25 }}
                >
                  <Input
                    name="lastName"
                    type="text"
                    placeholder="Last name"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }))
                    }
                    label="Last Name"
                    autoComplete="family-name"
                  />
                </motion.div>
              </div>
            </fieldset>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Section: Security */}
            <fieldset className="space-y-4">
              <legend className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                <KeyRound className="h-3.5 w-3.5" />
                Security
              </legend>
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Input
                  name="pin"
                  type="password"
                  placeholder="4–6 digit PIN"
                  required
                  value={formData.pin}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, pin: e.target.value }))
                  }
                  label="PIN"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  minLength="4"
                  maxLength="6"
                />
                {/* PIN strength dots */}
                <div className="flex items-center gap-1.5 mt-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i}>
                      {i < formData.pin.length ? (
                        <CircleDot className="h-3 w-3 text-primary" />
                      ) : (
                        <Circle className="h-3 w-3 text-muted-foreground/30" />
                      )}
                    </div>
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">
                    {formData.pin.length === 0 && "4–6 digits required"}
                    {formData.pin.length > 0 &&
                      formData.pin.length < 4 &&
                      `${4 - formData.pin.length} more digit${4 - formData.pin.length > 1 ? "s" : ""} needed`}
                    {formData.pin.length >= 4 &&
                      formData.pin.length < 6 &&
                      "Good"}
                    {formData.pin.length === 6 && "Maximum length"}
                  </span>
                </div>
              </motion.div>
            </fieldset>

            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                type="submit"
                disabled={loading}
                fullWidth
                isLoading={loading}
                loadingText="Creating Account..."
                size="lg"
              >
                Create Account
              </Button>
            </motion.div>

            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>
                Already have an account?{" "}
                <Button variant="link" type="button" onClick={goToLogin}>
                  Log in
                </Button>
              </p>
              <p>
                Need help?{" "}
                <Button
                  variant="link"
                  type="button"
                  onClick={() => openSupportLink()}
                >
                  Contact Support
                </Button>
              </p>
            </div>
          </form>
        </motion.div>
      </div>

      {showBiometricModal && (
        <BiometricRegistrationModal
          isOpen={showBiometricModal}
          onClose={() => setShowBiometricModal(false)}
          userData={registeredUser}
          onComplete={handleBiometricComplete}
        />
      )}
    </motion.div>
  );
};
