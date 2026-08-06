import React, { useEffect, useState } from "react";
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
  Watch,
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
import SuccessToaster from "./Toasters/SuccessToaster";

const STATUS_BADGES = {
  approved: { variant: "success", label: "Approved" },
  pending: { variant: "warning", label: "Pending" },
  rejected: { variant: "secondary", label: "Rejected" },
};

const isUnknown = (value) =>
  ["", "unknown"].includes((value || "").toString().trim().toLowerCase());

// Official brand glyphs (lucide has no brand icons). Paths from Simple Icons
// (CC0), rendered in currentColor so they follow the tile tint.
const AppleLogo = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
);

const AndroidLogo = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396" />
  </svg>
);

// Normalize a platform string to a known kind so we can pick an icon and
// describe watch support consistently.
const platformKind = (platform) => {
  const p = (platform || "").toLowerCase();
  if (p.includes("ios") || p.includes("iphone") || p.includes("ipad")) {
    return "ios";
  }
  if (p.includes("android")) return "android";
  return "unknown";
};

const PLATFORM_META = {
  ios: {
    Icon: AppleLogo,
    label: "iOS",
    tint: "text-foreground bg-muted",
    watch: "Apple Watch",
  },
  android: {
    Icon: AndroidLogo,
    label: "Android",
    tint: "text-emerald-500 bg-emerald-500/10",
    watch: "Wear OS watch",
  },
  unknown: {
    Icon: Smartphone,
    label: "Unknown platform",
    tint: "text-primary bg-primary/10",
    watch: null,
  },
};

