import React from 'react';
import {
  Clock,
  AlertTriangle, // For timeout or error
  Smartphone
} from 'lucide-react';
import { formatDateTime } from '../../../../../utils/utils.js'; // Adjust path


export const NotificationList = ({ notifications, isLoading, error, onNotificationClick, isActionsModalOpen }) => {

  if (isLoading) {
    return (
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
        <svg className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-gray-600 dark:text-gray-400 font-medium">Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-2xl shadow-md border border-red-200 dark:border-red-800">
        <AlertTriangle size={32} className="mx-auto mb-3 text-red-600 dark:text-red-400" />
        <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div className="text-center p-10 bg-gray-50 dark:bg-gray-800/50 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 mx-2">
        <p className="text-gray-600 dark:text-gray-400 font-medium">No notification history found.</p>
      </div>
    );
  }



  return (
    <div>
      {notifications.map((notification) => {
        const isPending = notification.status === 'pending';
        const isClickable = isPending && !isActionsModalOpen;
        
        return (
          <div
            key={notification._id}
            className={`bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-xl border border-gray-200 dark:border-gray-700 p-6 m-2 transition-all duration-200 ${
              isClickable ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:scale-[1.02]' : ''
            }`}
            onClick={() => isClickable && onNotificationClick && onNotificationClick(notification)}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-label={isClickable ? 'Open approval dialog for this notification' : undefined}
            onKeyDown={(e) => {
              if (isClickable && onNotificationClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onNotificationClick(notification);
              }
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {notification.title}
                </h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                    {formatDateTime(notification.createdAt)}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                    <Smartphone className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                    {notification.status === 'pending' ? '—' : (notification.deviceModel || 'Unknown')}
                  </p>
                </div>
                {isClickable && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 font-semibold bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full inline-block">
                    Tap to approve or reject
                  </p>
                )}
              </div>
              <div
                className={`px-4 py-1.5 rounded-full text-sm font-bold capitalize whitespace-nowrap ${notification.status === "approve"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                    : notification.status === "reject"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
                  }`}
              >
                {notification.status}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  );
}; 