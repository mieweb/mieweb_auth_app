import React, { useState, useEffect, useRef } from "react";
import { useDeviceRegistration } from "./hooks/useDeviceRegistration";
import { AppRoutes } from "./components/AppRoutes";
import { openSupportLink } from "../../../../utils/openExternal";
import { Spinner, Button, Card, CardContent } from "@mieweb/ui";
import { AlertTriangle, RefreshCw } from "lucide-react";

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-background space-y-6">
    <Spinner className="h-12 w-12" />
    <p className="text-primary font-medium text-lg text-center px-4">
      Checking Device Status...
    </p>
  </div>
);

const ConnectionError = ({ onRetry }) => {
  return (
    <div className="min-h-screen bg-background flex items-center p-6">
      <Card className="max-w-xs mx-auto">
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">
              Connection Issues
            </h1>
          </div>

          <div className="space-y-4 text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="text-primary">1.</div>
              <p>Check your internet connection</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-primary">2.</div>
              <p>Refresh the application</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-primary">3.</div>
              <p>Manually close and reopen if needed</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-primary">4.</div>
              <p>Contact support if unresolved</p>
            </div>
          </div>

          <Button onClick={onRetry} className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Now
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <button
              onClick={() => openSupportLink()}
              className="text-primary hover:underline font-medium"
            >
              Contact Support
            </button>
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
