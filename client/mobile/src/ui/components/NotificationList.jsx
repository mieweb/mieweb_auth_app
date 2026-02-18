import React from 'react';
import {
  Clock,
  AlertTriangle,
  Smartphone
} from 'lucide-react';
import { formatDateTime, isNotificationExpired } from '../../../../../utils/utils.js';
import { Spinner, Alert, AlertDescription, Badge, Card, CardContent } from '@mieweb/ui';


export const NotificationList = ({ notifications, isLoading, error, onNotificationClick, isActionsModalOpen }) => {

  if (isLoading) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        <Spinner size="md" />
        <p className="mt-2">Loading history...</p>
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
      <div className="text-center p-8 text-muted-foreground bg-muted/50 rounded-lg mx-2">
        No notification history found.
      </div>
    );
  }

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'approve': return 'success';
      case 'reject': return 'danger';
      case 'timeout': return 'secondary';
      default: return 'warning';
    }
  };

  return (
    <div>
      {notifications.map((notification) => {
        const isPending = notification.status === 'pending';
        const isExpired = isNotificationExpired(notification.createdAt);
        const isClickable = isPending && !isActionsModalOpen && !isExpired;
        
        const displayStatus = (isPending && isExpired) ? 'timeout' : notification.status;
        
        return (
          <Card
            key={notification._id}
            className={`m-2 ${
              isClickable ? 'cursor-pointer hover:shadow-xl transition-all duration-200' : ''
            }`}
            interactive={isClickable}
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
            <CardContent>
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
                      {displayStatus === 'pending' || displayStatus === 'timeout' ? '—' : (notification.deviceModel || 'Unknown')}
                    </p>
                  </div>
                  {isClickable && (
                    <p className="text-xs text-primary mt-2 font-medium">
                      Tap to approve or reject
                    </p>
                  )}
                </div>
                <Badge variant={getStatusBadgeVariant(displayStatus)}>
                  {displayStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  );
}; 