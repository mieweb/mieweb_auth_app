import { useState, useEffect, useCallback, useRef } from 'react';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';

// Session timeout configuration (30 minutes in milliseconds)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = 'lastActivityTime';

/**
 * Custom hook to manage user session timeout based on inactivity
 * Automatically logs out the user after 30 minutes of inactivity
 */
export const useSessionTimeout = () => {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(true);
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Update last activity time
  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem(STORAGE_KEY, now.toString());
    setIsActive(true);
  }, []);

  // Handle session expiration
  const handleSessionExpired = useCallback(() => {
    console.log('Session expired due to inactivity');
    
    // Clear the timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Logout the user
    Meteor.logout((err) => {
      if (err) {
        console.error('Error during automatic logout:', err);
      }
      
      // Clear local storage items
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('lastLoggedInEmail');
      
      // Navigate to login page
      navigate('/login');
    });
  }, [navigate]);

  // Check if session should expire
  const checkSessionValidity = useCallback(() => {
    const lastActivity = parseInt(localStorage.getItem(STORAGE_KEY) || lastActivityRef.current);
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivity;

    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      handleSessionExpired();
      return false;
    }

    return true;
  }, [handleSessionExpired]);

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Update activity timestamp
    updateActivity();

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      handleSessionExpired();
    }, INACTIVITY_TIMEOUT);
  }, [updateActivity, handleSessionExpired]);

  // Handle user activity events
  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Initialize session timeout management
  useEffect(() => {
    // Only run if user is logged in
    if (!Meteor.userId()) {
      return;
    }

    // Check session validity on mount
    if (!checkSessionValidity()) {
      return;
    }

    // Start the timer
    resetTimer();

    // Activity event listeners for user interaction
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Add event listeners with passive option for better performance
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer, handleActivity, checkSessionValidity]);

  // Handle app lifecycle events (Cordova pause/resume)
  useEffect(() => {
    if (!Meteor.isCordova || !Meteor.userId()) {
      return;
    }

    const handlePause = () => {
      console.log('App paused - storing activity timestamp');
      // Store the current time when app goes to background
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      
      // Clear the timeout while app is in background
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };

    const handleResume = () => {
      console.log('App resumed - checking session validity');
      
      // Check if session should expire based on time in background
      if (!checkSessionValidity()) {
        return; // Session expired, user will be logged out
      }

      // Session is still valid, reset the timer
      resetTimer();
    };

    // Listen for Cordova lifecycle events
    document.addEventListener('pause', handlePause, false);
    document.addEventListener('resume', handleResume, false);

    return () => {
      document.removeEventListener('pause', handlePause);
      document.removeEventListener('resume', handleResume);
    };
  }, [checkSessionValidity, resetTimer]);

  return {
    isActive,
    resetTimer,
    updateActivity
  };
};
