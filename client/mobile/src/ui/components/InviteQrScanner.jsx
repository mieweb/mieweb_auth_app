import React, { useEffect, useMemo, useRef } from "react";
import { Alert, AlertDescription, Button } from "@mieweb/ui";

const QR_FRAME_SIZE = 220;

const stopScanner = async (scanner) => {
  if (!scanner) {
    return;
  }

  try {
    if (typeof scanner.stop === "function" && scanner.isScanning) {
      await scanner.stop();
    }
  } finally {
    if (typeof scanner.clear === "function") {
      try {
        await Promise.resolve(scanner.clear());
      } catch {}
    }
  }
};

export const InviteQrScanner = ({ onScan, onError, onClose }) => {
  const scannerRef = useRef(null);
  const hasScannedRef = useRef(false);
  const elementId = useMemo(
    () => `invite-qr-reader-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  useEffect(() => {
    let isDisposed = false;

    const initializeScanner = async () => {
      // Request permissions properly on Android
      if (
        typeof window.cordova !== "undefined" &&
        window.cordova.platformId === "android" &&
        window.cordova.plugins?.permissions
      ) {
        try {
          const permissions = window.cordova.plugins.permissions;
          await new Promise((resolve, reject) => {
            permissions.checkPermission(
              permissions.CAMERA,
              (status) => {
                if (status.hasPermission) {
                  resolve();
                } else {
                  permissions.requestPermission(
                    permissions.CAMERA,
                    (status) => {
                      if (status.hasPermission) {
                        resolve();
                      } else {
                        reject(new Error("Camera permission denied"));
                      }
                    },
                    reject,
                  );
                }
              },
              reject,
            );
          });
          // Resolves either true or gracefully errors down to catch
        } catch {
          if (!isDisposed) {
            onError(
              "Camera access denied or unavailable. Enable camera permission for MIE Auth and try again.",
            );
          }
          return;
        }
      }

      try {
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.enumerateDevices
        ) {
          throw new Error("Camera streaming not supported by the browser.");
        }

        const { Html5Qrcode, Html5QrcodeSupportedFormats } =
          await import("html5-qrcode");

        if (isDisposed) {
          return;
        }

        const scanner = new Html5Qrcode(elementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });

        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: QR_FRAME_SIZE, height: QR_FRAME_SIZE },
          },
          (decodedText) => {
            if (hasScannedRef.current) {
              return;
            }

            hasScannedRef.current = true;
            onScan(decodedText);
          },
          () => {},
        );
      } catch (error) {
        if (!isDisposed) {
          const message =
            typeof error === "string" ? error : error?.message || "";

          if (
            message.includes("NotAllowedError") ||
            message.includes("Permission") ||
            message.includes("NotReadableError") ||
            message.includes("Could not start video source")
          ) {
            onError(
              "Camera access denied or unavailable. Enable camera permission for MIE Auth and try again.",
            );
          } else if (
            message.includes("NotFoundError") ||
            message.includes("no camera")
          ) {
            onError(
              "No camera found on this device. Please paste the invite link instead.",
            );
          } else {
            onError(
              message ||
                "Unable to start the QR scanner. Please paste the invite link instead.",
            );
          }
        }
      }
    };

    initializeScanner();

    return () => {
      isDisposed = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      void stopScanner(scanner);
    };
  }, [elementId, onError, onScan]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div
          id={elementId}
          className="min-h-[280px] overflow-hidden rounded-xl"
        />
      </div>

      <Alert>
        <AlertDescription>
          Point your camera at the invite QR code from the manager portal or
          email.
        </AlertDescription>
      </Alert>

      <Button type="button" variant="outline" fullWidth onClick={onClose}>
        Close scanner
      </Button>
    </div>
  );
};

export default InviteQrScanner;
