import React, { useState, useEffect } from 'react';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { User, Mail, Edit, ChevronDown, ExternalLink } from 'lucide-react';
import SuccessToaster from '../Toasters/SuccessToaster';
import { openExternal } from '../../../../../utils/openExternal';
import { Card, CardContent, Input, Button, Avatar } from '@mieweb/ui';

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
  todaysActivityCount = 0
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
            size="sm"
          />
          <Input
            type="text"
            name="lastName"
            value={profile.lastName || ""}
            onChange={handleProfileChange}
            placeholder="Last Name"
            size="sm"
          />
          <div className="flex space-x-2 mt-2">
            <Button
              onClick={handleProfileUpdate}
              disabled={isSaving}
              size="sm"
              isLoading={isSaving}
              loadingText="Saving..."
            >
              Save
            </Button>
            <Button
              onClick={toggleEdit}
              disabled={isSaving}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <h2 className="text-xl font-semibold text-foreground flex items-center justify-between">
          {`${profile.firstName || "User"} ${profile.lastName || ""}`}
          <Button
            onClick={toggleEdit}
            variant="ghost"
            size="icon"
            aria-label="Edit profile"
          >
            <Edit className="h-4 w-4 text-gray-500" />
          </Button>
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
      <Card>
        <CardContent>
          <SuccessToaster
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
          <div className="flex items-center space-x-4 mb-6">
            <Avatar
              name={`${profile.firstName || "User"} ${profile.lastName || ""}`}
              size="lg"
              fallback={<User className="h-8 w-8 text-white" />}
            />
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
              <div className="flex items-center justify-between text-foreground">
                <span className="text-muted-foreground">Today's Activity</span>
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

    fetch('/buildInfo.json')
      .then(res => res.json())
      .then(data => setBuildInfo(data))
      .catch(err => console.error('Failed to load build info:', err));
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
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              const userConfirmed = window.confirm(
                'You will be redirected to GitHub to view this commit.\n\nContinue?'
              );
              if (userConfirmed) {
                openExternal(commitUrl);
              }
            }}
            className="font-mono text-sm"
            rightIcon={<ExternalLink className="h-3 w-3" />}
          >
            {buildInfo.buildNumber}
          </Button>
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
      <Button
        variant="ghost"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center justify-between w-full text-left mb-2"
        aria-expanded={isOpen}
      >
        <h3 className="text-sm font-medium text-muted-foreground">
          {title}
        </h3>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </Button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
};
