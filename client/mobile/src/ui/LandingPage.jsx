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
import { NotificationList } from "./components/NotificationList";
import Pagination from "./Pagination/Pagination";
import ActionsModal from "./Modal/ActionsModal";
import ResultModal from "./Modal/ResultModal";
import {
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
} from "@mieweb/ui";

export const LandingPage = () => {
  const userProfileData = Session.get("userProfile") || {};
  const userId = userProfileData._id;
  const username = userProfileData.username;

  const navigate = useNavigate();

  const { isDarkMode, toggleDarkMode } = useDarkMode();
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
    filter,
    searchTerm,
    currentPage,
    totalPages,
    todaysActivityCount,
    statusCounts,
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
  } = useNotificationHandler(userId, username);

  const handleTimeout = () => {
    handleCloseActionModal();
  };

  const handleLogout = () => {
    Meteor.logout((err) => {
      if (!err) {
        navigate("/login");
      }
    });
  };

  const firstName = profile.firstName || "User";
  const greeting = getGreeting();

  const stats = [
    {
      label: "Today's Activity",
      value: todaysActivityCount,
      icon: <Activity className="h-5 w-5" />,
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      label: "Pending",
      value: statusCounts?.pending || 0,
      icon: <Clock className="h-5 w-5" />,
      color: "text-amber-500 bg-amber-500/10",
    },
    {
      label: "Approved",
      value: statusCounts?.approve || 0,
      icon: <CheckCircle className="h-5 w-5" />,
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      label: "Rejected",
      value: statusCounts?.reject || 0,
      icon: <XCircle className="h-5 w-5" />,
      color: "text-rose-500 bg-rose-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="MIE Auth"
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Welcome Banner */}
        <div
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white"
          style={{
            background:
              "linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-800) 100%)",
          }}
        >
          <div className="relative z-10">
            <p className="text-primary-100 text-sm font-medium">{greeting}</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">{firstName}</h1>
            <p className="text-primary-200 mt-2 text-sm max-w-lg">
              Manage your authentication requests and keep your account secure.
            </p>
          </div>
          {/* Decorative elements */}
          <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -right-2 -bottom-10 h-32 w-32 rounded-full bg-white/5 blur-xl" />
          <Shield className="absolute right-6 bottom-6 h-20 w-20 text-white/10" />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={`flex items-center justify-center h-10 w-10 rounded-xl ${stat.color}`}
                >
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground leading-none">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {stat.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Column */}
          <div className="lg:col-span-1">
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

          {/* Notifications Column */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-0">
                <Tabs value={filter} onValueChange={handleFilterChange}>
                  <div className="px-4 pt-4 sm:px-6 sm:pt-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
                      <h2 className="text-lg font-semibold text-foreground">
                        Activity History
                      </h2>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type="text"
                          placeholder="Search requests..."
                          value={searchTerm}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          hideLabel
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="px-4 sm:px-6">
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="pending">
                        Pending
                        {statusCounts?.pending > 0
                          ? ` (${statusCounts.pending})`
                          : ""}
                      </TabsTrigger>
                      <TabsTrigger value="approve">Approved</TabsTrigger>
                      <TabsTrigger value="reject">Rejected</TabsTrigger>
                    </TabsList>
                  </div>
                  {/* All tab content shares the same list */}
                  {["all", "pending", "approve", "reject"].map((tab) => (
                    <TabsContent
                      key={tab}
                      value={tab}
                      className="mt-0 px-2 sm:px-4 pb-4"
                    >
                      <NotificationList
                        notifications={notifications}
                        isLoading={isLoadingHistory}
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
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}
