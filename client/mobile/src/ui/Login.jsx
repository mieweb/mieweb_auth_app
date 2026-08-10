import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { openSupportLink } from "../../../../utils/openExternal";
import { migrateWithBiometricSecret } from "../../identity-migration";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { Random } from "meteor/random";
import {
  Fingerprint as FingerprintIcon,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import {
  Input,
  Button,
  Alert,
  AlertDescription,
  Modal,
  ModalBody,
} from "@mieweb/ui";

const BIOMETRIC_SECRET_NOT_FOUND = -113;
const BIOMETRIC_RECOVERY_NEEDED_KEY = "biometricRecoveryNeeded";

const isMissingBiometricSecret = (error) => {
  if (Number(error?.code) === BIOMETRIC_SECRET_NOT_FOUND) return true;

  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("item could not be found in the keychain") ||
    message.includes("secret not found") ||
    message.includes("no secret found")
  );
};

const clearBiometricEnrollment = () => {
  localStorage.removeItem("biometricsEnabled");
  localStorage.removeItem("biometricUserId");
};

const setBiometricRecoveryNeeded = (isNeeded) => {
  if (isNeeded) {
    localStorage.setItem(BIOMETRIC_RECOVERY_NEEDED_KEY, "true");
  } else {
    localStorage.removeItem(BIOMETRIC_RECOVERY_NEEDED_KEY);
  }
};

