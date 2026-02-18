import React from 'react';
import {
  LogOut,
  Moon,
  Sun,
  RotateCcw,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { openSupportLink } from '../../../../../utils/openExternal';
import { Button } from '@mieweb/ui';

export const DashboardHeader = ({
  title = "My Dashboard",
  isDarkMode,
  toggleDarkMode,
  onRefresh,
  onLogout,
}) => {
  return (
    <header className="bg-card/80 backdrop-blur-sm shadow-lg sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              {title}
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="icon"
              aria-label="Refresh"
              title="Refresh"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              onClick={toggleDarkMode}
              variant="ghost"
              size="icon"
              aria-label="Toggle Night Mode"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4 text-yellow-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={() => openSupportLink()}
              variant="ghost"
              size="icon"
              aria-label="Support"
              title="Support"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button
              onClick={onLogout}
              variant="danger"
              size="icon"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
