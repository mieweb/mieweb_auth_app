import assert from "assert";
import { getHandleResponseError } from "../utils/notificationResponse";
import {
  MAX_TRAY_ACTION_AUTH_RETRIES,
  canSendTrayAction,
  enqueueTrayAction,
  removeTrayAction,
  resolveTrayActionOutcome,
} from "../utils/trayAction";

describe("notification tray actions", function () {
  const ready = {
    userId: "u1",
    loggingIn: false,
    loggingOut: false,
    hasProfile: true,
  };

  it("waits while a logout is in flight even if the cached profile remains", function () {
    // Issue #552: the resume logout had started but Session.userProfile was
    // still set, so the action was sent on an unauthenticated connection.
    assert.strictEqual(
      canSendTrayAction({ ...ready, loggingOut: true }),
      false,
    );
    assert.strictEqual(canSendTrayAction({ ...ready, loggingIn: true }), false);
  });

  it("waits until both the Meteor login and the app login flow are done", function () {
    assert.strictEqual(canSendTrayAction({ ...ready, userId: null }), false);
    assert.strictEqual(
      canSendTrayAction({ ...ready, hasProfile: false }),
      false,
    );
    assert.strictEqual(canSendTrayAction(ready), true);
  });

  it("keeps actions for different requests queued in tap order", function () {
    // Reject A, then approve B before re-login: both must be sent.
    const rejectA = { notificationId: "A", action: "reject", queuedAt: 1 };
    const approveB = { notificationId: "B", action: "approve", queuedAt: 2 };
    const queue = enqueueTrayAction(enqueueTrayAction([], rejectA), approveB);

    assert.deepStrictEqual(queue, [rejectA, approveB]);
    assert.deepStrictEqual(removeTrayAction(queue, rejectA), [approveB]);
  });

  it("replaces an earlier action for the same request in place", function () {
    const rejectA = { notificationId: "A", action: "reject", queuedAt: 1 };
    const approveB = { notificationId: "B", action: "approve", queuedAt: 2 };
    const approveA = { notificationId: "A", action: "approve", queuedAt: 3 };
    const queue = enqueueTrayAction([rejectA, approveB], approveA);

    assert.deepStrictEqual(queue, [approveA, approveB]);
    // A late result for the replaced entry must not remove its replacement.
    assert.deepStrictEqual(removeTrayAction(queue, rejectA), queue);
  });

  it("re-queues not-authenticated failures up to the retry limit, then reports them", function () {
    const error = {
      error: "not-authenticated",
      reason: "You must be logged in to respond to notifications.",
      message:
        "You must be logged in to respond to notifications. [not-authenticated]",
    };

    assert.deepStrictEqual(
      resolveTrayActionOutcome({ error, authRetries: 0 }),
      { type: "retry" },
    );
    assert.deepStrictEqual(
      resolveTrayActionOutcome({
        error,
        authRetries: MAX_TRAY_ACTION_AUTH_RETRIES,
      }),
      { type: "error", message: error.message },
    );
  });

  it("reports other failures immediately and treats success as success", function () {
    assert.deepStrictEqual(
      resolveTrayActionOutcome({
        error: { error: "not-authorized", message: "nope [not-authorized]" },
      }),
      { type: "error", message: "nope [not-authorized]" },
    );
    assert.deepStrictEqual(
      resolveTrayActionOutcome({
        result: { success: false, message: "Notification has expired" },
        action: "approve",
      }),
      { type: "error", message: "Notification has expired" },
    );
    assert.deepStrictEqual(
      resolveTrayActionOutcome({
        result: { success: true },
        action: "approve",
      }),
      { type: "success" },
    );
  });
});

describe("notifications.handleResponse result interpretation", function () {
  it("does not report an expired or differently-answered request as success", function () {
    assert.strictEqual(
      getHandleResponseError(
        { success: false, message: "Notification has expired" },
        "approve",
      ),
      "Notification has expired",
    );
    // Already timed out server-side: the server answers success + status.
    assert.match(
      getHandleResponseError({ success: true, status: "timeout" }, "approve"),
      /expired/,
    );
    assert.strictEqual(
      getHandleResponseError({ success: true, status: "reject" }, "approve"),
      "This request was already rejected.",
    );
  });

  it("accepts a fresh answer or a repeat of the same answer", function () {
    assert.strictEqual(
      getHandleResponseError({ success: true }, "approve"),
      null,
    );
    assert.strictEqual(
      getHandleResponseError({ success: true, status: "approve" }, "approve"),
      null,
    );
  });
});
