import React, { useState, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import {
  User,
  Mail,
  Edit,
  ChevronDown,
  ExternalLink,
  Smartphone,
  Monitor,
} from "lucide-react";
import SuccessToaster from "../Toasters/SuccessToaster";
import { openExternal } from "../../../../../utils/openExternal";
import {
  Card,
  CardContent,
  Input,
  Button,
  Avatar,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalClose,
  ModalBody,
  ModalFooter,
} from "@mieweb/ui";

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

  const handleSave = async () => {
    await handleProfileUpdate();
  };

  const fullName =
    `${profile.firstName || "User"} ${profile.lastName || ""}`.trim();

  return (
    <div className="lg:col-span-1 space-y-4">
      {/* Profile Card */}
      <Card>
        <CardContent className="p-5">
          <SuccessToaster
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
          <div className="flex flex-col items-center text-center">
            <Avatar
              name={fullName}
              size="xl"
              fallback={<User className="h-10 w-10 text-white" />}
            />
            <div className="mt-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center justify-center gap-1.5">
                {fullName}
                <Button
                  onClick={toggleEdit}
                  variant="ghost"
                  size="icon"
                  aria-label="Edit profile"
                  className="h-7 w-7"
                >
                  <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </h2>
              {profile.email && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5" />
                  {profile.email}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device Info Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Device</h3>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Model</span>
              <span className="font-medium text-foreground">
                {deviceInfo.model}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-medium text-foreground">
                {deviceInfo.platform}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Version (mobile only) */}
      <AppVersionInfo />

      <Modal
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) toggleEdit();
        }}
        size="sm"
      >
        <ModalHeader>
          <ModalTitle>Edit Profile</ModalTitle>
          <ModalClose />
        </ModalHeader>
        <ModalBody>
          {errorMessage && (
            <p className="text-sm text-destructive mb-3">{errorMessage}</p>
          )}
          <div className="space-y-3">
            <Input
              type="text"
              name="firstName"
              value={profile.firstName || ""}
              onChange={handleProfileChange}
              placeholder="First Name"
              label="First Name"
            />
            <Input
              type="text"
              name="lastName"
              value={profile.lastName || ""}
              onChange={handleProfileChange}
              placeholder="Last Name"
              label="Last Name"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={toggleEdit}
            disabled={isSaving}
            variant="secondary"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            isLoading={isSaving}
            loadingText="Saving..."
          >
            Save
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

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
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">App Info</h3>
          <Monitor className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono text-sm font-medium text-foreground">
              {buildInfo.appVersion}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Build</span>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                const userConfirmed = window.confirm(
                  "You will be redirected to GitHub to view this commit.\n\nContinue?",
                );
                if (userConfirmed) {
                  openExternal(commitUrl);
                }
              }}
              className="font-mono text-sm h-auto p-0"
              rightIcon={<ExternalLink className="h-3 w-3" />}
            >
              {buildInfo.buildNumber}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
