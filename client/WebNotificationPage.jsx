import React, { useState } from "react";
import { Meteor } from "meteor/meteor";
import { Layout } from "./web/components/Layout";
import { AppStoreBadges } from "./web/components/AppStoreButtons";
import { usePageTitle } from "./hooks/usePageTitle";
import { Send, Bell, Smartphone, Info } from "lucide-react";
import {
  Input,
  Button,
  Alert,
  AlertTitle,
  AlertDescription,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@mieweb/ui";

export const WebNotificationPage = () => {
  usePageTitle("Test Notification");
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
        const errorMessage =
          result.error ||
          result.message ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
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
      setStatus({
        type: "error",
        message: error.message || "Failed to send notification",
      });
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Instructions & Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent>
                <h2 className="text-lg font-bold text-foreground mb-4 flex items-center">
                  <Info className="w-5 h-5 mr-2 text-primary" />
                  MIE Auth Test Instructions
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Test your Auth app, a professional two-factor authentication
                  app using push notifications.
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
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Feedback
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your feedback is crucial! Please report bugs or suggestions to{" "}
                  <a
                    href="mailto:devopsalerts@mieweb.com"
                    className="text-primary hover:underline"
                  >
                    devopsalerts@mieweb.com
                  </a>
                </p>
                <p className="text-sm text-muted-foreground italic">
                  Thank you for helping us build a more secure authentication
                  experience!
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Testing Interface */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Bell className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Test MIE Auth</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Send a test push notification to your registered device.
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-8">
                {/* Prerequisite Note & Download Links */}
                <Alert variant="info">
                  <AlertDescription>
                    <span className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <span className="flex-1">
                        <strong>Prerequisite:</strong> You need to install the
                        app and register your device to receive notifications.
                      </span>
                      <AppStoreBadges />
                    </span>
                  </AlertDescription>
                </Alert>

                {/* Status Messages */}
                {status && (
                  <Alert
                    variant={status.type === "success" ? "success" : "danger"}
                  >
                    <AlertTitle>
                      {status.type === "success" ? "Success" : "Error"}
                    </AlertTitle>
                    <AlertDescription>{status.message}</AlertDescription>
                  </Alert>
                )}

                {/* User Action Result */}
                {waitingForAction && (
                  <Alert variant="info">
                    <AlertTitle>Waiting for response...</AlertTitle>
                    <AlertDescription>
                      Please check your device and approve/reject the request.
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
                  >
                    <AlertTitle>Response Received</AlertTitle>
                    <AlertDescription>{userAction.message}</AlertDescription>
                  </Alert>
                )}

                {/* Form */}
                <div className="space-y-6">
                  <Input
                    label="Target Username"
                    name="username"
                    id="username"
                    placeholder="e.g., your_username"
                    value={formData.username}
                    onChange={handleChange}
                    helperText="Enter the username of the registered device you want to test."
                  />

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <Input
                      label="Notification Title"
                      name="title"
                      id="title"
                      placeholder="e.g., Test Push Notification"
                      value={formData.title}
                      onChange={handleChange}
                    />
                    <Input
                      label="Notification Body"
                      name="body"
                      id="body"
                      placeholder="e.g., This is a test notification from MIEWeb Auth."
                      value={formData.body}
                      onChange={handleChange}
                    />
                  </div>

                  {/* API Authentication Fields */}
                  <Alert variant="info">
                    <AlertTitle>API Authentication</AlertTitle>
                    <AlertDescription>
                      If API Authentication is enabled, you must provide an API
                      key.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <Input
                      label="API Key"
                      type="password"
                      name="apikey"
                      id="apikey"
                      placeholder="Enter your API key"
                      value={formData.apikey}
                      onChange={handleChange}
                    />
                    <Input
                      label="Client ID"
                      name="client_id"
                      id="client_id"
                      placeholder="e.g., ldap.example.com"
                      value={formData.client_id}
                      onChange={handleChange}
                      helperText="Optional"
                    />
                  </div>

                  <div className="bg-muted rounded-lg p-4 border border-border">
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
                    isLoading={isLoading}
                    loadingText="Sending..."
                    leftIcon={!isLoading ? <Send className="w-5 h-5" /> : null}
                    fullWidth
                  >
                    Send Notification
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};
