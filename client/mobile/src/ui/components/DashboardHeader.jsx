import React from 'react';
import {
  LogOut,
  Moon,
  Sun,
  RotateCcw,
  BellRing,
  Shield,
} from 'lucide-react';

export const DashboardHeader = ({
  title = "My Dashboard",
  isDarkMode,
  toggleDarkMode,
  onRefresh,
  onLogout,
}) => {
  return (
    <header className="bg-white/90 backdrop-blur-md dark:bg-gray-900/90 shadow-lg sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Left: App Branding */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 rounded-xl shadow-md">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {title}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Authentication Hub</p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              title="Refresh"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-200 active:scale-95"
              aria-label="Refresh"
            >
              <RotateCcw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </button>
            <button
              onClick={toggleDarkMode}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 dark:bg-gray-800 hover:bg-amber-100 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95"
              aria-label="Toggle Night Mode"
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 text-amber-500" />
              ) : (
                <Moon className="h-5 w-5 text-indigo-600" />
              )}
            </button>
            <button
              onClick={onLogout}
              title="Logout"
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
