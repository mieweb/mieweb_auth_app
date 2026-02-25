import React from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import {
  AppStoreButtons,
  APP_STORE_URL,
  GOOGLE_PLAY_URL,
} from "./components/AppStoreButtons";
import { Button } from "@mieweb/ui";
import { motion } from "framer-motion";
import {
  Smartphone,
  Fingerprint,
  Bell,
  Shield,
  QrCode,
  ArrowLeft,
} from "lucide-react";

/**
 * Renders a minimal QR code as an inline SVG.
 * Instead of adding a library dependency, we encode the smart-redirect
 * URL into a Google Charts QR API URL for display.
 */
const QRCode = ({ androidUrl, iosUrl }) => {
  const size = 160;
  return (
    <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="w-40 h-40 bg-white rounded-2xl p-2 shadow-lg border border-gray-100 flex items-center justify-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(iosUrl)}&format=svg`}
            alt="Scan to download on App Store"
            width={size}
            height={size}
            className="rounded-lg"
          />
        </div>
        <span className="text-xs font-semibold text-gray-500">
          App Store (iOS)
        </span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="w-40 h-40 bg-white rounded-2xl p-2 shadow-lg border border-gray-100 flex items-center justify-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(androidUrl)}&format=svg`}
            alt="Scan to download on Google Play"
            width={size}
            height={size}
            className="rounded-lg"
          />
        </div>
        <span className="text-xs font-semibold text-gray-500">
          Google Play (Android)
        </span>
      </div>
    </div>
  );
};

const features = [
  {
    icon: Fingerprint,
    title: "Biometric Login",
    description:
      "Face ID, Touch ID & fingerprint \u2014 authenticate in milliseconds.",
  },
  {
    icon: Bell,
    title: "Push Notification 2FA",
    description: "Approve or reject sign-in requests with a single tap.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bcrypt hashing, timing-safe comparisons & defense-in-depth.",
  },
  {
    icon: Smartphone,
    title: "Multi-Device",
    description: "Primary & secondary devices with cross-device approval.",
  },
];

export const MobileAppRequired = ({ mode = "login" }) => {
  const navigate = useNavigate();
  const isLogin = mode === "login";

  return (
    <Layout>
      <div className="relative min-h-[calc(100vh-140px)] flex items-center overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-blue-950">
        {/* Background effects */}
        <div
          className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"
          aria-hidden="true"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.12, 0.2, 0.12] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 -left-32 w-[400px] h-[400px] bg-blue-600 rounded-full blur-[128px]"
          aria-hidden="true"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.08, 0.15, 0.08] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute bottom-1/4 -right-32 w-[300px] h-[300px] bg-indigo-500 rounded-full blur-[128px]"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left side: Message */}
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium px-4 py-1.5 rounded-full mb-6"
              >
                <Smartphone className="w-4 h-4" />
                Mobile App Required
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1] mb-6"
              >
                {isLogin ? (
                  <>
                    Sign in with the{" "}
                    <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                      mobile app
                    </span>
                  </>
                ) : (
                  <>
                    Get started on{" "}
                    <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                      your phone
                    </span>
                  </>
                )}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-gray-400 max-w-lg mx-auto lg:mx-0 mb-8 leading-relaxed"
              >
                {isLogin
                  ? "MIE Auth uses biometric authentication and push notifications, which require the mobile app. Download it to sign in securely."
                  : "Registration requires the MIE Auth mobile app for device enrollment, biometric setup, and push notification configuration. Scan a QR code below or tap to download."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <AppStoreButtons
                  variant="light"
                  className="justify-center lg:justify-start"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6"
              >
                <Button
                  variant="link"
                  onClick={() => navigate("/")}
                  className="text-gray-400 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to home
                </Button>
              </motion.div>
            </div>

            {/* Right side: Phone mockup + QR codes */}
            <div className="flex flex-col items-center gap-10">
              {/* Phone mockup */}
              <motion.div
                initial={{ opacity: 0, y: 40, rotateY: -10 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                aria-hidden="true"
              >
                <div className="w-56 sm:w-64 h-[400px] sm:h-[440px] bg-gray-900 rounded-[3rem] border-[6px] border-gray-700 shadow-2xl shadow-blue-500/20 flex flex-col overflow-hidden relative">
                  {/* Notch */}
                  <div className="absolute top-0 w-full h-6 bg-gray-900 z-20 flex justify-center">
                    <div className="w-20 h-4 bg-black rounded-b-2xl" />
                  </div>
                  {/* Screen */}
                  <div className="flex-1 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
                    <div className="px-4 py-3 flex flex-col h-full">
                      <div className="mt-7 mb-2">
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-2 shadow-lg shadow-blue-500/30"
                        >
                          <img
                            src="/logo.png"
                            alt=""
                            width="28"
                            height="28"
                            className="w-7 h-7 brightness-0 invert"
                          />
                        </motion.div>
                        <h3 className="text-base font-bold text-gray-900">
                          {isLogin ? "Welcome Back" : "Create Account"}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {isLogin
                            ? "Authenticate with biometrics"
                            : "Set up your secure identity"}
                        </p>
                      </div>

                      {/* Feature list inside phone */}
                      <div className="space-y-1.5 flex-1">
                        {features.map((feature, i) => (
                          <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 + i * 0.12 }}
                            className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-2"
                          >
                            <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                              <feature.icon className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold text-gray-800 leading-tight">
                                {feature.title}
                              </div>
                              <div className="text-[9px] text-gray-500 leading-tight">
                                {feature.description}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Biometric icon at bottom */}
                      <div className="flex justify-center py-1.5">
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="w-10 h-10 border-2 border-blue-500 rounded-full flex items-center justify-center"
                        >
                          <Fingerprint className="w-5 h-5 text-blue-500" />
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* QR Codes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="text-center"
              >
                <div className="flex items-center gap-2 justify-center mb-4">
                  <QrCode className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-400">
                    Scan to download
                  </span>
                </div>
                <QRCode androidUrl={GOOGLE_PLAY_URL} iosUrl={APP_STORE_URL} />
              </motion.div>
            </div>
          </div>

          {/* Feature highlights */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6"
          >
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors text-center"
              >
                <feature.icon className="w-6 h-6 text-blue-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-white mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default MobileAppRequired;
