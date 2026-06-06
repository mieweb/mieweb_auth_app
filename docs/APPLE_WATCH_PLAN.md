# Apple Watch Approvals — Refined Ticket & Implementation Plan

> **Status: PROPOSAL — awaiting approval. No implementation has been done.**
>
> This document refines the original "Apple Watch" issue ("I'd like to approve
> from my watch") into an actionable ticket grounded in how MIEAuth actually
> works today, and proposes a phased plan to deliver Apple Watch approvals for
> a watch paired with the user's iPhone.

---

## 1. Refined Ticket

### Title
Approve / reject MIEAuth requests from a paired Apple Watch

### User story
As a MIEAuth user who wears an Apple Watch paired to my iPhone, I want incoming
approval requests (e.g. "MIE Sudo Security Alert", new-device registration) to
appear on my wrist with **Approve** and **Reject** buttons, so I can respond to
a request without taking my phone out.

### Background (how approvals work today)
MIEAuth is a Meteor + React app deployed to mobile via Cordova. Push delivery
uses **Firebase Cloud Messaging (FCM)**; on iOS, FCM relays through **APNs**.

- The server builds and sends notifications in
  [`server/firebase.js`](../server/firebase.js) via `sendNotification(...)`.
  The iOS payload already sets `aps.category = "APPROVAL"`,
  `mutable_content: true`, and `content_available`.
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

### The key technical constraint
watchOS does **not** run Cordova/WebView code. The `@havesource/cordova-plugin-push`
action buttons are registered **at runtime from the push payload** by the
plugin's iOS code. Apple Watch, however, only mirrors notifications and renders
action buttons that come from a **statically registered `UNNotificationCategory`**
on the iPhone. So the existing dynamic-action mechanism is the main blocker for
buttons showing up on the watch.

### Acceptance criteria
1. When the iPhone is locked / pocketed and a paired Apple Watch is active, an
   approval request is **mirrored to the watch** as a notification.
2. The watch notification shows **Approve** and **Reject** action buttons.
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
- A standalone (cellular) Apple Watch app that works without the paired iPhone.
- Independent enrollment / biometric secret storage on the watch.
- watchOS complications or Siri shortcuts.

---

## 2. Background research summary

| Concern | Current state | Implication for watch |
|---|---|---|
| Push transport | FCM → APNs (`server/firebase.js`) | Unchanged; watch mirrors APNs alerts from the phone. |
| Action buttons | Sent dynamically in FCM `data.actions` | **Must move to a static `UNNotificationCategory`** so the watch can render them. |
| iOS category | `aps.category = "APPROVAL"` already set | Reuse this category id when registering it natively. |
| Action handling | `push.on("approve"/"reject")` in WebView | Watch taps are delivered to the **iOS** app, not watchOS; the existing handlers can still fire if the category is wired through the plugin. |
| Device identity | `deviceUUID` from `Session.get("capturedDeviceInfo")` | Watch action would be attributed to the paired **iPhone's** `deviceUUID` (proposed for Phase 1, pending product sign-off — see Risks). |

**Important reality check:** because watchOS forwards interactions back to the
paired iPhone app, "approve from watch" is achievable **without** writing a
native watchOS app — *provided* the approval category and its actions are
registered statically on iOS so the system mirrors them to the watch. A native
watchOS companion app is only required for the standalone/independent
experience, which is intentionally out of scope for Phase 1.

---

## 3. Proposed plan

### Phase 0 — Spike / validation (no shipping code)
- Confirm with a paired Apple Watch that a notification carrying
  `aps.category = "APPROVAL"` is mirrored to the watch.
- Verify whether `@havesource/cordova-plugin-push` lets us register a **static**
  `UNNotificationCategory` (via `App.appendToConfig`/native config in
  `mobile-config.js`, or a small config-only plugin hook) whose action
  identifiers match the existing `approve` / `reject` callbacks.
- **Decision gate:** static-category approach vs. minimal native watch target.

### Phase 1 — Watch approvals via notification mirroring (primary deliverable)
1. **Register a static `APPROVAL` category on iOS** with `approve` and `reject`
   actions (identifiers matching today's callbacks) so Apple Watch renders the
   buttons. Driven from `mobile-config.js` so it stays in the Cordova build.
2. **Server payload alignment** (`server/firebase.js`): today the `APPROVAL`
   category is set on the APNs payload, but the action-routing fields
   (`userId` / `notificationId` / `deviceUUID`) are primarily consumed by the
   in-app modal flow and are not guaranteed to be present in the data payload
   for every approval path. Audit each `sendNotification(...)` call site and
   ensure these fields are consistently included so a watch-triggered action
   can reach `notifications.handleResponse`.
3. **Client action routing** (`client/mobile/push-notifications.js`): confirm
   `push.on("approve"/"reject")` fires for actions triggered from the watch
   (delivered via the paired phone) and that the existing
   `actionPerformedFromTray` de-dup logic still prevents double-handling.
4. **Tests** consistent with `tests/main.js`: payload-shape unit tests asserting
   the `APPROVAL` category + required action data fields are present.
5. **Docs**: add an "Apple Watch" subsection to `README.md` and a manual test
   checklist (locked phone, wrist-only approve/reject, timeout).

### Phase 2 (optional, later) — Native watchOS companion
- Only if independent/standalone behaviour is required. Adds a Swift/SwiftUI
  watch target outside the Cordova build, with its own APNs registration and a
  secure channel to the Meteor methods. Significantly larger effort; tracked
  separately if/when prioritized.

### Risks & open questions
- Does the current push plugin version support static categories without a fork?
  (Resolved in Phase 0.)
- Attribution: a watch tap is credited to the paired iPhone's `deviceUUID` — is
  that acceptable for audit/security requirements? (Needs product sign-off.)
- Android Wear / Wear OS is a separate effort and is **not** covered here.

---

## 4. Requested approval

Please review and confirm:
- [ ] The refined ticket + acceptance criteria match the intent.
- [ ] Phase 1 (mirroring via static `APPROVAL` category) is the desired first
      deliverable, with the native watchOS app deferred to Phase 2.

Once approved, implementation will proceed **Phase 0 → Phase 1** only.
