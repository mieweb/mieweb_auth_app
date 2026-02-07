# Development to Main Branch - Changes Summary

This document outlines all changes from the `development` branch that will be merged into the `main` branch.

## 📊 Overview

**Total Changes:**
- 30 files modified
- 1,399 insertions (+)
- 363 deletions (-)
- 319+ commits

---

## 🎯 Major Feature Additions

### 1. **App Version and Build Information Display**
- Added build information generation script (`generate-build-info.js`)
- Display app version and build number on Support page (Web)
- Display app version and build info on mobile landing page
- Build info automatically generated via prebuild script
- Added `buildInfo.json` to `.gitignore` as it's a generated file

### 2. **API Key Authentication**
- Implemented API key authentication for `/send-notification` endpoint
- Added API key management capabilities
- Enhanced security with proper validation and XSS prevention
- API key documentation in separate files

### 3. **Delete Account Functionality**
- Added delete account page with backend implementation
- Delete account link available in mobile profile
- Comprehensive documentation for account deletion feature
- User data cleanup on account deletion

### 4. **Auto-Biometric Login**
- Automatic biometric authentication trigger on app launch
- Lock screen UI for biometric prompts
- Improved user experience with seamless authentication

### 5. **Multi-Instance Support**
- MongoDB-based multi-instance notification handling
- Multi-instance solution documentation (`MULTI_INSTANCE_SOLUTION.md`)
- Migration script for existing deployments

### 6. **Session Timeout Management**
- 30-minute inactivity logout functionality
- Screen lock-based logout instead of inactivity timer
- Session timeout documentation in README
- Improved security with automatic session management

### 7. **Support and Help System**
- GitHub issue link integration in mobile apps
- Contact Support buttons on Login, Registration, and PendingRegistration pages
- Compact help icon button in DashboardHeader
- Support page with external link handling via `cordova-plugin-inappbrowser`

---

## 🔧 UI/UX Improvements

### Mobile App Enhancements

1. **ActionsModal Redesign**
   - Redesigned for mobile thumb accessibility
   - Larger buttons positioned at bottom for easier reach
   - Added keyboard support (Escape key to close)
   - Accessibility improvements with ARIA attributes
   - Added `scale-98` utility for button press feedback
   - Overflow handling and proper modal backdrop interaction

2. **ResultModal Redesign**
   - Modern mobile UX improvements
   - Better visual feedback and animations
   - Consistent styling with ActionsModal

3. **Notification Experience**
   - Display 'timeout' status for expired pending notifications
   - Show approve hint only when notification is clickable
   - Hide pending hint while modal is open
   - Fix misleading tap-to-approve hint
   - Improved notification click handling
   - Added click handlers to pending notifications in history

4. **Lock Screen UI**
   - Restyled to match app theme
   - Better biometric prompt integration
   - Consistent with overall design language

5. **Landing Page Improvements**
   - Design fixes for mobile landing page
   - Renamed "Msecure" to "MieAuth" for consistency
   - Fixed typo: from-blwue-50 -> from-blue-50

6. **Navigation Improvements**
   - Fixed navigation links to use React Router Link components
   - Proper routing without page reloads
   - Better user experience with instant navigation

### Web App Enhancements

1. **New Web Pages**
   - Support page with GitHub issue link
   - Privacy Policy page
   - Home page updates
   - Removed register page link from login

---

## 🐛 Bug Fixes

### Notification System

1. **Expired Notification Handling**
   - Mark pending notifications as timeout when expired
   - Block pending action modal when notification is expired
   - Proper expiry checks in client and server
   - Comprehensive tests for notification expiry logic

2. **Device Type Display**
   - Fixed notification history showing wrong device type
   - Show responding device in notification history instead of primary device
   - Fixed device info fetching to avoid N+1 queries
   - Update secondary device status to approved in DB after primary device approval

3. **Multi-Device Synchronization**
   - Fixed sync notifications across multiple devices
   - If user clicks "accept" on one phone, other devices get notified
   - Action modal disappears on all devices after action taken
   - Block notifications for unapproved devices

4. **Push Notification Issues**
   - Fixed APNs payload so Firebase Admin no longer rejects messages
   - Set dismissal/sync notifications to use default sound
   - Fixed notification handling when app is in background
   - Removed action buttons from Android notification tray
   - Users now tap notification to open app and approve/deny from within app UI

5. **Firebase Data Stringification**
   - Fixed Firebase notification data stringification error
   - Proper data handling in notification payloads

### Authentication & Registration

1. **User Session Management**
   - Fixed User undefined bug by using profile prop from parent
   - Added missing Session import in ProfileSection
   - Fixed validation issues: email/username matching, client-side validation consistency, and trim behavior

