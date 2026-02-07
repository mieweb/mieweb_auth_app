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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl p-6 w-full mx-0 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Action Required
          </h2>
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-full">
            <Clock className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">{timeLeft}s</span>
          </div>
        </div>

        <div className="space-y-5 flex-1 flex flex-col justify-end">
          <button
            onClick={onApprove}
            className="w-full flex items-center justify-center space-x-3 bg-green-600 text-white px-6 py-6 rounded-2xl hover:bg-green-700 active:scale-98 transition-all text-xl font-semibold shadow-lg"
          >
            <CheckCircle className="h-8 w-8" />
            <span>Approve</span>
          </button>

          <button
            onClick={onReject}
            className="w-full flex items-center justify-center space-x-3 bg-red-600 text-white px-6 py-6 rounded-2xl hover:bg-red-700 active:scale-98 transition-all text-xl font-semibold shadow-lg"
          >
            <XCircle className="h-8 w-8" />
            <span>Reject</span>
          </button>

          <button
            onClick={onClose}
            className="w-full bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-6 py-5 rounded-2xl hover:bg-gray-400 dark:hover:bg-gray-600 active:scale-98 transition-all text-lg font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionsModal;