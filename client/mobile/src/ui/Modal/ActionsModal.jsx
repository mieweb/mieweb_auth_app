import React, { useState, useEffect } from 'react';
import { Meteor } from 'meteor/meteor';
import { Check, X } from 'lucide-react';
import { TIMEOUT_DURATION_MS } from '../../../../../utils/constants';

const ActionsModal = ({ isOpen, onApprove, onReject, onClose, onTimeOut, notification }) => {
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

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen && notification) {
      const initialTime = calculateInitialTime();
      if (initialTime <= 0) { onTimeOut(); return; }

      setTimeLeft(initialTime);

      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timer); onTimeOut(); return 0; }
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
        className="bg-white dark:bg-[#1c1c1e] rounded-t-2xl w-full animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="actions-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag indicator */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between px-5 pt-1 pb-4">
          <div className="flex items-center space-x-3">
            {/* Inline circular timer */}
            <div className="relative flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 44 44" className="-rotate-90">
                <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="3"
                  stroke="currentColor" className="text-gray-200 dark:text-gray-700" />
                <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="3"
                  strokeLinecap="round" strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset} stroke="currentColor"
                  className={`transition-all duration-1000 ease-linear ${
                    isUrgent ? 'text-red-500' : 'text-blue-500 dark:text-blue-400'
                  }`}
                />
              </svg>
              <span className={`absolute text-xs font-semibold tabular-nums ${
                isUrgent ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'
              }`}>
                {timeLeft}
              </span>
            </div>
            <div>
              <h2 id="actions-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                Action Required
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Confirm or deny this request
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500 active:bg-gray-200 dark:active:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-2 space-y-2.5">
          {/* Approve / Reject side-by-side */}
          <div className="flex space-x-3">
            <button onClick={onApprove}
              className="flex-1 flex items-center justify-center space-x-2 bg-[#34c759] active:bg-[#2da44e] text-white py-4 rounded-xl active:scale-[0.97] transition-all font-semibold text-base"
            >
              <Check className="h-5 w-5" strokeWidth={2.5} />
              <span>Approve</span>
            </button>
            <button onClick={onReject}
              className="flex-1 flex items-center justify-center space-x-2 bg-[#ff3b30] active:bg-[#d63027] text-white py-4 rounded-xl active:scale-[0.97] transition-all font-semibold text-base"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
              <span>Reject</span>
            </button>
          </div>

          {/* Dismiss */}
          <button onClick={onClose}
            className="w-full text-center text-sm font-medium text-gray-400 dark:text-gray-500 py-3 active:text-gray-600 dark:active:text-gray-300 transition-colors"
          >
            Dismiss
          </button>
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