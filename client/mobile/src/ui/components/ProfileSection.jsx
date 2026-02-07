import React from 'react';
import { Session } from 'meteor/session';
import { User, Mail, Edit } from 'lucide-react';
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
        <div className="space-y-3">
          <input
            type="text"
            name="firstName"
            value={profile.firstName || ""}
            onChange={handleProfileChange}
            className="w-full px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all"
            placeholder="First Name"
          />
          <input
            type="text"
            name="lastName"
            value={profile.lastName || ""}
            onChange={handleProfileChange}
            className="w-full px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all"
            placeholder="Last Name"
          />
          <p className="text-gray-700 dark:text-gray-300 flex items-center text-sm pt-2">
            <Mail className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
            {profile.email}
          </p>
          <div className="flex space-x-2 mt-3">
            <button
              onClick={handleProfileUpdate}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={toggleEdit}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center justify-between mb-1">
            {`${profile.firstName || "User"} ${profile.lastName || ""}`}
            <button
              onClick={toggleEdit}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all active:scale-95"
              aria-label="Edit profile"
            >
              <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </button>
          </h2>
          <p className="text-gray-700 dark:text-gray-300 flex items-center text-sm">
            <Mail className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
            {profile.email}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="lg:col-span-1">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <SuccessToaster
          message={successMessage}
          onClose={() => setSuccessMessage("")}
        />
        <div className="flex items-center space-x-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 flex items-center justify-center shadow-lg">
            <User className="h-8 w-8 text-white" />
          </div>
          {renderProfileSection()}
        </div>

        <div className="space-y-4">
          <div className="border-t dark:border-gray-700 pt-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Device Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/30 p-3 rounded-xl">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Model</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {deviceInfo.model}
                </span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/30 p-3 rounded-xl">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Platform</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {deviceInfo.platform}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t dark:border-gray-700 pt-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Activity Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl">
                <span className="text-gray-700 dark:text-gray-300 font-medium">Today's Activity</span>
                <span className="font-bold text-blue-700 dark:text-blue-300 text-lg">{todaysActivityCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
