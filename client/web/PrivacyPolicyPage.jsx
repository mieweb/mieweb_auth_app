import React from "react";
import { Shield, Eye, Lock, Database, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@mieweb/ui";
import { Layout } from "./components/Layout";
import { usePageTitle } from "../hooks/usePageTitle";

const sections = [
  {
    icon: Eye,
    title: "Overview",
    color: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
    content: (
      <p className="text-muted-foreground">
        We safeguard user privacy while maintaining the ability to identify
        individuals who use our Services. We do not support anonymous use of our
        systems.
      </p>
    ),
  },
  {
    icon: Shield,
    title: "Anonymity",
    color: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          When you use our Services, we may take reasonable steps to determine
          your identity or, if you are operating through an automated agent, the
          identity of the individual controlling that agent.
        </p>
        <p>
          We may deny access to our Services if you or your agents engage in
          conduct that is harmful to our interests. If your actions violate
          applicable law (U.S. law by default, others considered as
          appropriate), we may cooperate with authorities in accordance with the
          Privacy and Confidentiality provisions below.
        </p>
        <p>
          Deliberate efforts to obscure identity—including aliases, VPNs,
          multiple identities, or hidden services—may be treated as misuse and
          may result in blocking, as such behavior suggests an intent to avoid
          accountability and creates unacceptable risk.
        </p>
      </div>
    ),
  },
  {
    icon: Lock,
    title: "Privacy and Confidentiality",
    color: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-green-600 dark:text-green-400",
    content: (
      <p className="text-muted-foreground">
        Once identity is established, the protection of your personal
        information is a priority. We will not disclose data linked to your
        identity without your direction, unless required by a valid court order
        and subject to your opportunity to contest that order.
      </p>
    ),
  },
  {
    icon: Database,
    title: "Ownership of Data",
    color: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Data you submit to our Services remains your property. We do not claim
          ownership and will not use it without your permission.
        </p>
        <p>
          Metadata generated through your use of our Services is owned by us and
          is handled in accordance with the Privacy and Confidentiality
          provisions above.
        </p>
      </div>
    ),
  },
  {
    icon: Trash2,
    title: "Account Deletion",
    color: "from-red-500/20 to-rose-500/20",
    iconColor: "text-red-600 dark:text-red-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          You have the right to request deletion of your account and associated
          data at any time.
        </p>
        <p>
          To request account deletion, please visit our{" "}
          <a
            href="/delete-account"
            className="text-primary hover:text-primary/80 underline transition-colors"
          >
            account deletion page
          </a>
          . Your request will be processed within 30 days, and you will receive
          confirmation when complete.
        </p>
      </div>
    ),
  },
];

const FadeIn = ({ children, delay = 0, className = "" }) => {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const PrivacyPolicyPage = () => {
  usePageTitle("Privacy Policy");
  const prefersReducedMotion = useReducedMotion();

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-background text-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center mb-6"
          >
            <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20">
              <Shield className="w-10 h-10 text-primary" />
            </div>
          </motion.div>
          <motion.h1
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl font-extrabold tracking-tight"
          >
            Privacy Policy
          </motion.h1>
          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-sm text-muted-foreground"
          >
            Last updated: {new Date().toLocaleDateString()}
          </motion.p>
        </div>
      </section>

      {/* Sections */}
      <section className="bg-background pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {sections.map((section, i) => {
            const Icon = section.icon;
            return (
              <FadeIn key={i} delay={i * 0.05}>
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`bg-gradient-to-br ${section.color} p-2.5 rounded-xl border border-border`}
                      >
                        <Icon className={`w-5 h-5 ${section.iconColor}`} />
                      </div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {section.title}
                      </h2>
                    </div>
                    {section.content}
                  </CardContent>
                </Card>
              </FadeIn>
            );
          })}
        </div>
      </section>
    </Layout>
  );
};
