import React, { useState, useCallback } from "react";
import {
  LogOut,
  Moon,
  Sun,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  Bell,
  BellRing,
  MoreVertical,
  ChevronDown,
  Smartphone,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { openSupportLink } from "../../../../../utils/openExternal";
import { openDiagnostics } from "../../../diagnostics";
import {
  Button,
  AppHeaderDivider,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
} from "@mieweb/ui";
import SuccessToaster from "../Toasters/SuccessToaster";
import {
  useTestNotification,
  TEST_DELAY_OPTIONS,
} from "../hooks/useTestNotification";

export const DashboardHeader = ({
  isDarkMode,
  toggleDarkMode,
  onRefresh,
  onLogout,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  const {
    isSending,
    send: sendTest,
    successMessage,
    errorMessage,
    clearSuccess,
    clearError,
  } = useTestNotification();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showTestOptions, setShowTestOptions] = useState(false);

  // Collapse the test submenu whenever the overflow menu closes so it always
  // reopens in its default (collapsed) state.
  const handleMenuOpenChange = (open) => {
    setMenuOpen(open);
    if (!open) setShowTestOptions(false);
  };

  const handleSendTest = (seconds) => {
    sendTest(seconds);
    handleMenuOpenChange(false);
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 700);
  }, [onRefresh]);

  const iconLabel = "text-[9px] font-medium mt-0.5 leading-tight";
  const iconButton =
    "flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl h-auto";

  return (
    <header className="relative z-50 isolate bg-card shadow-sm sm:sticky sm:top-0">
      {/* Test-notification toasts live at the header root (outside the overflow
          menu) so they persist after the menu closes on selection. */}
      <SuccessToaster message={successMessage} onClose={clearSuccess} />
      <SuccessToaster
        message={errorMessage}
        variant="error"
        onClose={clearError}
      />

      <div className="px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              MIE <span className="text-primary">Auth</span>
            </h2>
          </div>

          {/* Icon group — only the most-used actions stay inline; secondary
              actions are consolidated into the overflow menu to keep the
              header uncluttered. */}
          <div className="flex items-center bg-muted/80 rounded-2xl p-0.5 space-x-0.5">
            <Button
              variant="ghost"
              onClick={handleRefresh}
              aria-label="Refresh"
              className={iconButton}
            >
              <RefreshCw
                className={`h-[18px] w-[18px] text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className={`${iconLabel} text-muted-foreground`}>
                Refresh
              </span>
            </Button>
            <Button
              variant="ghost"
              onClick={toggleDarkMode}
              aria-label="Toggle theme"
              className={iconButton}
            >
              {isDarkMode ? (
                <Sun className="h-[18px] w-[18px] text-amber-500" />
              ) : (
                <Moon className="h-[18px] w-[18px] text-muted-foreground" />
              )}
              <span className={`${iconLabel} text-muted-foreground`}>
                {isDarkMode ? "Light" : "Dark"}
              </span>
            </Button>

            <Dropdown
              open={menuOpen}
              onOpenChange={handleMenuOpenChange}
              placement="bottom-end"
              width={240}
              trigger={
                <Button
                  variant="ghost"
                  aria-label="More options"
                  className={iconButton}
                >
                  <MoreVertical className="h-[18px] w-[18px] text-muted-foreground" />
                  <span className={`${iconLabel} text-muted-foreground`}>
                    More
                  </span>
                </Button>
              }
            >
              <DropdownItem
                icon={<Smartphone className="h-4 w-4" />}
                onClick={() => navigate("/settings/devices")}
              >
                My devices
              </DropdownItem>
              <DropdownItem
                icon={<Bell className="h-4 w-4" />}
                onClick={() => navigate("/settings/notifications")}
              >
                Notification permission
              </DropdownItem>
              <DropdownItem
                icon={<HelpCircle className="h-4 w-4" />}
                onClick={() => openSupportLink()}
              >
                Help &amp; Support
              </DropdownItem>
              <DropdownItem
                icon={<FileText className="h-4 w-4" />}
                onClick={openDiagnostics}
              >
                Diagnostics
              </DropdownItem>

              <DropdownSeparator />
              <DropdownItem
                icon={<BellRing className="h-4 w-4" />}
                aria-expanded={showTestOptions}
                onClick={() => setShowTestOptions((open) => !open)}
              >
                <span className="flex items-center gap-1.5">
                  Test notification
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showTestOptions ? "rotate-180" : ""}`}
                  />
                </span>
              </DropdownItem>
              {showTestOptions &&
                TEST_DELAY_OPTIONS.map(({ label, seconds }) => (
                  <DropdownItem
                    key={seconds}
                    disabled={isSending}
                    onClick={() => handleSendTest(seconds)}
                    className="pl-9 text-muted-foreground"
                  >
                    {label}
                  </DropdownItem>
                ))}
            </Dropdown>

            <AppHeaderDivider className="h-7" />
            <Button
              variant="ghost"
              onClick={onLogout}
              aria-label="Logout"
              className={iconButton}
            >
              <LogOut className="h-[18px] w-[18px] text-destructive" />
              <span className={`${iconLabel} text-destructive`}>Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
