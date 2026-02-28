# Mieweb Auth Package

A comprehensive Meteor package for mobile authentication with push notifications, biometric authentication, and device management. This package integrates Firebase Cloud Messaging (FCM) for push notifications and supports Cordova mobile applications.

## Features

- 📱 **Mobile Authentication**: Complete authentication flow for mobile devices
- 🔐 **Biometric Authentication**: Fingerprint and face recognition support
- 🔔 **Push Notifications**: Firebase Cloud Messaging integration
- 📊 **Device Management**: Track and manage multiple devices per user
- ⚡ **Real-time Updates**: Reactive data with Meteor's reactivity system
- 🎨 **Responsive UI**: Mobile-first React components with Tailwind CSS

## Installation

Add the package to your Meteor application:

```bash
meteor add mieweb:auth
```

## Environment Setup

Create a `.env` file in your project root with the following configuration:

```bash
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_JSON='{your_firebase_service_account_json}'

# Email Configuration (optional)
MAIL_URL=smtp://username:password@smtp.example.com:587
```

## Quick Start

### 1. Server Setup

In your server startup code:

```javascript
import { Meteor } from 'meteor/meteor';
import { MiewebAuthServer } from 'meteor/mieweb:auth';

Meteor.startup(() => {
  // Configure the package
  MiewebAuthServer.configure({
    firebaseServiceAccount: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    emailSettings: {
      mailUrl: process.env.MAIL_URL
    },
    customSettings: {
      appName: 'Your App Name',
      requireAdminApproval: true
    }
  });
});
```

### 2. Client Setup

#### Option A: Use the Complete App Component

```javascript
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import { initializeMiewebAuth } from 'meteor/mieweb:auth';

Meteor.startup(() => {
  // Initialize the complete authentication app
  initializeMiewebAuth('react-target');
});
```

#### Option B: Use Individual Components

```javascript
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import { 
  MiewebAuthApp,
  LoginComponent,
  RegistrationComponent,
  useDeviceRegistration,
  captureDeviceInfo
} from 'meteor/mieweb:auth';

const MyApp = () => {
  const { isRegistered, registerDevice } = useDeviceRegistration();
  
  React.useEffect(() => {
    if (Meteor.isCordova) {
      captureDeviceInfo();
    }
  }, []);

  return (
    <div>
      {isRegistered ? (
        <MiewebAuthApp />
      ) : (
        <RegistrationComponent onRegister={registerDevice} />
      )}
    </div>
  );
};

Meteor.startup(() => {
  const container = document.getElementById('react-target');
  const root = createRoot(container);
  root.render(<MyApp />);
});
```

## Collections

The package provides several MongoDB collections:

### DeviceDetails
Stores device information and user associations.

```javascript
import { DeviceDetails } from 'meteor/mieweb:auth';

// Get user devices
const userDevices = DeviceDetails.find({ userId: Meteor.userId() }).fetch();
```

### NotificationHistory
Tracks all push notifications sent to users.

```javascript
import { NotificationHistory } from 'meteor/mieweb:auth';

// Get user notifications
const notifications = NotificationHistory.find({ userId: Meteor.userId() }).fetch();
```

### PendingResponses
Manages pending approval responses.

```javascript
import { PendingResponses } from 'meteor/mieweb:auth';

// Check for pending responses
const pending = PendingResponses.find({ username: Meteor.user().username }).fetch();
```

## Methods

### Device Management

```javascript
import { MiewebAuthMethods } from 'meteor/mieweb:auth';

// Register a device
const result = await Meteor.callAsync(MiewebAuthMethods.DEVICE_DETAILS, {
  username: 'user@example.com',
  biometricSecret: 'secret123',
  userId: Meteor.userId(),
  email: 'user@example.com',
  deviceUUID: 'device-uuid-123',
  fcmToken: 'fcm-token-123',
  firstName: 'John',
  lastName: 'Doe',
  isFirstDevice: true
});
```

### Push Notifications

