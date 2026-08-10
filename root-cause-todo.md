# Root Cause TODO

Findings from the 2026-08-07 "push notifications not received" investigation. The admin Diagnostics tab (user lookup + test push) has already shipped; the items below are the underlying fixes still to do.

## 1. Client calls a nonexistent method to persist refreshed FCM tokens

- **Issue:** `client/mobile/push-notifications.js` (`setupRegistrationHandler`) calls `Meteor.call("deviceDetails.storeFCMToken", ...)`, but that method does not exist on the server — it fails with `Method not found [404]` on every app start. Client-writable token methods were deliberately removed (see `tests/deviceManagement.js` "FCM token lookups are no longer exposed as Meteor methods").
- **Impact:** When FCM rotates a token (reinstall, restore, OS update), the server keeps sending to the stale token and the device silently stops receiving pushes.
- **Fix:** Add a secure, authenticated token-refresh method that requires the caller's `deviceUUID` (and validates ownership/approved status), then call it from the `registration` handler. Remove or guard the dead `storeFCMToken` call.

## 2. Per-device registration date is not stored

- **Issue:** `registerDeviceDetails` (`utils/api/deviceDetails.js`) never records when a device was registered. Only the user document's top-level `createdAt` (first device) exists; `devices[].lastUpdated` is overwritten by every later mutation.
- **Impact:** Admins cannot tell when a device was added — useful for diagnostics and security review (e.g. spotting unexpected device additions).
- **Fix:**
  - Set `registeredAt: new Date()` in both device-creation paths (first-device insert and the `$push` for additional devices).
  - Preserve `registeredAt` in the update-existing-device branch (re-registration should not reset it — or decide explicitly that it should).
  - Expose `registeredAt` in `/api/admin/devices/list` and `/api/admin/diagnostics/user`, and render it in the Devices and Diagnostics tabs.
  - Backfill note: existing devices have no value — display "unknown" or backfill from `lastUpdated`.

## 3. Unsupported iOS push init options

- **Issue:** `configurePushNotifications` passes `foreground` and `priority` in the iOS init block; the installed plugin logs `Settings: Invalid option key` for both.
- **Impact:** Harmless, but produces misleading noise in device diagnostics logs.
- **Fix:** Remove the unsupported keys from the `ios` init options.

## 4. Exposed FCM token from diagnostics logs

- **Issue:** The user's diagnostics log shared on 2026-08-07 contained a full, live FCM registration token.
- **Fix:** Treat that token as exposed — force the device to re-register (rotates the token) once item 1 lands. Consider redacting FCM tokens in the diagnostics log capture going forward.

## 5. Runaway timeout loop on app resume (2026-08-10 log)

- **Issue:** Resuming the app fired `notificationHistory.updateStatus(..., "timeout")` ~1,400 times in 6 seconds for an already-approved Aug 7 notification (`QJSAZbvA8LSfP5ZKy`). Chain:
  - `handleAppResume` (`client/mobile/src/ui/hooks/useNotificationHandler.js`) restored a **stale** `pendingNotification` from localStorage — it was never cleared after the notification was approved.
  - `ActionsModal` opened with the ancient `createdAt`; `calculateInitialTime() <= 0` triggers `handleTimeout()` inside the effect.
  - `onTimeOut` (`handleTimeout` in `LandingPage.jsx`) is not memoized, and the client method stub's Minimongo write re-renders the page, so the effect re-runs on every render → repeated `updateStatus` calls until the first server ack closes the modal.
- **Impact:** DDP method flood, and the notification's `approve` status was overwritten to `timeout` (audit trail corrupted).
- **Fixes:**
  - Clear `pendingNotification` from localStorage whenever the notification is resolved (approve/reject/timeout), and validate `createdAt` on resume — discard expired entries instead of opening the modal.
  - Wrap `handleTimeout` in `useCallback` in `LandingPage.jsx`; add a one-shot guard (ref) in `ActionsModal` so `handleTimeout` fires at most once per open.
  - Server-side: `notificationHistory.updateStatus` (`utils/api/notificationHistory.js`) must require `this.userId`, verify ownership, and only allow `pending → timeout` transitions (never overwrite a handled status). Add a DDP rate limit.

## 6. notificationHistory methods lack authentication

- **Issue:** `notificationHistory.updateStatus`, `getLastIdByUser`, `getByUser`, and `getByStatus` have no `this.userId` / ownership checks — any connected client can read or rewrite any user's notification history by guessing/knowing ids.
- **Fix:** Require authentication, scope reads to `this.userId`, and validate status transitions server-side.
