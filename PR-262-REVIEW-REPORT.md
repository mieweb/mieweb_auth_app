# PR #262 — Detailed Review Report

**Title:** feat: integrate @mieweb/ui component library across all pages  
**Author:** William Reiske (`wreiske@mieweb.com`)  
**Branch:** `feat/mieweb-ui-integration` → `development`  
**Date:** All 13 commits on February 18, 2026  
**Stats:** 94 files changed, +19,098 / −7,107 lines

---

## Table of Contents

1. [Commit-by-Commit Summary](#1-commit-by-commit-summary)
2. [UI Component Library Integration](#2-ui-component-library-integration)
3. [Styling & Theme Changes](#3-styling--theme-changes)
4. [New Pages & Components](#4-new-pages--components)
5. [Deleted Pages, Components & Files](#5-deleted-pages-components--files)
6. [Routing Changes](#6-routing-changes)
7. [Data Layer Changes](#7-data-layer-changes)
8. [Server-Side Changes](#8-server-side-changes)
9. [Firebase Changes](#9-firebase-changes)
10. [Build & DevOps](#10-build--devops)
11. [Dependencies Changed](#11-dependencies-changed)
12. [Utility Changes](#12-utility-changes)
13. [Documentation Changes](#13-documentation-changes)
14. [Test Changes](#14-test-changes)
15. [Other Config & Build Files](#15-other-config--build-files)
16. [Summary: Removed vs Added](#16-summary-removed-vs-added)

---

## 1. Commit-by-Commit Summary

### Commit 1 — `d8689e2` — `feat: integrate @mieweb/ui component library across all pages`

The initial massive integration commit. Key changes:

- Replaced all custom UI elements with `@mieweb/ui` shared library components (`Button`, `Card`, `Input`, `Alert`, `Spinner`, `SiteHeader`, `SiteFooter`, etc.)
- Added Tailwind CSS v4 with `@mieweb/ui` styles
- Added rspack bundler configuration for Meteor
- Updated every page to use the new component library:
  - Web landing page
  - DeleteAccountPage
  - PrivacyPolicyPage
  - SupportPage
  - Login
  - Registration
  - Welcome
  - PendingRegistrationPage
  - WebNotificationPage
- Updated Meteor packages and npm dependencies

### Commit 2 — `93362a5` — `fix: remove unused imports and variables`

Cleanup pass removing unused imports across multiple files:

- `Alert`, `AlertTitle`, `AlertDescription` from `App.jsx`
- `Spinner` from `WebNotificationPage.jsx`
- `Mail`, `Lock` from `Login.jsx`
- `Search` from `NotificationFilters.jsx`
- `Mail`, `Lock` from `Registration.jsx`
- `useNavigate`/`navigate` from `Layout.jsx`
- `Zap`, `fadeIn` from `WebLandingPage.jsx`

### Commit 3 — `a857144` — `fix: hide SiteHeader login/signup buttons`

The `@mieweb/ui` `SiteHeader` ships with login/signup buttons that are irrelevant to this app. Set `showSignUp={false}` and added CSS overrides to hide the auth buttons from both desktop and mobile views.

### Commit 4 — `efda98a` — `fix: set favicon and update site title from 'Meteor App'`

- Generated `favicon.ico`, `favicon-32x32.png`, `favicon-16x16.png`, and `apple-touch-icon.png` from existing logo
- Updated page title from "Meteor App" to "MIE Auth — Open Source Two-Factor Authentication"
- Added favicon `<link>` tags to `client/main.html`

### Commit 5 — `c4760cf` — `fix: convert broken Button as='a' to proper anchor tags`

The `@mieweb/ui` `Button` component doesn't support the polymorphic `as` prop, so `<Button as='a'>` was rendering non-clickable buttons. Converted them to plain `<a>` tags using `buttonVariants()` utility from `@mieweb/ui` for consistent styling.

**Fixed in:**

- `WebLandingPage.jsx` (App Store, Google Play, GitHub, Test Notification links)
- `SupportPage.jsx` (GitHub Issue link)

### Commit 6 — `6d5f7c5` — `fix: resolve white-on-white button text on landing page`

`buttonVariants()` primary variant sets `text-white` via CSS, which overrides `text-gray-900` in Tailwind v4's source order. Switched to `secondary` variant and added inline style overrides for the 4 white store buttons (hero + final CTA sections) to guarantee correct colors.

### Commit 7 — `fb9effc` — `fix: replace dark: Tailwind variants with semantic mieweb/ui theme classes for reliable dark mode`

Replaced all Tailwind `dark:` variant classes across the entire codebase with semantic `@mieweb/ui` theme classes. Examples:

| Before (Tailwind dark variants) | After (semantic theme classes) |
| ------------------------------- | ------------------------------ |
| `dark:bg-gray-800`              | `bg-card`                      |
| `dark:text-white`               | `text-foreground`              |
| `dark:text-gray-300`            | `text-muted-foreground`        |
| `dark:border-gray-700`          | `border-border`                |
| `bg-white dark:bg-gray-900`     | `bg-background`                |

### Commit 8 — `5a1ec43` — `feat: redesign dashboard with welcome banner, stat cards, and tabbed history`

Major dashboard redesign with the following additions:

- **Gradient welcome banner** with personalized greeting
- **Stat cards row** showing: Today's Activity, Pending, Approved, Rejected counts
- **Redesigned profile section** into centered card with separate device card
- **Tab-based notification filtering** — replaced dropdown with `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` from `@mieweb/ui`
- **Streamlined notification list items** with status dots and compact layout
- **Improved empty state** with icon and friendly copy
- **Exposed `statusCounts`** from `useNotificationData` hook
- Fully responsive for mobile and desktop

### Commit 9 — `cacb0bb` — `fix: prevent Biometric Ready badge from overflowing viewport at xl breakpoint`

Changed `FloatingBadge` positioning from `xl:-right-20` to `xl:-right-4 2xl:-right-20` so the badge stays within the viewport at widths near 1280px. The larger offset is now reserved for the 2xl (1536px+) breakpoint where there is sufficient room. Also ran Prettier formatting on `WebLandingPage.jsx`.

### Commit 10 — `c4884e8` — `feat: integrate @mieweb/ui component library across all pages` (second major commit)

Further integration refinements:

- Added `AppStoreButtons`, `MobileAppRequired`, `ProtectedRoute`, and `usePageTitle` components/hooks
- **Rewrote `useNotificationData` hook** from 30-second polling to real-time reactive Meteor subscriptions using `useTracker` + Minimongo
- Added graceful degradation for missing `FIREBASE_SERVICE_ACCOUNT_JSON` and `MAIL_URL` environment variables
- Removed duplicated email configuration code in `server/main.js`
- Removed unnecessary `console.log` statements that could leak user info
- Formatted all files with Prettier

### Commit 11 — `bb01128` — `fix: resolve code review issues and add linting/formatting tooling`

- Removed unused imports (`NotificationFilters`, `Card`, `CardContent`, `ChevronDown`, `Button`, etc.) across mobile and web components
- Removed unused variables (`result`, `notificationResult`, `useSmartRedirectUrl`, `isRequireAdminApproval`, `isRequireSecondaryDeviceApproval`)
- Removed unreachable `console.log` in `server/firebase.js`
- Added **ESLint** with React/React Hooks plugins
- Added **Prettier** with project-consistent config
- Added **Husky** pre-commit hook with **lint-staged**
- Formatted all project files with Prettier

### Commit 12 — `1235b7b` — `style: format workflow and launch.json with prettier`

Applied Prettier formatting to GitHub Actions workflow YAML files and `.vscode/launch.json`.

### Commit 13 — `b661cf3` — `fix: remove unused imports and variables per code review`

Final cleanup:

- Removed unused `tmpdir` import from `os` in `bin/start.mjs`
- Removed unused `fs` import in `bin/start.mjs`
- Removed unused `collection` variable in `migrate-multi-instance.js`

---

## 2. UI Component Library Integration

### New Dependency

`@mieweb/ui` v0.2.0 — a shared MIE Web component library.

### Components Used Across the App

| Component                                        | Where Used                                                                               | Replaces                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `Button`, `buttonVariants()`                     | Every page                                                                               | Custom `<button>` elements with inline Tailwind classes |
| `Card`, `CardContent`, `CardHeader`, `CardTitle` | `App.jsx` (ConnectionError), `ProfileSection`, `LandingPage` (stat cards), all web pages | Custom `<div>` with `bg-white rounded-lg shadow`        |
| `Input`                                          | `Login`, `Registration`, `WebNotificationPage`, `LandingPage` (search)                   | Custom `<input>` with Tailwind classes                  |
| `Spinner`                                        | `App.jsx` (loading), `AppRoutes` (PageLoader), web pages                                 | Custom `animate-spin` div                               |
| `Alert`, `AlertTitle`, `AlertDescription`        | `Registration`, various error states                                                     | Custom error `<div>` elements                           |
| `SiteHeader`, `SiteFooter`                       | `Layout.jsx` wrapper around all web pages                                                | No previous header/footer (or custom implementations)   |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `LandingPage` notification filtering                                                     | Custom dropdown filter                                  |
| `Avatar`, `AvatarFallback`                       | `ProfileSection`                                                                         | Custom avatar div                                       |
| `Badge`                                          | `ProfileSection`, `NotificationList`, `WebLandingPage`                                   | Custom styled spans                                     |
| `Modal` / `Dialog`                               | `ActionsModal`, `BiometricRegistrationModal`, `ResultModal`                              | Custom modal implementations                            |
| `Pagination`                                     | `Pagination` component                                                                   | Custom pagination (simplified)                          |

---

## 3. Styling & Theme Changes

### CSS Entry Point (`client/main.css`)

```css
/* Added before Tailwind import */
@import "@mieweb/ui/styles.css";
@import "tailwindcss";

/* Added source scanning for @mieweb/ui dist files */
@source "../node_modules/@mieweb/ui/dist/**/*.{js,cjs}";

/* New custom keyframe animations */
@keyframes slide-up { ... }
@keyframes draw-check { ... }

@utility animate-slide-up { ... }
@utility animate-draw-check { ... }
```

### Dark Mode Approach — Complete Overhaul

**Before:** Used Tailwind `dark:` variant classes throughout (e.g., `dark:bg-gray-800`, `dark:text-gray-300`, `dark:border-gray-700`).

**After:** Uses semantic CSS custom properties from `@mieweb/ui`:

| Semantic Class                | Purpose                             |
| ----------------------------- | ----------------------------------- |
| `bg-background`               | Page/section backgrounds            |
| `bg-card`                     | Card surfaces                       |
| `text-foreground`             | Primary text                        |
| `text-muted-foreground`       | Secondary/dimmed text               |
| `text-card-foreground`        | Text on cards                       |
| `border-border`               | Borders                             |
| `bg-primary` / `text-primary` | Brand/accent colors                 |
| `text-primary-foreground`     | Text on primary-colored backgrounds |

### Dark Mode Flash Prevention

Added an inline `<script>` in `client/main.html` that reads `localStorage.darkMode` and applies `.dark` class + `data-theme="dark"` on `<html>` before React renders:

```html
<script>
  (function () {
    var stored = localStorage.getItem("darkMode");
    var prefersDark =
      stored === "true" ||
      (stored === null &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (prefersDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  })();
</script>
```

### `useDarkMode` Hook

Rewritten to toggle both `.dark` class AND `data-theme` attribute on `<html>` for the `@mieweb/ui` theme system.

---

## 4. New Pages & Components

| File                                                 | Type              | Description                                                                                                               |
| ---------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `client/web/MobileAppRequired.jsx`                   | **New page**      | Shows "Mobile App Required" page with App Store/Play Store links when web users attempt to access `/login` or `/register` |
| `client/web/NotFoundPage.jsx`                        | **New page**      | 404 catch-all page with navigation back to home                                                                           |
| `client/web/components/AppStoreButtons.jsx`          | **New component** | Reusable component rendering App Store + Google Play download buttons, used in `MobileAppRequired` and `WebLandingPage`   |
| `client/mobile/src/ui/components/ProtectedRoute.jsx` | **New component** | Auth guard — checks `Meteor.userId()` and redirects to `/login` if null                                                   |
| `client/hooks/usePageTitle.js`                       | **New hook**      | Sets `document.title` with "— MIE Auth" suffix, restores previous title on unmount                                        |

### `ProtectedRoute` Implementation

```jsx
export const ProtectedRoute = ({ children }) => {
  if (!Meteor.userId()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};
```

### `usePageTitle` Implementation

```jsx
export const usePageTitle = (title) => {
  useEffect(() => {
    const prev = document.title;
    document.title = title
      ? `${title} — MIE Auth`
      : "MIE Auth — Open Source Two-Factor Authentication";
    return () => {
      document.title = prev;
    };
  }, [title]);
};
```

---

## 5. Deleted Pages, Components & Files

| File                                                | Lines Removed | Description                                                                                                        |
| --------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `client/web/FAQPage.jsx`                            | 263           | FAQ page completely removed; `/faq` route removed from router                                                      |
| `client/mobile/src/ui/components/DeviceSection.jsx` | 29            | Standalone device info component; device info folded into `ProfileSection`                                         |
| `server/adminApi.js`                                | 347           | **Entire admin REST API** — endpoints for `/api/admin/pubkey`, `/api/admin/auth`, device management, email logs    |
| `server/adminAuth.js`                               | 484           | **Admin authentication system** — LDAP bind, session management, RSA key encryption, credential validation         |
| `server/templates/admin.js`                         | 694           | **Admin dashboard HTML template** — single-page admin UI with login form, device management grid, email log viewer |
| `docs/ADMIN_DASHBOARD.md`                           | 92            | Admin dashboard documentation                                                                                      |
| `utils/api/emailLog.js`                             | 80            | Email logging collection, Mongo schema, `createEmailLog` helper, 90-day TTL index                                  |
| `distribution/whatsnew/en-US/default.txt`           | 1             | App store "what's new" text                                                                                        |
| `scripts/mieauth.service`                           | 38            | systemd service unit file                                                                                          |
| `scripts/setup-systemd.sh`                          | 84            | systemd setup/installation script                                                                                  |
| `scripts/start-mieauth.sh`                          | 5             | Simple start script                                                                                                |
| `public/resources/icon-beta.png`                    | binary        | Beta icon image                                                                                                    |

### Admin Dashboard — What Was Removed

The admin dashboard was a self-contained web-based admin panel served at `/admin` with:

- **LDAP authentication** against configurable LDAP servers with group-based access control
- **RSA public-key encryption** for password transit
- **Session management** with secure random tokens
- **REST API endpoints:**
  - `GET /api/admin/pubkey` — get RSA public key
  - `POST /api/admin/auth` — login with LDAP credentials
  - `GET /api/admin/devices` — list all registered devices
  - `POST /api/admin/devices/:id/approve` — approve a device
  - `POST /api/admin/devices/:id/reject` — reject a device
  - `GET /api/admin/email-log` — view email sending history
- **Frontend template** — vanilla HTML/CSS/JS SPA with login form, device data grid, email log viewer

---

## 6. Routing Changes

File: `client/mobile/src/ui/components/AppRoutes.jsx`

### Lazy Loading

Web-only pages are now lazy-loaded with `React.lazy()` + `Suspense` to reduce the initial mobile bundle:

```jsx
const WebLandingPage = lazy(() => import("../../../../web/WebLandingPage").then(...));
const WebNotificationPage = lazy(() => import("../../../../WebNotificationPage").then(...));
const PrivacyPolicyPage = lazy(() => import("../../../../web/PrivacyPolicyPage").then(...));
const SupportPage = lazy(() => import("../../../../web/SupportPage").then(...));
const DeleteAccountPage = lazy(() => import("../../../../web/DeleteAccountPage").then(...));
const NotFoundPage = lazy(() => import("../../../../web/NotFoundPage").then(...));
const MobileAppRequired = lazy(() => import("../../../../web/MobileAppRequired").then(...));
```

### Protected Routes

`/dashboard` and `/biometricModal` are now wrapped in `<ProtectedRoute>` (requires `Meteor.userId()`):

```jsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <LandingPage deviceDetails={deviceUuid} />
    </ProtectedRoute>
  }
/>
```

### Platform-Aware Routes

`/login` and `/register` now show `<MobileAppRequired>` on web instead of the mobile login/register forms:

```jsx
<Route
  path="/login"
  element={
    Meteor.isCordova ? (
      <LoginPage deviceDetails={deviceUuid} />
    ) : (
      <MobileAppRequired mode="login" />
    )
  }
/>
```

### Route Changes

| Route             | Before                           | After                                                             |
| ----------------- | -------------------------------- | ----------------------------------------------------------------- |
| `/faq`            | `<FAQPage />`                    | **Removed**                                                       |
| `/welcome`        | `<WelcomePage />`                | **Removed**                                                       |
| `/login` (web)    | `<LoginPage />`                  | `<MobileAppRequired mode="login" />`                              |
| `/register` (web) | `<RegistrationPage />`           | `<MobileAppRequired mode="register" />`                           |
| `/dashboard`      | `<LandingPage />`                | `<ProtectedRoute><LandingPage /></ProtectedRoute>`                |
| `/biometricModal` | `<BiometricRegistrationModal />` | `<ProtectedRoute><BiometricRegistrationModal /></ProtectedRoute>` |
| `*` (catch-all)   | None                             | Cordova: `<Navigate to="/" />`, Web: `<NotFoundPage />`           |

---

## 7. Data Layer Changes

### `useNotificationData` Hook — Polling → Reactive Subscriptions

**Before (30-second polling):**

```js
// Used Meteor.callAsync with setInterval
const fetchNotificationHistory = useCallback(async () => {
  const response = await Meteor.callAsync(
    "notificationHistory.getByUser",
    userId,
  );
  // Batch fetch device info via Meteor.callAsync("deviceDetails.getByAppId", appId)
  // ...enrich and setState
}, [userId]);

useEffect(() => {
  fetchNotificationHistory();
  const refreshInterval = setInterval(fetchNotificationHistory, 30000);
  return () => clearInterval(refreshInterval);
}, [fetchNotificationHistory]);
```

**After (real-time reactive subscriptions):**

```js
// Uses Meteor.subscribe + useTracker for instant reactive updates
const { allNotifications, isLoading } = useTracker(() => {
  const notifHandle = Meteor.subscribe("notificationHistory.byUser", userId);
  const deviceHandle = Meteor.subscribe("deviceDetails.byUser", userId);
  const isLoading = !notifHandle.ready() || !deviceHandle.ready();

  // Reactively query Minimongo
  const notifications = NotificationHistory.find(
    { userId },
    { sort: { createdAt: -1 }, limit: 50 },
  ).fetch();

  // Enrich with device info from Minimongo
  const userDeviceDoc = DeviceDetails.findOne({ userId });
  // ...
  return { allNotifications: enrichedNotifications, isLoading };
}, [userId]);
```

### New Computed Field: `statusCounts`

```js
const statusCounts = useMemo(() => {
  const counts = {
    pending: 0,
    approve: 0,
    reject: 0,
    total: allNotifications.length,
  };
  allNotifications.forEach((n) => {
    if (n.status === "pending") counts.pending++;
    else if (n.status === "approve") counts.approve++;
    else if (n.status === "reject") counts.reject++;
  });
  return counts;
}, [allNotifications]);
```

### Removed from Return Value

- `error` state
- `fetchNotificationHistory` callback

### Added to Return Value

- `statusCounts`

---

## 8. Server-Side Changes

File: `server/main.js`

### Removed Features

1. **Admin dashboard route handler** — deleted `WebApp.connectHandlers.use('/admin', ...)` that served the admin HTML template
2. **Admin API import** — removed `import "./adminApi"`
3. **Admin template import** — removed `import { adminPageTemplate } from './templates/admin'`
4. **Email logging** — removed `import { EmailLog, createEmailLog } from "../utils/api/emailLog.js"`

### Graceful Degradation

**MAIL_URL:**

```js
// Before:
if (!process.env.MAIL_URL) {
  throw new Error("MAIL_URL or SENDGRID_API_KEY is required for email service");
}

// After:
if (!process.env.MAIL_URL) {
  console.warn(
    "[email] MAIL_URL or SENDGRID_API_KEY is not set – email service will be unavailable.",
  );
}
```

### New Meteor Method: `users.devLogin`

Development-only method that creates a test user and returns credentials. Completely blocked in production:

```js
"users.devLogin": async function () {
  if (!Meteor.isDevelopment) {
    throw new Meteor.Error("not-allowed", "Dev login is only available in development mode");
  }
  const email = "dev@test.local";
  const username = "devuser";
  const password = "devpass123";

  let user = await Meteor.users.findOneAsync({ username });
  if (!user) {
    const userId = await Accounts.createUserAsync({ email, username, password,
      profile: { firstName: "Dev", lastName: "User", registrationStatus: "approved" }
    });
  }
  return { email, password };
}
```

### Console Logging Cleanup

Removed many `console.log` statements that leaked user info (device UUIDs, profile data, registration details). Examples:

- `console.log(' ### Log Step 2 : inside App.jsx, App component rendering with:', JSON.stringify({ capturedDeviceUuid, boolRegisteredDevice, isLoading }))` — **removed**
- `console.log(' ### Log Step 3 : inside AppRoutes.jsx, App routes called with:', JSON.stringify({ isRegistered, deviceUuid }))` — **removed**
- `console.log(" ### Log Step 1: inside main.jsx...")` — **removed**
- `console.log("user is not on Cordova, skipping...")` — **removed**

### Error Handling Simplification

Validation errors in `/send-notification` endpoint refactored from individual response writes to thrown errors:

```js
// Before:
if (!username) {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: false, error: "Username is required." }));
  return;
}

// After:
if (!username) throw new Error("Username is required");
```

### Removed Optional API Key Verification

When `SEND_NOTIFICATION_FORCE_AUTH` is false, previously the server would still try to verify a provided API key gracefully. This fallback logic was removed — now it simply skips verification when auth is not required.

---

## 9. Firebase Changes

File: `server/firebase.js`

### Conditional Initialization

Firebase initialization is now wrapped in a conditional check:

```js
let firebaseInitialized = false;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    );
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseInitialized = true;
  } catch (e) {
    console.warn(
      "[firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:",
      e.message,
    );
  }
} else {
  console.warn(
    "[firebase] FIREBASE_SERVICE_ACCOUNT_JSON env var is not set – push notifications will be unavailable.",
  );
}
```

### Graceful `sendNotification`

```js
export const sendNotification = async (fcmToken, title, body, data = {}) => {
  if (!firebaseInitialized) {
    console.warn(
      "[firebase] Firebase is not initialized – skipping push notification.",
    );
    return null;
  }
  // ...existing logic
};
```

The same guard applies to `sendDeviceApprovalNotification`.

### Other Changes

- Removed unreachable `console.log` after a return statement
- Prettier formatting (single → double quotes, trailing commas)

---

## 10. Build & DevOps

### Meteor Upgrade

`METEOR@3.0.4` → `METEOR@3.4`

### Meteor Package Updates

| Package                 | Before        | After  |
| ----------------------- | ------------- | ------ |
| `mongo`                 | 2.0.2         | 2.2.0  |
| `standard-minifier-css` | 1.9.3         | 1.10.0 |
| `standard-minifier-js`  | 3.0.0         | 3.2.0  |
| `ecmascript`            | 0.16.9        | 0.17.0 |
| `typescript`            | 5.4.3         | 5.9.3  |
| `shell-server`          | 0.6.0         | 0.7.0  |
| `static-html`           | 1.4.0         | 1.5.0  |
| `accounts-password`     | (unversioned) | 3.2.2  |
| `accounts-base`         | (unversioned) | 3.2.0  |
| `check`                 | (unversioned) | 1.5.0  |
| `session`               | (unversioned) | 1.2.2  |
| `sha`                   | (unversioned) | 1.0.10 |

**New Meteor package:** `rspack`

### Rspack Bundler

Added Rust-based bundler as an alternative to Meteor's default bundler:

- `rspack.config.js` — minimal config using `@meteorjs/rspack`
- New devDependencies: `@meteorjs/rspack`, `@rsdoctor/rspack-plugin`, `@rspack/cli`, `@rspack/core`, `@rspack/plugin-react-refresh`, `react-refresh`

```js
// rspack.config.js
const { defineConfig } = require("@meteorjs/rspack");
module.exports = defineConfig((Meteor) => {
  return {};
});
```

### CI/CD Workflows — Complete Restructuring

**Deleted (large monolithic workflows):**

| File                     | Lines     |
| ------------------------ | --------- |
| `deploy-development.yml` | 604 lines |
| `deploy-production.yml`  | 587 lines |

**Added (focused, smaller workflows):**

| File                                    | Lines | Purpose                                              |
| --------------------------------------- | ----- | ---------------------------------------------------- |
| `build-actions-runners-dev.yml`         | 90    | Build on self-hosted actions runners for development |
| `build-android-apk-prod-on-release.yml` | 87    | Build Android APK on GitHub release creation         |
| `build-server-on-release.yml`           | 57    | Build server deployment on release                   |

### Linting & Formatting Tooling

**ESLint** (`eslint.config.js`) — flat config format:

```js
export default [
  { ignores: ["node_modules/**", ".meteor/**", "_build/**", "public/**"] },
  {
    files: ["**/*.{js,jsx,mjs}"],
    plugins: { react: reactPlugin, "react-hooks": reactHooksPlugin },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
```

**Prettier** (`.prettierrc`):

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 80
}
```

**Husky** (`.husky/pre-commit`):

```sh
npx lint-staged
```

**lint-staged** (in `package.json`):

```json
{
  "*.{js,jsx,mjs}": ["prettier --write", "eslint --fix"],
  "*.{json,md,css,html}": ["prettier --write"]
}
```

**New npm scripts:**

```json
{
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "prepare": "husky"
}
```

### `.gitignore` Updates

**Added:**

- `_build` (Meteor Modern-Tools build context)
- `*/build-assets`, `*/build-chunks`
- `.rsdoctor` (rspack diagnostic tool output)

**Removed:**

- `*.aab` duplicate entry (consolidated)
- `setup-dev-server.sh`

---

## 11. Dependencies Changed

### Added

| Package                        | Version | Purpose                        |
| ------------------------------ | ------- | ------------------------------ |
| `@mieweb/ui`                   | ^0.2.0  | Shared UI component library    |
| `@swc/helpers`                 | ^0.5.17 | SWC transpiler runtime helpers |
| `ag-grid-community`            | ^35.1.0 | Data grid library              |
| `ag-grid-react`                | ^35.1.0 | React bindings for AG Grid     |
| `eslint`                       | ^9.39.2 | JavaScript linter              |
| `eslint-plugin-react`          | ^7.37.5 | React-specific ESLint rules    |
| `eslint-plugin-react-hooks`    | ^7.0.1  | React Hooks ESLint rules       |
| `husky`                        | ^9.1.7  | Git hooks manager              |
| `lint-staged`                  | ^16.2.7 | Run linters on staged files    |
| `prettier`                     | ^3.8.1  | Code formatter                 |
| `@meteorjs/rspack`             | ^1.0.0  | Meteor rspack integration      |
| `@rsdoctor/rspack-plugin`      | ^1.2.3  | Rspack diagnostics             |
| `@rspack/cli`                  | ^1.7.1  | Rspack CLI                     |
| `@rspack/core`                 | ^1.7.1  | Rspack core                    |
| `@rspack/plugin-react-refresh` | ^1.4.3  | React Fast Refresh for rspack  |
| `react-refresh`                | ^0.17.0 | React Fast Refresh runtime     |

### Removed

| Package          | Version        | Reason                                                          |
| ---------------- | -------------- | --------------------------------------------------------------- |
| `ldapjs`         | git dependency | Was used by admin LDAP authentication (admin dashboard removed) |
| `react-icons`    | ^5.4.0         | Replaced by `lucide-react` (already present)                    |
| `react-toastify` | ^11.0.2        | Replaced by `@mieweb/ui` toast/alert components                 |

---

## 12. Utility Changes

### `utils/api/deviceDetails.js`

Heavy Prettier reformatting + quote style changes (single → double quotes, trailing commas). Core functional logic preserved.

### `utils/api/apiKeys.js`

Major reformatting. Functional logic preserved but code style completely changed.

### `utils/api/notificationHistory.js`

Reformatted. Added new Meteor publications for the reactive subscription system:

- `notificationHistory.byUser` — publishes notification history for a specific user

### `utils/api/pendingResponses.js`

Reformatted.

### `utils/utils.js`

Reformatted with Prettier. Quote style changes throughout. Functional logic preserved.

### `utils/openExternal.js`

Reformatted.

### `utils/api/emailLog.js`

**Deleted entirely** — email logging collection and `createEmailLog` helper removed along with the admin dashboard.

---

## 13. Documentation Changes

| File                         | Change                                              |
| ---------------------------- | --------------------------------------------------- |
| `README.md`                  | Reformatted with Prettier                           |
| `API_KEY_AUTHENTICATION.md`  | Moved from `docs/` to project root, reformatted     |
| `MULTI_INSTANCE_SOLUTION.md` | Moved from `docs/` to project root, reformatted     |
| `instructions.md`            | Moved from `docs/` to project root, content updated |
| `docs/ADMIN_DASHBOARD.md`    | **Deleted**                                         |

---

## 14. Test Changes

File: `tests/main.js` — 852 lines changed.

Major reformatting with Prettier. The test file was reformatted from single quotes to double quotes with trailing commas throughout. Functional test logic appears preserved but extensively restyled.

---

## 15. Other Config & Build Files

| File                        | Lines Changed | Description                                                       |
| --------------------------- | ------------- | ----------------------------------------------------------------- |
| `mobile-config.js`          | 107           | Reformatted with Prettier                                         |
| `bin/start.mjs`             | 112           | Reformatted; removed unused `tmpdir` (from `os`) and `fs` imports |
| `generate-build-info.js`    | 88            | Reformatted with Prettier                                         |
| `manage-api-keys.js`        | 201           | Reformatted with Prettier                                         |
| `migrate-multi-instance.js` | 212           | Reformatted; removed unused `collection` variable                 |
| `.vscode/launch.json`       | 15            | Reformatted with Prettier                                         |
| `public/buildInfo.json`     | 8             | Updated build metadata                                            |

### New Public Assets

| File                          | Description                         |
| ----------------------------- | ----------------------------------- |
| `public/favicon.ico`          | 5,430 bytes — site favicon          |
| `public/favicon-32x32.png`    | 1,454 bytes — 32×32 favicon         |
| `public/favicon-16x16.png`    | 701 bytes — 16×16 favicon           |
| `public/apple-touch-icon.png` | 15,456 bytes — iOS home screen icon |

### Removed Public Assets

| File                             | Description                       |
| -------------------------------- | --------------------------------- |
| `public/resources/icon-beta.png` | 335,568 bytes — beta icon removed |

---

## 16. Summary: Removed vs Added

| Category             | What Was Removed                                                                                                  | What Was Added/Changed                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Admin Dashboard**  | LDAP-based admin panel (3 server files: `adminApi.js`, `adminAuth.js`, `admin.js` template + docs) — ~1,617 lines | Nothing — admin feature entirely removed                         |
| **Email Logging**    | `emailLog.js` collection + `createEmailLog` helper — 80 lines                                                     | Nothing — feature removed                                        |
| **FAQ Page**         | `FAQPage.jsx` + `/faq` route — 263 lines                                                                          | Nothing — FAQ removed                                            |
| **systemd Scripts**  | `mieauth.service`, `setup-systemd.sh`, `start-mieauth.sh` — 127 lines                                             | Nothing — deployment scripts removed                             |
| **UI Library**       | Custom buttons, cards, inputs, manual dark-mode CSS                                                               | `@mieweb/ui` components + semantic theme tokens across all pages |
| **Bundler**          | Default Meteor bundler only                                                                                       | rspack integration with `@meteorjs/rspack`                       |
| **Data Fetching**    | 30-second polling interval for notifications                                                                      | Real-time reactive Meteor subscriptions via `useTracker`         |
| **Route Protection** | No auth guards on routes                                                                                          | `ProtectedRoute` component + platform-aware route guards         |
| **Code Quality**     | No automated linting/formatting                                                                                   | ESLint + Prettier + Husky + lint-staged                          |
| **Meteor**           | v3.0.4                                                                                                            | v3.4                                                             |
| **Dependencies**     | `ldapjs`, `react-icons`, `react-toastify`                                                                         | `@mieweb/ui`, `ag-grid-*`, `@rspack/*`, linting tools            |
| **CI/CD**            | 2 monolithic workflows (~1,191 lines)                                                                             | 3 focused workflows (~234 lines)                                 |
| **Console Logging**  | Verbose debug logs leaking user data                                                                              | Cleaned up; removed unnecessary/sensitive logs                   |
| **Error Handling**   | Server crashes on missing `MAIL_URL` / `FIREBASE_SERVICE_ACCOUNT_JSON`                                            | Graceful degradation with console warnings                       |

---

_Report generated on February 25, 2026_
