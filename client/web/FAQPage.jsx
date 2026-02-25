import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Shield,
  Smartphone,
  Server,
  Key,
  AlertTriangle,
  Settings,
  ExternalLink,
  LifeBuoy,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, Button, buttonVariants, Badge } from "@mieweb/ui";
import { Layout } from "./components/Layout";
import { usePageTitle } from "../hooks/usePageTitle";

const faqData = [
  {
    category: "About MIE Auth",
    icon: Shield,
    color: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
    items: [
      {
        q: "What is MIE Auth?",
        a: "A push-based multi-factor authentication system that works with SSH via LDAP or via direct REST calls from applications. It sends a push challenge to a registered device and returns an approve/deny decision to the requesting service.",
      },
      {
        q: "Why did we build MIE Auth instead of using Microsoft Authenticator, Google Authenticator, or Authy?",
        a: 'Those apps don\'t provide a vendor-neutral, self-hostable "LDAP-triggered push approval" flow. They are mostly TOTP (codes) or tightly coupled to their own identity ecosystems. We needed push approval that our LDAP and applications could trigger directly via REST and enforce for SSH access.',
      },
      {
        q: "Can we use Microsoft Authenticator, Google Authenticator, or Authy instead?",
        a: 'Not as a drop-in for our push-approval LDAP flow. Google/Authy focus on TOTP codes. Microsoft supports push, but generally only within Azure AD/Entra sign-in flows. None offer a simple, generic "LDAP bind → push → approve/deny" API we can own and operate.',
      },
      {
        q: "Is it self-hosted or cloud?",
        a: "You can host the MIE Auth server in your environment for full control, or deploy in a managed environment with HA and geo-redundancy options.",
      },
    ],
  },
  {
    category: "How It Works",
    icon: Settings,
    color: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
    items: [
      {
        q: "How does MIE Auth work for SSH with LDAP?",
        a: "SSH client initiates auth → LDAP receives bind → LDAP calls MIE Auth server via REST → MIE Auth sends push to the user's device → user approves/denies → result returns to MIE Auth → back to LDAP → SSH decision enforced.",
      },
      {
        q: "Can applications call MIE Auth directly without LDAP?",
        a: "Yes. Any app can call the REST API to initiate a push challenge and consume the approval/denial response.",
      },
      {
        q: "What does the integration look like for SSH specifically?",
        a: "OpenSSH talks to LDAP (or PAM/RADIUS tied to LDAP). On bind/challenge, LDAP or PAM calls MIE Auth REST. Approval/denial returns synchronously. Policies, retries, and timeouts are configurable.",
      },
      {
        q: "Can MIE Auth be integrated via PAM, RADIUS, or an IdP?",
        a: "Yes. In addition to LDAP and REST, you can integrate through PAM modules or RADIUS where appropriate, and pair with an IdP for SSO scenarios if desired.",
      },
    ],
  },
  {
    category: "Authentication Methods",
    icon: Key,
    color: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    items: [
      {
        q: "Does MIE Auth support TOTP codes as a backup?",
        a: "Yes. You can enable TOTP as an offline fallback or for environments that can't receive push, while keeping push as the primary factor.",
      },
      {
        q: "What about WebAuthn/FIDO2?",
        a: "WebAuthn is excellent for browser-based logins and is strongly phishing-resistant. For SSH, you'd typically use FIDO2 keys integrated into SSH or an IdP/gateway that fronts SSH. That's a different architecture than LDAP-triggered push. MIE Auth can coexist with WebAuthn if you deploy both (e.g., WebAuthn for web apps, MIE Auth push for SSH/LDAP).",
      },
      {
        q: "Can we require step-up for sensitive operations?",
        a: "Yes. Define policies that require additional factors (TOTP, hardware key, or supervisor approval) based on resource, user group, network, or risk signals.",
      },
      {
        q: 'Why is this preferable to "just use WebAuthn everywhere"?',
        a: "WebAuthn is ideal for web and modern SSH/FIDO2 setups but doesn't slot neatly into an LDAP push-approval flow without re-architecting. MIE Auth gives us consistent push MFA for legacy and SSH/LDAP-based access while allowing WebAuthn where it fits best.",
      },
    ],
  },
  {
    category: "Devices & Enrollment",
    icon: Smartphone,
    color: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-green-600 dark:text-green-400",
    items: [
      {
        q: "What platforms are supported for the mobile app?",
        a: "iOS and Android. Desktop approval options can be added via companion apps or secure browser flows if required.",
      },
      {
        q: "How do users enroll their devices?",
        a: "Admins provision the user; the user pairs the device via QR code or secure link; device is bound to the account with cryptographic keys and device metadata.",
      },
      {
        q: "Does MIE Auth support multiple devices per user?",
        a: "Yes. You can allow or restrict per policy. Each device is uniquely registered and can be independently revoked.",
      },
      {
        q: "What if the user doesn't want another app?",
        a: "We can allow TOTP in compatible authenticator apps as a secondary method. However, push approvals, number matching, and contextual prompts require the MIE Auth app to deliver the full security and UX we designed.",
      },
    ],
  },
  {
    category: "Security & Recovery",
    icon: AlertTriangle,
    color: "from-red-500/20 to-rose-500/20",
    iconColor: "text-red-600 dark:text-red-400",
    items: [
      {
        q: "What happens if the phone is offline?",
        a: "Options include TOTP fallback, backup codes, or temporary bypass with policy controls. You can also configure time-boxed emergency access workflows.",
      },
      {
        q: "How do we handle lost or stolen devices?",
        a: "Admins can revoke device tokens immediately. Users re-enroll a new device using secondary verification and recovery policies (backup codes, admin verification, or hardware key if enabled).",
      },
      {
        q: "How do we mitigate MFA fatigue and push phishing?",
        a: "Number matching, geo/IP context, per-request details, rate limiting, and lockouts on repeated denials. Policies can require step-up (e.g., TOTP or hardware key) for risky requests.",
      },
    ],
  },
  {
    category: "Operations & Compliance",
    icon: Server,
    color: "from-indigo-500/20 to-violet-500/20",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    items: [
      {
        q: "What auditing and compliance features are available?",
        a: "Detailed logs of requests, device, IP, approval/denial, and policy decisions. Export to SIEM via syslog/webhooks. Supports least-privilege admin roles and retention policies.",
      },
      {
        q: "What are the availability and performance characteristics?",
        a: "Push round-trip typically completes in seconds. The server supports horizontal scaling and active-active HA. Local cache policies can prevent lockouts during transient outages.",
      },
      {
        q: "How hard is it to migrate from existing TOTP-only flows?",
        a: "You can keep TOTP enabled while introducing push. Users enroll devices gradually, and you transition policies to prefer push over time.",
      },
    ],
  },
];

