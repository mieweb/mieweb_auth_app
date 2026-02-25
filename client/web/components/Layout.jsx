import { Link } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@mieweb/ui";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "FAQ", href: "/faq" },
  { label: "Test it now", href: "/test-notification" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Support", href: "/support" },
];

const footerLinks = [
  {
    title: "Resources",
    links: [
      { label: "FAQ", href: "/faq" },
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

export const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader
        logo={
          <Link to="/" className="flex items-center space-x-3">
            <img
              src="/logo.png"
              alt="MIEWeb Auth Logo"
              className="w-10 h-10 rounded-lg"
            />
            <span className="text-lg font-bold text-foreground">
              MIEWeb Auth
            </span>
          </Link>
        }
        navLinks={navLinks}
        linkComponent={Link}
      />

      {/* Main Content */}
      <main className="flex-grow">{children}</main>

      <SiteFooter
        logo={
          <div className="flex items-center space-x-2 mb-4">
            <img
              src="/logo.png"
              alt="MIEWeb Auth Logo"
              className="w-10 h-10 rounded-md"
            />
            <span className="text-xl font-bold">MIEWeb Auth</span>
          </div>
        }
        description="Secure, seamless, and privacy-focused authentication for your applications."
        columns={footerLinks}
        linkComponent={Link}
        copyright={`\u00A9 ${new Date().getFullYear()} MIEWeb Auth. All rights reserved.`}
      />
    </div>
  );
};
