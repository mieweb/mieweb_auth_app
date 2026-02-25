import React, { useState, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { User, Mail, Edit, ChevronDown, ExternalLink } from "lucide-react";
import { Button, Input, Avatar, Card, CardContent } from "@mieweb/ui";
import SuccessToaster from "../Toasters/SuccessToaster";
import { openExternal } from "../../../../../utils/openExternal";

export const ProfileSection = ({
  profile,
  isEditing,
  isSaving,
  successMessage,
  errorMessage,
  handleProfileChange,
  handleProfileUpdate,
  toggleEdit,
  setSuccessMessage,
  todaysActivityCount = 0,
}) => {
  const capturedDeviceInfo = Session.get("capturedDeviceInfo") || {};
  const deviceInfo = {
    model: capturedDeviceInfo.model || "N/A",
    platform: capturedDeviceInfo.platform || "N/A",
  };

  const renderProfileSection = () => (
    <div className="flex-1">
      {isEditing ? (
        <div className="space-y-2">
          <Input
            type="text"
            name="firstName"
            value={profile.firstName || ""}
            onChange={handleProfileChange}
            placeholder="First Name"
          />
          <Input
            type="text"
            name="lastName"
            value={profile.lastName || ""}
            onChange={handleProfileChange}
            placeholder="Last Name"
          />
          <div className="flex space-x-2 mt-2">
            <Button size="sm" onClick={handleProfileUpdate} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={toggleEdit}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <h2 className="text-xl font-semibold text-foreground flex items-center justify-between">
          {`${profile.firstName || "User"} ${profile.lastName || ""}`}
          <button
            onClick={toggleEdit}
            className="p-1 hover:bg-muted rounded-full"
          >
            <Edit className="h-4 w-4 text-muted-foreground" />
          </button>
        </h2>
      )}
      <p className="text-muted-foreground flex items-center">
        <Mail className="h-4 w-4 mr-2" />
        {profile.email}
      </p>
    </div>
  );

  return (
    <div className="lg:col-span-1">
      <Card className="bg-card/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <SuccessToaster
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
          <div className="flex items-center space-x-4 mb-6">
            <Avatar className="h-16 w-16 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-lg flex items-center justify-center">
              {(profile.firstName?.[0] || "U").toUpperCase()}
            </Avatar>
            {renderProfileSection()}
          </div>

          <div className="space-y-4">
            <AppVersionInfo />

            <CollapsibleSection title="Device Information">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium text-foreground">
                    {deviceInfo.model}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="font-medium text-foreground">
                    {deviceInfo.platform}
                  </span>
                </div>
              </div>
            </CollapsibleSection>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Activity Summary
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Today&apos;s Activity</span>
                  <span>{todaysActivityCount}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Displays app version and build number (last main branch commit).
 * Only rendered inside Cordova (mobile apps), hidden on web.
 */
const AppVersionInfo = () => {
  const [buildInfo, setBuildInfo] = useState(null);

  useEffect(() => {
    if (!Meteor.isCordova) return;

    fetch("/buildInfo.json")
      .then((res) => res.json())
      .then((data) => setBuildInfo(data))
      .catch((err) => console.error("Failed to load build info:", err));
  }, []);

  if (!Meteor.isCordova || !buildInfo) return null;

  const commitUrl = `https://github.com/mieweb/mieweb_auth_app/commit/${buildInfo.buildNumber}`;

  return (
    <CollapsibleSection title="App Info" defaultOpen={false}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Version</span>
          <span className="font-mono text-sm font-medium text-foreground">
            {buildInfo.appVersion}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Build</span>
          <button
            type="button"
            onClick={() => {
              const userConfirmed = window.confirm(
                "You will be redirected to GitHub to view this commit.\n\nContinue?",
              );
              if (userConfirmed) {
                openExternal(commitUrl);
              }
            }}
            className="font-mono text-sm font-medium text-primary flex items-center gap-1"
          >
            {buildInfo.buildNumber}
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
};

/**
 * Reusable collapsible section with animated chevron.
 */
const CollapsibleSection = ({ title, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full text-left mb-2 focus:outline-none"
      >
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
};
