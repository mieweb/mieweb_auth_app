import React, { useState } from "react";
import { Meteor } from "meteor/meteor";
import { Layout } from "./web/components/Layout";
import {
  Send,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Smartphone,
  Info,
  AlertTriangle,
} from "lucide-react";
import { classifyError } from "../utils/errorHelpers";
import { usePageTitle } from "./hooks/usePageTitle";
import {
  Card,
  CardContent,
  Input,
  Button,
  Alert,
  AlertDescription,
} from "@mieweb/ui";
import { motion, useReducedMotion } from "framer-motion";

export const WebNotificationPage = () => {
  usePageTitle("Test Notification");
  const prefersReducedMotion = useReducedMotion();
  const [formData, setFormData] = useState({
    username: "",
    title: "",
    body: "",
    apikey: "",
    client_id: "",
  });
  const [status, setStatus] = useState(null);
  const [userAction, setUserAction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForAction, setWaitingForAction] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSendNotification = async () => {
    if (!formData.username.trim()) {
      setStatus({ type: "error", message: "Username is required" });
      return;
    }

    setIsLoading(true);
    setStatus(null);
    setUserAction(null);
    setWaitingForAction(false);

    try {
      const payload = {
        username: formData.username.trim(),
        title: formData.title,
        body: formData.body,
        timeout: "",
        restriction: "",
        deviceType: "primary",
        metaData: "server name, ip, source, etc",
        actions: [
          { icon: "approve", title: "Approve", callback: "approve" },
          { icon: "reject", title: "Reject", callback: "reject" },
        ],
      };

      // Include API key and client ID if provided
      if (formData.apikey && formData.apikey.trim()) {
        payload.apikey = formData.apikey.trim();
      }
      if (formData.client_id && formData.client_id.trim()) {
        payload.client_id = formData.client_id.trim();
      }

      const response = await fetch(Meteor.absoluteUrl("send-notification"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Parse response as JSON regardless of status
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
        );
      }

      if (!response.ok) {
        const errorCode = result.errorCode || "";
        const httpStatus = response.status;
        const { type: errorType, hint } = classifyError(errorCode, httpStatus);
        const errorMessage =
          result.error ||
          result.message ||
          "Something went wrong. Please try again.";
        setStatus({
          type: errorType,
          message: errorMessage,
          hint,
          errorCode,
          httpStatus,
        });
        setIsLoading(false);
        return;
      }

      setStatus({
        type: "success",
        message: result.message || "Notification sent successfully!",
      });
      setIsLoading(false);

      if (result.action) {
        setWaitingForAction(true);

        let actionMessage = "";
        let actionType = "info";

        switch (result.action.toLowerCase()) {
          case "approve":
            actionMessage = "User approved the request ✅";
            actionType = "success";
            break;
          case "reject":
            actionMessage = "User rejected the request ❌";
            actionType = "error";
            break;
          case "timeout":
            actionMessage = "Request timed out ⏰";
            actionType = "warning";
            break;
          default:
            actionMessage = `User action: ${result.action}`;
            actionType = "info";
        }

        setTimeout(() => {
          setWaitingForAction(false);
          setUserAction({ type: actionType, message: actionMessage });
        }, 2000);
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      const msg = error.message || "Failed to send notification";
      const isNetwork =
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Network request failed");
      const errorCode = isNetwork ? "network-error" : "unknown";
      const { hint } = classifyError(errorCode);
      setStatus({
        type: "error",
        message: isNetwork
          ? "Unable to reach the server. Please check your network connection and try again."
          : msg,
        hint,
        errorCode,
      });
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-background text-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center mb-6"
          >
            <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20">
              <Bell className="w-10 h-10 text-primary" />
            </div>
          </motion.div>
          <motion.h1
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-extrabold tracking-tight"
          >
            Test MIEWeb Auth
          </motion.h1>
          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto"
          >
            Send a test push notification to your registered device.
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-background pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Instructions & Info */}
            <div className="lg:col-span-1 space-y-6">
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center">
                      <Info className="w-5 h-5 mr-2 text-primary" />
                      MIEWeb Auth Test Instructions
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Test your Auth app, a professional two-factor
                      authentication app using push notifications.
                    </p>

                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                      What to Test
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-2 mb-6 list-disc pl-4">
                      <li>Push notification delivery and reliability</li>
                      <li>Login approval/denial flow</li>
                      <li>Device registration process</li>
                      <li>Biometric authentication (Face ID/Touch ID)</li>
                      <li>Dark mode interface</li>
                      <li>Notification history tracking</li>
                    </ul>

                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                      Known Issues
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-2 mb-6 list-disc pl-4">
                      <li>Occasional notification delay in background mode</li>
                      <li>UI refinements in progress</li>
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      Feedback
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your feedback is crucial! Please report bugs or
                      suggestions to{" "}
                      <a
                        href="mailto:devopsalerts@mieweb.com"
                        className="text-primary hover:underline"
                      >
                        devopsalerts@mieweb.com
                      </a>
                    </p>
                    <p className="text-sm text-muted-foreground italic">
                      Thank you for helping us build a more secure
                      authentication experience!
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Right Column: Testing Interface */}
            <div className="lg:col-span-2">
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <Card className="bg-card border-border overflow-hidden">
                  <CardContent className="p-6 space-y-8">
                    {/* Prerequisite Note & Download Links */}
                    <div className="bg-primary/5 rounded-md p-4 border border-primary/20">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm text-foreground">
                            <strong>Prerequisite:</strong> You need to install
                            the app and register your device to receive
                            notifications.
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {/* App Store - Small */}
                          <a
                            href="https://apps.apple.com/us/app/mie-auth-open-source/id6756409072"
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm transition-colors"
                          >
                            <svg
                              className="w-4 h-4 mr-1.5"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.11-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                            </svg>
                            App Store
                          </a>
                          {/* Play Store - Small */}
                          <a
                            href="https://play.google.com/store/apps/details?id=com.mieweb.mieauth"
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm transition-colors"
                          >
                            <svg
                              className="w-4 h-4 mr-1.5"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                            </svg>
                            Google Play
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Status Messages */}
                    {status && (
                      <Alert
                        variant={
                          status.type === "success"
                            ? "success"
                            : status.type === "warning"
                              ? "warning"
                              : "danger"
                        }
                        className="mb-6"
                      >
                        {status.type === "success" ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : status.type === "warning" ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <AlertDescription>
                          <h3 className="text-sm font-medium mb-1">
                            {status.type === "success"
                              ? "Success"
                              : status.type === "warning"
                                ? "Warning"
                                : "Error"}
                            {status.httpStatus ? ` (${status.httpStatus})` : ""}
                          </h3>
                          <p>{status.message}</p>
                          {status.hint && (
                            <p className="mt-2 text-xs opacity-80">
                              <strong>Tip:</strong> {status.hint}
                            </p>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* User Action Result */}
                    {waitingForAction && (
                      <Alert variant="info" className="animate-pulse">
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                          <h3 className="text-sm font-medium mb-1">
                            Waiting for response...
                          </h3>
                          <p>
                            Please check your device and approve/reject the
                            request.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}

                    {userAction && (
                      <Alert
                        variant={
                          userAction.type === "success"
                            ? "success"
                            : userAction.type === "error"
                              ? "danger"
                              : "warning"
                        }
                        className="mb-6"
                      >
                        {userAction.type === "success" ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : userAction.type === "error" ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                        <AlertDescription>
                          <h3 className="text-sm font-medium mb-1">
                            Response Received
                          </h3>
                          <p>{userAction.message}</p>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Form */}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label
                          htmlFor="username"
                          className="block text-sm font-medium text-foreground"
                        >
                          Target Username
                        </label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <Input
                            type="text"
                            name="username"
                            id="username"
                            className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                            placeholder="e.g., your_username"
                            value={formData.username}
                            onChange={handleChange}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Enter the username of the registered device you want
                          to test.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label
                            htmlFor="title"
                            className="block text-sm font-medium text-foreground"
                          >
                            Notification Title
                          </label>
                          <Input
                            type="text"
                            name="title"
                            id="title"
                            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                            placeholder="e.g., Test Push Notification"
                            value={formData.title}
                            onChange={handleChange}
                          />
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="body"
                            className="block text-sm font-medium text-foreground"
                          >
                            Notification Body
                          </label>
                          <Input
                            type="text"
                            name="body"
                            id="body"
                            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                            placeholder="e.g., This is a test notification from MIEWeb Auth."
                            value={formData.body}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      {/* API Authentication Fields */}
                      <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                        <div className="flex items-start mb-3">
                          <Info className="w-5 h-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-foreground">
                              API Authentication
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              If API Authentication is enabled, you must provide
                              an API key.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label
                              htmlFor="apikey"
                              className="block text-sm font-medium text-foreground"
                            >
                              API Key
                            </label>
                            <Input
                              type="password"
                              name="apikey"
                              id="apikey"
                              className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                              placeholder="Enter your API key"
                              value={formData.apikey}
                              onChange={handleChange}
                            />
                          </div>

                          <div className="space-y-2">
                            <label
                              htmlFor="client_id"
                              className="block text-sm font-medium text-foreground"
                            >
                              Client ID{" "}
                              <span className="text-muted-foreground">
                                (Optional)
                              </span>
                            </label>
                            <Input
                              type="text"
                              name="client_id"
                              id="client_id"
                              className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                              placeholder="e.g., ldap.example.com"
                              value={formData.client_id}
                              onChange={handleChange}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-4 border border-border">
                        <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                          <Smartphone className="w-4 h-4 mr-2 text-muted-foreground" />
                          Preview
                        </h4>
                        <div className="bg-card p-3 rounded border border-border shadow-sm">
                          <p className="font-semibold text-foreground">
                            {formData.title || "Notification Title"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formData.body || "Notification body text..."}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={handleSendNotification}
                        disabled={isLoading || waitingForAction}
                        className="w-full py-6"
                        isLoading={isLoading}
                        loadingText="Sending..."
                      >
                        {!isLoading && <Send className="w-5 h-5 mr-2" />}
                        Send Notification
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};
