import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { CheckCircle, XCircle, Clock, Shield } from 'lucide-react';
import { TIMEOUT_DURATION_MS } from '../../../../utils/constants';

/**
 * ApprovalPage - Handles authentication approval requests without requiring full app login
 * 
 * This page is designed to handle cold-start scenarios where the user taps a push notification
 * while the app is closed. It allows quick response to authentication requests while maintaining
 * security through OS-level biometric authentication.
 * 
 * Security model:
 * - No full app login required to view the approval screen
 * - Biometric/PIN authentication required before approve/deny actions
 * - Device must be registered and approved
 * - Uses OS-level authentication (BiometricPrompt on Android)
 */
export const ApprovalPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [notificationDetails, setNotificationDetails] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionResult, setActionResult] = useState(null);

  // Extract notification details from navigation state or session
  useEffect(() => {
    const loadNotificationDetails = async () => {
      try {
        // Try to get from navigation state first
        let notification = location.state?.notification;
        
        // If not in navigation state, try localStorage (for cold start)
        if (!notification) {
          const pendingNotification = localStorage.getItem('pendingNotification');
          if (pendingNotification) {
            notification = JSON.parse(pendingNotification);
          }
        }

        // If still no notification, try Session
        if (!notification) {
          const sessionNotification = Session.get('notificationReceivedId');
          if (sessionNotification?.appId && sessionNotification?.status === 'pending') {
            // Fetch full details from server
            const deviceInfo = Session.get('capturedDeviceInfo') || {};
            const deviceUUID = deviceInfo.uuid;
            
            if (deviceUUID) {
              const result = await Meteor.callAsync(
                'notificationHistory.getLastIdByDevice',
                deviceUUID
              );
              if (result?.status === 'pending') {
                notification = result;
              }
            }
          }
        }

        if (notification) {
          setNotificationDetails(notification);
          
          // Calculate initial time
          const createdAt = typeof notification.createdAt === 'string' || typeof notification.createdAt === 'object'
            ? new Date(notification.createdAt).getTime()
            : notification.createdAt * (notification.createdAt < 1e12 ? 1000 : 1);
          
          const remainingTime = Math.max(0, Math.floor((createdAt + TIMEOUT_DURATION_MS - Date.now()) / 1000));
          setTimeLeft(remainingTime);
          
          if (remainingTime <= 0) {
            setError('This authentication request has expired.');
          }
        } else {
          setError('No pending authentication request found.');
        }
      } catch (err) {
        console.error('Error loading notification details:', err);
        setError('Failed to load authentication request details.');
      } finally {
        setIsLoading(false);
      }
    };

    loadNotificationDetails();
  }, [location.state]);

  // Countdown timer
  useEffect(() => {
    if (!notificationDetails || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setError('This authentication request has expired.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [notificationDetails, timeLeft]);

  // Check if notification was handled by another device
  useEffect(() => {
    if (!notificationDetails?.notificationId) return;

    const checkStatus = async () => {
      try {
        const isHandled = await Meteor.callAsync(
          'notificationHistory.isHandled',
          notificationDetails.notificationId
        );
        if (isHandled) {
          setActionResult('handled');
          setTimeout(() => navigate('/login'), 2000);
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    };

    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [notificationDetails, navigate]);

  /**
   * Authenticates user using OS-level biometric/PIN authentication
   * Returns true if authentication successful, false otherwise
   */
  const authenticateWithBiometric = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!window.Fingerprint) {
        reject(new Error('Biometric authentication not available'));
        return;
      }

      Fingerprint.show(
        {
          description: 'Authenticate to approve or deny this request',
          disableBackup: false, // Allow PIN fallback
        },
        () => {
          console.log('Biometric authentication successful');
          resolve(true);
        },
        (error) => {
          console.error('Biometric authentication failed:', error);
          reject(error);
        }
      );
    });
  }, []);

  /**
   * Handles approve/deny action with biometric authentication
   */
  const handleAction = useCallback(async (action) => {
    if (!notificationDetails?.notificationId) {
      setError('No notification details available');
      return;
    }

    if (timeLeft <= 0) {
      setError('This authentication request has expired.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Require biometric authentication
      await authenticateWithBiometric();

      // Step 2: Get device info
      const deviceInfo = Session.get('capturedDeviceInfo') || {};
      const deviceUUID = deviceInfo.uuid;

      if (!deviceUUID) {
        throw new Error('Device information not available');
      }

      // Step 3: Send action to server using device UUID
      // The server will look up the user associated with this device
      const result = await Meteor.callAsync(
        'notifications.handleResponseByDevice',
        deviceUUID,
        action,
        notificationDetails.notificationId
      );

      console.log('Action processed successfully:', result);
      
      // Step 4: Clean up and show result
      localStorage.removeItem('pendingNotification');
      Session.set('notificationReceivedId', null);
      
      setActionResult(action);
      
      // Step 5: Navigate to login after brief delay
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: `Authentication ${action === 'approve' ? 'approved' : 'denied'} successfully.` 
          } 
        });
      }, 2000);

    } catch (err) {
      console.error('Action failed:', err);
      
      if (err.message?.includes('cancel') || err.message?.includes('Cancel')) {
        setError('Authentication cancelled. Please try again.');
      } else {
        setError(err.reason || err.message || `Failed to ${action} request`);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [notificationDetails, timeLeft, authenticateWithBiometric, navigate]);

  const handleApprove = () => handleAction('approve');
  const handleReject = () => handleAction('reject');

  const handleClose = () => {
    localStorage.removeItem('pendingNotification');
    Session.set('notificationReceivedId', null);
    navigate('/login');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Loading authentication request...</p>
        </div>
      </div>
    );
  }

  // Action result state
  if (actionResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            {actionResult === 'approve' && (
              <>
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Approved</h2>
                <p className="text-gray-600">Authentication request approved successfully.</p>
              </>
            )}
            {actionResult === 'reject' && (
              <>
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Denied</h2>
                <p className="text-gray-600">Authentication request denied.</p>
              </>
            )}
            {actionResult === 'handled' && (
              <>
                <CheckCircle className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Handled</h2>
                <p className="text-gray-600">This request was handled on another device.</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main approval UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header with timer */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Authentication Request</h1>
          <div className="flex items-center space-x-2 bg-blue-100 rounded-full px-3 py-1">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-blue-600 font-semibold">{timeLeft}s</span>
          </div>
        </div>

        {/* Security notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-yellow-800 font-medium">Security Notice</p>
              <p className="text-xs text-yellow-700 mt-1">
                You'll be asked to authenticate with your fingerprint or PIN before approving or denying this request.
              </p>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Notification details */}
        {notificationDetails && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Request Details</h3>
            <div className="text-sm text-gray-600 space-y-1">
              {notificationDetails.username && (
                <p><span className="font-medium">User:</span> {notificationDetails.username}</p>
              )}
              {notificationDetails.appName && (
                <p><span className="font-medium">Application:</span> {notificationDetails.appName}</p>
              )}
              <p><span className="font-medium">Status:</span> Pending</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={handleApprove}
            disabled={isProcessing || timeLeft <= 0 || !!error}
            className="w-full flex items-center justify-center space-x-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100"
          >
            <CheckCircle className="h-5 w-5" />
            <span>{isProcessing ? 'Processing...' : 'Approve'}</span>
          </button>

          <button
            onClick={handleReject}
            disabled={isProcessing || timeLeft <= 0 || !!error}
            className="w-full flex items-center justify-center space-x-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100"
          >
            <XCircle className="h-5 w-5" />
            <span>{isProcessing ? 'Processing...' : 'Deny'}</span>
          </button>

          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-800 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>

        {/* Info text */}
        <p className="text-xs text-gray-500 text-center mt-6">
          After responding, you'll be directed to log in to access your full account.
        </p>
      </div>
    </div>
  );
};