const formatLastUsed = (device) => {
  const when = device.lastUsed || device.lastUpdated;
  return when ? new Date(when).toLocaleString() : "Never";
};

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
 * Step-up confirmation modal for destructive device actions.
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
const ConfirmActionModal = ({ action, busy, error, onClose, onConfirm }) => {
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

const DeviceManagementPage = () => {
  const navigate = useNavigate();
  const capturedInfo = Session.get("capturedDeviceInfo") || null;
  const currentUuid = capturedInfo?.uuid || null;

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

  // Device-trust push received while the app is open (set by
  // push-notifications.js) — shown as a toast since iOS foreground pushes
  // have no OS banner.
  const trustNotice = useTracker(() => Session.get("deviceTrustNotice"), []);

  const approvedCount = devices.filter(
    (d) => d.deviceRegistrationStatus === "approved",
  ).length;

  // Resolve display info for a device. For the CURRENT device we fall back to
  // the live captured OS info when the stored record is missing/"Unknown"
  // (older registrations stored placeholders).
  const resolve = (device) => {
    const isCurrent = device.deviceUUID === currentUuid;

    let platform = device.devicePlatform;
    if (isUnknown(platform) && isCurrent) platform = capturedInfo?.platform;

    let model = device.deviceModel;
    if (isUnknown(model) && isCurrent) model = capturedInfo?.model;

    const kind = platformKind(platform);
    const meta = PLATFORM_META[kind];

    const name =
      device.customName ||
      (!isUnknown(model) ? model : null) ||
      (kind !== "unknown"
        ? `${meta.label} device`
        : isCurrent
          ? "This device"
          : "Unknown device");

    return { isCurrent, kind, meta, name };
  };

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

  const startRename = (device, name) => {
    setPageError("");
    setRenamingUuid(device.deviceUUID);
    setRenameValue(device.customName || name);
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

  const requestSetPrimary = (device, name) => {
    const currentDevice = devices.find((d) => d.deviceUUID === currentUuid);
    const currentIsPrimary =
      currentDevice &&
      currentDevice.deviceRegistrationStatus === "approved" &&
      (currentDevice.isPrimary || approvedCount <= 1);

    setActionError("");
    setPendingAction({
      type: "setPrimary",
      device,
      title: `Make "${name}" your primary device?`,
      description:
        "The primary device receives new-device approval requests for your account.",
      warning: currentIsPrimary
        ? "This device will hand over its primary role. Verify it's you to continue."
        : "Your current primary device will be asked to approve this change — keep it nearby.",
      confirmLabel: "Make primary",
    });
  };

  const requestRevoke = (device, name) => {
    const isCurrent = device.deviceUUID === currentUuid;
    const isLast = devices.length === 1;
    setActionError("");
    setPendingAction({
      type: "revoke",
      device,
      title: `Remove "${name}"?`,
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

  const requestPendingResponse = (device, name, approve) => {
    setActionError("");
    setPendingAction({
      type: approve ? "approve" : "reject",
      device,
      title: approve ? `Approve "${name}"?` : `Reject "${name}"?`,
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
      } else if (pendingAction.type === "setPrimary") {
        // May block for up to ~25s while the current primary device is asked
        // to approve the transfer via an actionable push.
        await Meteor.callAsync("devices.setPrimary", {
          deviceUUID: pendingAction.device.deviceUUID,
          actorDeviceUUID: currentUuid,
          reAuth,
        });
        // The server pushes the confirmation after a short delay so it can
        // land as a visible OS banner — tell the user how to see it.
        Session.set("deviceTrustNotice", {
          message:
            "Primary device updated. A confirmation notification arrives in ~10s — close or background the app to see it.",
          timestamp: new Date().getTime(),
        });
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
      <SuccessToaster
        message={trustNotice?.message || ""}
        onClose={() => Session.set("deviceTrustNotice", null)}
      />
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
          <Alert variant="danger">
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
            const { isCurrent, meta, name } = resolve(device);
            const { Icon } = meta;
            const isApproved = device.deviceRegistrationStatus === "approved";
            const isPending = device.deviceRegistrationStatus === "pending";
            const status =
              STATUS_BADGES[device.deviceRegistrationStatus] ||
              STATUS_BADGES.rejected;
            const isRenaming = renamingUuid === device.deviceUUID;

            // A lone approved device is effectively primary even if the stored
            // flag was never set.
            const isEffectivePrimary =
              isApproved && (device.isPrimary || approvedCount <= 1);
            const canMakePrimary =
              isApproved && !isEffectivePrimary && approvedCount > 1;

            return (
              <Card key={device.deviceUUID}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${meta.tint}`}
                    >
                      <Icon className="h-5 w-5" />
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
                            {name}
                          </h3>
                          <Button
                            variant="ghost"
                            aria-label="Rename device"
                            className="p-1.5 h-auto"
                            onClick={() => startRename(device, name)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground truncate">
                        {meta.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last used: {formatLastUsed(device)}
                      </p>
                      {isApproved && meta.watch && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Watch className="h-3.5 w-3.5" />
                          {meta.watch} notifications supported
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={status.variant} size="sm">
                        {status.label}
                      </Badge>
                      {isEffectivePrimary && (
                        <Badge
                          variant="secondary"
                          size="sm"
                          className="bg-amber-500/15 text-amber-600"
                        >
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          Primary
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="secondary" size="sm">
                          This device
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {isPending ? (
                      <>
                        <Button
                          size="sm"
                          disabled={!currentUuid || isCurrent}
                          onClick={() =>
                            requestPendingResponse(device, name, true)
                          }
                        >
                          <ShieldCheck className="h-4 w-4 mr-1.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={!currentUuid || isCurrent}
                          onClick={() =>
                            requestPendingResponse(device, name, false)
                          }
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      canMakePrimary && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!currentUuid}
                          onClick={() => requestSetPrimary(device, name)}
                        >
                          <Star className="h-4 w-4 mr-1.5" />
                          Make primary
                        </Button>
                      )
                    )}
                    {/* The primary (or only approved) device can never be
                        removed — the account always keeps one trusted device.
                        Transfer the primary role first (approved on the
                        current primary) to remove this device. */}
                    {!isEffectivePrimary && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive ml-auto"
                        disabled={!currentUuid}
                        onClick={() => requestRevoke(device, name)}
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Remove
                      </Button>
                    )}
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
