import { useState, useEffect, useCallback } from 'react';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { Tracker } from 'meteor/tracker';

export const useNotificationHandler = (userId, username, fetchNotificationHistory) => {
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const [notificationIdForAction, setNotificationIdForAction] = useState(null);
  const [currentNotificationDetails, setCurrentNotificationDetails] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState(null);

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
    const handleAppResume = () => {
      const pendingNotification = localStorage.getItem('pendingNotification');
      if (pendingNotification) {
        const { appId, notificationId, createdAt } = JSON.parse(pendingNotification);
        Session.set('notificationReceivedId', { appId, status: "pending" });
        setCurrentNotificationDetails({ notificationId, createdAt });
        setNotificationIdForAction(notificationId);
        setIsActionsModalOpen(true);
      }
    };

    document.addEventListener('resume', handleAppResume);
    return () => document.removeEventListener('resume', handleAppResume);
  }, []);

  // Session tracker with cold start handling
  useEffect(() => {
    if (!userId) return;

    const tracker = Tracker.autorun(async () => {
      const notificationData = Session.get("notificationReceivedId");
      
      // Check localStorage first for pending notification from action buttons
      const pendingNotificationStr = localStorage.getItem('pendingNotification');
      if (pendingNotificationStr) {
        try {
          const pendingNotification = JSON.parse(pendingNotificationStr);
          const { appId, notificationId, action } = pendingNotification;
          
          console.log('Found pending notification from localStorage:', pendingNotification);
          
          // If notificationId is available, fetch the specific notification
          if (notificationId) {
            const specificNotification = await Meteor.callAsync(
              "notificationHistory.getByNotificationId",
              notificationId
            );
            
            if (specificNotification && specificNotification.status === 'pending') {
              console.log('Retrieved specific pending notification:', specificNotification);
              setCurrentNotificationDetails(specificNotification);
              setNotificationIdForAction(specificNotification.notificationId);
              setIsActionsModalOpen(true);
              
              // Update session to reflect this notification
              Session.set('notificationReceivedId', {
                appId,
                notificationId,
                status: "pending",
                timestamp: new Date().getTime()
              });
              
              return; // Exit early, we've handled the notification
            }
          }
        } catch (error) {
          console.error("Error handling pending notification from localStorage:", error);
        }
      }
      
      // Fallback to session-based handling if no localStorage data
      if (!notificationData) return;

      // Handle cold start notification
      if (notificationData.coldstart) {
        localStorage.setItem('pendingNotification', JSON.stringify(notificationData));
      }

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
  }, [notificationIdForAction, username, fetchNotificationHistory]);

  // Modal state cleanup
  const handleCloseActionModal = useCallback(() => {
    Session.set('notificationReceivedId', null);
    localStorage.removeItem('pendingNotification');
    setIsActionsModalOpen(false);
    setNotificationIdForAction(null);
    setCurrentNotificationDetails(null);
    setActionError(null);
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