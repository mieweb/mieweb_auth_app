import React, { useState } from "react";
import { Meteor } from "meteor/meteor";
import { Layout } from "./components/Layout";
import {
  AlertCircle,
  CheckCircle,
  Trash2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Card,
  CardContent,
  Button,
  Input,
  Textarea,
  Alert,
  AlertDescription,
} from "@mieweb/ui";
import { usePageTitle } from "../hooks/usePageTitle";

export const DeleteAccountPage = () => {
  usePageTitle("Delete Account");
  const prefersReducedMotion = useReducedMotion();
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    reason: "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
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

    setIsSubmitting(true);

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
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.1),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center mb-6"
          >
            <div className="bg-red-500/20 p-4 rounded-2xl border border-red-500/30">
              <Trash2 className="w-10 h-10 text-red-400" />
            </div>
          </motion.div>
          <motion.h1
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-extrabold tracking-tight"
          >
            Delete Your Account
          </motion.h1>
          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-lg text-gray-400 max-w-xl mx-auto"
          >
            Request permanent deletion of your account and associated data
          </motion.p>
        </div>
      </section>

      {/* Form */}
      <section className="bg-gray-950 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {status.message && (
              <Alert
                variant={status.type === "success" ? "default" : "destructive"}
                className={`mb-6 ${
                  status.type === "success"
                    ? "border-green-500/30 bg-green-500/10"
                    : "border-red-500/30 bg-red-500/10"
                }`}
              >
                {status.type === "success" ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription
                  className={
                    status.type === "success"
                      ? "text-green-300"
                      : "text-red-300"
                  }
                >
                  {status.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Warning card */}
            <Card className="bg-amber-500/10 border-amber-500/20 mb-6">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-amber-300 mb-2">
                      Important Information
                    </h3>
                    <ul className="text-sm text-amber-200/80 space-y-1 list-disc list-inside">
                      <li>
                        Account deletion is permanent and cannot be undone
                      </li>
                      <li>
                        All your data, including notification history, will be
                        deleted
                      </li>
                      <li>
                        You will receive a confirmation email before deletion
                      </li>
                      <li>Processing may take up to 30 days</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form card */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-300"
                    >
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your.email@example.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                    />
                    <p className="text-xs text-gray-500">
                      The email address associated with your account
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="username"
                      className="block text-sm font-medium text-gray-300"
                    >
                      Username <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="text"
                      id="username"
                      name="username"
                      required
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="Your username"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="reason"
                      className="block text-sm font-medium text-gray-300"
                    >
                      Reason for Deletion (Optional)
                    </label>
                    <Textarea
                      id="reason"
                      name="reason"
                      rows={4}
                      value={formData.reason}
                      onChange={handleChange}
                      placeholder="Please tell us why you're deleting your account (optional)"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
                    />
                    <p className="text-xs text-gray-500">
                      Your feedback helps us improve our service
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <a
                      href="/"
                      className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Cancel
                    </a>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      variant="destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isSubmitting
                        ? "Submitting..."
                        : "Request Account Deletion"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};
