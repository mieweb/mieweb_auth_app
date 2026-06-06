# Watch Support — Refined Ticket & Implementation Plan

> **Status: PROPOSAL — awaiting approval. No implementation has been done.**
>
> This document refines the original "Apple Watch" issue ("I'd like to approve
> from my watch") into an actionable ticket grounded in how MIEAuth actually
> works today, and proposes a phased plan to deliver wrist-based approvals on
> **both Apple Watch (paired iPhone) and Wear OS (paired Android phone)**.

---

## 1. Refined Ticket

### Title
Watch Support — approve / reject MIEAuth requests from a paired smartwatch
(Apple Watch and Wear OS)

### User story
As a MIEAuth user who wears a smartwatch paired to my phone, I want incoming
approval requests (e.g. "MIE Sudo Security Alert", new-device registration) to
appear on my wrist with **Approve** and **Reject** buttons, so I can respond to
a request without taking my phone out. This must work on both **Apple Watch**
(paired to iPhone) and **Wear OS** (paired to Android phone).

### Background (how approvals work today)
MIEAuth is a Meteor + React app deployed to mobile via Cordova. Push delivery
uses **Firebase Cloud Messaging (FCM)**; on iOS, FCM relays through **APNs**.

- The server builds and sends notifications in
  [`server/firebase.js`](../server/firebase.js) via `sendNotification(...)`.
  The iOS payload already sets `aps.category = "APPROVAL"`,
  `mutable_content: true`, and `content_available`; the Android payload is sent
  with `priority: "high"`.
- Action buttons (`approve` / `reject`) are passed **dynamically in the FCM
  data payload** (see the `actions` array in
  [`send_notification.sh`](../send_notification.sh) and
  `sendSecondaryDeviceApprovalRequest` in `server/firebase.js`).
- On the device they are handled by the
  [`@havesource/cordova-plugin-push`](../mobile-config.js) plugin. The client
  registers `push.on("approve", ...)` / `push.on("reject", ...)` handlers in
  [`client/mobile/push-notifications.js`](../client/mobile/push-notifications.js),
  which call the `notifications.handleResponse` Meteor method.
- Per-user devices (FCM token, `deviceUUID`, `isPrimary`,
  `deviceRegistrationStatus`, `deviceModel`, `devicePlatform`) are stored in the
  `deviceDetails` collection — see
  [`utils/api/deviceDetails.js`](../utils/api/deviceDetails.js).

### The key technical constraint (per platform)
Neither watchOS nor Wear OS runs the app's Cordova/WebView code. Both platforms
**mirror/bridge** a phone notification to the wrist and forward any button tap
**back to the phone app** to handle. The blocker differs by platform:

- **Apple Watch:** the watch only renders action buttons that come from a
  **statically registered `UNNotificationCategory`**. The current
  `@havesource/cordova-plugin-push` actions are registered **at runtime from the
  push payload**, which the watch ignores. The fix is to register the
  `APPROVAL` category and its `approve`/`reject` actions **statically** on iOS.
- **Android (Wear OS):** action buttons are rendered from **`NotificationCompat`
  actions** (each backed by a `PendingIntent`). Wear OS bridges these to the
  watch automatically as long as the notification is not local-only (this app
  uses `forceShow: true` / `priority: "high"` and does **not** set local-only).
  The fix is to ensure the approve/reject actions are emitted as
  `NotificationCompat` actions so they bridge to the watch.

### Acceptance criteria
1. When the phone is locked / pocketed and a paired watch is active, an approval
   request is **mirrored/bridged to the watch** as a notification — on both
   Apple Watch and Wear OS.
2. The watch notification shows **Approve** and **Reject** action buttons on
   both platforms.
3. Tapping **Approve** / **Reject** on the watch produces the same server-side
   result as tapping them on the phone (calls `notifications.handleResponse`
   with the correct `userId`, `action`, `notificationId`, `deviceUUID`). The
   user receives confirmation on the wrist (the system's default haptic plus
   the notification dismissing), and an action failure surfaces the same
   fallback path the phone uses today (the `trayActionResult` error in
   `client/mobile/push-notifications.js`).
4. Approving/rejecting from the watch resolves the request the same way the
   phone does today (success/timeout/already-handled behaviour is consistent),
   and de-duplication with the phone modal flow still works.
5. No regression to existing Android or iPhone-only push behaviour.

### Out of scope (for the first deliverable)
- Standalone (cellular) watch apps that work without the paired phone —
  applies to both LTE Apple Watch and standalone Wear OS.
- Independent enrollment / biometric secret storage on the watch.
- watchOS complications / Wear OS tiles or Siri shortcuts.

---

## 2. Background research summary

| Concern | Current state | Implication for watch |
|---|---|---|
| Push transport | FCM → APNs on iOS; FCM on Android (`server/firebase.js`) | Unchanged; watch mirrors/bridges the phone's notification. |
| Action buttons | Sent dynamically in FCM `data.actions` | **Apple:** must move to a static `UNNotificationCategory`. **Android:** must be emitted as `NotificationCompat` actions so Wear OS bridges them. |
| iOS category | `aps.category = "APPROVAL"` already set | Reuse this category id when registering it natively. |
| Android channel | `forceShow: true`, `priority: "high"`, not local-only (`client/mobile/push-notifications.js`) | Notifications already bridge to Wear OS; only the action rendering needs alignment. |
| Action handling | `push.on("approve"/"reject")` in WebView | Watch taps are delivered to the **phone** app, not the watch OS; the existing handlers can still fire if the actions are wired through the plugin. |
| Device identity | `deviceUUID` from `Session.get("capturedDeviceInfo")` | Watch action would be attributed to the paired **phone's** `deviceUUID` (proposed for Phase 1, pending product sign-off — see Risks). |

**Important reality check:** because both watchOS and Wear OS forward
interactions back to the paired **phone** app, "approve from watch" is
achievable on both platforms **without** writing a native watch app — *provided*
the approve/reject actions are exposed in the form each platform mirrors: a
static `UNNotificationCategory` on iOS and `NotificationCompat` actions on
Android. Native watch companion apps are only required for the
standalone/independent experience, which is intentionally out of scope for
Phase 1.

---

## 3. Proposed plan

### Phase 0 — Spike / validation (no shipping code)
- **Apple:** confirm a paired Apple Watch mirrors a notification carrying
  `aps.category = "APPROVAL"`, and verify whether
  `@havesource/cordova-plugin-push` lets us register a **static**
  `UNNotificationCategory` (via `App.appendToConfig`/native config in
  `mobile-config.js`, or a small config-only plugin hook) whose action
  identifiers match the existing `approve` / `reject` callbacks.
- **Android:** confirm a paired Wear OS watch bridges the approval notification
  and renders its `NotificationCompat` action buttons, and verify the plugin
  emits the dynamic actions as real `NotificationCompat` actions (not just
  in-payload data).
- **Decision gate:** for each platform, config/plugin-only approach vs. minimal
  native watch target.

### Phase 1 — Watch approvals via notification mirroring/bridging (primary deliverable)
1. **Apple — register a static `APPROVAL` category on iOS** with `approve` and
   `reject` actions (identifiers matching today's callbacks) so Apple Watch
   renders the buttons. Driven from `mobile-config.js` so it stays in the
   Cordova build.
2. **Android — ensure approve/reject are `NotificationCompat` actions** so Wear
   OS bridges them to the watch, each backed by a `PendingIntent` that routes
   to the same handler the plugin already uses.
3. **Server payload alignment** (`server/firebase.js`): today the `APPROVAL`
   category is set on the APNs payload, but the action-routing fields
   (`userId` / `notificationId` / `deviceUUID`) are primarily consumed by the
   in-app modal flow and are not guaranteed to be present in the data payload
   for every approval path. Audit each `sendNotification(...)` call site and
   ensure these fields are consistently included (for both platforms) so a
   watch-triggered action can reach `notifications.handleResponse`.
4. **Client action routing** (`client/mobile/push-notifications.js`): confirm
   `push.on("approve"/"reject")` fires for actions triggered from either watch
   (delivered via the paired phone) and that the existing
   `actionPerformedFromTray` de-dup logic still prevents double-handling.
5. **Tests** consistent with `tests/main.js`: payload-shape unit tests asserting
   the iOS `APPROVAL` category, the Android action structure, and the required
   action data fields are present.
6. **Docs**: add a "Watch Support" subsection to `README.md` and a manual test
   checklist for both platforms (locked phone, wrist-only approve/reject,
   timeout).

### Phase 2 (optional, later) — Native watch companion apps
- Only if independent/standalone behaviour is required. Adds a native watch
  target outside the Cordova build (Swift/SwiftUI for watchOS; Kotlin/Compose
  for Wear OS), each with its own push registration and a secure channel to the
  Meteor methods. Significantly larger effort; tracked separately if/when
  prioritized.

### Risks & open questions
- Does the current push plugin version support static iOS categories and proper
  Android `NotificationCompat` actions without a fork? (Resolved in Phase 0.)
- Attribution: a watch tap is credited to the paired phone's `deviceUUID` — is
  that acceptable for audit/security requirements? (Needs product sign-off.)
- Wear OS bridging behaviour can vary by OEM skin / battery-optimization
  settings; validate on representative hardware in Phase 0.

---

## 4. Requested approval

Please review and confirm:
- [ ] The refined ticket + acceptance criteria match the intent.
- [ ] Phase 1 (mirroring/bridging via static iOS `APPROVAL` category +
      Android `NotificationCompat` actions) is the desired first deliverable,
      with native watch apps deferred to Phase 2.

Once approved, implementation will proceed **Phase 0 → Phase 1** only.
