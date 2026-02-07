import React, { useState, useEffect } from 'react';
import { Meteor } from 'meteor/meteor';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { TIMEOUT_DURATION_MS } from '../../../../../utils/constants';

const ActionsModal = ({ isOpen, onApprove, onReject, onClose, onTimeOut, notification }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  const calculateInitialTime = () => {
    if (!notification?.createdAt) return 0;

    let createdAt = notification.createdAt;

    // Convert to number if it's a string
    if (typeof createdAt === 'string' || typeof createdAt === 'object') {
      createdAt = new Date(createdAt).getTime();
    } else if (typeof createdAt === 'number' && createdAt < 1e12) {
      // If it's a Unix timestamp in seconds, convert to milliseconds
      createdAt *= 1000;
    }

    const remainingTime = Math.max(0, Math.floor((createdAt + TIMEOUT_DURATION_MS - Date.now()) / 1000));

    return Math.max(0, remainingTime);
  };

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

    if (isOpen && notification) {
      const initialTime = calculateInitialTime();
      console.log('Initial timer value:', initialTime);

      if (initialTime <= 0) {
        onTimeOut();
        return;
      }

      setTimeLeft(initialTime);

      // Countdown timer
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Status checking
      statusCheckInterval = setInterval(checkStatus, 2000);
    }

    return () => {
      clearInterval(timer);
      clearInterval(statusCheckInterval);
    };
  }, [isOpen, notification, onClose, onTimeOut]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md mx-0 sm:mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Action Required
          </h2>
          <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-full">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">{timeLeft}s</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            Please approve or reject this authentication request
          </p>
        </div>

        {/* Action Buttons - Positioned at bottom for thumb accessibility */}
        <div className="p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onApprove}
            className="w-full flex items-center justify-center space-x-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-6 py-4 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform active:scale-98"
          >
            <CheckCircle className="h-6 w-6" />
            <span>Approve</span>
          </button>

          <button
            onClick={onReject}
            className="w-full flex items-center justify-center space-x-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-6 py-4 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform active:scale-98"
          >
            <XCircle className="h-6 w-6" />
            <span>Reject</span>
          </button>

          <button
            onClick={onClose}
            className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 text-gray-800 dark:text-gray-200 px-6 py-3 rounded-2xl font-medium transition-all duration-200 transform active:scale-98"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionsModal;