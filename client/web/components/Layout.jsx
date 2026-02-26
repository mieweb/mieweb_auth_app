import React, { useState, useEffect } from "react";
import { SiteHeader, SiteFooter, Button } from "@mieweb/ui";
import { Sun, Moon } from "lucide-react";

export const Layout = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("darkMode") === "true" ? "dark" : "light";
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
    localStorage.setItem("darkMode", String(isDark));
  }, [theme]);

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
        showSignUp={false}
      />

      <main className="flex-grow">{children}</main>

      <Button
        variant="outline"
        size="icon"
        className="fixed top-1/2 -translate-y-1/2 right-4 z-50 rounded-full shadow-lg bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === "light" ? (
          <Moon className="h-5 w-5" />
        ) : (
          <Sun className="h-5 w-5" />
        )}
      </Button>

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
