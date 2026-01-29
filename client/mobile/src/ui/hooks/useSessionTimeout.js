import { useState, useEffect, useCallback, useRef } from 'react';
import { Meteor } from 'meteor/meteor';
import { useNavigate } from 'react-router-dom';

// Session timeout configuration (30 minutes in milliseconds)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = 'lastActivityTime';
const ACTIVITY_UPDATE_THROTTLE = 10000; // Only update localStorage every 10 seconds

/**
 * Custom hook to manage user session timeout based on inactivity
 * Automatically logs out the user after 30 minutes of inactivity
 */
export const useSessionTimeout = () => {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const lastStorageUpdateRef = useRef(Date.now());

  // Update last activity time (throttled for localStorage writes)
  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    
    // Only update localStorage if enough time has passed (throttle writes)
    if (now - lastStorageUpdateRef.current >= ACTIVITY_UPDATE_THROTTLE) {
      localStorage.setItem(STORAGE_KEY, now.toString());
      lastStorageUpdateRef.current = now;
    }
  }, []);

  // Handle session expiration
  const handleSessionExpired = useCallback(() => {
    // Double-check if session is actually expired before logging out
    const lastActivity = lastActivityRef.current;
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivity;

    if (timeSinceLastActivity < INACTIVITY_TIMEOUT) {
      // User was active recently, don't log out
      return;
    }

    console.log('Session expired due to inactivity');
    
    // Clear the timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Logout the user
    Meteor.logout((err) => {
      if (err) {
        console.error('Error during automatic logout:', err);
        // Even if server logout fails, we should still clear local state
        // to prevent security issues
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
    const storedTime = localStorage.getItem(STORAGE_KEY);
    
    // If no stored time exists and this is a fresh session, it's valid
    if (!storedTime) {
      const now = Date.now();
      localStorage.setItem(STORAGE_KEY, now.toString());
      lastActivityRef.current = now;
      return true;
    }

    const lastActivity = parseInt(storedTime);
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivity;

    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      handleSessionExpired();
      return false;
    }

    // Update ref with stored time
    lastActivityRef.current = lastActivity;
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

  // Handle user activity events (stable reference)
  const handleActivityRef = useRef(() => {});
  useEffect(() => {
    handleActivityRef.current = () => {
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
    };
  }, [updateActivity, handleSessionExpired]);

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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    updateActivity();
    timeoutRef.current = setTimeout(() => {
      handleSessionExpired();
    }, INACTIVITY_TIMEOUT);

    // Activity event listeners for user interaction
    // Removed mousemove for performance, kept meaningful interactions
    const events = [
      'mousedown',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    const handleActivity = () => handleActivityRef.current();

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
    // Run only once on mount when user is logged in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle app lifecycle events (Cordova pause/resume)
  useEffect(() => {
    if (!Meteor.isCordova || !Meteor.userId()) {
      return;
    }

    const handlePause = () => {
      console.log('App paused - storing activity timestamp');
      // Store the last activity time (not current time) when app goes to background
      const lastActivity = lastActivityRef.current;
      localStorage.setItem(STORAGE_KEY, lastActivity.toString());
      
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      updateActivity();
      timeoutRef.current = setTimeout(() => {
        handleSessionExpired();
      }, INACTIVITY_TIMEOUT);
    };

    // Listen for Cordova lifecycle events
    document.addEventListener('pause', handlePause, false);
    document.addEventListener('resume', handleResume, false);

    return () => {
      document.removeEventListener('pause', handlePause);
      document.removeEventListener('resume', handleResume);
    };
    // Run only once on mount for Cordova
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hook doesn't need to return anything as it manages session automatically
  return null;
};
