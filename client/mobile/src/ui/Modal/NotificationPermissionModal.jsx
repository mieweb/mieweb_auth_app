import React, { useState } from "react";
import { Bell, BellOff, Settings as SettingsIcon } from "lucide-react";
import { Modal, ModalBody, Button } from "@mieweb/ui";
import { requestPushRegistration } from "../../../push-notifications";
import { useNotificationPermission } from "../hooks/useNotificationPermission";

// Blocks the app while OS notifications are off. `isEnabled` is null while a
// system dialog is open, so this only appears once the prompt was denied or dismissed.
const NotificationPermissionModal = () => {
  const { isEnabled, openSettings } = useNotificationPermission();
  // Still off after a re-request means the OS won't prompt again — Settings is the only path.
  const [needsSettings, setNeedsSettings] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState("");

  const handleEnable = () => {
    setNeedsSettings(true);
    requestPushRegistration();
  };

  const handleOpenSettings = async () => {
    setError("");
    setIsOpening(true);
    try {
      await openSettings();
    } catch {
      setError(
        "Couldn't open system settings automatically. Please open your device Settings, find this app, and turn on Notifications.",
      );
    } finally {
      setIsOpening(false);
    }
  };

  if (isEnabled !== false) return null;

  return (
    <Modal
      open
      onOpenChange={() => {}}
      closeOnOverlayClick={false}
      closeOnEscape={false}
      size="sm"
      aria-label="Enable notifications"
    >
      <ModalBody className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 flex items-center justify-center bg-warning/10 rounded-full">
            {needsSettings ? (
              <BellOff className="h-9 w-9 text-warning" />
            ) : (
              <Bell className="h-9 w-9 text-warning" />
            )}
          </div>
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">
          Notifications Required
        </h2>

        {needsSettings ? (
          <>
            <p className="text-muted-foreground mb-3">
              Notifications are turned off for this app. To turn them on:
            </p>
            <ol className="text-sm text-muted-foreground text-left list-decimal pl-5 space-y-1 mb-4">
              <li>Tap Open Settings below.</li>
              <li>Open Notifications and turn on Allow Notifications.</li>
              <li>Return to this app.</li>
            </ol>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <Button
              onClick={handleOpenSettings}
              fullWidth
              isLoading={isOpening}
              loadingText="Opening…"
              leftIcon={<SettingsIcon className="h-4 w-4" />}
            >
              Open Settings
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-4">
              Login approval requests are delivered as push notifications, so
              they must be enabled to use this app.
            </p>
            <Button
              onClick={handleEnable}
              fullWidth
              leftIcon={<Bell className="h-4 w-4" />}
            >
              Enable Notifications
            </Button>
          </>
        )}
      </ModalBody>
    </Modal>
  );
};

export default NotificationPermissionModal;
