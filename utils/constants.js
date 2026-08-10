export const PAGE_SIZE = 5;
export const TIMEOUT_DURATION_MS = 55000;
export const APPROVAL_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// --- Approval notification / watch-support action contract ---
// Single source of truth shared by the server FCM payload (server/firebase.js)
// and the client push handlers (client/mobile/push-notifications.js). The iOS
// category id must equal aps.category, and each action identifier must match a
// push.on(...) handler so taps from the phone OR a paired watch route the same
// way. See README "Watch Support".
export const APPROVAL_CATEGORY_ID = "APPROVAL";
export const APPROVE_ACTION = "approve";
export const REJECT_ACTION = "reject";

// Action descriptors sent in the FCM data payload. On Android the plugin turns
// these into NotificationCompat actions (bridged to Wear OS); on iOS they are
// ignored in favour of the statically registered category below.
export const APPROVAL_ACTIONS = [
  { callback: APPROVE_ACTION, title: "Approve", foreground: true },
  { callback: REJECT_ACTION, title: "Reject", foreground: true },
];

// Statically registered iOS UNNotificationCategory. Apple Watch only renders
// action buttons that come from a static category, so this is what makes the
// Approve/Reject buttons appear on the wrist.
//
// IMPORTANT: these MUST be background actions (foreground: false). Apple Watch
// does not display foreground actions for mirrored notifications because the
// watch cannot launch the iPhone app — watchOS silently hides any
// isForeground: YES action, leaving only "Dismiss" on the wrist. Background
// actions are forwarded to the paired iPhone and handled by the
// push.on("approve"/"reject") handlers without opening the app, which is the
// intended wrist-approval flow.
export const IOS_APPROVAL_CATEGORIES = {
  [APPROVAL_CATEGORY_ID]: {
    yes: {
      callback: APPROVE_ACTION,
      title: "Approve",
      foreground: false,
      destructive: false,
    },
    no: {
      callback: REJECT_ACTION,
      title: "Reject",
      foreground: false,
      destructive: true,
    },
  },
};

// Data fields a tray/watch action requires to reach notifications.handleResponse
// (enforced by handleActionFromTray in client/mobile/push-notifications.js).
export const REQUIRED_ACTION_DATA_FIELDS = ["userId", "notificationId"];
