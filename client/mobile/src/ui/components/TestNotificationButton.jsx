import React, { useState } from "react";
import { Meteor } from "meteor/meteor";
import { BellRing } from "lucide-react";
import { Button } from "@mieweb/ui";
import SuccessToaster from "../Toasters/SuccessToaster";

/**
 * Compact utility action (rendered in the dashboard header) that lets a
 * signed-in user send a push notification to their own approved device(s)
 * to verify that push delivery is working end-to-end.
 */
export const TestNotificationButton = () => {
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSendTest = () => {
    if (isSending) return;
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
      <SuccessToaster
        message={errorMessage}
        variant="error"
        onClose={() => setErrorMessage("")}
      />
      <Button
        variant="ghost"
        onClick={handleSendTest}
        disabled={isSending}
        aria-label="Send test notification"
        className="flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl h-auto"
      >
        <BellRing
          className={`h-[18px] w-[18px] text-muted-foreground ${isSending ? "animate-pulse" : ""}`}
        />
        <span className="text-[9px] font-medium mt-0.5 leading-tight text-muted-foreground">
          Test
        </span>
      </Button>
    </>
  );
};
