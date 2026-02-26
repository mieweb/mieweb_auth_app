import React from "react";
import {
  Clock,
  AlertTriangle,
  Smartphone,
  ChevronRight,
  Inbox,
} from "lucide-react";
import {
  formatDateTime,
  isNotificationExpired,
} from "../../../../../utils/utils.js";
import { Spinner, Alert, AlertDescription, Badge } from "@mieweb/ui";

export const NotificationList = ({
  notifications,
  isLoading,
  error,
  onNotificationClick,
  isActionsModalOpen,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <Spinner size="md" />
        <p className="mt-3 text-sm">Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" icon={<AlertTriangle className="h-5 w-5" />}>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-muted mb-4">
          <Inbox className="h-8 w-8" />
        </div>
        <p className="font-medium text-foreground">No activity yet</p>
        <p className="text-sm mt-1">
          Authentication requests will appear here.
        </p>
      </div>
    );
  }

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case "approve":
        return "success";
      case "reject":
        return "danger";
      case "timeout":
        return "secondary";
      default:
        return "warning";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "approve":
        return "Approved";
      case "reject":
        return "Rejected";
      case "timeout":
        return "Expired";
      case "pending":
        return "Pending";
      default:
        return status;
    }
  };

  return (
    <div className="divide-y divide-border">
      {notifications.map((notification) => {
        const isPending = notification.status === "pending";
        const isExpired = isNotificationExpired(notification.createdAt);
        const isClickable = isPending && !isActionsModalOpen && !isExpired;
        const displayStatus =
          isPending && isExpired ? "timeout" : notification.status;

        return (
          <div
            key={notification._id}
            className={`flex items-center gap-3 px-2 py-3.5 transition-colors ${
              isClickable
                ? "cursor-pointer hover:bg-muted/50 active:bg-muted"
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
            {/* Status indicator dot */}
            <div
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                displayStatus === "approve"
                  ? "bg-emerald-500"
                  : displayStatus === "reject"
                    ? "bg-rose-500"
                    : displayStatus === "pending"
                      ? "bg-amber-500 animate-pulse"
                      : "bg-muted-foreground"
              }`}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground truncate">
                  {notification.title}
                </h3>
                <Badge
                  variant={getStatusBadgeVariant(displayStatus)}
                  className="shrink-0 text-xs"
                >
                  {getStatusLabel(displayStatus)}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(notification.createdAt)}
                </span>
                {displayStatus !== "pending" &&
                  displayStatus !== "timeout" &&
                  notification.deviceModel &&
                  notification.deviceModel !== "Unknown" && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      {notification.deviceModel}
                    </span>
                  )}
              </div>
              {isClickable && (
                <p className="text-xs text-primary mt-1 font-medium">
                  Tap to approve or reject
                </p>
              )}
            </div>

            {/* Arrow for clickable items */}
            {isClickable && (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
};
