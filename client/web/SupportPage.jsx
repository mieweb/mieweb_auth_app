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
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center mb-6"
          >
            <div className="bg-blue-500/20 p-4 rounded-2xl border border-blue-500/30">
              <LifeBuoy className="w-10 h-10 text-blue-400" />
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
            className="mt-4 text-lg text-gray-400 max-w-xl mx-auto"
          >
            To request help or report a bug, please open an issue on our GitHub
            repository.
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-gray-950 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Report issue card */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 space-y-5">
                <p className="text-sm text-gray-400">
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
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                      <Github className="h-5 w-5 text-gray-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">
                        Repository
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {GITHUB_REPO_URL}
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors shrink-0" />
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
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-red-500/20 p-2 rounded-xl border border-red-500/30">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Account Management
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Need to delete your account? You can request account
                      deletion and we'll process your request within 30 days.
                    </p>
                  </div>
                </div>
                <a
                  href="/delete-account"
                  className="inline-flex items-center text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
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
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-4 h-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-white">
                      App Information
                    </h3>
                  </div>
                  <dl className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <dt className="text-gray-400">Version</dt>
                      <dd>
                        <Badge
                          variant="secondary"
                          className="bg-white/10 text-gray-300 border-white/20 font-mono"
                        >
                          {buildInfo.appVersion}
                        </Badge>
                      </dd>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <dt className="text-gray-400">Build Number</dt>
                      <dd>
                        <a
                          href={`${GITHUB_REPO_URL}/commit/${buildInfo.buildNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-blue-400 hover:text-blue-300 transition-colors text-xs"
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
