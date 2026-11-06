import React, { useEffect, useState } from "react";
import { Button } from "@mieweb/ui";
import { Clock } from "lucide-react";
import { formatCountdown } from "../../../utils/adminHelpers";

const TICK_MS = 250;

/** Milliseconds left until `deadline` (epoch ms), re-rendering while it counts down. */
export const useCountdown = (deadline) => {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    // Always resync first so an already-elapsed deadline never renders as active.
    setNow(Date.now());
    if (!deadline || deadline <= Date.now()) return undefined;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) clearInterval(timer);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [deadline]);

  return Math.max(0, (deadline || 0) - now);
};

/**
 * Action button with a server-driven cooldown: shows a spinner while the
 * request runs, then "Resend in mm:ss" with a draining progress bar until the
 * deadline passes, after which it re-enables itself.
 */
export const CooldownButton = ({
  deadline,
  totalMs,
  isLoading,
  onClick,
  children,
  cooldownLabel = "Resend in",
}) => {
  const remaining = useCountdown(deadline);
  const coolingDown = remaining > 0;
  const fraction =
    coolingDown && totalMs ? Math.min(1, remaining / totalMs) : 0;
  const seconds = Math.ceil(remaining / 1000);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      isLoading={isLoading}
      disabled={coolingDown || isLoading}
      aria-label={
        coolingDown ? `${cooldownLabel} ${seconds} seconds` : undefined
      }
      className="relative min-w-[8.75rem] overflow-hidden tabular-nums"
    >
      {coolingDown ? (
        <>
          <Clock className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {cooldownLabel} {formatCountdown(remaining)}
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-0.5 bg-primary/70 transition-[width] duration-300 ease-linear motion-reduce:transition-none"
            style={{ width: `${fraction * 100}%` }}
          />
        </>
      ) : (
        children
      )}
    </Button>
  );
};
