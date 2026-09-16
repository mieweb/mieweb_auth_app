import React, { useEffect, useState } from "react";
import { Fingerprint as FingerprintIcon } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Modal,
  ModalBody,
} from "@mieweb/ui";

// Prompt the OS biometric dialog and resolve with the device-bound secret.
// The secret is only released by the OS after a successful biometric check,
// which is what makes it usable as step-up re-authentication proof.
const getBiometricProof = () =>
  new Promise((resolve, reject) => {
    if (!window.Fingerprint) {
      reject(new Error("Biometric authentication is unavailable."));
      return;
    }
    window.Fingerprint.loadBiometricSecret(
      {
        description: "Confirm it's you to continue",
        disableBackup: true,
      },
      (secret) =>
        // Some devices "succeed" with an empty secret when no biometric
        // credential is stored — treat that as a failure so the caller falls
        // back to PIN instead of sending an invalid proof to the server.
        secret
          ? resolve({ biometricSecret: secret })
          : reject(new Error("No biometric credential found on this device.")),
      (err) =>
        reject(new Error(err?.message || "Biometric verification cancelled.")),
    );
  });

/**
 * Step-up confirmation modal for destructive account and device actions.
 *
 * Preference order: biometrics FIRST (auto-triggered on open), PIN as the
 * fallback — when biometrics fail, are cancelled, or the user chooses
 * "Use PIN instead".
 *
 * NOTE: deliberately NO Fingerprint.isAvailable pre-check — it misreports
 * Face ID on iOS simulators even when enrolled, while loadBiometricSecret
 * works (the login flow relies on the same direct call). Failures simply
 * drop to PIN.
 */
export const ConfirmActionModal = ({
  action,
  busy,
  error,
  onClose,
  onConfirm,
}) => {
  const bioSupported = !!window.Fingerprint;
  const [mode, setMode] = useState(bioSupported ? "biometric" : "pin");
  const [verifying, setVerifying] = useState(false);
  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState("");

  const runBiometric = async () => {
    setLocalError("");
    setVerifying(true);
    try {
      const proof = await getBiometricProof();
      onConfirm(proof);
    } catch (err) {
      // Fall back to PIN entry when biometrics fail or are cancelled.
      setLocalError(`${err.message} Enter your PIN to continue.`);
      setMode("pin");
    } finally {
      setVerifying(false);
    }
  };

  // Auto-trigger the biometric prompt as soon as the modal opens (same
  // direct-call pattern as the biometric login flow).
  useEffect(() => {
    if (bioSupported) runBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePinConfirm = () => {
    setLocalError("");
    if (!pin.trim()) {
      setLocalError("Enter your PIN to continue.");
      return;
    }
    onConfirm({ pin: pin.trim() });
  };

  const message = error || localError;
  const disabled = busy || verifying;

  return (
    <Modal open onOpenChange={(open) => !open && !disabled && onClose()}>
      <ModalBody>
        <div className="space-y-4 p-1">
          <h3 className="text-base font-semibold text-foreground">
            {action.title}
          </h3>
          <p className="text-sm text-muted-foreground">{action.description}</p>

          {action.warning && (
            <Alert variant="warning">
              <AlertDescription>{action.warning}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert variant="danger">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {mode === "biometric" ? (
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={runBiometric}
                disabled={disabled}
              >
                <FingerprintIcon className="h-4 w-4 mr-2" />
                {verifying ? "Verifying…" : "Verify with biometrics"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setLocalError("");
                  setMode("pin");
                }}
                disabled={disabled}
              >
                Use PIN instead
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <Button
                className="w-full"
                onClick={handlePinConfirm}
                disabled={busy}
              >
                {busy ? "Verifying…" : action.confirmLabel}
              </Button>
              {bioSupported && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setLocalError("");
                    setMode("biometric");
                  }}
                  disabled={busy}
                >
                  <FingerprintIcon className="h-4 w-4 mr-2" />
                  Use biometrics instead
                </Button>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={onClose}
            disabled={disabled}
          >
            Cancel
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default ConfirmActionModal;
