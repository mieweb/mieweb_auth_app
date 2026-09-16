import assert from "assert";

if (Meteor.isServer) {
  describe("iOS notification badge", function () {
    const {
      buildPushMessage,
      getPendingBadgeCount,
    } = require("../server/firebase");
    const { NotificationHistory } = require("../utils/api/notificationHistory");

    const USER_ID = "badge-test-user";
    const OTHER_USER_ID = "badge-test-other-user";
    const TEST_USER_IDS = [USER_ID, OTHER_USER_ID];

    const insertNotification = (status, userId = USER_ID) =>
      NotificationHistory.insertAsync({
        userId,
        notificationId: `badge-${status}-${Math.random()}`,
        title: "t",
        body: "b",
        status,
        createdAt: new Date(),
      });

    beforeEach(async function () {
      await NotificationHistory.removeAsync({ userId: { $in: TEST_USER_IDS } });
    });

    after(async function () {
      await NotificationHistory.removeAsync({ userId: { $in: TEST_USER_IDS } });
    });

    describe("getPendingBadgeCount", function () {
      it("counts only the user's pending notifications", async function () {
        await insertNotification("pending");
        await insertNotification("pending");
        await insertNotification("approved");
        await insertNotification("timeout");
        await insertNotification("pending", OTHER_USER_ID);

        assert.strictEqual(await getPendingBadgeCount(USER_ID), 2);
        assert.strictEqual(await getPendingBadgeCount(OTHER_USER_ID), 1);
      });

      it("returns 0 once every request has been handled", async function () {
        await insertNotification("approved");

        assert.strictEqual(await getPendingBadgeCount(USER_ID), 0);
      });

      it("returns null when no user id is available", async function () {
        assert.strictEqual(await getPendingBadgeCount(undefined), null);
        assert.strictEqual(await getPendingBadgeCount(""), null);
      });
    });

    describe("buildPushMessage", function () {
      it("uses the real pending count instead of a hardcoded 1", function () {
        const message = buildPushMessage("token", "Title", "Body", {}, 3);

        assert.strictEqual(message.apns.payload.aps.badge, 3);
      });

      it("omits the badge when the count is unknown", function () {
        const message = buildPushMessage("token", "Title", "Body", {}, null);

        assert.ok(!("badge" in message.apns.payload.aps));
      });

      it("keeps the badge on silent sync pushes so it can drop to 0", function () {
        const message = buildPushMessage(
          "token",
          "",
          "",
          { isSync: "true" },
          0,
        );

        assert.strictEqual(message.apns.payload.aps.badge, 0);
        assert.ok(!("alert" in message.apns.payload.aps));
        assert.ok(!("sound" in message.apns.payload.aps));
      });
    });
  });
}
