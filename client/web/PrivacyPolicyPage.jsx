import React from "react";
import {
  Shield,
  Eye,
  Lock,
  Database,
  Trash2,
  Building2,
  Share2,
  Ban,
  Fingerprint,
  Clock,
  Mail,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@mieweb/ui";
import { Layout } from "./components/Layout";
import { usePageTitle } from "../hooks/usePageTitle";

// Google Play requires the policy to name the developer and every app it
// covers, and to list collected data consistently with the Data Safety form.
const COMPANY = "Medical Informatics Engineering, LLC";

const sections = [
  {
    icon: Building2,
    title: "Who This Policy Covers",
    color: "from-slate-500/20 to-gray-500/20",
    iconColor: "text-slate-600 dark:text-slate-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          This Privacy Policy is issued by {COMPANY} (&ldquo;MIE&rdquo;), the
          developer and operator of the applications and services described
          below.
        </p>
        <p>It applies to the following applications:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium text-foreground">MIEAuth</span> —
            Android package <code>com.mieweb.mieauth</code>, iOS bundle{" "}
            <code>org.mieweb.opensource</code>
          </li>
          <li>
            <span className="font-medium text-foreground">MIEAuth Beta</span> —
            Android package and iOS bundle <code>org.mieweb.os.dev</code>
          </li>
          <li>
            <span className="font-medium text-foreground">MIEWeb Auth</span> —
            Android package and iOS bundle <code>org.mieweb.auth</code>
          </li>
        </ul>
        <p>
          It also applies to the associated websites and back-end services that
          MIE operates for these applications.
        </p>
      </div>
    ),
  },
  {
    icon: Eye,
    title: "Overview",
    color: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          These applications provide multi-factor authentication. MIE safeguards
          user privacy while maintaining the ability to identify individuals who
          use the Services, because verifying identity is the purpose of the
          product. MIE does not support anonymous use of these systems.
        </p>
        <p>
          MIE does not sell personal information, does not share it with data
          brokers, and does not use it for advertising or for any form of
          behavioural profiling.
        </p>
      </div>
    ),
  },
  {
    icon: Database,
    title: "Information MIE Collects",
    color: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    content: (
      <div className="space-y-4 text-muted-foreground">
        <div>
          <p className="font-medium text-foreground mb-1">
            Account information
          </p>
          <p>
            First name, last name, username, and email address, provided by the
            user or by an administrator who invites them. Passwords and PINs are
            stored only as salted cryptographic hashes; MIE never stores them in
            readable form.
          </p>
        </div>
        <div>
          <p className="font-medium text-foreground mb-1">Device information</p>
          <p>
            A device identifier, device model, operating system platform and
            version, a user-assigned device nickname, and the registration and
            activity timestamps for each registered device. This information
            identifies which devices are entitled to approve a sign-in.
          </p>
        </div>
        <div>
          <p className="font-medium text-foreground mb-1">
            Push notification tokens
          </p>
          <p>
            A Firebase Cloud Messaging token for each registered device, used
            solely to deliver authentication requests to that device.
          </p>
        </div>
        <div>
          <p className="font-medium text-foreground mb-1">
            Authentication activity
          </p>
          <p>
            A record of authentication requests and their outcome — approved,
            rejected, or expired — together with the device that responded and
            the time it responded. This record exists so that users and
            administrators can review access to their accounts.
          </p>
        </div>
      </div>
    ),
  },
  {
    icon: Ban,
    title: "Information MIE Does Not Collect",
    color: "from-teal-500/20 to-cyan-500/20",
    iconColor: "text-teal-600 dark:text-teal-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>These applications do not collect or request:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Location data of any kind</li>
          <li>Contacts, calendar entries, SMS messages, or call logs</li>
          <li>Photos, files, or microphone audio</li>
          <li>Advertising identifiers or analytics for advertising purposes</li>
        </ul>
        <p>
          The applications request camera access on the devices where it is
          offered, and use it for one purpose only: scanning a QR code to
          complete an invitation. Camera frames are analysed on the device as
          they are viewed and are never recorded, stored, or transmitted.
        </p>
      </div>
    ),
  },
  {
    icon: Fingerprint,
    title: "Biometric Authentication",
    color: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-600 dark:text-violet-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Where a device offers fingerprint or face unlock, the applications can
          use it to confirm that the person approving a request is the device
          owner.
        </p>
        <p>
          Biometric data never leaves the device and is never transmitted to or
          stored by MIE. The operating system performs the match locally and
          reports only success or failure. MIE stores a cryptographic secret
          tied to the device, which proves possession of that device and cannot
          be used to reconstruct any biometric information.
        </p>
      </div>
    ),
  },
  {
    icon: Share2,
    title: "How Information Is Shared",
    color: "from-orange-500/20 to-red-500/20",
    iconColor: "text-orange-600 dark:text-orange-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          MIE does not sell personal information. It is disclosed only to the
          service providers required to operate the product:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium text-foreground">
              Google Firebase Cloud Messaging
            </span>{" "}
            — receives the device push token and the notification content in
            order to deliver authentication requests.
          </li>
          <li>
            <span className="font-medium text-foreground">
              The email delivery provider
            </span>{" "}
            — receives the email address and message content for invitations,
            approvals, and account notices.
          </li>
          <li>
            <span className="font-medium text-foreground">Duo Security</span> —
            where an organisation has enabled the optional Duo integration,
            receives username, email, display name, and registered device
            details so that devices appear in that organisation&rsquo;s Duo
            administration console.
          </li>
        </ul>
        <p>
          Where an organisation deploys these applications for its members, that
          organisation&rsquo;s administrators can see the account and device
          information belonging to their own users.
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
      <div className="space-y-3 text-muted-foreground">
        <p>
          Once identity is established, protecting personal information is a
          priority. MIE will not disclose data linked to a user&rsquo;s identity
          without that user&rsquo;s direction, unless required by a valid court
          order and subject to the user&rsquo;s opportunity to contest it.
        </p>
        <p>
          Traffic between the applications and MIE servers is encrypted in
          transit. Passwords, PINs, and access tokens are stored only as
          cryptographic hashes.
        </p>
      </div>
    ),
  },
  {
    icon: Shield,
    title: "Identity and Acceptable Use",
    color: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          When a person uses the Services, MIE may take reasonable steps to
          determine their identity or, if they are operating through an
          automated agent, the identity of the individual controlling that
          agent.
        </p>
        <p>
          MIE may deny access where conduct is harmful to its interests. Where
          actions violate applicable law (U.S. law by default, others considered
          as appropriate), MIE may cooperate with authorities in accordance with
          the Privacy and Confidentiality provisions above.
        </p>
        <p>
          Because the product exists to establish identity, deliberate efforts
          to obscure it — including aliases, multiple identities, or hidden
          services — may be treated as misuse and may result in access being
          blocked.
        </p>
      </div>
    ),
  },
  {
    icon: Database,
    title: "Ownership of Data",
    color: "from-sky-500/20 to-blue-500/20",
    iconColor: "text-sky-600 dark:text-sky-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Data submitted to the Services remains the property of the person who
          submitted it. MIE does not claim ownership of it and will not use it
          for unrelated purposes without permission.
        </p>
        <p>
          Metadata generated through use of the Services is owned by MIE and is
          handled in accordance with the Privacy and Confidentiality provisions
          above.
        </p>
      </div>
    ),
  },
  {
    icon: Clock,
    title: "Data Retention",
    color: "from-indigo-500/20 to-blue-500/20",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Account and device information is retained for as long as the account
          remains active, because it is required for the account to function.
        </p>
        <p>
          Records of outgoing email are retained for 90 days with personal
          details masked. Authentication activity is retained so that account
          access can be reviewed, and is removed when the account is deleted.
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
          Users have the right to request deletion of their account and
          associated data at any time.
        </p>
        <p>
          To request deletion, visit the{" "}
          <a
            href="/delete-account"
            className="text-primary hover:text-primary/80 underline transition-colors"
          >
            account deletion page
          </a>
          . Requests are processed within 30 days and confirmation is sent when
          complete.
        </p>
        <p>
          Deleting an account removes the account record, all registered device
          records — including device identifiers, push tokens, and the
          device-bound cryptographic secret — and the associated authentication
          activity.
        </p>
      </div>
    ),
  },
  {
    icon: Mail,
    title: "Children and Contact",
    color: "from-emerald-500/20 to-green-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          These applications are intended for use by adults in a workplace or
          organisational setting. They are not directed at children, and MIE
          does not knowingly collect personal information from children.
        </p>
        <p>
          MIE may update this policy from time to time; the date shown above
          reflects the most recent revision.
        </p>
        <p>
          For any question about this policy or about personal data, contact{" "}
          {COMPANY} through the{" "}
          <a
            href="/support"
            className="text-primary hover:text-primary/80 underline transition-colors"
          >
            support page
          </a>
          .
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
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-4 text-base text-muted-foreground"
          >
            {COMPANY}
          </motion.p>
          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-2 text-sm text-muted-foreground"
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
