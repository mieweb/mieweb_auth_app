import React, { useState, useEffect, useRef } from "react";
import { useDeviceRegistration } from "./hooks/useDeviceRegistration";
import { AppRoutes } from "./components/AppRoutes";
import { openSupportLink } from "../../../../utils/openExternal";
import { Spinner, Button, Card, CardContent } from "@mieweb/ui";

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-background space-y-6">
    <Spinner size="xl" />
    <p className="text-primary font-medium text-lg text-center px-4">
      Checking Device Status ...
    </p>
  </div>
);

const ConnectionError = ({ onRetry }) => {
  return (
    <div className="min-h-screen bg-background flex items-center p-6">
      <Card className="max-w-xs mx-auto">
        <CardContent className="space-y-6">
          <div className="text-center space-y-3">
            <div className="text-red-500 text-5xl">⚠️</div>
            <h1 className="text-2xl font-bold text-foreground">
              Connection Issues
            </h1>
          </div>

          <div className="space-y-4 text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="text-blue-500">1.</div>
              <p>Check your internet connection</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-blue-500">2.</div>
              <p>Refresh the application</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-blue-500">3.</div>
              <p>Manually close and reopen if needed</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-blue-500">4.</div>
              <p>Contact support if unresolved</p>
            </div>
          </div>

          <Button onClick={onRetry} fullWidth>
            ↻ Refresh Now
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <Button variant="link" onClick={() => openSupportLink()}>
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const App = () => {
  const { capturedDeviceUuid, boolRegisteredDevice, isLoading } =
    useDeviceRegistration();
  const [showError, setShowError] = useState(false);
  const loadingRef = useRef(isLoading);

  useEffect(() => {
    loadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loadingRef.current) setShowError(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleRetry = () => window.location.reload();

  return (
    <>
      {showError ? (
        <ConnectionError onRetry={handleRetry} />
      ) : isLoading ? (
        <LoadingState />
      ) : (
        <div className="min-h-screen bg-background">
          <AppRoutes
            isRegistered={boolRegisteredDevice}
            deviceUuid={capturedDeviceUuid}
          />
        </div>
      )}
    </>
  );
};
