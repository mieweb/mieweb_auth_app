import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { openSupportLink } from "../../../../utils/openExternal";
import { Clock, ShieldCheck, RefreshCw, Home, LifeBuoy } from "lucide-react";
import { Button, Badge, Alert, AlertDescription } from "@mieweb/ui";

const PendingRegistrationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { message, approvalType } = location.state || {
    message: "Your registration is pending approval.",
    approvalType: "admin",
  };

  const isAdmin = approvalType === "admin";

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-6 bg-card text-card-foreground p-8 rounded-3xl shadow-xl border border-border">
        {/* Header */}
        <div className="text-center space-y-3">
          <div
            className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center ${
              isAdmin ? "bg-warning/10" : "bg-primary/10"
            }`}
          >
            {isAdmin ? (
              <Clock className="h-7 w-7 text-warning" />
            ) : (
              <ShieldCheck className="h-7 w-7 text-primary" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Registration Pending
          </h2>
          <Badge variant="warning" size="sm">
            Awaiting Approval
          </Badge>
        </div>

        {/* Status message */}
        <Alert variant="warning">
          <AlertDescription>
            {message}
            <br />
            <span className="mt-1 text-xs opacity-75">
              {isAdmin
                ? "An administrator will review your request shortly."
                : "Your email verification is being processed."}
            </span>
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => navigate("/login")}
            fullWidth
            leftIcon={<Home className="h-4 w-4" />}
          >
            Return to Home
          </Button>

          <Button
            variant="outline"
            fullWidth
            onClick={handleRefresh}
            isLoading={isRefreshing}
            loadingText="Refreshing…"
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh Status
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onClick={() => openSupportLink()}
            leftIcon={<LifeBuoy className="h-4 w-4" />}
          >
            Contact Support
          </Button>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground text-center">
        If you believe this is an error, please contact our support team.
      </p>
    </div>
  );
};

export default PendingRegistrationPage;
