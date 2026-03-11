import React, { useEffect, useMemo, useRef } from "react";
import { Meteor } from "meteor/meteor";
import { Alert, AlertDescription, Button } from "@mieweb/ui";

const QR_FRAME_SIZE = 220;

const callbackToPromise = (register) =>
  new Promise((resolve, reject) => {
    register((error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });

const getFriendlyScannerError = (error) => {
  switch (error?.name) {
    case "CAMERA_ACCESS_DENIED":
      return "Camera access was denied. Enable camera permission for MIE Auth and try again.";
    case "CAMERA_ACCESS_RESTRICTED":
      return "Camera access is restricted on this device.";
    case "BACK_CAMERA_UNAVAILABLE":
    case "FRONT_CAMERA_UNAVAILABLE":
    case "CAMERA_UNAVAILABLE":
      return "No supported camera is available for scanning on this device. Please paste the invite link instead.";
    case "SCAN_CANCELED":
      return "QR scanning was cancelled.";
    default:
      return (
        error?._message ||
        error?.message ||
        "Unable to start the QR scanner. Please paste the invite link instead."
      );
  }
};

const SCANNER_CLASS = "qr-scanner-active";

const setNativeScannerActive = (active) => {
  if (typeof document === "undefined") {
    return;
  }

  if (active) {
    document.documentElement.classList.add(SCANNER_CLASS);
  } else {
    document.documentElement.classList.remove(SCANNER_CLASS);
  }
};

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

const stopNativeScanner = (scanner) => {
  if (!scanner) {
    setNativeScannerActive(false);
    return;
  }

  try {
    scanner.cancelScan?.(() => {});
  } catch {}

  try {
    scanner.hide?.(() => {});
  } catch {}

  try {
    scanner.destroy?.(() => {});
  } catch {}

  setNativeScannerActive(false);
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
      if (Meteor.isCordova && window?.QRScanner) {
        const nativeScanner = window.QRScanner;
        scannerRef.current = nativeScanner;

        try {
          const status = await callbackToPromise((done) =>
            nativeScanner.prepare((error, preparedStatus) =>
              done(error, preparedStatus),
            ),
          );

          if (isDisposed) {
            stopNativeScanner(nativeScanner);
            return;
          }

          if (!status?.authorized) {
            if (
              status?.denied &&
              typeof nativeScanner.openSettings === "function"
            ) {
              stopNativeScanner(nativeScanner);
              onError(
                "Camera access was denied. Enable camera permission for MIE Auth in Settings and try again.",
              );
              return;
            }

            stopNativeScanner(nativeScanner);
            onError("Camera access is required to scan an invite QR code.");
            return;
          }

          setNativeScannerActive(true);

          await callbackToPromise((done) =>
            nativeScanner.show((showStatus) => done(null, showStatus)),
          );

          nativeScanner.scan((error, result) => {
            if (isDisposed) {
              stopNativeScanner(nativeScanner);
              return;
            }

            if (error) {
              if (error.name !== "SCAN_CANCELED") {
                onError(getFriendlyScannerError(error));
              }
              stopNativeScanner(nativeScanner);
              return;
            }

            stopNativeScanner(nativeScanner);
            onScan(result);
          });

          return;
        } catch (error) {
          if (!isDisposed) {
            onError(getFriendlyScannerError(error));
          }
          stopNativeScanner(nativeScanner);
          return;
        }
      }

      try {
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
            aspectRatio: 1,
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
          onError(
            error?.message ||
              "Unable to start the QR scanner. Please paste the invite link instead.",
          );
        }
      }
    };

    initializeScanner();

    return () => {
      isDisposed = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (Meteor.isCordova && typeof scanner?.cancelScan === "function") {
        stopNativeScanner(scanner);
        return;
      }

      void stopScanner(scanner);
    };
  }, [elementId, onError, onScan]);

  return (
    <div
      className={
        Meteor.isCordova ? "fixed inset-0 z-50 bg-transparent" : "space-y-4"
      }
    >
      {!Meteor.isCordova && (
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div
            id={elementId}
            className="min-h-[280px] overflow-hidden rounded-xl"
          />
        </div>
      )}

      {Meteor.isCordova ? (
        <div className="absolute inset-x-0 top-0 z-10 space-y-4 p-4 pointer-events-none">
          <Alert className="pointer-events-auto bg-black/75 border-white/10 text-white backdrop-blur-sm">
            <AlertDescription>
              The camera scanner is opening. Point it at the invite QR code from
              the manager portal or email.
            </AlertDescription>
          </Alert>

          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={onClose}
            className="pointer-events-auto bg-black/55 backdrop-blur-sm"
          >
            Close scanner
          </Button>
        </div>
      ) : (
        <>
          <Alert>
            <AlertDescription>
              Point your camera at the invite QR code from the manager portal or
              email.
            </AlertDescription>
          </Alert>

          <Button type="button" variant="outline" fullWidth onClick={onClose}>
            Close scanner
          </Button>
        </>
      )}
    </div>
  );
};

export default InviteQrScanner;
