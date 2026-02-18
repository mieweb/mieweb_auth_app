import React from 'react';
import { Smartphone } from 'lucide-react';
import { Session } from 'meteor/session'; // Needed to get initial device info

export const DeviceSection = () => {
  // Get device info directly from session for simplicity
  // Or could be passed as props if fetched elsewhere
  const capturedDeviceInfo = Session.get("capturedDeviceInfo") || {};
  const deviceInfo = {
    model: capturedDeviceInfo.model || "N/A",
    platform: capturedDeviceInfo.platform || "N/A",
  };

  return (
    <div className="bg-card text-card-foreground shadow-md rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold text-foreground mb-4">Device Information</h2>
      <div className="flex items-center space-x-3 mb-2">
        <Smartphone className="text-primary" size={20} />
        <span className="text-foreground font-medium">Model:</span>
        <span className="text-muted-foreground">{deviceInfo.model}</span>
      </div>
      <div className="flex items-center space-x-3">
        <Smartphone className="text-primary" size={20} />
        <span className="text-foreground font-medium">Platform:</span>
        <span className="text-muted-foreground">{deviceInfo.platform}</span>
      </div>
    </div>
  );
}; 