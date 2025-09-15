# Migration Guide: From Standalone App to Package

This guide explains how to transition from the original standalone Mieweb Auth App to using the `mieweb:auth` package.

## Current State

After the refactoring, you have two options:

### Option 1: Keep Using Original App (No Changes Needed)
- All original files remain in place
- App continues to work as before
- Use this if you want to keep the standalone app

### Option 2: Migrate to Package (Recommended for Reusability)
- Use the packaged version for better modularity
- Easier to integrate into other apps
- Better maintainability

## Migration Steps

### Step 1: Add Package to Your App
```bash
meteor add mieweb:auth
```

### Step 2: Update Server Code
Replace your server/main.js imports:

**Before:**
```javascript
import { DeviceDetails } from "../utils/api/deviceDetails.js";
import { NotificationHistory } from "../utils/api/notificationHistory.js"
import { sendNotification } from "./firebase";
```

**After:**
```javascript
import { 
  DeviceDetails, 
  NotificationHistory,
  sendNotification 
} from 'meteor/mieweb:auth';
```

### Step 3: Update Client Code
Replace your client/main.jsx:

**Before:**
```javascript
import { App } from './mobile/src/ui/App';
import { captureDeviceInfo } from './mobile/capture-device-info';
// ... existing imports and setup
```

**After:**
```javascript
import { initializeMiewebAuth } from 'meteor/mieweb:auth';

Meteor.startup(() => {
  initializeMiewebAuth('react-target');
});
```

### Step 4: Configure the Package
Add to your server startup:

```javascript
import { MiewebAuthServer } from 'meteor/mieweb:auth';

Meteor.startup(() => {
  MiewebAuthServer.configure({
    firebaseServiceAccount: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    customSettings: {
      appName: 'Your App Name'
    }
  });
});
```

## File Cleanup (Optional)

If you decide to fully migrate to the package, you can remove these original files:

### Safe to Remove (if using package):
- `client/mobile/` (mobile utilities now in package)
- `client/WebNotificationPage.jsx` (if not used elsewhere)
- Duplicate React components (now in package)

### Keep These Files:
- `server/main.js` (but update imports to use package)
- `utils/api/` (contains your Meteor methods - still needed)
- `.env` and configuration files
- `mobile-config.js` (for Cordova builds)

### Files Analysis:
- ✅ **Keep**: Core server logic, environment config
- ⚠️  **Update**: Import statements to use package
- 🗑️ **Optional Remove**: Duplicate UI components

## Coexistence Strategy (Recommended)

You can run both versions side by side:

1. **Original app**: Keep working as-is for current users
2. **Package version**: Use for new features or other apps
3. **Gradual migration**: Move features one by one

## Testing Your Migration

1. **Test package installation**:
   ```bash
   meteor add mieweb:auth
   meteor
   ```

2. **Test package imports**:
   ```javascript
   import { DeviceDetails } from 'meteor/mieweb:auth';
   console.log(DeviceDetails); // Should not be undefined
   ```

3. **Test UI components**:
   ```javascript
   import { initializeMiewebAuth } from 'meteor/mieweb:auth';
   initializeMiewebAuth('test-container');
   ```

## Rollback Plan

If something goes wrong:

1. Remove the package: `meteor remove mieweb:auth`
2. Revert import statements to original paths
3. Original app continues to work

## Benefits of Package Migration

### ✅ Advantages:
- **Reusability**: Use in multiple apps
- **Maintainability**: Centralized updates
- **Modularity**: Clean separation of concerns
- **Documentation**: Better docs and examples
- **Testing**: Package-level tests

### ⚠️ Considerations:
- **Learning curve**: New import paths
- **Dependencies**: Package manages its own deps
- **Customization**: May require package modifications

## Support

- Check `packages/mieweb-auth/README.md` for full documentation
- See `example-usage/` directory for integration examples
- Run `./cleanup.sh` for file analysis

## Quick Reference

### Package Exports
```javascript
// Collections
import { DeviceDetails, NotificationHistory } from 'meteor/mieweb:auth';

// Components  
import { MiewebAuthApp, LoginComponent } from 'meteor/mieweb:auth';

// Hooks
import { useDeviceRegistration } from 'meteor/mieweb:auth';

// Server functions
import { sendNotification, MiewebAuthServer } from 'meteor/mieweb:auth';

// Utilities
import { isValidToken, generateAppId } from 'meteor/mieweb:auth';
```

Choose the migration path that best fits your needs!
