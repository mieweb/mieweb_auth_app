import React, { useState, useEffect } from 'react';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { User, Mail, Edit, ChevronDown, ExternalLink } from 'lucide-react';
import SuccessToaster from '../Toasters/SuccessToaster';

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
          <input
            type="text"
            name="firstName"
            value={profile.firstName || ""}
            onChange={handleProfileChange}
            className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
            placeholder="First Name"
          />
          <input
            type="text"
            name="lastName"
            value={profile.lastName || ""}
            onChange={handleProfileChange}
            className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
            placeholder="Last Name"
          />
          <div className="flex space-x-2 mt-2">
            <button
              onClick={handleProfileUpdate}
              disabled={isSaving}
              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={toggleEdit}
              disabled={isSaving}
              className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center justify-between">
          {`${profile.firstName || "User"} ${profile.lastName || ""}`}
          <button
            onClick={toggleEdit}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <Edit className="h-4 w-4 text-gray-500" />
          </button>
        </h2>
      )}
      <p className="text-gray-600 dark:text-gray-300 flex items-center">
        <Mail className="h-4 w-4 mr-2" />
        {profile.email}
      </p>
    </div>
  );

  return (
    <div className="lg:col-span-1">
      <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-lg p-6">
        <SuccessToaster
          message={successMessage}
          onClose={() => setSuccessMessage("")}
        />
        <div className="flex items-center space-x-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center">
            <User className="h-8 w-8 text-white" />
          </div>
          {renderProfileSection()}
        </div>

        <div className="space-y-4">
          <AppVersionInfo />

          <CollapsibleSection title="Device Information">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300">Model</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {deviceInfo.model}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300">Platform</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {deviceInfo.platform}
                </span>
              </div>
            </div>
          </CollapsibleSection>

          <div className="border-t dark:border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Activity Summary
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between dark:text-gray-300">
                <span className="text-gray-600 dark:text-gray-300">Today's Activity</span>
                <span>{todaysActivityCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
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
          <span className="text-gray-600 dark:text-gray-300">Version</span>
          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
            {buildInfo.appVersion}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-300">Build</span>
          <a
            href={commitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
          >
            {buildInfo.buildNumber}
            <ExternalLink className="h-3 w-3" />
          </a>
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
    <div className="border-t dark:border-gray-700 pt-4">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center justify-between w-full text-left mb-2 focus:outline-none"
      >
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </h3>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
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
