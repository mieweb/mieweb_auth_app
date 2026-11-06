import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Avatar, Button } from "@mieweb/ui";
import {
  KeyRound,
  LogOut,
  Mail,
  Moon,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Sun,
  Users,
} from "lucide-react";
import { RESOURCES } from "../api";
import { useResource } from "../resources";
import { usePageTitle } from "../../hooks/usePageTitle";

export const NAV_GROUPS = [
  {
    label: "Accounts",
    items: [
      { to: "users", label: "Users", icon: Users, badge: "pendingUsers" },
      {
        to: "devices",
        label: "Devices",
        icon: Smartphone,
        badge: "pendingDevices",
      },
    ],
  },
  {
    label: "Integrations",
    items: [
      { to: "api-keys", label: "API Keys", icon: KeyRound },
      { to: "duo", label: "Duo", icon: ShieldCheck },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "emails", label: "Emails", icon: Mail },
      { to: "diagnostics", label: "Diagnostics", icon: Stethoscope },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

const useDarkMode = () => {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.setAttribute(
      "data-theme",
      dark ? "dark" : "light",
    );
  }, [dark]);

  const toggle = () => {
    // Same key the boot script in client/main.html reads before first paint.
    localStorage.setItem("darkMode", String(!dark));
    setDark(!dark);
  };
  return [dark, toggle];
};

/** Pending approval counts shown as nav badges (shares the sections' cached data). */
const usePendingCounts = () => {
  const users = useResource(RESOURCES.users);
  const devices = useResource(RESOURCES.devices);
  return {
    pendingUsers: (users.data?.users || []).filter(
      (u) => u.registrationStatus === "pending",
    ).length,
    pendingDevices: (devices.data?.devices || []).filter(
      (d) => d.status === "pending",
    ).length,
  };
};

const CountBadge = ({ count, label }) =>
  count > 0 ? (
    <span
      className="ml-auto rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
      aria-label={`${count} ${label}`}
    >
      {count}
    </span>
  ) : null;

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
    isActive
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;

const Brand = () => (
  <div className="flex items-center gap-2">
    <img src="/logo.png" alt="" className="h-7 w-7 rounded-md" />
    <span className="text-sm font-semibold text-foreground">MIEAuth</span>
    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      Admin
    </span>
  </div>
);

const IconButton = ({ label, onClick, children }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="h-8 w-8"
  >
    {children}
  </Button>
);

export const AdminShell = ({ username, onSignOut }) => {
  const location = useLocation();
  const counts = usePendingCounts();
  const [dark, toggleDark] = useDarkMode();
  const current = NAV_ITEMS.find((item) =>
    location.pathname.startsWith(`/admin/${item.to}`),
  );
  usePageTitle(current ? `${current.label} · Admin` : "Admin");

  const ThemeIcon = dark ? Sun : Moon;
  const themeLabel = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <div className="min-h-screen bg-muted/40 dark:bg-background">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Brand />
        </div>
        <nav
          aria-label="Admin sections"
          className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, badge }) => (
                  <li key={to}>
                    <NavLink to={`/admin/${to}`} className={navLinkClass}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {label}
                      {badge && (
                        <CountBadge count={counts[badge]} label="pending" />
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Avatar size="sm" name={username} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {username}
            </p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <IconButton label={themeLabel} onClick={toggleDark}>
            <ThemeIcon className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <IconButton label="Sign out" onClick={onSignOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      </aside>

      {/* Mobile / tablet header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <div className="flex items-center gap-1">
            <span className="mr-1 hidden text-sm text-muted-foreground sm:inline">
              {username}
            </span>
            <IconButton label={themeLabel} onClick={toggleDark}>
              <ThemeIcon className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            <IconButton label="Sign out" onClick={onSignOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
        <nav aria-label="Admin sections" className="overflow-x-auto px-2 pb-2">
          <ul className="flex gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, badge }) => (
              <li key={to} className="shrink-0">
                <NavLink to={`/admin/${to}`} className={navLinkClass}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                  {badge && (
                    <CountBadge count={counts[badge]} label="pending" />
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main
        id="admin-main"
        tabIndex={-1}
        className="lg:pl-60 focus:outline-none"
      >
        <div
          key={location.pathname}
          className="mx-auto max-w-6xl animate-fade-in px-4 py-6 sm:px-6 lg:px-8 lg:py-8 motion-reduce:animate-none"
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};
