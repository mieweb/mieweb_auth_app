import React from "react";
import { useLocation, Link } from "react-router-dom";
import { Clock, ShieldCheck, RefreshCw, HelpCircle } from "lucide-react";
import { Card, CardContent, Button } from "@mieweb/ui";
import { openSupportLink } from "../../../../utils/openExternal";

const PendingRegistrationPage = () => {
  const location = useLocation();
  const { message, approvalType } = location.state || {
    message: "Your registration is pending approval.",
    approvalType: "admin",
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="p-8 space-y-6">
          <h2 className="text-2xl font-bold text-foreground">
            Registration Pending
          </h2>

          <div>
            {approvalType === "admin" ? (
              <Clock className="mx-auto h-16 w-16 text-yellow-500" />
            ) : (
              <ShieldCheck className="mx-auto h-16 w-16 text-blue-500" />
            )}
          </div>

          <p className="text-muted-foreground">{message}</p>

          <p className="text-sm text-muted-foreground">
            {approvalType === "admin"
              ? "An administrator will review your request shortly."
              : "Your email verification is being processed."}
          </p>

          <div className="border-t border-border pt-4 flex flex-col space-y-3">
            <Link to="/login">
              <Button variant="link" className="w-full">
                Return to Home
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Status
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => openSupportLink()}
              className="gap-1"
            >
              <HelpCircle className="h-4 w-4" />
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-8 text-sm text-muted-foreground">
        If you believe this is an error, please contact our support team.
      </p>
    </div>
  );
};

export default PendingRegistrationPage;
