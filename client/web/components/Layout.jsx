import React from 'react';
import { useLocation } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '@mieweb/ui';

export const Layout = ({ children }) => {
  const location = useLocation();

  const links = [
    { label: 'Home', href: '/' },
    { label: 'Test it now', href: '/test-notification' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Support', href: '/support' },
  ];

  const footerLinkGroups = [
    {
      title: 'Resources',
      links: [
        { label: 'Privacy Policy', href: '/privacy-policy' },
        { label: 'Support', href: '/support' },
        { label: 'GitHub', href: 'https://github.com/mieweb/mieweb_auth_app', external: true },
      ],
    },
  ];

  const socialLinks = [
    { platform: 'github', href: 'https://github.com/mieweb/mieweb_auth_app' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader
        logo={{
          src: '/logo.png',
          alt: 'MIEWeb Auth Logo',
          name: 'MIEWeb Auth',
          href: '/',
        }}
        links={links}
        variant="white"
        showSignUp={false}
        onLogin={null}
      />

      <main className="flex-grow">
        {children}
      </main>

      <SiteFooter
        logo={{
          src: '/logo.png',
          alt: 'MIEWeb Auth Logo',
          name: 'MIEWeb Auth',
          href: '/',
        }}
        description="Secure, seamless, and privacy-focused authentication for your applications."
        linkGroups={footerLinkGroups}
        socialLinks={socialLinks}
        companyName="MIEWeb Auth"
        variant="dark"
        privacyHref="/privacy-policy"
      />
    </div>
  );
};
