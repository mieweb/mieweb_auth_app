import { useEffect, useCallback } from 'react';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'appWasPaused';

/**
 * Custom hook to manage user session based on device screen lock.
 * When the user returns to the app after screen lock / background,
 * it logs them out and navigates to /login where the lock screen
 * will automatically re-trigger biometric authentication.
 */
export const useSessionTimeout = () => {
  const navigate = useNavigate();

  // Handle logout when app resumes after screen lock
  const handleLogout = useCallback(() => {
    console.log('Session: Logging out after device screen lock – biometric re-auth will trigger on login screen');
    
    Meteor.logout((err) => {
      if (err) {
        console.error('Error during automatic logout:', err);
      }
      
      // Clear pause flag (keep lastLoggedInEmail & biometricUserId for seamless re-auth)
      localStorage.removeItem(STORAGE_KEY);
      
      // Navigate to login – the lock screen will auto-trigger biometrics
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
      // Mark that app went to background
      localStorage.setItem(STORAGE_KEY, 'true');
    };

    const handleResume = () => {
      console.log('App resumed - checking if user should be logged out');
      
      const wasPaused = localStorage.getItem(STORAGE_KEY);
      
      if (wasPaused === 'true') {
        // App was in background (screen was locked), log out the user
        handleLogout();
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
