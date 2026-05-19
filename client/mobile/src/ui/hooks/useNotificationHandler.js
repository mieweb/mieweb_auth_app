import { useState, useEffect, useCallback, useRef } from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { Tracker } from "meteor/tracker";
import { isNotificationExpired } from "../../../../../utils/utils.js";

export const useNotificationHandler = (userId, username) => {
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const [notificationIdForAction, setNotificationIdForAction] = useState(null);
  const [currentNotificationDetails, setCurrentNotificationDetails] =
    useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState(null);
  const resultModalTimeoutRef = useRef(null);

  const scheduleResultModalAutoClose = useCallback(() => {
    if (resultModalTimeoutRef.current) {
      clearTimeout(resultModalTimeoutRef.current);
    }
    resultModalTimeoutRef.current = setTimeout(() => {
      setIsResultModalOpen(false);
      resultModalTimeoutRef.current = null;
    }, 3000);
  }, []);

  // Clear any pending auto-close timer on unmount to avoid setting state on
  // an unmounted component.
  useEffect(() => {
    return () => {
      if (resultModalTimeoutRef.current) {
        clearTimeout(resultModalTimeoutRef.current);
        resultModalTimeoutRef.current = null;
      }
    };
  }, []);

  const getLatestPendingNotification = useCallback(async () => {
    if (!userId) return null;
    try {
      const latestNotification = await Meteor.callAsync(
        "notificationHistory.getLastIdByUser",
        userId,
      );
      return latestNotification?.status === "pending"
        ? latestNotification
        : null;
    } catch {
      return null;
    }
  }, [userId]);

  // Background notification persistence
  useEffect(() => {
    const handleAppResume = () => {
      // Skip modal restoration when an action is being processed from the
      // notification tray — the action handler will resolve the notification
      // server-side without any user interaction.
      if (Session.get("actionPerformedFromTray")) return;

      const pendingNotification = localStorage.getItem("pendingNotification");
      if (pendingNotification) {
        const { appId, notificationId, createdAt } =
          JSON.parse(pendingNotification);
        Session.set("notificationReceivedId", { appId, status: "pending" });
        setCurrentNotificationDetails({ notificationId, createdAt });
        setNotificationIdForAction(notificationId);
        setIsActionsModalOpen(true);
      }
    };

    document.addEventListener("resume", handleAppResume);
    return () => document.removeEventListener("resume", handleAppResume);
  }, []);

  // Session tracker with cold start handling
  useEffect(() => {
    if (!userId) return;

    const tracker = Tracker.autorun(async () => {
      const notificationData = Session.get("notificationReceivedId");
      if (!notificationData) return;

      // Skip if an action is being processed from the notification tray.
      // The tray handler will call notifications.handleResponse directly.
      if (Session.get("actionPerformedFromTray")) return;

      // Handle cold start notification
      if (notificationData.coldstart) {
        localStorage.setItem(
          "pendingNotification",
          JSON.stringify(notificationData),
        );
      }

      try {
        const latestPending = await getLatestPendingNotification();
        if (latestPending) {
          setCurrentNotificationDetails(latestPending);
          setNotificationIdForAction(latestPending.notificationId);
          setIsActionsModalOpen(true);
        }
      } catch {
        // Silently handled — reactive tracker will retry
      }
    });

    return () => tracker.stop();
  }, [userId, getLatestPendingNotification]);

  // React to tray-initiated actions: show the result modal on success or fall
  // back to opening the actions modal on failure so the user can retry.
  useEffect(() => {
    if (!userId) return;

    const tracker = Tracker.autorun(() => {
      const result = Session.get("trayActionResult");
      if (!result) return;

      // Clear immediately so this only fires once
      Session.set("trayActionResult", null);

      if (result.status === "approved") {
        setIsResultModalOpen(true);
        scheduleResultModalAutoClose();
      } else if (result.status === "error") {
        // Action failed silently — surface the modal so the user can retry
        setActionError(
          `Failed to ${result.action}: ${result.error || "Unknown error"}`,
        );
        getLatestPendingNotification().then((latestPending) => {
          if (latestPending) {
            setCurrentNotificationDetails(latestPending);
            setNotificationIdForAction(latestPending.notificationId);
            setIsActionsModalOpen(true);
          }
        });
      }
      // status === "rejected": no UI feedback needed, real-time subscription updates the list
    });

    return () => tracker.stop();
  }, [userId, getLatestPendingNotification, scheduleResultModalAutoClose]);

  // Action handling with improved error states
  const sendUserAction = useCallback(
    async (action) => {
      if (!notificationIdForAction || !userId) return;

      setIsProcessingAction(true);
      setActionError(null);

      try {
        // Get current device UUID to track which device responded
        const deviceInfo = Session.get("capturedDeviceInfo") || {};
        const deviceUUID = deviceInfo.uuid || null;

        await Meteor.callAsync(
          "notifications.handleResponse",
          userId,
          action,
          notificationIdForAction,
          deviceUUID,
        );

        setIsActionsModalOpen(false);
        if (action === "approve") {
          setIsResultModalOpen(true);
          scheduleResultModalAutoClose();
        }

        // Subscription handles real-time updates automatically
      } catch (error) {
        setActionError(`Failed to ${action}: ${error.reason || error.message}`);
      } finally {
        setIsProcessingAction(false);
      }
    },
    [notificationIdForAction, userId, scheduleResultModalAutoClose],
  );

  // Modal state cleanup
  const handleCloseActionModal = useCallback(() => {
    Session.set("notificationReceivedId", null);
    localStorage.removeItem("pendingNotification");
    setIsActionsModalOpen(false);
    setNotificationIdForAction(null);
    setCurrentNotificationDetails(null);
    setActionError(null);
  }, []);

  // Manually open modal for a specific notification
  const openNotificationModal = useCallback((notification) => {
    // Guard checks
    if (!notification) {
      return;
    }

    if (notification.status !== "pending") {
      return;
    }

    // Check if notification is expired
    if (isNotificationExpired(notification.createdAt)) {
      // Mark as timed out
      Meteor.callAsync(
        "notificationHistory.updateStatus",
        notification.notificationId,
        "timeout",
      )
        .then(() => {})
        .catch(() => {});
      return;
    }

    // Set notification details in state
    setCurrentNotificationDetails(notification);
    setNotificationIdForAction(notification.notificationId);
    setIsActionsModalOpen(true);

    // Persist to localStorage for app resume consistency
    if (
      notification.appId &&
      notification.notificationId &&
      notification.createdAt
    ) {
      localStorage.setItem(
        "pendingNotification",
        JSON.stringify({
          appId: notification.appId,
          notificationId: notification.notificationId,
          createdAt: notification.createdAt,
        }),
      );
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
    handleApprove: () => sendUserAction("approve"),
    handleReject: () => sendUserAction("reject"),
    handleCloseResultModal: () => {
      if (resultModalTimeoutRef.current) {
        clearTimeout(resultModalTimeoutRef.current);
        resultModalTimeoutRef.current = null;
      }
      setIsResultModalOpen(false);
    },
    handleCloseActionModal,
    openNotificationModal,
  };
};