const FAQItem = ({
  question,
  answer,
  isOpen,
  onToggle,
  prefersReducedMotion,
}) => (
  <div className="border-b border-border last:border-b-0">
    <button
      onClick={onToggle}
      className="w-full px-6 py-5 text-left flex items-start justify-between hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
      aria-expanded={isOpen}
    >
      <span className="text-base font-medium text-foreground pr-4">
        {question}
      </span>
      {isOpen ? (
        <ChevronUp className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      ) : (
        <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
      )}
    </button>
    {isOpen && (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        transition={{ duration: 0.2 }}
        className="px-6 pb-5"
      >
        <p className="text-sm text-muted-foreground leading-relaxed">
          {answer}
        </p>
      </motion.div>
    )}
  </div>
);

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

export const FAQPage = () => {
  usePageTitle("FAQ");
  const [openItems, setOpenItems] = useState(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const allKeys = faqData.flatMap((cat, ci) =>
    cat.items.map((_, ii) => `${ci}-${ii}`),
  );

  const totalQuestions = allKeys.length;

  const toggleItem = (key) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setOpenItems(new Set());
    } else {
      setOpenItems(new Set(allKeys));
    }
    setExpandAll(!expandAll);
  };

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
              <HelpCircle className="w-10 h-10 text-primary" />
            </div>
          </motion.div>
          <motion.h1
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl font-extrabold tracking-tight"
          >
            Frequently Asked Questions
          </motion.h1>
          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Everything you need to know about MIE Auth — why it exists, how it
            works, and how to get started.
          </motion.p>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6 flex items-center justify-center gap-4"
          >
            <Badge
              variant="secondary"
              className="bg-muted text-muted-foreground border-border"
            >
              {faqData.length} Categories
            </Badge>
            <Badge
              variant="secondary"
              className="bg-muted text-muted-foreground border-border"
            >
              {totalQuestions} Questions
            </Badge>
          </motion.div>
        </div>
      </section>

      {/* Controls */}
      <div className="bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleExpandAll}>
            {expandAll ? "Collapse All" : "Expand All"}
          </Button>
        </div>
      </div>

      {/* FAQ Sections */}
      <section className="bg-background pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {faqData.map((category, ci) => {
            const Icon = category.icon;
            return (
              <FadeIn key={ci} delay={ci * 0.05}>
                <div className="flex items-center space-x-3 mb-4">
                  <div
                    className={`bg-gradient-to-br ${category.color} p-2.5 rounded-xl border border-border`}
                  >
                    <Icon className={`w-5 h-5 ${category.iconColor}`} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    {category.category}
                  </h2>
                </div>
                <Card className="bg-card border-border shadow-lg overflow-hidden">
                  <CardContent className="p-0">
                    {category.items.map((item, ii) => {
                      const key = `${ci}-${ii}`;
                      return (
                        <FAQItem
                          key={key}
                          question={item.q}
                          answer={item.a}
                          isOpen={openItems.has(key)}
                          onToggle={() => toggleItem(key)}
                          prefersReducedMotion={prefersReducedMotion}
                        />
                      );
                    })}
                  </CardContent>
                </Card>
              </FadeIn>
            );
          })}

          {/* Still have questions */}
          <FadeIn delay={0.1}>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-8 text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-primary/10 p-3 rounded-xl border border-primary/20">
                    <LifeBuoy className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Still have questions?
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Open an issue on GitHub or reach out to our support team.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <a
                    href="https://github.com/mieweb/mieweb_auth_app/issues/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "default" })}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open a GitHub Issue
                  </a>
                  <a
                    href="/support"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    <LifeBuoy className="w-4 h-4 mr-2" />
                    Visit Support Page
                  </a>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </section>
    </Layout>
  );
};
