/**
 * GitHub support URL for creating new issues.
 */
export const SUPPORT_URL =
  "https://github.com/mieweb/mieweb_auth_app/issues/new";

/**
 * Open a URL in the device's external / system browser (Safari / Chrome).
 * Tries cordova-plugin-inappbrowser with _system target first,
 * then SafariViewController, then plain window.open as a fallback.
 */
export const openExternal = (url) => {
  // cordova-plugin-inappbrowser exposes .open on cordova.InAppBrowser
  const iab =
    (window.cordova && window.cordova.InAppBrowser) || window.InAppBrowser;

  if (iab) {
    // '_system' opens the URL in the device's default browser app
    iab.open(url, "_system");
  } else if (window.SafariViewController) {
    window.SafariViewController.isAvailable((available) => {
      if (available) {
        window.SafariViewController.show({ url });
      } else {
        window.open(url, "_system");
      }
    });
  } else {
    window.open(url, "_blank", "location=yes");
  }
};

/**
 * Show a confirmation popup before opening the GitHub support page.
 * Lets the user know they are being redirected to GitHub.
 */
export const openSupportLink = () => {
  const userConfirmed = window.confirm(
    "You will be redirected to GitHub to create a support issue.\n\nContinue?",
  );
  if (userConfirmed) {
    openExternal(SUPPORT_URL);
  }
};
