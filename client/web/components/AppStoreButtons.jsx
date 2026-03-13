import React from "react";

const AppleIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.11-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const GooglePlayIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
  </svg>
);

export const APP_STORE_URL =
  "https://apps.apple.com/us/app/mie-auth-open-source/id6756409072";
export const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.mieweb.mieauth";

/**
 * Reusable App Store + Google Play download buttons.
 * @param {'light'|'dark'} variant - 'light' renders white buttons, 'dark' renders dark buttons
 * @param {string} className - additional classes for the wrapper
 */
export const AppStoreButtons = ({ variant = "light", className = "" }) => {
  const isLight = variant === "light";

  const btnClass = isLight
    ? "bg-white hover:bg-gray-100 text-gray-900 shadow-xl shadow-white/10 hover:shadow-white/20 dark:bg-card dark:hover:bg-muted dark:text-foreground"
    : "bg-gray-900 hover:bg-gray-800 text-white shadow-xl shadow-black/10";

  return (
    <div className={`flex flex-col sm:flex-row gap-4 ${className}`}>
      <a
        href={APP_STORE_URL}
        className={`inline-flex items-center gap-3 px-5 py-3 rounded-lg font-semibold transition-all duration-300 no-underline ${btnClass}`}
      >
        <span className="shrink-0">
          <AppleIcon />
        </span>
        <div className="text-left">
          <div className="text-[10px] font-normal opacity-70">
            Download on the
          </div>
          <div className="text-sm font-bold font-sans -mt-0.5">App Store</div>
        </div>
      </a>

      <a
        href={GOOGLE_PLAY_URL}
        className={`inline-flex items-center gap-3 px-5 py-3 rounded-lg font-semibold transition-all duration-300 no-underline ${btnClass}`}
      >
        <span className="shrink-0">
          <GooglePlayIcon />
        </span>
        <div className="text-left">
          <div className="text-[10px] font-normal opacity-70">GET IT ON</div>
          <div className="text-sm font-bold font-sans -mt-0.5">Google Play</div>
        </div>
      </a>
    </div>
  );
};

/**
 * Compact inline store badges for use inside alerts or tight spaces.
 */
export const AppStoreBadges = () => (
  <div className="flex gap-2 shrink-0">
    <a
      href={APP_STORE_URL}
      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm transition-colors no-underline"
    >
      <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.11-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      App Store
    </a>
    <a
      href={GOOGLE_PLAY_URL}
      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm transition-colors no-underline"
    >
      <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
      </svg>
      Google Play
    </a>
  </div>
);