2. **Primary Device Approval**
   - Fixed secondary device registration notification handling
   - Fixed removing bug in case of reject and timeout
   - Today's Activity counter fixed

3. **Biometrics**
   - Fixed biometrics modal errors
   - Fixed issue with login with biometric and notification history

### Email & Communication

1. **Approval Link Error Handling**
   - Improved error messages for approval link failures
   - Added proper error messages with specific reasons (expired, invalid token, user not found, server error)
   - Refactored error detection logic to reusable helper function
   - Added comprehensive tests for error template variations

2. **Email Configuration**
   - Fixed email routing from environment variables
   - Simplified email service config: use MAIL_URL if set, else generate from SENDGRID_API_KEY
   - Updated email templates with better formatting

### Mobile App Specific

1. **Build Number Links**
   - Use `openExternal` for build number link in Cordova apps
   - Proper external browser handling

2. **Icon and Metadata**
   - Updated icons and logo
   - Fixed app metadata and configuration

3. **Android Compatibility**
   - Changed minimum Android version to 35 (Play Store requirement)
   - Fixed permission issues in workflows
   - Fixed Gradle version compatibility (updated to 8.5)

### Deployment & DevOps

1. **GitHub Actions**
   - Fixed service file location in actions
   - Updated workflow files for proper APK building
   - Added google-service.json handling from GitHub secrets
   - Fixed permission denied issues
   - Updated artifact versions (v3 to v4)

2. **Environment Configuration**
   - Added absolute URL in send-notifications
   - Changed package name to include opensource
   - Refactored environment code
   - Added internal secret handling

---

## 🔒 Security Enhancements

### Input Validation & Sanitization
- Added comprehensive input validation for all user inputs
- XSS prevention measures implemented
- User enumeration protection
- Proper SQL injection prevention

### Token Management
- Increased approval token expiry from 3 minutes to 24 hours
- Added token expiration logic with proper error handling
- Better token validation and error messaging
- Proper boundary check alignment for token expiration

### Authentication
- API key authentication for notification endpoints
- Improved session management with timeout
- Better device approval workflow
- Enhanced FCM token handling

---

## 🧪 Testing Improvements

### New Test Coverage
- Comprehensive tests for notification expiry logic
- Tests for error template variations
- Tests for `determineTokenErrorReason` covering multiple scenarios
- Tests for token boundary conditions
- Device-related tests in dedicated describe blocks with proper cleanup

### Test Fixes
- Fixed timestamp check and updated comments
- Address code review feedback for test cleanup
- Better test organization and structure

---

## 📚 Documentation Updates

### New Documentation
- `API_KEY_AUTHENTICATION.md` - Complete API key authentication guide
- `MULTI_INSTANCE_SOLUTION.md` - Multi-instance deployment guide
- Session timeout feature documented in README
- Delete account feature documentation
- Build information feature documentation
- Implementation summary documentation

### README Improvements
- Added 28+ lines of new documentation
- Updated setup instructions
- Added feature descriptions
- Better organization and clarity

---

## 🗄️ Database & Backend Changes

### Collections & Schema
- Added notification history collection with proper indexing
- Updated device details schema for secondary device support
- Enhanced user cleanup for expired admin tokens and rejected users

### API Endpoints
- `/send-notification` endpoint with API key authentication
- Enhanced device registration endpoints
- Improved notification status update endpoints
- Better error handling across all endpoints

### Utilities
- New utility functions in `utils/utils.js`:
  - `determineTokenErrorReason()` - Token error detection
  - `isNotificationExpired()` - Notification expiry checking
- New `utils/openExternal.js` for external link handling
- New `utils/constants.js` for centralized constants
- Enhanced `utils/api/deviceDetails.js` with 42+ new lines
- Improved `utils/api/notificationHistory.js`

---

## 🔄 Dependency Updates

### Added Dependencies
- `cordova-plugin-inappbrowser` - For external link handling
- Build info generation dependencies

### Updated Dependencies (Dependabot)
- Bump `elliptic` and `meteor-node-stubs`
- Bump `react-router` and `react-router-dom`
- Bump `@remix-run/router`, `react-router`, and `react-router-dom`
- Bump `jws`
- Bump `node-forge` from 1.3.1 to 1.3.2
- Bump `glob` from 10.4.5 to 10.5.0
- Bump `axios` from 1.7.9 to 1.12.0
- Bump `form-data`
- Bump `@babel/runtime` from 7.26.0 to 7.27.6

---

## 📱 Mobile Configuration

### Android
- Minimum Android version updated to 35
- Fixed Gradle configuration (version 8.5)
- Proper FCM integration
- Fixed APK build process

