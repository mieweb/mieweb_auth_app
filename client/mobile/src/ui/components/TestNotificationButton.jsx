import React, { useState } from "react";
import { Meteor } from "meteor/meteor";
import { BellRing } from "lucide-react";
import { Button, Card, CardContent } from "@mieweb/ui";
import SuccessToaster from "../Toasters/SuccessToaster";

/**
 * Lets a signed-in user send a push notification to their own approved
 * device(s) to verify that push delivery is working end-to-end.
 */
export const TestNotificationButton = () => {
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSendTest = () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsSending(true);

    Meteor.call("notifications.sendTest", (error, result) => {
      setIsSending(false);
      if (error) {
        setErrorMessage(
          error.reason || "Could not send the test notification.",
        );
        return;
      }
      const count = result?.sent || 0;
      setSuccessMessage(
        `Test notification sent to ${count} device${count === 1 ? "" : "s"}.`,
      );
    });
  };

  return (
    <>
      <SuccessToaster
        message={successMessage}
        onClose={() => setSuccessMessage("")}
      />
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Test push notifications
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send a sample notification to your approved device to confirm
              delivery is working.
            </p>
            {errorMessage && (
              <p className="text-xs text-destructive mt-1">{errorMessage}</p>
            )}
          </div>
          <Button
            onClick={handleSendTest}
            disabled={isSending}
            aria-label="Send test notification"
            className="shrink-0"
          >
            <BellRing className="h-4 w-4 mr-2" />
            {isSending ? "Sending..." : "Send Test"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
};
