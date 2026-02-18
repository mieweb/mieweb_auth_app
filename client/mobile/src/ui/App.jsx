import React, { useState, useEffect, useRef } from 'react';
import { useDeviceRegistration } from './hooks/useDeviceRegistration';
import { AppRoutes } from './components/AppRoutes';
import { openSupportLink } from '../../../../utils/openExternal';
import { Spinner, Button, Card, CardContent, Alert, AlertTitle, AlertDescription } from '@mieweb/ui';

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-white space-y-6">
    <Spinner size="xl" />
    <p className="text-blue-700 font-medium text-lg text-center px-4">
    Checking Device Status ...
    </p>
  </div>
);

const ConnectionError = ({ onRetry }) => {
  return (
  <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center p-6">
    <Card className="max-w-xs mx-auto">
      <CardContent className="space-y-6">
        <div className="text-center space-y-3">
          <div className="text-red-500 text-5xl">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800">Connection Issues</h1>
        </div>

        <div className="space-y-4 text-gray-600">
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

        <div className="text-center text-sm text-gray-600">
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
  const { capturedDeviceUuid, boolRegisteredDevice, isLoading } = useDeviceRegistration();
  const [showError, setShowError] = useState(false);
  const loadingRef = useRef(isLoading);

  console.log(' ### Log Step 2 : inside App.jsx,  App component rendering with:', JSON.stringify({ capturedDeviceUuid, boolRegisteredDevice, isLoading }));

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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
          <AppRoutes 
            isRegistered={boolRegisteredDevice} 
            deviceUuid={capturedDeviceUuid} 
          />
        </div>
      )}
    </>
  );
};