// ── Lock Screen (biometric auto-trigger) ────────────────────────────────────
const LockScreen = ({
  email,
  onBiometricSuccess,
  onShowPinFallback,
  error,
  isAuthenticating,
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-6 bg-card text-card-foreground p-8 rounded-3xl shadow-xl border border-border">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
            <FingerprintIcon className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Welcome Back!</h2>
          {email && <p className="text-sm text-muted-foreground">{email}</p>}
        </div>

        {/* Error */}
        {error && (
          <Alert variant="danger" icon={<AlertCircle className="h-4 w-4" />}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Biometric button */}
        <Button
          onClick={onBiometricSuccess}
          disabled={isAuthenticating}
          aria-label="Authenticate with biometrics"
          fullWidth
          isLoading={isAuthenticating}
          loadingText="Authenticating…"
          leftIcon={<FingerprintIcon className="h-5 w-5" />}
        >
          Unlock with Biometrics
        </Button>

        {/* PIN fallback */}
        <Button
          onClick={onShowPinFallback}
          variant="outline"
          fullWidth
          leftIcon={<KeyRound className="h-4 w-4" />}
        >
          Use PIN Instead
        </Button>
      </div>
    </div>
  );
};

// ── Main LoginPage ───────────────────────────────────────────────────────────
export const LoginPage = ({ deviceDetails }) => {
  const [email, setEmail] = useState(
    () => localStorage.getItem("lastLoggedInEmail") || "",
  );
  const [isReturningUser, setIsReturningUser] = useState(
    () => !!localStorage.getItem("lastLoggedInEmail"),
  );
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showPinForm, setShowPinForm] = useState(false);
  const [needsBiometricRecovery, setNeedsBiometricRecovery] = useState(
    () => localStorage.getItem(BIOMETRIC_RECOVERY_NEEDED_KEY) === "true",
  );
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const [isRecoveringBiometrics, setIsRecoveringBiometrics] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const navigate = useNavigate();
  const biometricTriggered = useRef(false);

  // Determine if biometric credentials exist
  const hasBiometricCredentials =
    localStorage.getItem("biometricsEnabled") === "true" ||
    !!localStorage.getItem("biometricUserId");

  // ── Connection monitor ──────────────────────────────────────────────────
  useEffect(() => {
    const connectionCheck = setInterval(() => {
      if (!Meteor.status().connected) {
        setError("Connection to server lost. Reconnecting…");
      } else {
        setError((prev) =>
          prev === "Connection to server lost. Reconnecting…" ? "" : prev,
        );
      }
    }, 3000);

    return () => clearInterval(connectionCheck);
  }, []);

  // ── Registration check helper ───────────────────────────────────────────
  const checkRegistrationStatus = useCallback(
    async (userId, emailAddress) => {
      setCheckingStatus(true);
      try {
        const result = await Meteor.callAsync("users.checkRegistrationStatus", {
          userId,
          email: emailAddress,
        });
        if (!result?.status)
          throw new Error("Failed to retrieve registration status");

        if (result.status !== "approved") {
          setError("Your account is pending approval by an administrator.");
          navigate("/pending-registration");
          return false;
        }
        return true;
      } catch (err) {
        setError(
          err.reason || err.message || "Failed to verify account status",
        );
        return false;
      } finally {
        setCheckingStatus(false);
      }
    },
    [navigate],
  );

  // ── Biometric login (reusable) ──────────────────────────────────────────
  const handleBiometricLogin = useCallback(async () => {
    const hasEnrollment =
      localStorage.getItem("biometricsEnabled") === "true" ||
      !!localStorage.getItem("biometricUserId");
    if (!hasEnrollment) {
      // No credentials stored – fall back to PIN form
      setShowPinForm(true);
      return;
    }

    setIsLoggingIn(true);
    setError("");

    try {
      if (!window.Fingerprint)
        throw new Error("Biometric auth unavailable on this device.");

      await new Promise((resolve, reject) => {
        window.Fingerprint.loadBiometricSecret(
          {
            description: "Authenticate to unlock MIE Auth",
            disableBackup: true,
          },
          async (biometricSecret) => {
            try {
              const result = await Meteor.callAsync(
                "users.loginWithBiometric",
                biometricSecret,
              );
              if (!result?._id)
                throw new Error("Biometric authentication failed");

              // Establish a real Meteor session so server methods see this.userId
              if (result.token) {
                await new Promise((res, rej) => {
                  Meteor.loginWithToken(result.token, (err) =>
                    err ? rej(err) : res(),
                  );
                });
              }

              const isApproved = await checkRegistrationStatus(
                result._id,
                result.email,
              );
              if (isApproved) {
                localStorage.setItem("biometricsEnabled", "true");
                localStorage.removeItem("biometricUserId");
                setBiometricRecoveryNeeded(false);
                setNeedsBiometricRecovery(false);
                Session.set("userProfile", {
                  email: result.email,
                  username: result.username,
                  _id: result._id,
                });
                // Fire-and-forget: the device-bound secret is already in hand,
                // so upgrade this installation to a v2 identity silently.
                migrateWithBiometricSecret(biometricSecret);
                navigate("/dashboard");
              } else {
                await new Promise((res) => Meteor.logout(res));
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          (err) =>
            reject(err || new Error("Biometric authentication cancelled")),
        );
      });
    } catch (err) {
      if (isMissingBiometricSecret(err)) {
        clearBiometricEnrollment();
        setBiometricRecoveryNeeded(true);
        setNeedsBiometricRecovery(true);
        setShowPinForm(true);
        setError(
          "Your biometric setup is no longer available on this device. Sign in with your PIN to set it up again.",
        );
      } else {
        setError(err.message || "Biometric login failed. Use PIN instead.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  }, [checkRegistrationStatus, navigate]);

  const finishPinLogin = (userId) => {
    Session.set("userProfile", { email, _id: userId });
    localStorage.setItem("lastLoggedInEmail", email);

    if (needsBiometricRecovery || !hasBiometricCredentials) {
      setRecoveryError("");
      setShowRecoveryPrompt(true);
      return;
    }

    navigate("/dashboard");
  };

  const registerRecoveredBiometrics = () => {
    if (!window.Fingerprint) {
      setRecoveryError(
        "Biometric authentication is unavailable on this device.",
      );
      return;
    }

    if (!deviceDetails) {
      setRecoveryError("Device information is unavailable. Please try again.");
      return;
    }

    setIsRecoveringBiometrics(true);
    setRecoveryError("");
    const biometricSecret = Random.secret(32);

    window.Fingerprint.registerBiometricSecret(
      {
        description: "Set up biometric login for MIE Auth",
        secret: biometricSecret,
        invalidateOnEnrollment: true,
        disableBackup: true,
      },
      async () => {
        try {
          await Meteor.callAsync("users.rotateBiometricSecret", {
            deviceUUID: deviceDetails,
            biometricSecret,
          });
          localStorage.setItem("biometricsEnabled", "true");
          localStorage.removeItem("biometricUserId");
          setBiometricRecoveryNeeded(false);
          setNeedsBiometricRecovery(false);
          setShowRecoveryPrompt(false);
          navigate("/dashboard");
        } catch (err) {
          clearBiometricEnrollment();
          setRecoveryError(
            err.reason ||
              err.message ||
              "Unable to finish biometric setup. Please try again.",
          );
        } finally {
          setIsRecoveringBiometrics(false);
        }
      },
      (err) => {
        setRecoveryError(
          err?.message || "Unable to register biometrics. Please try again.",
        );
        setIsRecoveringBiometrics(false);
      },
    );
  };

  // ── Auto-trigger biometrics on mount for returning users ────────────────
  useEffect(() => {
    if (biometricTriggered.current) return;
    if (!hasBiometricCredentials) {
      // No biometrics registered – go straight to PIN form
      setShowPinForm(true);
      return;
    }

    // Small delay so the lock screen renders first
    const timer = setTimeout(() => {
      biometricTriggered.current = true;
      handleBiometricLogin();
    }, 600);

    return () => clearTimeout(timer);
  }, [hasBiometricCredentials, handleBiometricLogin]);

  // ── PIN login ───────────────────────────────────────────────────────────
  const handlePinLogin = async (e) => {
    e.preventDefault();
    if (!deviceDetails) {
      setError("Device info not available. Please refresh.");
      return;
    }
    if (!Meteor.status().connected) {
      setError("No connection. Please check your network.");
      return;
    }

    setIsLoggingIn(true);
    setError("");

    try {
      let userId;
      await new Promise((resolve, reject) => {
        Meteor.loginWithPassword(email, pin, (err) => {
          if (err) {
            reject(err);
          } else {
            userId = Meteor.userId();
            resolve();
          }
        });
      });

      const isApproved = await checkRegistrationStatus(userId, email);
      if (isApproved) {
        finishPinLogin(userId);
      } else {
        Meteor.logout();
      }
    } catch (err) {
      setError(err.reason || "Login failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ── If biometric credentials exist and we haven't switched to PIN → show lock screen
  if (hasBiometricCredentials && !showPinForm) {
    return (
      <LockScreen
        email={email}
        error={error}
        isAuthenticating={isLoggingIn || checkingStatus}
        onBiometricSuccess={handleBiometricLogin}
        onShowPinFallback={() => {
          setError("");
          setShowPinForm(true);
        }}
      />
    );
  }

  // ── PIN fallback form ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-6 bg-card text-card-foreground p-8 rounded-3xl shadow-xl border border-border">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {isReturningUser ? "Welcome Back!" : "Sign In"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isReturningUser ? email : "Enter your credentials to continue"}
          </p>
        </div>

        <form onSubmit={handlePinLogin} className="space-y-5">
          {error && (
            <Alert variant="danger" icon={<AlertCircle className="h-4 w-4" />}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Email field */}
          <div>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              label="Email"
              placeholder="Enter your email"
              autoComplete="email"
              disabled={isLoggingIn || checkingStatus}
            />
            {isReturningUser && (
              <Button
                variant="link"
                size="sm"
                type="button"
                onClick={() => {
                  localStorage.removeItem("lastLoggedInEmail");
                  setEmail("");
                  setIsReturningUser(false);
                }}
              >
                Not you? Use a different account
              </Button>
            )}
          </div>

          {/* PIN field */}
          <Input
            id="pin"
            type="password"
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            label="PIN"
            placeholder="Enter your PIN"
            maxLength={6}
            minLength={4}
            pattern="[0-9]*"
            inputMode="numeric"
            autoComplete="current-password"
            disabled={isLoggingIn || checkingStatus}
          />

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoggingIn || checkingStatus}
            fullWidth
            isLoading={isLoggingIn || checkingStatus}
            loadingText={checkingStatus ? "Verifying…" : "Signing In…"}
          >
            Sign In with PIN
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Need help?{" "}
            <Button
              variant="link"
              type="button"
              onClick={() => openSupportLink()}
            >
              Contact Support
            </Button>
          </div>
        </form>

        {/* Back to biometric if available */}
        {hasBiometricCredentials && (
          <Button
            onClick={() => {
              setError("");
              setShowPinForm(false);
              biometricTriggered.current = false;
            }}
            variant="outline"
            fullWidth
            leftIcon={<FingerprintIcon className="h-4 w-4" />}
          >
            Use Biometrics Instead
          </Button>
        )}
      </div>

      <Modal
        open={showRecoveryPrompt}
        onOpenChange={(open) => {
          if (!open && !isRecoveringBiometrics) {
            setShowRecoveryPrompt(false);
            navigate("/dashboard");
          }
        }}
        size="sm"
      >
        <ModalBody className="text-center space-y-4">
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
            <FingerprintIcon className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {needsBiometricRecovery
                ? "Set Up Biometrics Again"
                : "Set Up Biometrics"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {needsBiometricRecovery
                ? "Your previous biometric credential was tied to your old device. Create a new credential for this device now."
                : "Enable biometric login for faster, secure access on this device."}
            </p>
          </div>
          {recoveryError && (
            <Alert variant="danger" icon={<AlertCircle className="h-4 w-4" />}>
              <AlertDescription>{recoveryError}</AlertDescription>
            </Alert>
          )}
          <Button
            onClick={registerRecoveredBiometrics}
            disabled={isRecoveringBiometrics}
            isLoading={isRecoveringBiometrics}
            loadingText="Setting Up…"
            fullWidth
            leftIcon={<FingerprintIcon className="h-5 w-5" />}
          >
            Set Up Biometrics
          </Button>
          <Button
            onClick={() => {
              setShowRecoveryPrompt(false);
              navigate("/dashboard");
            }}
            disabled={isRecoveringBiometrics}
            variant="secondary"
            fullWidth
          >
            Skip for Now
          </Button>
        </ModalBody>
      </Modal>
    </div>
  );
};
