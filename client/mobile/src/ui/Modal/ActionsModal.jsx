import React, { useState, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { Check, X, ShieldCheck, Clock } from "lucide-react";
import { TIMEOUT_DURATION_MS } from "../../../../../utils/constants";

const ActionsModal = ({
  isOpen,
  onApprove,
  onReject,
  onClose,
  onTimeOut,
  notification,
  isLoading,
  error,
}) => {
  const [timeLeft, setTimeLeft] = useState(0);

  const calculateInitialTime = () => {
    if (!notification?.createdAt) return 0;

    let createdAt = notification.createdAt;

    if (typeof createdAt === "string" || typeof createdAt === "object") {
      createdAt = new Date(createdAt).getTime();
    } else if (typeof createdAt === "number" && createdAt < 1e12) {
      createdAt *= 1000;
    }

    return Math.max(
      0,
      Math.floor((createdAt + TIMEOUT_DURATION_MS - Date.now()) / 1000),
    );
  };

  const totalSeconds = TIMEOUT_DURATION_MS / 1000;
  const timerProgress = timeLeft > 0 ? timeLeft / totalSeconds : 0;

  useEffect(() => {
    let timer;
    let statusCheckInterval;

    const checkStatus = async () => {
      if (!notification?.notificationId) return;
      try {
        const isHandled = await Meteor.callAsync(
          "notificationHistory.isHandled",
          notification.notificationId,
        );
        if (isHandled) onClose();
      } catch (error) {
        console.error("Status check error:", error);
      }
    };

    const handleTimeout = async () => {
      if (!notification?.notificationId) {
        onTimeOut();
        return;
      }

      try {
        await Meteor.callAsync(
          "notificationHistory.updateStatus",
          notification.notificationId,
          "timeout",
        );
      } catch (error) {
        console.error(
          "Failed to update notification status to timeout:",
          error,
        );
      }

      onTimeOut();
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen && notification) {
      const initialTime = calculateInitialTime();

      if (initialTime <= 0) {
        handleTimeout();
        return;
      }

      setTimeLeft(initialTime);

      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      statusCheckInterval = setInterval(checkStatus, 2000);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      clearInterval(timer);
      clearInterval(statusCheckInterval);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, notification, onClose, onTimeOut]);

  if (!isOpen) return null;

  const isUrgent = timeLeft <= 10;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0
      ? `${m}:${String(s).padStart(2, "0")}`
      : `0:${String(s).padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl w-full max-w-[340px] shadow-2xl animate-modal-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="actions-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-8 pb-6">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                isUrgent ? "bg-destructive/10" : "bg-primary/10"
              }`}
            >
              <ShieldCheck
                className={`h-8 w-8 ${
                  isUrgent ? "text-destructive" : "text-primary"
                }`}
              />
            </div>
          </div>

          {/* Title */}
          <h2
            id="actions-modal-title"
            className="text-xl font-bold text-foreground text-center leading-snug"
          >
            {notification?.title || "Verification Request"}
          </h2>

          {/* Body — only if present */}
          {notification?.body && (
            <p className="text-[13px] text-muted-foreground mt-2 text-center leading-relaxed">
              {notification.body}
            </p>
          )}

          {/* Timer bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <Clock
                  className={`h-3.5 w-3.5 ${isUrgent ? "text-destructive" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-xs font-medium ${isUrgent ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {isUrgent ? "Expiring soon" : "Expires in"}
                </span>
              </div>
              <span
                className={`text-xs font-bold tabular-nums ${
                  isUrgent ? "text-destructive" : "text-foreground/70"
                }`}
              >
                {formatTime(timeLeft)}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                  isUrgent ? "bg-destructive" : "bg-primary"
                }`}
                style={{ width: `${timerProgress * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mb-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2.5">
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 bg-[#34c759] active:bg-[#2da44e] dark:bg-[#30b350] dark:active:bg-[#2a9d46] text-white py-[14px] rounded-[14px] active:scale-[0.98] transition-all font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-green-600/20 dark:shadow-green-500/10"
          >
            <Check className="h-5 w-5" strokeWidth={2.5} />
            <span>{isLoading ? "Processing..." : "Approve"}</span>
          </button>

          <button
            onClick={onReject}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 bg-[#ff3b30] active:bg-[#d63027] dark:bg-[#e8342a] dark:active:bg-[#c42d24] text-white py-[14px] rounded-[14px] active:scale-[0.98] transition-all font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-red-600/20 dark:shadow-red-500/10"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
            <span>Deny</span>
          </button>

          <button
            onClick={onClose}
            className="w-full text-center text-[13px] font-medium text-muted-foreground py-1.5 active:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-modal-in {
          animation: modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
};

export default ActionsModal;
