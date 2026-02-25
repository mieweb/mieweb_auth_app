import React, { useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { SiteHeader, SiteFooter } from "@mieweb/ui";

export const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [devLoading, setDevLoading] = useState(false);

  const user = useTracker(() => {
    const meteorUser = Meteor.user();
    if (!meteorUser) return null;
    return {
      id: meteorUser._id,
      name:
        [meteorUser.profile?.firstName, meteorUser.profile?.lastName]
          .filter(Boolean)
          .join(" ") || meteorUser.username,
      email: meteorUser.emails?.[0]?.address,
    };
  }, []);

  const handleDevLogin = useCallback(async () => {
    if (devLoading) return;
    setDevLoading(true);
    try {
      const { password, email } = await Meteor.callAsync("users.devLogin");
      await new Promise((resolve, reject) => {
        Meteor.loginWithPassword(email, password, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      navigate("/dashboard");
    } catch (err) {
      console.error("[dev] Login failed:", err);
      alert(`Dev login failed: ${err.reason || err.message}`);
    } finally {
      setDevLoading(false);
    }
  }, [devLoading, navigate]);

  const handleLogout = useCallback(() => {
    Meteor.logout(() => navigate("/"));
  }, [navigate]);

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
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader
        logo={{
          src: "/logo.png",
          alt: "MIE Auth Logo",
          name: "MIE Auth",
          href: "/",
        }}
        links={links}
        variant="white"
        {...(user
          ? {
              user,
              onLogout: handleLogout,
              userMenuItems: [{ label: "Dashboard", href: "/dashboard" }],
            }
          : Meteor.isDevelopment
            ? {
                onLogin: handleDevLogin,
                signUpHref: "/register",
              }
            : {
                loginHref: "/login",
                signUpHref: "/register",
              })}
      />

      <main className="flex-grow">{children}</main>

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