### iOS
- Added iOS platform support
- iOS Google-service file configuration
- Proper APNs integration
- Fixed iOS notification handling

### Cordova
- Updated plugin configuration
- Added `cordova-plugin-inappbrowser`
- Fixed mobile-config.js settings
- Better resource management

---

## 🎨 Styling & UI Components

### Tailwind Configuration
- Added `scale-98` utility for button press feedback
- Custom color variants for better visibility
- Improved dark mode support

### Component Updates
- **DashboardHeader**: Added help icon button, improved styling
- **NotificationList**: Better status display, timeout handling
- **ProfileSection**: Enhanced with device info, session timeout UI
- **Login/Registration**: Added support links, better validation display
- **Welcome Screen**: Improved layout and messaging

---

## 🔨 Build & Development

### Build Process
- Added prebuild script for build info generation
- Improved GitHub Actions workflows
- Better artifact management
- Fixed build-related issues

### Development Tools
- `.gitignore` updates for generated files
- VSCode configuration improvements
- Better development documentation

### Deployment
- Fixed deployment automation
- Updated environment variable handling
- Better production/development separation
- Proper secret management

---

## 🌟 User Experience Features

### "Remember Me" Functionality
- Remember last logged-in email for returning users
- Better login experience for repeat users

### Notification Improvements
- Silent sync notifications to avoid cluttering notification area
- Better notification priority handling
- Improved notification payload structure

### Error Handling
- Better error messages throughout the app
- Proper error templates for different scenarios
- User-friendly error displays

---

## 📝 Code Quality Improvements

### Refactoring
- Extracted reusable helper functions
- Better code organization
- Removed redundant code
- Improved error handling patterns

### Code Comments
- Added implementation notes
- Better documentation in code
- Clearer function descriptions

### Removed
- Removed old redundant code
- Cleaned up commented code
- Removed unused imports and dependencies

---

## 🚀 Performance Optimizations

### Database Queries
- Optimized device info fetching to avoid N+1 queries
- Better indexing for notification history
- Efficient multi-device lookups

### Client-Side
- Better state management
- Reduced unnecessary re-renders
- Optimized notification handling

---

## 🔄 Migration & Compatibility

### Migration Scripts
- `migrate-multi-instance.js` - For migrating to multi-instance setup
- `manage-api-keys.js` - For API key management
- User cleanup for expired tokens

### Backward Compatibility
- Maintained compatibility with existing deployments
- Graceful migration paths
- Proper versioning

---

## Summary of File Changes

### Major File Changes (by category)

**Configuration Files:**
- `.gitignore` - Added build artifacts and sensitive files
- `mobile-config.js` - Updated for proper FCM integration
- `package.json` - Added new scripts and dependencies
- `tailwind.config.js` - Added custom utilities

**Client Files:**
- `client/mobile/src/ui/App.jsx` - Enhanced with lock screen and version display
- `client/mobile/src/ui/Login.jsx` - Major refactor with support links
- `client/mobile/src/ui/Modal/ActionsModal.jsx` - Complete redesign for mobile UX
- `client/mobile/src/ui/Modal/ResultModal.jsx` - Enhanced with better feedback
- `client/mobile/src/ui/components/ProfileSection.jsx` - Added device info and session UI
- `client/web/SupportPage.jsx` - Added build info display

**Server Files:**
- `server/main.js` - Major updates with API key auth, better error handling
- `server/firebase.js` - Fixed notification payload issues
- `server/templates/email.js` - Enhanced error templates
- `server/internalSecret.js` - New file for secret management

**Utility Files:**
- `utils/utils.js` - Added helper functions (60+ new lines)
- `utils/openExternal.js` - New file for external link handling
- `utils/constants.js` - New file for centralized constants
- `utils/api/deviceDetails.js` - Enhanced device management (42+ new lines)

**Test Files:**
- `tests/main.js` - Added 243+ lines of new tests

**New Files:**
- `generate-build-info.js` - Build info generation
- `public/buildInfo.json` - Generated build information
- `server/internalSecret.js` - Internal secret management
- `utils/openExternal.js` - External link handling

---

## 🏁 Conclusion

This merge brings **319+ commits** with significant improvements across:
- ✅ Security (API keys, token management, validation)
- ✅ User Experience (Better UI/UX, notifications, mobile accessibility)
- ✅ Features (Auto-login, account deletion, session timeout, version display)
- ✅ Bug Fixes (Notifications, authentication, device handling)
- ✅ Documentation (Comprehensive guides and README updates)
- ✅ Testing (Extensive new test coverage)
- ✅ Performance (Query optimizations, better state management)
- ✅ Code Quality (Refactoring, better patterns, cleaner code)

**Ready for Production:** All features have been tested, documented, and reviewed.
