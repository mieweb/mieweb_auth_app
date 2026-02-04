/**
 * Initialize the status bar for Android devices
 * Ensures the app UI does not overlap with system status bar and camera cutouts
 */
export const initializeStatusBar = () => {
  if (window.StatusBar) {
    console.log('Initializing StatusBar plugin');
    
    // Ensure status bar does not overlay the webview
    window.StatusBar.overlaysWebView(false);
    
    // Set status bar background color to match the app
    window.StatusBar.backgroundColorByHexString('#ffffff');
    
    // Use default (dark) text for status bar
    window.StatusBar.styleDefault();
    
    console.log('StatusBar plugin initialized successfully');
  } else {
    console.log('StatusBar plugin not available - running in browser or plugin not installed');
  }
};
