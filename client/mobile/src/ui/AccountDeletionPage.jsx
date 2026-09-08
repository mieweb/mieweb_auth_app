import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { AlertTriangle, ArrowLeft, CheckCircle, Trash2 } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
} from "@mieweb/ui";
import { wipeLocalCredentialsAndLogout } from "../../local-session";
import { ConfirmActionModal } from "./Modal/ConfirmActionModal";

// Typing this phrase guards against an accidental tap on an irreversible action.
const CONFIRM_PHRASE = "DELETE";

const CONSEQUENCES = [
  "Every device registered to your account is removed and signed out.",
  "You stop receiving authentication requests immediately.",
  "Your profile, device records, authentication history and pending approvals are permanently erased.",
  "To use MIE Auth again you must register from scratch and be re-approved by an administrator.",
];

const AccountDeletionPage = () => {
  const navigate = useNavigate();
  const [phrase, setPhrase] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [deleted, setDeleted] = useState(false);

  // ProtectedRoute also accepts a Session-only (biometric) state, but deletion
  // needs a real DDP login or the server sees no userId.
  const isSignedIn = useTracker(() => !!Meteor.userId(), []);

  const phraseMatches = phrase.trim().toUpperCase() === CONFIRM_PHRASE;

  const deleteAccount = async (reAuth) => {
    setBusy(true);
    setActionError("");
    try {
      await Meteor.callAsync("users.deleteOwnAccount", { reAuth });
      setConfirming(false);
      setDeleted(true);
    } catch (err) {
      setActionError(err.reason || err.message || "Failed to delete account.");
    } finally {
      setBusy(false);
    }
  };

  if (deleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 space-y-4 text-center">
            <CheckCircle className="h-10 w-10 mx-auto text-emerald-500" />
            <h2 className="text-lg font-bold text-foreground">
              Your account has been deleted
            </h2>
            <p className="text-sm text-muted-foreground">
              Your MIE Auth account, all of its registered devices and your
              authentication history have been permanently removed.
            </p>
            <Button fullWidth onClick={() => wipeLocalCredentialsAndLogout()}>
              Done
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="relative z-50 bg-card shadow-sm sm:sticky sm:top-0">
        <div className="px-4 py-2.5 flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="p-2 rounded-xl h-auto"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <h2 className="text-base font-bold text-foreground">
            Delete Account
          </h2>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        <Alert variant="warning">
          <AlertDescription>
            Deleting your account is permanent and cannot be undone.
          </AlertDescription>
        </Alert>

        {!isSignedIn && (
          <Alert variant="danger">
            <AlertDescription>
              Your session has expired, so your account cannot be deleted right
              now. Sign in again to continue.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              What happens when you delete
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
              {CONSEQUENCES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <Input
              label={`Type ${CONFIRM_PHRASE} to confirm`}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder={CONFIRM_PHRASE}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              disabled={busy || !isSignedIn}
            />
            <Button
              variant="danger"
              fullWidth
              leftIcon={<Trash2 className="h-4 w-4" />}
              disabled={!phraseMatches || busy || !isSignedIn}
              onClick={() => {
                setActionError("");
                setConfirming(true);
              }}
            >
              Delete my account
            </Button>
            {actionError && !confirming && (
              <Alert variant="danger">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Prefer to keep your account and only remove a device? Use My devices
          instead.
        </p>
      </main>

      {confirming && (
        <ConfirmActionModal
          action={{
            title: "Delete your account?",
            description:
              "Verify it's you to permanently delete your MIE Auth account.",
            warning:
              "This removes your account and every registered device. It cannot be undone.",
            confirmLabel: "Delete account",
          }}
          busy={busy}
          error={actionError}
          onClose={() => {
            setConfirming(false);
            setActionError("");
          }}
          onConfirm={deleteAccount}
        />
      )}
    </div>
  );
};

export default AccountDeletionPage;
