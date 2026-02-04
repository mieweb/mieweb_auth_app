import { useEffect, useCallback } from 'react';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'appWasPaused';
const PAUSE_TIMESTAMP_KEY = 'appPausedTimestamp';
// Threshold in milliseconds - only logout if app was paused for more than this duration
// This prevents logout when tapping notifications (which causes brief pause/resume cycles)
const LOGOUT_THRESHOLD_MS = 2000; // 2 seconds

/**
 * Custom hook to manage user session based on device screen lock
 * Automatically logs out the user when they return to the app after locking their phone.
 * This leverages the device's built-in security (phone lock) instead of arbitrary timeouts.
 * 
 * Now includes protection against false positives from notification taps, which can
 * trigger brief pause/resume cycles without actually backgrounding the app.
 */
export const useSessionTimeout = () => {
  const navigate = useNavigate();

  // Handle logout when app resumes after screen lock
  const handleLogout = useCallback(() => {
    console.log('Logging out user after device screen lock');
    
    // Logout the user
    Meteor.logout((err) => {
      if (err) {
        console.error('Error during automatic logout:', err);
      }
      
      // Clear pause flags (keep lastLoggedInEmail for UX - it's safe and convenient)
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PAUSE_TIMESTAMP_KEY);
      
      // Navigate to login page
      navigate('/login');
    });
  }, [navigate]);

  // Handle app lifecycle events (Cordova pause/resume)
  useEffect(() => {
    // Only set up listeners for Cordova (mobile) apps with logged-in users
    if (!Meteor.isCordova || !Meteor.userId()) {
      return;
    }

    const handlePause = () => {
      console.log('App paused - user locked screen or switched apps');
      // Mark that app went to background and record the timestamp
      const pauseTime = Date.now();
      localStorage.setItem(STORAGE_KEY, 'true');
      localStorage.setItem(PAUSE_TIMESTAMP_KEY, pauseTime.toString());
    };

    const handleResume = () => {
      console.log('App resumed - checking if user should be logged out');
      
      const wasPaused = localStorage.getItem(STORAGE_KEY);
      const pauseTimestamp = localStorage.getItem(PAUSE_TIMESTAMP_KEY);
      
      if (wasPaused === 'true' && pauseTimestamp) {
        const resumeTime = Date.now();
        const pauseDuration = resumeTime - parseInt(pauseTimestamp, 10);
        
        console.log(`App was paused for ${pauseDuration}ms`);
        
        // Only logout if the app was paused for longer than the threshold
        // This prevents logout when tapping notifications (which causes brief pause/resume)
        if (pauseDuration >= LOGOUT_THRESHOLD_MS) {
          console.log('Pause duration exceeds threshold - logging out');
          handleLogout();
        } else {
          console.log('Pause duration below threshold - keeping user logged in (likely notification tap)');
          // Clear the pause flags without logging out
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(PAUSE_TIMESTAMP_KEY);
        }
      }
    };

    // Listen for Cordova lifecycle events
    document.addEventListener('pause', handlePause, false);
    document.addEventListener('resume', handleResume, false);

    return () => {
      document.removeEventListener('pause', handlePause);
      document.removeEventListener('resume', handleResume);
    };
  }, [handleLogout]);

  // Hook doesn't need to return anything as it manages session automatically
  return null;
};
