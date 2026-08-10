import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCircle2,
  RefreshCw,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Badge,
  Alert,
  AlertDescription,
} from "@mieweb/ui";
import { useNotificationPermission } from "./hooks/useNotificationPermission";

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { isEnabled, recheck, openSettings } = useNotificationPermission();
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState("");

  // Always reflect the latest OS-level state when the screen opens. The app
  // also re-checks on `resume`, so returning from the system settings screen
  // updates this view automatically.
  useEffect(() => {
    recheck();
  }, [recheck]);

  const enabled = isEnabled === true;
  const disabled = isEnabled === false;
  const unknown = isEnabled === null || isEnabled === undefined;

  const handleOpenSettings = async () => {
    setError("");
    setIsOpening(true);
    try {
      await openSettings();
    } catch {
      setError(
        "Couldn't open system settings automatically. Please open your device Settings, find MIE Auth, and turn on Notifications.",
      );
    } finally {
      setIsOpening(false);
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
          <h2 className="text-base font-bold text-foreground">
            Notification Settings
          </h2>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-5">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  enabled ? "bg-emerald-500/10" : "bg-amber-500/10"
                }`}
              >
                {enabled ? (
                  <Bell className="h-6 w-6 text-emerald-500" />
                ) : (
                  <BellOff className="h-6 w-6 text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  Push Notifications
                </h3>
                <p className="text-xs text-muted-foreground">
                  Required to receive authentication approval requests
                </p>
              </div>
              {enabled && (
                <Badge variant="success" size="sm">
                  Enabled
                </Badge>
              )}
              {disabled && (
                <Badge variant="warning" size="sm">
                  Disabled
                </Badge>
              )}
              {unknown && (
                <Badge variant="secondary" size="sm">
                  Unknown
                </Badge>
              )}
            </div>

            {enabled && (
              <Alert variant="success">
                <AlertDescription className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Notifications are on. You&apos;ll receive authentication
                    approval requests on this device.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {disabled && (
              <>
                <Alert variant="warning">
                  <AlertDescription>
                    Notifications are turned off for MIE Auth. Without them you
                    won&apos;t receive authentication approval requests. Enable
                    notifications in your device settings to continue using the
                    app.
                  </AlertDescription>
                </Alert>

                {error && <p className="text-sm text-destructive">{error}</p>}

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
            )}

            {unknown && (
              <Alert variant="info">
                <AlertDescription>
                  Notification status is only available in the mobile app.
                </AlertDescription>
              </Alert>
            )}

            <Button
              variant="secondary"
              fullWidth
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => recheck()}
            >
              Re-check status
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NotificationSettings;
