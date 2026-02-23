import React, { useState } from "react";
import { Meteor } from "meteor/meteor";
import { useNavigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { usePageTitle } from "../hooks/usePageTitle";
import { Trash2 } from "lucide-react";
import {
  Input,
  Textarea,
  Button,
  Alert,
  AlertTitle,
  AlertDescription,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@mieweb/ui";

export const DeleteAccountPage = () => {
  const navigate = useNavigate();
  usePageTitle("Delete Account");
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    reason: "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Don't trim on keystroke - it removes spaces while typing, confusing users
    // Trimming is done in handleSubmit before API call
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email || !emailRegex.test(formData.email)) {
      setStatus({
        type: "error",
        message: "Please enter a valid email address.",
      });
      return false;
    }

    if (formData.email.length < 3 || formData.email.length > 254) {
      setStatus({
        type: "error",
        message: "Email must be between 3 and 254 characters.",
      });
      return false;
    }

    if (
      !formData.username ||
      formData.username.length < 1 ||
      formData.username.length > 100
    ) {
      setStatus({
        type: "error",
        message: "Username must be between 1 and 100 characters.",
      });
      return false;
    }

    if (formData.reason && formData.reason.length > 1000) {
      setStatus({
        type: "error",
        message: "Reason must be less than 1000 characters.",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!validateForm()) {
      return;
    }

    // Show confirmation before actually submitting
    setShowConfirm(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);

    // Trim email and username before sending to API
    const trimmedData = {
      email: formData.email.trim(),
      username: formData.username.trim(),
      reason: formData.reason,
    };

    try {
      await Meteor.callAsync("users.requestAccountDeletion", trimmedData);
      setStatus({
        type: "success",
        message:
          "Account deletion request submitted successfully. You will receive a confirmation email shortly.",
      });
      setFormData({ email: "", username: "", reason: "" });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error.reason ||
          "Failed to submit deletion request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Trash2 className="h-6 w-6 text-red-600 mr-3" />
              <CardTitle>Delete Your Account</CardTitle>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Request permanent deletion of your account and associated data
            </p>
          </CardHeader>

          <CardContent>
            {status.message && (
              <div className="mb-6">
                <Alert
                  variant={status.type === "success" ? "success" : "danger"}
                >
                  <AlertDescription>{status.message}</AlertDescription>
                </Alert>
              </div>
            )}

            <div className="mb-6">
              <Alert variant="warning">
                <AlertTitle>Important Information</AlertTitle>
                <AlertDescription>
                  <span className="text-sm space-y-1 block">
                    {"• Account deletion is permanent and cannot be undone"}
                    <br />
                    {
                      "• All your data, including notification history, will be deleted"
                    }
                    <br />
                    {"• You will receive a confirmation email before deletion"}
                    <br />
                    {"• Processing may take up to 30 days"}
                  </span>
                </AlertDescription>
              </Alert>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Email Address"
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@example.com"
                helperText="The email address associated with your account"
              />

              <Input
                label="Username"
                type="text"
                id="username"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                placeholder="Your username"
              />

              <Textarea
                label="Reason for Deletion (Optional)"
                id="reason"
                name="reason"
                rows={4}
                value={formData.reason}
                onChange={handleChange}
                placeholder="Please tell us why you're deleting your account (optional)"
                helperText="Your feedback helps us improve our service"
              />

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/")}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                  loadingText="Submitting..."
                  leftIcon={<Trash2 className="h-4 w-4" />}
                >
                  Request Account Deletion
                </Button>
              </div>
            </form>

            {/* Confirmation Dialog */}
            {showConfirm && (
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50"
                onClick={() => setShowConfirm(false)}
              >
                <div
                  className="bg-card rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="confirm-delete-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </div>
                    <h3
                      id="confirm-delete-title"
                      className="text-lg font-semibold text-foreground"
                    >
                      Confirm Account Deletion
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">
                    Are you sure you want to request account deletion? This
                    action cannot be undone and all your data will be
                    permanently removed.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="ghost"
                      onClick={() => setShowConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onClick={handleConfirmedSubmit}
                      leftIcon={<Trash2 className="h-4 w-4" />}
                    >
                      Yes, Delete My Account
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};
