import React from "react";
import { Clock, AlertTriangle, Smartphone } from "lucide-react";
import { Spinner, Badge } from "@mieweb/ui";
import {
  formatDateTime,
  isNotificationExpired,
} from "../../../../../utils/utils.js";

const statusVariant = (status) => {
  switch (status) {
    case "approve":
      return "default";
    case "reject":
      return "destructive";
    case "timeout":
      return "secondary";
    default:
      return "outline";
  }
};

export const NotificationList = ({
  notifications,
  isLoading,
  error,
  onNotificationClick,
  isActionsModalOpen,
}) => {
  if (isLoading) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        <Spinner className="h-6 w-6 mx-auto mb-2" />
        Loading history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-6 text-destructive bg-destructive/10 rounded-lg">
        <AlertTriangle size={24} className="mx-auto mb-2" />
        {error}
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground bg-muted/50 rounded-lg mx-2">
        No notification history found.
      </div>
    );
  }

  return (
    <div>
      {notifications.map((notification) => {
        const isPending = notification.status === "pending";
        const isExpired = isNotificationExpired(notification.createdAt);
        const isClickable = isPending && !isActionsModalOpen && !isExpired;

        // Compute the display status - show 'timeout' for expired pending notifications
        const displayStatus =
          isPending && isExpired ? "timeout" : notification.status;

        return (
          <div
            key={notification._id}
            className={`bg-card/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 m-2 ${
              isClickable
                ? "cursor-pointer hover:bg-card hover:shadow-xl transition-all duration-200"
                : ""
            }`}
            onClick={() =>
              isClickable &&
              onNotificationClick &&
              onNotificationClick(notification)
            }
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-label={
              isClickable
                ? "Open approval dialog for this notification"
                : undefined
            }
            onKeyDown={(e) => {
              if (
                isClickable &&
                onNotificationClick &&
                (e.key === "Enter" || e.key === " ")
              ) {
                e.preventDefault();
                onNotificationClick(notification);
              }
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {notification.title}
                </h3>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    {formatDateTime(notification.createdAt)}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Smartphone className="h-4 w-4 mr-2" />
                    {displayStatus === "pending" || displayStatus === "timeout"
                      ? "\u2014"
                      : notification.deviceModel || "Unknown"}
                  </p>
                </div>
                {isClickable && (
                  <p className="text-xs text-primary mt-2 font-medium">
                    Tap to approve or reject
                  </p>
                )}
              </div>
              <Badge variant={statusVariant(displayStatus)}>
                {displayStatus}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
};
