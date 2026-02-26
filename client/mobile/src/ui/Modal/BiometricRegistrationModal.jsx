import React, { useState, useEffect } from "react";
import {
  Fingerprint as FingerprintIcon,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { Modal, ModalBody, Button } from "@mieweb/ui";

const BiometricRegistrationModal = ({
  isOpen,
  onClose,
  userData,
  onComplete,
}) => {
  const [status, setStatus] = useState("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isOpen && userData?.biometricSecret) {
      registerBiometrics();
    }
  }, [isOpen, userData]);

  const registerBiometrics = () => {
    if (!window.Fingerprint) {
      handleError("Biometric authentication not supported");
      return;
    }

    if (!userData?.biometricSecret) {
      handleError("Missing biometric configuration");
      return;
    }

    window.Fingerprint.registerBiometricSecret(
      {
        description: "Secure login for your account",
        secret: userData.biometricSecret,
        invalidateOnEnrollment: true,
        disableBackup: true,
      },
      () => handleSuccess(),
      (error) => handleError(error.message),
    );
  };

  const handleSuccess = () => {
    setStatus("success");
    localStorage.setItem("biometricsEnabled", "true");
    localStorage.setItem("biometricUserId", userData?.biometricSecret);
    setTimeout(() => {
      onClose();
      onComplete(true);
    }, 2000);
  };

  const handleError = (message = "Unknown error") => {
    setStatus("error");
    setErrorMessage(message);
  };

  const handleRetry = () => {
    setStatus("processing");
    registerBiometrics();
  };

  const handleSkip = () => {
    onClose();
    onComplete(false);
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="sm"
    >
      <ModalBody className="text-center">
        {status === "processing" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 flex items-center justify-center bg-primary/10 rounded-full animate-pulse">
                <FingerprintIcon className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-4">
              Register Biometrics
            </h2>
            <p className="text-muted-foreground">
              Follow your device&apos;s prompts to complete setup
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 flex items-center justify-center bg-green-500/15 rounded-full">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-4">
              Biometric Login Enabled
            </h2>
            <p className="text-muted-foreground">
              You can now log in using your biometrics
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 flex items-center justify-center bg-red-500/15 rounded-full">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              Registration Failed
            </h2>
            <p className="text-muted-foreground mb-4">
              {errorMessage || "Unable to register biometrics"}
            </p>
            <Button onClick={handleRetry} fullWidth>
              Try Again
            </Button>
            <Button
              onClick={handleSkip}
              variant="secondary"
              fullWidth
              className="mt-2"
            >
              Skip for Now
            </Button>
          </>
        )}
      </ModalBody>
    </Modal>
  );
};

export default BiometricRegistrationModal;
