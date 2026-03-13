import React, { useState, useCallback } from "react";
import {
  LogOut,
  Moon,
  Sun,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { openSupportLink } from "../../../../../utils/openExternal";
import { Button, AppHeaderDivider } from "@mieweb/ui";

export const DashboardHeader = ({
  isDarkMode,
  toggleDarkMode,
  onRefresh,
  onLogout,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 700);
  }, [onRefresh]);

  const iconLabel = "text-[9px] font-medium mt-0.5 leading-tight";

  return (
    <header className="sticky top-0 z-10 bg-card shadow-sm">
      <div className="px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              MIE <span className="text-primary">Auth</span>
            </h2>
          </div>

          {/* Icon group */}
          <div className="flex items-center bg-muted/80 rounded-2xl p-0.5 space-x-0.5">
            <Button
              variant="ghost"
              onClick={handleRefresh}
              aria-label="Refresh"
              className="flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl h-auto"
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
              className="flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl h-auto"
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
            <Button
              variant="ghost"
              onClick={() => openSupportLink()}
              aria-label="Support"
              className="flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl h-auto"
            >
              <HelpCircle className="h-[18px] w-[18px] text-muted-foreground" />
              <span className={`${iconLabel} text-muted-foreground`}>Help</span>
            </Button>
            <AppHeaderDivider className="h-7" />
            <Button
              variant="ghost"
              onClick={onLogout}
              aria-label="Logout"
              className="flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl h-auto"
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
