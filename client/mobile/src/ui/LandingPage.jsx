import React from "react";
import { Session } from "meteor/session";
import { Meteor } from "meteor/meteor";

// Import Hooks
import { useDarkMode } from "./hooks/useDarkMode";
import { useUserProfile } from "./hooks/useUserProfile";
import { useNotificationData } from "./hooks/useNotificationData";
import { useNotificationHandler } from "./hooks/useNotificationHandler";
import { useSessionTimeout } from "./hooks/useSessionTimeout";

// Import Components
import { DashboardHeader } from "./components/DashboardHeader";
import { ProfileSection } from "./components/ProfileSection";
import { NotificationFilters } from "./components/NotificationFilters";
import { NotificationList } from "./components/NotificationList";
import Pagination from "./Pagination/Pagination";
import ActionsModal from "./Modal/ActionsModal";
import ResultModal from "./Modal/ResultModal";
import { Clock } from "lucide-react";
import { useNavigate } from "react-router";

export const LandingPage = () => {
  // Get initial user info from Session (needed by hooks)
  const userProfileData = Session.get("userProfile") || {};
  const userId = userProfileData._id;
  const username = userProfileData.username;

  const navigate = useNavigate();

  // Use Custom Hooks
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  // Session management - automatically logs out when returning to app after screen lock
  useSessionTimeout();

  const {
    profile,
    isEditing,
    isSaving,
    successMessage,
    errorMessage,
    handleProfileChange,
    handleProfileUpdate,
    toggleEdit,
    setSuccessMessage,
  } = useUserProfile();

  const {
    notifications,
    isLoading: isLoadingHistory,
    error: historyError,
    filter,
    searchTerm,
    currentPage,
    totalPages,
    todaysActivityCount,
    fetchNotificationHistory,
    handleFilterChange,
    handleSearchChange,
    handlePageChange,
  } = useNotificationData(userId);

  const {
    isActionsModalOpen,
    isResultModalOpen,
    currentAction,
    notificationDetails,
    isProcessingAction,
    actionError,
    handleApprove,
    handleReject,
    handleCloseResultModal,
    handleCloseActionModal,
    openNotificationModal,
  } = useNotificationHandler(userId, username, fetchNotificationHistory);

  const handleTimeout = async () => {
    handleCloseActionModal();
  };

  // Logout Function
  const handleLogout = () => {
    Meteor.logout((err) => {
      if (err) {
        console.error("Logout failed:", err);
      } else {
        navigate("/login");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="MIEWeb Auth"
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        onRefresh={fetchNotificationHistory}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (Profile & Device) */}
          <div className="lg:col-span-1 space-y-6">
            <ProfileSection
              profile={profile}
              isEditing={isEditing}
              isSaving={isSaving}
              successMessage={successMessage}
              errorMessage={errorMessage}
              handleProfileChange={handleProfileChange}
              handleProfileUpdate={handleProfileUpdate}
              toggleEdit={toggleEdit}
              setSuccessMessage={setSuccessMessage}
              todaysActivityCount={todaysActivityCount}
            />
          </div>

          {/* Right Column (Notifications) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center space-x-2 mx-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">History</h2>
            </div>
            <NotificationFilters
              filter={filter}
              searchTerm={searchTerm}
              onFilterChange={handleFilterChange}
              onSearchChange={handleSearchChange}
            />
            <NotificationList
              notifications={notifications}
              isLoading={isLoadingHistory}
              error={historyError}
              onNotificationClick={openNotificationModal}
              isActionsModalOpen={isActionsModalOpen}
            />
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <ActionsModal
        isOpen={isActionsModalOpen}
        onClose={handleCloseActionModal}
        onApprove={handleApprove}
        onReject={handleReject}
        notification={notificationDetails}
        isLoading={isProcessingAction}
        error={actionError}
        onTimeOut={handleTimeout}
      />
      <ResultModal
        isOpen={isResultModalOpen}
        onClose={handleCloseResultModal}
        action={currentAction}
      />
    </div>
  );
};
