import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  QrCode,
  Link as LinkIcon,
  UserPlus,
  ScanLine,
  ArrowRight,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
} from "@mieweb/ui";
import {
  getInviteRegistrationPath,
  extractInviteToken,
} from "../../deep-links";

const hasBarcodeScanner = () =>
  Boolean(window?.cordova?.plugins?.barcodeScanner?.scan);

export const RegistrationOnboardingPage = () => {
  const navigate = useNavigate();
  const [inviteInput, setInviteInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedToken = useMemo(
    () => extractInviteToken(inviteInput),
    [inviteInput],
  );

  const goToInviteRegistration = (value) => {
    const registrationPath = getInviteRegistrationPath(value);

    if (!registrationPath) {
      setError("Enter a valid invite link or token.");
      return;
    }

    setError("");
    navigate(registrationPath);
  };

  const handleScanQrCode = async () => {
    if (!hasBarcodeScanner()) {
      setError(
        "QR scanning is unavailable on this device. Paste the invite link instead.",
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      await new Promise((resolve, reject) => {
        window.cordova.plugins.barcodeScanner.scan(
          (result) => {
            if (result.cancelled) {
              resolve();
              return;
            }

            const token = extractInviteToken(result.text);
            if (!token) {
              reject(new Error("The scanned QR code is not a valid invite."));
              return;
            }

            goToInviteRegistration(token);
            resolve();
          },
          (scanError) => {
            reject(
              scanError instanceof Error
                ? scanError
                : new Error(String(scanError || "QR scan failed")),
            );
          },
          {
            showFlipCameraButton: true,
            showTorchButton: true,
            prompt: "Scan your MIE Auth registration QR code",
            resultDisplayDuration: 0,
            formats: "QR_CODE",
          },
        );
      });
    } catch (scanError) {
      setError(scanError.message || "Unable to scan the QR code.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasteInviteLink = () => {
    goToInviteRegistration(inviteInput);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4 sm:p-6 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-border shadow-lg">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  <UserPlus className="h-4 w-4" />
                  Device setup
                </div>
                <h1 className="text-3xl font-bold text-foreground">
                  Set up MIE Auth your way
                </h1>
                <p className="text-muted-foreground">
                  Use your invite for the fastest setup, or continue with manual
                  registration if needed.
                </p>
              </div>

              {error && (
                <Alert variant="danger">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={handleScanQrCode}
                  disabled={loading}
                  className="text-left rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/60 disabled:opacity-60"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">
                        Scan QR code
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Fastest option for invited users
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Scan the QR code from the manager portal to load your invite
                    details instantly.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    <ScanLine className="h-4 w-4" />
                    {loading ? "Opening scanner..." : "Open scanner"}
                  </div>
                </button>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                      <LinkIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">
                        Paste invite link
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Works with email or copied portal links
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Input
                      value={inviteInput}
                      onChange={(event) => setInviteInput(event.target.value)}
                      placeholder="Paste the invite link or token"
                      label="Invite link"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                    <Button
                      type="button"
                      onClick={handlePasteInviteLink}
                      disabled={!normalizedToken}
                      fullWidth
                    >
                      Continue with invite
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-lg">
            <CardContent className="p-8 flex flex-col justify-between h-full space-y-6">
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-foreground">
                  Register manually
                </h2>
                <p className="text-muted-foreground">
                  Use the existing registration form if you do not have an
                  invite yet.
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">
                Manual registration keeps the current approval process
                unchanged.
              </div>

              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => navigate("/register")}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Use manual registration
              </Button>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
};

export default RegistrationOnboardingPage;
