import React, { useState, useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { SiteHeader, SiteFooter, Button } from "@mieweb/ui";
import { Sun, Moon } from "lucide-react";

export const Layout = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  });

  useEffect(() => {
    const isDark = theme === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      setTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const links = [
    { label: "Home", href: "/" },
    { label: "FAQ", href: "/faq" },
    { label: "Test it now", href: "/test-notification" },
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Support", href: "/support" },
  ];

  const footerLinkGroups = [
    {
      title: "Resources",
      links: [
        { label: "Privacy Policy", href: "/privacy-policy" },
        { label: "Support", href: "/support" },
        {
          label: "GitHub",
          href: "https://github.com/mieweb/mieweb_auth_app",
          external: true,
        },
      ],
    },
  ];

  const socialLinks = [
    { platform: "github", href: "https://github.com/mieweb/mieweb_auth_app" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <SiteHeader
        logo={{
          src: "/logo.png",
          alt: "MIE Auth Logo",
          name: "MIE Auth",
          href: "/",
        }}
        links={links}
        variant="white"
        showSignUp={!Meteor.isCordova}
        loginHref={!Meteor.isCordova ? "/login" : undefined}
        signUpHref={!Meteor.isCordova ? "/register" : undefined}
      />

      <main className="flex-grow">{children}</main>

      <div className="flex justify-end px-4 sm:px-6 lg:px-8 py-4 bg-background">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full shadow-sm bg-background text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "light" ? (
            <>
              <Moon className="h-4 w-4" />
              <span className="text-sm">Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="h-4 w-4" />
              <span className="text-sm">Light Mode</span>
            </>
          )}
        </Button>
      </div>

      <SiteFooter
        logo={{
          src: "/logo.png",
          alt: "MIE Auth Logo",
          name: "MIE Auth",
          href: "/",
        }}
        description="Secure, seamless, and privacy-focused authentication for your applications."
        linkGroups={footerLinkGroups}
        socialLinks={socialLinks}
        companyName="MIE Auth"
        variant="dark"
        privacyHref="/privacy-policy"
      />
    </div>
  );
};
