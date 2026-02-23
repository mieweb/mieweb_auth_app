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
  Users,
  Settings,
  Globe,
} from "lucide-react";
import { Layout } from "./components/Layout";

const faqData = [
  {
    category: "About MIE Auth",
    icon: Shield,
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

const FAQItem = ({ question, answer, isOpen, onToggle }) => (
  <div className="border-b border-gray-200 last:border-b-0">
    <button
      onClick={onToggle}
      className="w-full px-6 py-5 text-left flex items-start justify-between hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
      aria-expanded={isOpen}
    >
      <span className="text-base font-medium text-gray-900 pr-4">
        {question}
      </span>
      {isOpen ? (
        <ChevronUp className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
      ) : (
        <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
      )}
    </button>
    {isOpen && (
      <div className="px-6 pb-5">
        <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
      </div>
    )}
  </div>
);

export const FAQPage = () => {
  const [openItems, setOpenItems] = useState(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const allKeys = faqData.flatMap((cat, ci) =>
    cat.items.map((_, ii) => `${ci}-${ii}`),
  );

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
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-white/20 p-3 rounded-full">
              <HelpCircle className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-lg text-blue-100 max-w-2xl mx-auto">
            Everything you need to know about MIE Auth — why it exists, how it
            works, and how to get started.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-end">
        <button
          onClick={handleExpandAll}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors focus:outline-none"
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {/* FAQ Sections */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-10">
        {faqData.map((category, ci) => {
          const Icon = category.icon;
          return (
            <div key={ci}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {category.category}
                </h2>
              </div>
              <div className="bg-white shadow rounded-lg overflow-hidden">
                {category.items.map((item, ii) => {
                  const key = `${ci}-${ii}`;
                  return (
                    <FAQItem
                      key={key}
                      question={item.q}
                      answer={item.a}
                      isOpen={openItems.has(key)}
                      onToggle={() => toggleItem(key)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Still have questions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Still have questions?
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Open an issue on GitHub or reach out to our support team.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://github.com/mieweb/mieweb_auth_app/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              Open a GitHub Issue
            </a>
            <a
              href="/support"
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
            >
              Visit Support Page
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
};