```javascript
// Server-side: Send notification
import { sendNotification } from 'meteor/mieweb:auth';

const result = await sendNotification(
  fcmToken,
  'Notification Title',
  'Notification Body',
  { customData: 'value' }
);
```

## Hooks

The package provides React hooks for common operations:

### useDeviceRegistration

```javascript
import { useDeviceRegistration } from 'meteor/mieweb:auth';

const MyComponent = () => {
  const { 
    isRegistered, 
    registrationStatus, 
    registerDevice, 
    error 
  } = useDeviceRegistration();

  // Your component logic
};
```

### useNotificationData

```javascript
import { useNotificationData } from 'meteor/mieweb:auth';

const MyComponent = () => {
  const { 
    notifications, 
    isLoading, 
    hasMore, 
    loadMore 
  } = useNotificationData();

  // Your component logic
};
```

## Components

### Available Components

- `MiewebAuthApp` - Complete authentication application
- `LoginComponent` - Login form
- `RegistrationComponent` - Registration form  
- `WelcomeComponent` - Welcome screen
- `LandingPageComponent` - Dashboard/landing page
- `PendingRegistrationPage` - Pending approval screen

### Component Props

```javascript
import { LoginComponent } from 'meteor/mieweb:auth';

<LoginComponent
  onLoginSuccess={(user) => console.log('Login successful', user)}
  onLoginError={(error) => console.log('Login failed', error)}
  customStyling={{
    primaryColor: '#your-color',
    backgroundColor: '#your-bg-color'
  }}
/>
```

## Mobile/Cordova Integration

For Cordova applications, the package automatically initializes mobile features:

```javascript
import { 
  captureDeviceInfo,
  initializeBiometrics,
  initializePushNotifications
} from 'meteor/mieweb:auth';

// These are called automatically on 'deviceready' event
// But you can also call them manually:
if (Meteor.isCordova) {
  document.addEventListener('deviceready', () => {
    captureDeviceInfo();
    initializeBiometrics();
    initializePushNotifications();
  });
}
```

## Customization

### Custom Styling

The package uses Tailwind CSS classes. You can override styles by including your own CSS:

```css
/* Override default button styling */
.mieweb-auth-button {
  @apply bg-blue-600 hover:bg-blue-700;
}

/* Override modal styling */
.mieweb-auth-modal {
  @apply bg-gray-800 text-white;
}
```

### Custom Configuration

```javascript
// Server-side configuration
MiewebAuthServer.configure({
  customSettings: {
    // Require admin approval for first device
    requireAdminApproval: true,
    
    // Require approval for secondary devices
    requireSecondaryDeviceApproval: true,
    
    // Custom notification settings
    notificationSettings: {
      retryAttempts: 3,
      retryDelay: 5000
    },
    
    // Custom email templates
    emailTemplates: {
      approval: (data) => `Custom approval email for ${data.username}`,
      rejection: (data) => `Custom rejection email for ${data.username}`
    }
  }
});
```

## Publications

The package automatically publishes data based on user permissions:

- `deviceDetails.byUser` - User's device details
- `notificationHistory.byUser` - User's notification history
- `pendingResponses.byUser` - User's pending responses

## Security

The package implements several security measures:

- Biometric secret validation
- Token-based device authentication
- User-scoped data access
- Input validation with `check`
- Secure Firebase integration

## Requirements

- Meteor 2.8+
- Node.js 14+
- MongoDB
- Firebase project (for push notifications)
- For mobile: Cordova with required plugins

### Required Cordova Plugins

```bash
cordova plugin add @havesource/cordova-plugin-push
cordova plugin add cordova-plugin-device
cordova plugin add cordova-plugin-fingerprint-aio
```

## Development

To contribute to this package:

1. Clone the repository
2. Make your changes in the package directory
3. Test with a sample Meteor application
4. Submit a pull request

## Support

For issues and feature requests, please use the GitHub repository issue tracker.

## License

This package is released under the MIT License. See LICENSE file for details.

## Version History

### 1.0.0
- Initial release
- Complete authentication flow
- Firebase push notifications
- Biometric authentication
- Device management
- React components and hooks
