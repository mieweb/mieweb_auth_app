import React, { useState } from "react";
import { Meteor } from "meteor/meteor";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Input,
  Button,
  Alert,
  AlertDescription,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalClose,
  ModalBody,
} from "@mieweb/ui";
import { PIN_PATTERN } from "../../../../utils/constants";

const PIN_INPUT_PROPS = {
  type: "password",
  required: true,
  maxLength: 6,
  minLength: 4,
  pattern: "[0-9]*",
  inputMode: "numeric",
  autoComplete: "off",
};

/**
 * Lets a user finish an admin-issued PIN reset with their temporary PIN, or
 * notify their administrator that they need one. There is no self-service reset.
 */
export const ResetPinModal = ({ initialEmail, onClose, onSuccess }) => {
  const [email, setEmail] = useState(initialEmail || "");
  const [tempPin, setTempPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const isBusy = isSubmitting || isNotifying;

  const ensureConnected = () => {
    if (Meteor.status().connected) return true;
    setError("No connection. Please check your network.");
    return false;
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    if (!PIN_PATTERN.test(newPin)) {
      setError("New PIN must be 4 to 6 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PINs do not match.");
      return;
    }
    if (newPin === tempPin) {
      setError("Your new PIN must be different from the temporary PIN.");
      return;
    }
    if (!ensureConnected()) return;

    setIsSubmitting(true);
    try {
      await Meteor.callAsync("users.resetPinWithTemporary", {
        email: email.trim(),
        tempPin,
        newPin,
      });
      onSuccess();
    } catch (err) {
      setError(err.reason || "Could not reset your PIN. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleNotify = async () => {
    setError("");
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    if (!ensureConnected()) return;

    setIsNotifying(true);
    try {
      await Meteor.callAsync("users.requestPinReset", { email: email.trim() });
      setNotified(true);
    } catch (err) {
      setError(
        err.reason || "Could not notify your administrator. Please try again.",
      );
    } finally {
      setIsNotifying(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !isBusy) onClose();
      }}
      size="sm"
    >
      <ModalHeader>
        <ModalTitle>Reset PIN</ModalTitle>
        <ModalClose />
      </ModalHeader>
      <ModalBody className="space-y-5">
        {error && (
          <Alert variant="danger" icon={<AlertCircle className="h-4 w-4" />}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleReset} className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Have a temporary PIN?
          </h3>
          <Input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            label="Email"
            autoComplete="email"
            disabled={isBusy}
          />
          <Input
            id="reset-temp-pin"
            {...PIN_INPUT_PROPS}
            value={tempPin}
            onChange={(e) => setTempPin(e.target.value)}
            label="Temporary PIN"
            disabled={isBusy}
          />
          <Input
            id="reset-new-pin"
            {...PIN_INPUT_PROPS}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            label="New PIN"
            placeholder="4 to 6 digits"
            autoComplete="new-password"
            disabled={isBusy}
          />
          <Input
            id="reset-confirm-pin"
            {...PIN_INPUT_PROPS}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            label="Confirm New PIN"
            autoComplete="new-password"
            disabled={isBusy}
          />
          <Button
            type="submit"
            fullWidth
            disabled={isBusy}
            isLoading={isSubmitting}
            loadingText="Updating PIN…"
          >
            Set New PIN
          </Button>
        </form>

        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">
            Don&apos;t have one?
          </h3>
          <p className="text-sm text-muted-foreground">
            Contact your administrator to reset your PIN.
          </p>
          {notified && (
            <Alert
              variant="success"
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              <AlertDescription>
                If this account exists, your administrator has been notified.
              </AlertDescription>
            </Alert>
          )}
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={handleNotify}
            disabled={isBusy || notified}
            isLoading={isNotifying}
            loadingText="Notifying…"
          >
            Notify My Administrator
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
};
