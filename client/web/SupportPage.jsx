import React, { useState, useEffect } from "react";
import {
  Github,
  LifeBuoy,
  ExternalLink,
  Trash2,
  Info,
  ArrowRight,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, buttonVariants, Badge } from "@mieweb/ui";
import { Layout } from "./components/Layout";
import { usePageTitle } from "../hooks/usePageTitle";

export const SupportPage = () => {
  usePageTitle("Support");
  const prefersReducedMotion = useReducedMotion();
  const GITHUB_REPO_URL = "https://github.com/mieweb/mieweb_auth_app";
  const GITHUB_NEW_ISSUE_URL = `${GITHUB_REPO_URL}/issues/new`;

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
      {/* Hero */}
      <section className="relative overflow-hidden bg-background text-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center mb-6"
          >
            <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20">
              <LifeBuoy className="w-10 h-10 text-primary" />
            </div>
          </motion.div>
          <motion.h1
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl font-extrabold tracking-tight"
          >
            Support
          </motion.h1>
          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto"
          >
            To request help or report a bug, please open an issue on our GitHub
            repository.
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-background pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Report issue card */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-5">
                <p className="text-sm text-muted-foreground">
                  Opening an issue helps us track progress and respond publicly.
                  Please include steps to reproduce and any relevant
                  screenshots.
                </p>

                <a
                  href={GITHUB_NEW_ISSUE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "default" })}
                >
                  <Github className="w-4 h-4 mr-2" />
                  Open a GitHub Issue
                </a>

                {/* Repo link card */}
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/50 p-4 hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background border border-border">
                      <Github className="h-5 w-5 text-muted-foreground" />
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
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </a>
              </CardContent>
            </Card>
          </motion.div>

          {/* Account management */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-destructive/10 p-2 rounded-xl border border-destructive/20">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Account Management
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Need to delete your account? You can request account
                      deletion and we'll process your request within 30 days.
                    </p>
                  </div>
                </div>
                <a
                  href="/delete-account"
                  className="inline-flex items-center text-sm text-destructive hover:text-destructive/80 font-medium transition-colors"
                >
                  Request Account Deletion
                  <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </CardContent>
            </Card>
          </motion.div>

          {/* Build info */}
          {buildInfo && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">
                      App Information
                    </h3>
                  </div>
                  <dl className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <dt className="text-muted-foreground">Version</dt>
                      <dd>
                        <Badge
                          variant="secondary"
                          className="bg-muted text-muted-foreground border-border font-mono"
                        >
                          {buildInfo.appVersion}
                        </Badge>
                      </dd>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <dt className="text-muted-foreground">Build Number</dt>
                      <dd>
                        <a
                          href={`${GITHUB_REPO_URL}/commit/${buildInfo.buildNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-primary hover:text-primary/80 transition-colors text-xs"
                        >
                          {buildInfo.buildNumber}
                        </a>
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </section>
    </Layout>
  );
};
