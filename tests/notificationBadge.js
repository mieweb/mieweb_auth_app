import assert from "assert";

if (Meteor.isServer) {
  describe("iOS notification badge", function () {
    const {
      buildPushMessage,
      getPendingBadgeCount,
    } = require("../server/firebase");
    const { NotificationHistory } = require("../utils/api/notificationHistory");

    const USER_ID = "badge-test-user";

    const insertNotification = (status) =>
      NotificationHistory.insertAsync({
        userId: USER_ID,
        notificationId: `badge-${status}-${Math.random()}`,
        title: "t",
        body: "b",
        status,
        createdAt: new Date(),
      });

    beforeEach(async function () {
      await NotificationHistory.removeAsync({ userId: USER_ID });
    });

    after(async function () {
      await NotificationHistory.removeAsync({ userId: USER_ID });
    });

    describe("getPendingBadgeCount", function () {
      it("counts only the user's pending notifications", async function () {
        await insertNotification("pending");
        await insertNotification("pending");
        await insertNotification("approved");
        await insertNotification("timeout");

        assert.strictEqual(await getPendingBadgeCount(USER_ID), 2);
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
