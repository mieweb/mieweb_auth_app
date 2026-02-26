import React from "react";
import { Session } from "meteor/session";
import { Meteor } from "meteor/meteor";
import { openExternal } from "../../../../utils/openExternal";

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
  User,
  Mail,
  Edit,
  Smartphone,
  Info,
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
  Avatar,
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
    refresh,
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
    Meteor.logout(() => {
      navigate("/login");
    });
  };

  const fullName =
    `${profile.firstName || "User"} ${profile.lastName || ""}`.trim();
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
        onRefresh={refresh}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Welcome Banner + Profile */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white"
          style={{
            background:
              "linear-gradient(135deg, var(--color-primary-600, #4f6daa) 0%, var(--color-primary-800, #2d4373) 100%)",
          }}
        >
          <div className="relative z-10 flex items-center gap-4">
            <Avatar
              name={fullName}
              size="xl"
              fallback={<User className="h-10 w-10 text-white" />}
            />
            <div className="flex-1 min-w-0">
              <p className="text-primary-100 text-xs font-medium">{greeting}</p>
              <h2 className="text-lg sm:text-xl font-bold mt-0.5 flex items-center gap-1.5">
                {fullName}
                <button
                  onClick={toggleEdit}
                  className="inline-flex items-center justify-center h-6 w-6 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Edit profile"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
              </h2>
              <p className="text-primary-200 mt-1 text-xs">
                Manage your authentication requests and keep your account
                secure.
              </p>
            </div>
          </div>
          <DeviceAppBar email={profile.email} />
          <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -right-2 -bottom-10 h-32 w-32 rounded-full bg-white/5 blur-xl" />
          <Shield className="absolute right-6 bottom-6 h-16 w-16 text-white/10" />
        </div>

        {/* Profile Section */}
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

        {/* Notifications */}
        <div className="space-y-4">
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
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
                <div className="px-4 sm:px-6 overflow-x-auto">
                  <TabsList className="w-full min-w-0">
                    <TabsTrigger value="all" className="flex-1 px-2 sm:px-4">
                      All
                    </TabsTrigger>
                    <TabsTrigger
                      value="pending"
                      className="flex-1 px-2 sm:px-4"
                    >
                      Pending
                      {statusCounts?.pending > 0
                        ? ` (${statusCounts.pending})`
                        : ""}
                    </TabsTrigger>
                    <TabsTrigger
                      value="approve"
                      className="flex-1 px-2 sm:px-4"
                    >
                      Approved
                    </TabsTrigger>
                    <TabsTrigger value="reject" className="flex-1 px-2 sm:px-4">
                      Rejected
                    </TabsTrigger>
                  </TabsList>
                </div>
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

function DeviceAppBar({ email }) {
  const capturedDeviceInfo = Session.get("capturedDeviceInfo") || {};
  const model = capturedDeviceInfo.model;
  const platform = capturedDeviceInfo.platform;

  const [buildInfo, setBuildInfo] = React.useState(null);
  React.useEffect(() => {
    if (!Meteor.isCordova) return;
    fetch("/buildInfo.json")
      .then((r) => r.json())
      .then(setBuildInfo)
      .catch(() => {});
  }, []);

  const hasDevice = model || platform;
  const hasApp = Meteor.isCordova && buildInfo;

  if (!hasDevice && !hasApp && !email) return null;

  return (
    <div className="relative z-10 mt-3 pt-2.5 border-t border-white/15 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-primary-200">
      {email && (
        <span className="flex items-center gap-1 truncate">
          <Mail className="h-3 w-3 flex-shrink-0" />
          {email}
        </span>
      )}
      {hasDevice && (
        <span className="flex items-center gap-1">
          <Smartphone className="h-3 w-3" />
          {[model, platform].filter(Boolean).join(" · ")}
        </span>
      )}
      {hasApp && (
        <span className="flex items-center gap-1">
          <Info className="h-3 w-3" />v{buildInfo.appVersion}
          {buildInfo.buildNumber && (
            <span
              className="text-primary-300 underline decoration-dotted cursor-pointer hover:text-white transition-colors"
              onClick={() => {
                const commitUrl = `https://github.com/mieweb/mieweb_auth_app/commit/${buildInfo.buildNumber}`;
                if (
                  window.confirm(
                    "You will be redirected to GitHub to view this commit.\n\nContinue?",
                  )
                ) {
                  openExternal(commitUrl);
                }
              }}
            >
              ({buildInfo.buildNumber})
            </span>
          )}
        </span>
      )}
    </div>
  );
}
