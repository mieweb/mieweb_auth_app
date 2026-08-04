import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { useTracker } from "meteor/react-meteor-data";
import {
  ArrowLeft,
  Check,
  Fingerprint as FingerprintIcon,
  Pencil,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Modal,
  ModalBody,
  Spinner,
} from "@mieweb/ui";
import { DeviceDetails } from "../../../../utils/api/deviceDetails";

const STATUS_BADGES = {
  approved: { variant: "success", label: "Approved" },
  pending: { variant: "warning", label: "Pending" },
  rejected: { variant: "secondary", label: "Rejected" },
};

const formatLastUsed = (device) => {
  const when = device.lastUsed || device.lastUpdated;
  return when ? new Date(when).toLocaleString() : "Never";
};

const deviceLabel = (device) =>
  device.customName || device.deviceModel || "Unknown device";

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
        description: "Confirm it's you to manage your devices",
        disableBackup: true,
      },
      (secret) => resolve({ biometricSecret: secret }),
      (err) =>
        reject(new Error(err?.message || "Biometric verification cancelled.")),
    );
  });

/**
 * Step-up confirmation modal for destructive device actions. The user must
 * verify with biometrics (preferred) or their account PIN before the action
 * is sent to the server.
 */
const ConfirmActionModal = ({ action, busy, error, onClose, onConfirm }) => {
  const [pin, setPin] = useState("");
  const [usePin, setUsePin] = useState(!Session.get("Biometrics"));
  const [localError, setLocalError] = useState("");

  if (!action) return null;

  const handleBiometricConfirm = async () => {
    setLocalError("");
    try {
      const proof = await getBiometricProof();
      onConfirm(proof);
    } catch (err) {
      // Fall back to PIN entry when biometrics fail or are cancelled.
      setLocalError(err.message);
      setUsePin(true);
    }
  };

  const handlePinConfirm = () => {
    setLocalError("");
    if (!pin.trim()) {
      setLocalError("Enter your PIN to continue.");
      return;
    }
    onConfirm({ pin: pin.trim() });
  };

  const message = error || localError;

  return (
    <Modal open onOpenChange={(open) => !open && !busy && onClose()}>
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
            <Alert variant="error">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {usePin ? (
            <div className="space-y-2">
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={busy}
              />
              <Button
                className="w-full"
                onClick={handlePinConfirm}
                disabled={busy}
              >
                {busy ? "Verifying..." : action.confirmLabel}
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={handleBiometricConfirm}
              disabled={busy}
            >
              <FingerprintIcon className="h-4 w-4 mr-2" />
              {busy ? "Verifying..." : "Verify with biometrics"}
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
};

const DeviceManagementPage = () => {
  const navigate = useNavigate();
  const currentUuid = Session.get("capturedDeviceInfo")?.uuid || null;

  const [renamingUuid, setRenamingUuid] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [pageError, setPageError] = useState("");

  const { devices, isLoading } = useTracker(() => {
    const userId = Meteor.userId();
    if (!userId) return { devices: [], isLoading: false };

    const handle = Meteor.subscribe("deviceDetails.byUser", userId);
    const userDoc = DeviceDetails.findOne({ userId });
    return { devices: userDoc?.devices || [], isLoading: !handle.ready() };
  }, []);

  // Current device first, then primary, then most recently used.
  const sortedDevices = [...devices].sort((a, b) => {
    if (a.deviceUUID === currentUuid) return -1;
    if (b.deviceUUID === currentUuid) return 1;
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return (
      new Date(b.lastUsed || b.lastUpdated || 0) -
      new Date(a.lastUsed || a.lastUpdated || 0)
    );
  });

  const wipeLocalAndLogout = () => {
    [
      "biometricsEnabled",
      "biometricUserId",
      "lastLoggedInEmail",
      "pendingNotification",
    ].forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore storage errors
      }
    });
    Meteor.logout(() => window.location.replace("/"));
  };

  const startRename = (device) => {
    setPageError("");
    setRenamingUuid(device.deviceUUID);
    setRenameValue(device.customName || device.deviceModel || "");
  };

  const saveRename = async (device) => {
    setPageError("");
    try {
      await Meteor.callAsync("devices.rename", {
        deviceUUID: device.deviceUUID,
        name: renameValue,
      });
      setRenamingUuid(null);
    } catch (err) {
      setPageError(err.reason || err.message || "Failed to rename device.");
    }
  };

  const setPrimary = async (device) => {
    setPageError("");
    try {
      await Meteor.callAsync("devices.setPrimary", {
        deviceUUID: device.deviceUUID,
      });
    } catch (err) {
      setPageError(err.reason || err.message || "Failed to update device.");
    }
  };

  const requestRevoke = (device) => {
    const isCurrent = device.deviceUUID === currentUuid;
    const isLast = devices.length === 1;
    setActionError("");
    setPendingAction({
      type: "revoke",
      device,
      title: `Remove "${deviceLabel(device)}"?`,
      description:
        "This device will no longer receive authentication requests and will be signed out.",
      warning: isLast
        ? "This is your only device. Removing it deregisters your account entirely — you will need to register again and be re-approved by an administrator."
        : isCurrent
          ? "You are removing the device you are currently using. You will be signed out immediately."
          : "Your other devices will be signed out and will need to sign in again.",
      confirmLabel: "Remove device",
    });
  };

  const requestPendingResponse = (device, approve) => {
    setActionError("");
    setPendingAction({
      type: approve ? "approve" : "reject",
      device,
      title: approve
        ? `Approve "${deviceLabel(device)}"?`
        : `Reject "${deviceLabel(device)}"?`,
      description: approve
        ? "This device will be able to receive and respond to authentication requests for your account."
        : "This device's registration request will be rejected and removed.",
      warning: approve
        ? "Only approve devices you recognize and control. If you don't recognize this device, reject it."
        : null,
      confirmLabel: approve ? "Approve device" : "Reject device",
    });
  };

  const runPendingAction = async (reAuth) => {
    if (!pendingAction || !currentUuid) return;
    setBusy(true);
    setActionError("");
    try {
      if (pendingAction.type === "revoke") {
        const result = await Meteor.callAsync("devices.revoke", {
          deviceUUID: pendingAction.device.deviceUUID,
          actorDeviceUUID: currentUuid,
          reAuth,
        });
        if (
          result.accountRemoved ||
          pendingAction.device.deviceUUID === currentUuid
        ) {
          wipeLocalAndLogout();
          return;
        }
      } else {
        await Meteor.callAsync("devices.approvePending", {
          deviceUUID: pendingAction.device.deviceUUID,
          actorDeviceUUID: currentUuid,
          approve: pendingAction.type === "approve",
          reAuth,
        });
      }
      setPendingAction(null);
    } catch (err) {
      setActionError(err.reason || err.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="relative z-50 bg-card shadow-sm sm:sticky sm:top-0">
        <div className="px-4 py-2.5 flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="p-2 rounded-xl h-auto"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <h2 className="text-base font-bold text-foreground">My Devices</h2>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        <p className="text-xs text-muted-foreground">
          Devices registered to your account. Removing a device requires
          verifying it&apos;s you.
        </p>

        {pageError && (
          <Alert variant="error">
            <AlertDescription>{pageError}</AlertDescription>
          </Alert>
        )}

        {!currentUuid && (
          <Alert variant="warning">
            <AlertDescription>
              Device identity is unavailable, so device actions are disabled.
              Please restart the app and try again.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : sortedDevices.length === 0 ? (
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              No devices are registered to your account.
            </CardContent>
          </Card>
        ) : (
          sortedDevices.map((device) => {
            const isCurrent = device.deviceUUID === currentUuid;
            const status =
              STATUS_BADGES[device.deviceRegistrationStatus] ||
              STATUS_BADGES.rejected;
            const isRenaming = renamingUuid === device.deviceUUID;

            return (
              <Card key={device.deviceUUID}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            maxLength={40}
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            aria-label="Save name"
                            className="p-2 h-auto"
                            onClick={() => saveRename(device)}
                          >
                            <Check className="h-4 w-4 text-emerald-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label="Cancel rename"
                            className="p-2 h-auto"
                            onClick={() => setRenamingUuid(null)}
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {deviceLabel(device)}
                          </h3>
                          {device.isPrimary && (
                            <Star
                              className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500"
                              aria-label="Primary device"
                            />
                          )}
                          <Button
                            variant="ghost"
                            aria-label="Rename device"
                            className="p-1.5 h-auto"
                            onClick={() => startRename(device)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground truncate">
                        {device.devicePlatform || "Unknown platform"}
                        {device.deviceModel && device.customName
                          ? ` · ${device.deviceModel}`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last used: {formatLastUsed(device)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={status.variant} size="sm">
                        {status.label}
                      </Badge>
                      {isCurrent && (
                        <Badge variant="secondary" size="sm">
                          This device
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {device.deviceRegistrationStatus === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={!currentUuid || isCurrent}
                          onClick={() => requestPendingResponse(device, true)}
                        >
                          <ShieldCheck className="h-4 w-4 mr-1.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={!currentUuid || isCurrent}
                          onClick={() => requestPendingResponse(device, false)}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      !device.isPrimary &&
                      device.deviceRegistrationStatus === "approved" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!currentUuid}
                          onClick={() => setPrimary(device)}
                        >
                          <Star className="h-4 w-4 mr-1.5" />
                          Make primary
                        </Button>
                      )
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive ml-auto"
                      disabled={!currentUuid}
                      onClick={() => requestRevoke(device)}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      {pendingAction && (
        <ConfirmActionModal
          action={pendingAction}
          busy={busy}
          error={actionError}
          onClose={() => {
            setPendingAction(null);
            setActionError("");
          }}
          onConfirm={runPendingAction}
        />
      )}
    </div>
  );
};

export default DeviceManagementPage;
