import React, { useEffect, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Session } from "meteor/session";
import { useTracker } from "meteor/react-meteor-data";
import { BellRing } from "lucide-react";
import { Button } from "@mieweb/ui";
import SuccessToaster from "../Toasters/SuccessToaster";

const DELAY_OPTIONS = [
  { label: "Send now", seconds: 0 },
  { label: "Send in 5s", seconds: 5 },
  { label: "Send in 10s", seconds: 10 },
  { label: "Send in 30s", seconds: 30 },
];

/**
 * Compact utility action (rendered in the dashboard header) that lets a
 * signed-in user send a push notification to their own approved device(s)
 * to verify that push delivery is working end-to-end.
 *
 * Tapping the button opens a small menu to send the test push immediately or
 * after a short delay. The delay lets the user background/close the app first
 * so they can verify the system banner (background behavior); an immediate
 * send while the app stays open is delivered in-app instead, since foreground
 * pushes are routed to the JS handler rather than shown as an OS banner.
 */
export const TestNotificationButton = () => {
  const [isSending, setIsSending] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const menuRef = useRef(null);

  // A test push that arrives while the app is open is delivered straight to
  // the JS notification handler (no OS banner). Surface it as an in-app toast
  // that explains why no banner appeared.
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

  // Close the menu when tapping anywhere outside it.
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  const handleSendTest = (delaySeconds) => {
    if (isSending) return;
    setIsMenuOpen(false);
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
      <div className="relative" ref={menuRef}>
        <Button
          variant="ghost"
          onClick={() => setIsMenuOpen((open) => !open)}
          disabled={isSending}
          aria-label="Send test notification"
          aria-expanded={isMenuOpen}
          className="flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl h-auto"
        >
          <BellRing
            className={`h-[18px] w-[18px] text-muted-foreground ${isSending ? "animate-pulse" : ""}`}
          />
          <span className="text-[9px] font-medium mt-0.5 leading-tight text-muted-foreground">
            Test
          </span>
        </Button>
        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-border bg-background shadow-lg py-1">
            {DELAY_OPTIONS.map(({ label, seconds }) => (
              <button
                key={seconds}
                type="button"
                onClick={() => handleSendTest(seconds)}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                {label}
                {seconds > 0 && (
                  <span className="block text-[10px] text-muted-foreground">
                    Close the app to see the banner
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
