import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Github,
  Smartphone,
  Lock,
  Zap,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import { Layout } from "./components/Layout";
import { AppStoreButtons } from "./components/AppStoreButtons";
import { usePageTitle } from "../hooks/usePageTitle";

const highlightFaqs = [
  {
    q: "What is MIE Auth?",
    a: "A push-based multi-factor authentication system that works with SSH via LDAP or via direct REST calls. It sends a push challenge to your registered device and returns an approve/deny decision.",
  },
  {
    q: "Why not use Google Authenticator or Microsoft Authenticator?",
    a: 'Those apps focus on TOTP codes or are tied to their own ecosystems. MIE Auth provides a vendor-neutral, self-hostable "LDAP bind → push → approve/deny" flow you fully own and operate.',
  },
  {
    q: "How does it work with SSH?",
    a: "SSH → LDAP bind → REST call to MIE Auth → push notification → user approves/denies → decision flows back through LDAP to SSH. The entire round-trip completes in seconds.",
  },
  {
    q: "What if my phone is offline?",
    a: "TOTP fallback, backup codes, or policy-controlled temporary bypass are all supported. You can also configure time-boxed emergency access workflows.",
  },
];

export const WebLandingPage = () => {
  const [openFaq, setOpenFaq] = useState(null);
  usePageTitle("Home");

  return (
    <Layout>
      {/* Hero Section */}
      <div className="relative bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <svg
              className="hidden lg:block absolute right-0 inset-y-0 h-full w-48 text-white transform translate-x-1/2"
              fill="currentColor"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="50,0 100,0 50,100 0,100" />
            </svg>

            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-2xl tracking-tight font-extrabold text-gray-900 sm:text-3xl md:text-4xl">
                  <span className="block xl:inline">Secure Authentication</span>{" "}
                  <span className="block text-blue-600 xl:inline">
                    at your fingertips
                  </span>
                </h1>
                <p className="mt-3 text-sm text-gray-500 sm:mt-5 sm:text-base sm:max-w-xl sm:mx-auto md:mt-5 md:text-lg lg:mx-0">
                  Experience the next generation of security with the MIEWeb
                  Auth mobile app. Biometric verification, push notifications,
                  and seamless login management all in one place.
                </p>

                <div className="mt-8 sm:mt-10">
                  <p className="text-sm font-semibold text-muted-foreground tracking-wider uppercase mb-4">
                    Download the App
                  </p>
                  <AppStoreButtons />

                  <div className="mt-6 flex items-center sm:justify-center lg:justify-start space-x-4">
                    <a
                      href="https://github.com/mieweb/mieweb_auth_app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-500 hover:text-gray-900 flex items-center transition-colors"
                    >
                      <Github className="w-4 h-4 mr-1" />
                      View Source Code
                    </a>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2 bg-gray-50 flex items-center justify-center">
          {/* Abstract Phone Mockup / Illustration */}
          <div className="relative w-full h-64 sm:h-72 md:h-96 lg:h-full flex items-center justify-center">
            <div className="w-64 h-96 bg-gray-900 rounded-[3rem] border-8 border-gray-800 shadow-2xl flex flex-col overflow-hidden relative transform rotate-[-5deg] hover:rotate-0 transition-transform duration-500">
              <div className="absolute top-0 w-full h-6 bg-gray-800 z-20 flex justify-center">
                <div className="w-20 h-4 bg-black rounded-b-xl"></div>
              </div>
              <div className="flex-1 bg-white relative overflow-hidden">
                {/* Mock App UI */}
                <div className="p-6 flex flex-col h-full">
                  <div className="mt-8 mb-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                      <img
                        src="/logo.png"
                        alt="App Logo"
                        className="w-12 h-12"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Welcome Back
                    </h3>
                    <p className="text-sm text-gray-500">
                      Please authenticate to continue
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="h-12 bg-gray-100 rounded-lg w-full animate-pulse"></div>
                    <div className="h-12 bg-blue-600 rounded-lg w-full shadow-lg flex items-center justify-center text-white font-medium">
                      Login
                    </div>
                  </div>
                  <div className="mt-auto flex justify-center">
                    <div className="w-12 h-12 border-2 border-blue-500 rounded-full flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Why MIE Auth Section */}
      <div className="py-16 bg-gray-50 overflow-hidden lg:py-24">
        <div className="relative max-w-xl mx-auto px-4 sm:px-6 lg:px-8 lg:max-w-7xl">
          <div className="relative">
            <h2 className="text-center text-xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-2xl">
              Why MIE Auth?
            </h2>
            <p className="mt-4 max-w-3xl mx-auto text-center text-base text-gray-500">
              A push-based multi-factor authentication system you can own and
              operate.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="relative mt-12 lg:mt-16 lg:grid lg:grid-cols-3 lg:gap-8">
            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                <Lock className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="mt-5 text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Secure
                </h3>
                <p className="mt-2 text-base text-gray-500">
                  Your data is protected with encryption and security protocols.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                <Zap className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="mt-5 text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Lightning Fast
                </h3>
                <p className="mt-2 text-base text-gray-500">
                  Optimized performance ensures your users never have to wait to
                  log in.
                </p>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                <CheckCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="mt-5 text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Easy Integration
                </h3>
                <p className="mt-2 text-base text-gray-500">
                  Simple API and SDKs make it easy to add authentication to any
                  app.
                </p>
              </div>
            </div>
          </div>

          {/* Quick FAQ */}
          <div className="mt-16 lg:mt-20 max-w-3xl mx-auto">
            <h3 className="text-center text-lg font-bold text-gray-900 sm:text-xl mb-2">
              Common Questions
            </h3>
            <p className="text-center text-sm text-gray-500 mb-8">
              Quick answers to what matters most.{" "}
              <Link
                to="/faq"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                See all FAQs &rarr;
              </Link>
            </p>
            <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100 divide-y divide-gray-100">
              {highlightFaqs.map((item, i) => (
                <div key={i}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors focus:outline-none"
                    aria-expanded={openFaq === i}
                  >
                    <span className="text-sm font-medium text-gray-900 pr-4">
                      {item.q}
                    </span>
                    {openFaq === i ? (
                      <ChevronUp className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-5">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {item.a}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link
                to="/faq"
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                View all frequently asked questions
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
