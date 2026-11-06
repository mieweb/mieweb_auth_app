import React, { useEffect } from "react";
import { Alert, AlertDescription } from "@mieweb/ui";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const DURATION_MS = { success: 4000, danger: 7000 };

const Toast = ({ id, message, variant, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), DURATION_MS[variant] || 5000);
    return () => clearTimeout(timer);
  }, [id, variant, onDismiss]);

  const Icon = variant === "danger" ? AlertTriangle : CheckCircle2;
  return (
    <Alert
      role={variant === "danger" ? "alert" : "status"}
      variant={variant}
      icon={<Icon className="h-4 w-4" />}
      dismissible
      onDismiss={() => onDismiss(id)}
      className="pointer-events-auto w-full max-w-sm animate-slide-up shadow-lg motion-reduce:animate-none"
    >
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
};

export const Toaster = ({ toasts, onDismiss }) => (
  <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
    {toasts.map((toast) => (
      <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
    ))}
  </div>
);
