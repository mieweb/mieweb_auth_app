import React, { useState, useEffect } from 'react';
import { Meteor } from 'meteor/meteor';
import { Check, X } from 'lucide-react';
import { TIMEOUT_DURATION_MS } from '../../../../../utils/constants';
import { Button, Alert, AlertDescription } from '@mieweb/ui';

const ActionsModal = ({ isOpen, onApprove, onReject, onClose, onTimeOut, notification, isLoading, error }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  const calculateInitialTime = () => {
    if (!notification?.createdAt) return 0;

    let createdAt = notification.createdAt;

    if (typeof createdAt === 'string' || typeof createdAt === 'object') {
      createdAt = new Date(createdAt).getTime();
    } else if (typeof createdAt === 'number' && createdAt < 1e12) {
      createdAt *= 1000;
    }

    return Math.max(0, Math.floor((createdAt + TIMEOUT_DURATION_MS - Date.now()) / 1000));
  };

  const timerProgress = timeLeft > 0 ? (timeLeft / (TIMEOUT_DURATION_MS / 1000)) : 0;

  useEffect(() => {
    let timer;
    let statusCheckInterval;

    const checkStatus = async () => {
      if (!notification?.notificationId) return;
      try {
        const isHandled = await Meteor.callAsync(
          'notificationHistory.isHandled',
          notification.notificationId
        );
        if (isHandled) onClose();
      } catch (error) {
        console.error('Status check error:', error);
      }
    };

    const handleTimeout = async () => {
      if (!notification?.notificationId) {
        onTimeOut();
        return;
      }
      
      try {
        // Mark the notification as timed out
        await Meteor.callAsync(
          'notificationHistory.updateStatus',
          notification.notificationId,
          'timeout'
        );
        console.log('Notification marked as timeout');
      } catch (error) {
        console.error('Failed to update notification status to timeout:', error);
      }
      
      onTimeOut();
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen && notification) {
      const initialTime = calculateInitialTime();

      if (initialTime <= 0) {
        handleTimeout();
        return;
      }

      setTimeLeft(initialTime);

      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      statusCheckInterval = setInterval(checkStatus, 2000);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      clearInterval(timer);
      clearInterval(statusCheckInterval);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, notification, onClose, onTimeOut]);

  if (!isOpen) return null;

  // Circular timer
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - timerProgress);
  const isUrgent = timeLeft <= 10;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-end justify-center z-50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="actions-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag indicator */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between px-5 pt-1 pb-4">
          <div className="flex items-center space-x-3">
            {/* Inline circular timer */}
            <div className="relative flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 44 44" className="-rotate-90">
                <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="3"
                  stroke="currentColor" className="text-muted" />
                <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="3"
                  strokeLinecap="round" strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset} stroke="currentColor"
                  className={`transition-all duration-1000 ease-linear ${
                    isUrgent ? 'text-red-500' : 'text-primary'
                  }`}
                />
              </svg>
              <span className={`absolute text-xs font-semibold tabular-nums ${
                isUrgent ? 'text-red-500' : 'text-muted-foreground'
              }`}>
                {timeLeft}
              </span>
            </div>
            <div>
              <h2 id="actions-modal-title" className="text-lg font-semibold text-foreground leading-tight">
                Action Required
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Confirm or deny this request
              </p>
            </div>
          </div>
          <Button onClick={onClose} aria-label="Close" variant="ghost" size="icon">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-2 space-y-2.5">
          {/* Error message */}
          {error && (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {/* Approve / Reject side-by-side */}
          <div className="flex space-x-3">
            <Button onClick={onApprove}
              disabled={isLoading}
              className="flex-1"
              leftIcon={<Check className="h-5 w-5" strokeWidth={2.5} />}
              isLoading={isLoading}
              loadingText="Processing..."
            >
              Approve
            </Button>
            <Button onClick={onReject}
              disabled={isLoading}
              variant="danger"
              className="flex-1"
              leftIcon={<X className="h-5 w-5" strokeWidth={2.5} />}
            >
              Reject
            </Button>
          </div>

          {/* Dismiss */}
          <Button onClick={onClose}
            variant="ghost"
            fullWidth
            size="sm"
          >
            Dismiss
          </Button>
        </div>

        {/* Safe-area spacer */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0.5rem)' }} />
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }
      `}</style>
    </div>
  );
};

export default ActionsModal;