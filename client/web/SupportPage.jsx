import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Github } from "lucide-react";
import { Layout } from "./components/Layout";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  Button,
  buttonVariants,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@mieweb/ui";

export const SupportPage = () => {
  const GITHUB_REPO_URL = "https://github.com/mieweb/mieweb_auth_app";
  const GITHUB_NEW_ISSUE_URL = `${GITHUB_REPO_URL}/issues/new`;
  const navigate = useNavigate();
  usePageTitle("Support");

  const [buildInfo, setBuildInfo] = useState(null);

  useEffect(() => {
    fetch("/buildInfo.json")
      .then((response) => response.json())
      .then((data) => setBuildInfo(data))
      .catch((error) => {
        console.error("Error loading build info:", error);
      });
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              To request help or report a bug, please open an issue on our
              GitHub repository.
            </p>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Opening an issue helps us track progress and respond publicly.
                Please include steps to reproduce and any relevant screenshots.
              </p>

              <a
                href={GITHUB_NEW_ISSUE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants() + " no-underline"}
              >
                <span className="shrink-0">
                  <Github className="w-5 h-5" />
                </span>
                Open a GitHub Issue
              </a>

              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted p-3 hover:bg-muted/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-card border border-border">
                    <Github className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      Repository
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {GITHUB_REPO_URL}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium text-primary shrink-0">
                  View
                </div>
              </a>
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-sm font-medium text-foreground mb-4">
                Account Management
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Need to delete your account? You can request account deletion
                and we'll process your request within 30 days.
              </p>
              <Button
                variant="link"
                onClick={() => navigate("/delete-account")}
                className="text-red-600 hover:text-red-800 p-0"
              >
                Request Account Deletion →
              </Button>
            </div>

            {buildInfo && (
              <div className="mt-8 pt-6 border-t border-border">
                <h3 className="text-sm font-medium text-foreground mb-4">
                  App Information
                </h3>
                <dl className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">Version</dt>
                    <dd className="font-mono text-foreground">
                      {buildInfo.appVersion}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">Build Number</dt>
                    <dd className="font-mono text-foreground">
                      <a
                        href={`${GITHUB_REPO_URL}/commit/${buildInfo.buildNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        {buildInfo.buildNumber}
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};
