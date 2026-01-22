# Test Application for Mieweb Auth Package

This is a simple test application that demonstrates how to use the `mieweb:auth` package in a new Meteor application.

## Setup

1. Add the package to your Meteor app:
```bash
meteor add mieweb:auth
```

2. Create a `.env` file with your Firebase configuration:
```bash
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

## Usage Example

### Server (server/main.js)
```javascript
import { Meteor } from 'meteor/meteor';
import { MiewebAuthServer } from 'meteor/mieweb:auth';

Meteor.startup(() => {
  MiewebAuthServer.configure({
    firebaseServiceAccount: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    customSettings: {
      appName: 'Test App',
      requireAdminApproval: true
    }
  });
});
```

### Client (client/main.js)
```javascript
import { Meteor } from 'meteor/meteor';
import { initializeMiewebAuth } from 'meteor/mieweb:auth';

Meteor.startup(() => {
  initializeMiewebAuth('react-target');
});
```

### HTML (client/main.html)
```html
<head>
  <title>Mieweb Auth Test</title>
</head>

<body>
  <div id="react-target"></div>
</body>
```

## Testing Individual Components

```javascript
import React from 'react';
import { 
  MiewebAuthApp,
  LoginComponent,
  useDeviceRegistration 
} from 'meteor/mieweb:auth';

const CustomApp = () => {
  const { isRegistered } = useDeviceRegistration();
  
  return (
    <div>
      <h1>My Custom App</h1>
      {isRegistered ? <MiewebAuthApp /> : <LoginComponent />}
    </div>
  );
};
```
