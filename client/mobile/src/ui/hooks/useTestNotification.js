import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { useTracker } from "meteor/react-meteor-data";

// Options offered for the test push. A delay lets the user background/close the
// app first so they can verify the system banner (background behavior); an
// immediate send while the app stays open is delivered in-app instead, since
// foreground pushes are routed to the JS handler rather than shown as a banner.
export const TEST_DELAY_OPTIONS = [
  { label: "Send now", seconds: 0 },
  { label: "Send in 5s", seconds: 5 },
  { label: "Send in 10s", seconds: 10 },
  { label: "Send in 30s", seconds: 30 },
];

/**
 * Encapsulates the "send a test push to my own device(s)" behavior so it can be
 * driven from a menu while its toasts are rendered independently (outside any
 * dropdown, so they survive the menu closing on selection).
 */
export const useTestNotification = () => {
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // A test push that arrives while the app is open is delivered straight to the
  // JS notification handler (no OS banner). Surface it as an in-app toast that
  // explains why no banner appeared.
  const foregroundReceipt = useTracker(() =>
    Session.get("testNotificationForeground"),
  );
  useEffect(() => {
    if (!foregroundReceipt) return;
    Session.set("testNotificationForeground", null);
    setSuccessMessage(
      "Test push received. The app was open, so it's shown here in-app — " +
        "the OS only shows a banner when the app is in the background. " +
        "Use a delayed send and close the app to test the banner.",
    );
  }, [foregroundReceipt]);

  const send = (delaySeconds) => {
    if (isSending) return;
    setErrorMessage("");
    setSuccessMessage("");
    setIsSending(true);

    Meteor.call("notifications.sendTest", delaySeconds, (error, result) => {
      setIsSending(false);
      if (error) {
        setErrorMessage(
          error.reason || "Could not send the test notification.",
        );
        return;
      }
      if (result?.scheduled) {
        setSuccessMessage(
          `Test notification will be sent in ${result.delaySeconds}s — ` +
            "close or background the app now to see the system banner.",
        );
        return;
      }
      const count = result?.sent || 0;
      setSuccessMessage(
        `Test notification sent to ${count} device${count === 1 ? "" : "s"}.`,
      );
    });
  };

  return {
    isSending,
    send,
    successMessage,
    errorMessage,
    clearSuccess: () => setSuccessMessage(""),
    clearError: () => setErrorMessage(""),
  };
};
