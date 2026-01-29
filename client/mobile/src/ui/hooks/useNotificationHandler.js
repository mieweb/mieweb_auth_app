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
      if (!notificationData) return;

      // Handle cold start notification
      if (notificationData.coldstart) {
        localStorage.setItem('pendingNotification', JSON.stringify(notificationData));
      }

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

  // Manually open modal for a specific notification
  const openNotificationModal = useCallback((notification) => {
    // Guard checks
    if (!notification) {
      console.warn('Cannot open modal: notification is null or undefined');
      return;
    }
    
    if (notification.status !== 'pending') {
      return;
    }
    
    // Set notification details in state
    setCurrentNotificationDetails(notification);
    setNotificationIdForAction(notification.notificationId);
    setIsActionsModalOpen(true);
    
    // Persist to localStorage for app resume consistency
    if (notification.appId && notification.notificationId && notification.createdAt) {
      localStorage.setItem('pendingNotification', JSON.stringify({
        appId: notification.appId,
        notificationId: notification.notificationId,
        createdAt: notification.createdAt
      }));
    }
    
    // Note: We intentionally do NOT set Session.set('notificationReceivedId') here
    // to avoid triggering the Tracker.autorun which would fetch the latest notification
    // and potentially replace the manually selected one
  }, []);

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
    handleCloseActionModal,
    openNotificationModal
  };
};