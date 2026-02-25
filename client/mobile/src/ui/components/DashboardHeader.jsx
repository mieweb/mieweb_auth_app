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

export const DashboardHeader = ({
  title = "My Dashboard",
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

  const iconBtn =
    "flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl active:scale-95 transition-all duration-150";
  const iconLabel = "text-[9px] font-medium mt-0.5 leading-tight";

  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl">
      <div className="px-4 py-2.5">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold text-foreground">
              MIEWeb<span className="text-primary">Auth</span>
            </h1>
          </div>

          {/* Icon group */}
          <div className="flex items-center bg-muted/80 rounded-2xl p-0.5 space-x-0.5">
            <button
              onClick={handleRefresh}
              className={iconBtn}
              aria-label="Refresh"
            >
              <RefreshCw
                className={`h-[18px] w-[18px] text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className={`${iconLabel} text-muted-foreground`}>
                Refresh
              </span>
            </button>
            <button
              onClick={toggleDarkMode}
              className={iconBtn}
              aria-label="Toggle theme"
            >
              {isDarkMode ? (
                <Sun className="h-[18px] w-[18px] text-amber-500" />
              ) : (
                <Moon className="h-[18px] w-[18px] text-muted-foreground" />
              )}
              <span className={`${iconLabel} text-muted-foreground`}>
                {isDarkMode ? "Light" : "Dark"}
              </span>
            </button>
            <button
              onClick={() => openSupportLink()}
              className={iconBtn}
              aria-label="Support"
            >
              <HelpCircle className="h-[18px] w-[18px] text-muted-foreground" />
              <span className={`${iconLabel} text-muted-foreground`}>Help</span>
            </button>
            <div className="w-px h-7 bg-border mx-0.5" />
            <button onClick={onLogout} className={iconBtn} aria-label="Logout">
              <LogOut className="h-[18px] w-[18px] text-destructive" />
              <span className={`${iconLabel} text-destructive`}>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
