import { useState, useEffect, useCallback, useRef } from 'react';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { Tracker } from 'meteor/tracker';

const NOTIFICATION_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export const useNotificationHandler = (userId, fetchNotificationHistory) => {
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const [notificationIdForAction, setNotificationIdForAction] = useState(null);
  const [currentNotificationDetails, setCurrentNotificationDetails] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState(null);
  
  // Ref to track currently displayed notification (for duplicate prevention)
  const displayedNotificationIdRef = useRef(null);

  // Clean up on logout (userId becomes null)
  useEffect(() => {
    if (!userId) {
      setIsActionsModalOpen(false);
      setIsResultModalOpen(false);
      setCurrentAction(null);
      setNotificationIdForAction(null);
      setCurrentNotificationDetails(null);
      setIsProcessingAction(false);
      setActionError(null);
      Session.set('notificationReceivedId', null);
      // Note: Don't clear localStorage here - user might log back in
    }
  }, [userId]);

  const getLatestPendingNotification = useCallback(async () => {
    if (!userId) return null;
    try {
      const latestNotification = await Meteor.callAsync(
        "notificationHistory.getLastIdByUser",
        userId
      );
      return (latestNotification?.status === 'pending') ? latestNotification : null;
    } catch (error) {
      console.error("Error getting latest notification:", error);
      return null;
    }
  }, [userId]);

  // Background notification persistence
  useEffect(() => {
    const handleAppResume = async () => {
      const pendingNotificationStr = localStorage.getItem('pendingNotification');
      if (!pendingNotificationStr || !userId) return;
      
      try {
        const { notificationId, timestamp } = JSON.parse(pendingNotificationStr);
        
        // Check if notification expired
        const now = new Date().getTime();
        if (timestamp && (now - timestamp > NOTIFICATION_EXPIRY_MS)) {
          localStorage.removeItem('pendingNotification');
          return;
        }
        
        // Fetch latest notification details from server
        if (notificationId) {
          const notification = await Meteor.callAsync(
            "notificationHistory.getByNotificationId",
            notificationId
          );
          
          if (notification && notification.status === 'pending') {
            // Prevent duplicate modal if already displaying same notification
            if (displayedNotificationIdRef.current === notification.notificationId) {
              localStorage.removeItem('pendingNotification');
              return;
            }
            
            setCurrentNotificationDetails(notification);
            setNotificationIdForAction(notification.notificationId);
            setIsActionsModalOpen(true);
            displayedNotificationIdRef.current = notification.notificationId;
          } else {
            localStorage.removeItem('pendingNotification');
          }
        }
      } catch (error) {
        console.error('Error on app resume:', error);
        localStorage.removeItem('pendingNotification');
      }
    };

    document.addEventListener('resume', handleAppResume);
    return () => document.removeEventListener('resume', handleAppResume);
  }, [userId]);

  // Session tracker with cold start handling
  useEffect(() => {
    if (!userId) return;

    const tracker = Tracker.autorun(async () => {
      const notificationData = Session.get("notificationReceivedId");
      
      // Check localStorage first for pending notification
      const pendingNotificationStr = localStorage.getItem('pendingNotification');
      
      if (pendingNotificationStr) {
        try {
          const pendingNotification = JSON.parse(pendingNotificationStr);
          const { appId, notificationId, timestamp } = pendingNotification;
          
          // Check if notification is too old (expired after 10 minutes)
          const now = new Date().getTime();
          if (timestamp && (now - timestamp > NOTIFICATION_EXPIRY_MS)) {
            console.log('Notification expired, cleaning up');
            localStorage.removeItem('pendingNotification');
            return;
          }
          
          if (notificationId) {
            const specificNotification = await Meteor.callAsync(
              "notificationHistory.getByNotificationId",
              notificationId
            );
            
            if (specificNotification && specificNotification.status === 'pending') {
              // Prevent duplicate modal if already displaying same notification
              if (displayedNotificationIdRef.current === specificNotification.notificationId) {
                localStorage.removeItem('pendingNotification');
                return;
              }
              
              setCurrentNotificationDetails(specificNotification);
              setNotificationIdForAction(specificNotification.notificationId);
              setIsActionsModalOpen(true);
              displayedNotificationIdRef.current = specificNotification.notificationId;
              
              Session.set('notificationReceivedId', {
                appId,
                notificationId,
                status: "pending",
                timestamp: new Date().getTime()
              });
              
              localStorage.removeItem('pendingNotification');
              return;
            } else {
              // Notification already handled or not found
              console.log('Notification no longer pending or not found');
              localStorage.removeItem('pendingNotification');
            }
          }
        } catch (error) {
          console.error("Error handling pending notification:", error);
          localStorage.removeItem('pendingNotification');
        }
      }
      
      // Fallback to session-based handling if no localStorage data
      if (!notificationData) return;

      // If we have a specific notificationId in session data, use it
      if (notificationData.notificationId) {
        try {
          const specificNotification = await Meteor.callAsync(
            "notificationHistory.getByNotificationId",
            notificationData.notificationId
          );
          
          if (specificNotification && specificNotification.status === 'pending') {
            setCurrentNotificationDetails(specificNotification);
            setNotificationIdForAction(specificNotification.notificationId);
            setIsActionsModalOpen(true);
            // Clear localStorage after successfully handling
            localStorage.removeItem('pendingNotification');
            return;
          }
        } catch (error) {
          console.error("Error fetching specific notification:", error);
        }
      }

      // Fallback: fetch latest pending notification
      try {
        const latestPending = await getLatestPendingNotification();
        if (latestPending) {
          setCurrentNotificationDetails(latestPending);
          setNotificationIdForAction(latestPending.notificationId);
          setIsActionsModalOpen(true);
        }
      } catch (error) {
        console.error("Notification handling error:", error);
      }
    });

    return () => tracker.stop();
  }, [userId, getLatestPendingNotification]);

  // Action handling with improved error states
  const sendUserAction = useCallback(async (action) => {
    if (!notificationIdForAction || !userId) return;

    setIsProcessingAction(true);
    setActionError(null);

    try {
      // Get current device UUID to track which device responded
      const deviceInfo = Session.get('capturedDeviceInfo') || {};
      const deviceUUID = deviceInfo.uuid || null;
      
      const result = await Meteor.callAsync(
        "notifications.handleResponse",
        userId,
        action,
        notificationIdForAction,
        deviceUUID
      );
      
      setIsActionsModalOpen(false);
      
      // Show success modal only for approve
      if (action === 'approve') {
        setIsResultModalOpen(true);
        setTimeout(() => setIsResultModalOpen(false), 3000);
      }
      
      // Force refresh notifications list
      Meteor.setTimeout(fetchNotificationHistory, 500);
    } catch (error) {
      setActionError(`Failed to ${action}: ${error.reason || error.message}`);
    } finally {
      setIsProcessingAction(false);
    }
  }, [notificationIdForAction, userId, fetchNotificationHistory]);

  // Modal state cleanup
  const handleCloseActionModal = useCallback(() => {
    Session.set('notificationReceivedId', null);
    localStorage.removeItem('pendingNotification');
    setIsActionsModalOpen(false);
    setNotificationIdForAction(null);
    setCurrentNotificationDetails(null);
    setActionError(null);
    displayedNotificationIdRef.current = null;
    fetchNotificationHistory();
  }, [fetchNotificationHistory]);

  return {
    isActionsModalOpen,
    isResultModalOpen,
    currentAction,
    notificationDetails: currentNotificationDetails,
    isProcessingAction,
    actionError,
    handleApprove: () => sendUserAction('approve'),
    handleReject: () => sendUserAction('reject'),
    handleCloseResultModal: () => setIsResultModalOpen(false),
    handleCloseActionModal
  };
};