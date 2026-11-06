import assert from "assert";

if (Meteor.isServer) {
  describe("Admin REST API", function () {
    const { Accounts } = require("meteor/accounts-base");
    const { Email } = require("meteor/email");
    require("../server/adminApi");
    const { createSession, destroySession } = require("../server/adminAuth");
    const { getResendCooldownMs } = require("../server/pinReset");
    const { DeviceAuditLog } = require("../server/deviceManagement");
    const { EmailLog } = require("../utils/api/emailLog");

    const EMAIL = "admin-api-user@example.com";
    const ADMIN = "test-admin";
    const originalSendAsync = Email.sendAsync;
    let token;
    let userId;

    const request = async (
      path,
      { method = "POST", body, auth = token } = {},
    ) => {
      const res = await fetch(Meteor.absoluteUrl(path.slice(1)), {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(auth && { Authorization: `Bearer ${auth}` }),
        },
        body: body && JSON.stringify(body),
      });
      return {
        status: res.status,
        headers: res.headers,
        body: await res.json(),
      };
    };
    const resetPin = (options) =>
      request("/api/admin/users/reset-pin", { body: { userId }, ...options });
    const listUsers = () => request("/api/admin/users/list", { method: "GET" });
    const listedUser = async () =>
      (await listUsers()).body.users.find((u) => u._id === userId);

    beforeEach(async function () {
      Email.sendAsync = async () => {};
      delete process.env.PIN_RESET_RESEND_COOLDOWN_SECONDS;
      token = createSession(ADMIN);
      await Meteor.users.removeAsync({ "emails.address": EMAIL });
      userId = await Accounts.createUserAsync({
        email: EMAIL,
        username: "admin-api-user",
        password: "1234",
        profile: { registrationStatus: "approved" },
      });
    });

    afterEach(async function () {
      Email.sendAsync = originalSendAsync;
      destroySession(token);
      await Meteor.users.removeAsync({ _id: userId });
      await DeviceAuditLog.removeAsync({ userId });
      await EmailLog.removeAsync({ userId });
    });

    it("rejects requests without a valid admin session", async function () {
      assert.strictEqual((await resetPin({ auth: null })).status, 401);
      assert.strictEqual(
        (await resetPin({ auth: "forged-token" })).status,
        403,
      );
      const unauthList = await request("/api/admin/users/list", {
        method: "GET",
        auth: null,
      });
      assert.strictEqual(unauthList.status, 401);
      assert.strictEqual(
        (await Meteor.users.findOneAsync(userId)).services.pinReset,
        undefined,
      );
    });

    it("enforces the PIN resend cooldown server-side and reports it", async function () {
      const first = await resetPin();
      assert.strictEqual(first.status, 200);
      assert.match(first.body.tempPin, /^\d{6}$/);
      assert.strictEqual(first.body.cooldownMs, getResendCooldownMs());
      assert.strictEqual(first.headers.get("cache-control"), "no-store");

      // A direct second request (e.g. another tab) is refused, not re-issued.
      const second = await resetPin();
      assert.strictEqual(second.status, 429);
      assert.strictEqual(second.body.errorCode, "rate-limited");
      assert.ok(second.body.retryAfterMs > 0);
      assert.ok(second.body.retryAfterMs <= getResendCooldownMs());
      assert.ok(Number(second.headers.get("retry-after")) >= 1);
      assert.strictEqual(second.body.tempPin, undefined);
    });

    it("lists each user's remaining cooldown so the UI survives a reload", async function () {
      const before = await listUsers();
      assert.strictEqual(
        before.body.pinResetCooldownTotalMs,
        getResendCooldownMs(),
      );
      assert.strictEqual((await listedUser()).pinResetCooldownMs, 0);

      await resetPin();
      const user = await listedUser();
      assert.ok(user.pinResetCooldownMs > 0);
      assert.ok(user.pinResetCooldownMs <= getResendCooldownMs());
      assert.ok(new Date(user.pinResetExpiresAt) > new Date());

      await Meteor.users.updateAsync(
        { _id: userId },
        {
          $set: {
            "services.pinResetIssuedAt": new Date(Date.now() - 60 * 1000),
          },
        },
      );
      assert.strictEqual((await listedUser()).pinResetCooldownMs, 0);
    });

    it("records the approving admin in the audit log", async function () {
      await Meteor.users.updateAsync(
        { _id: userId },
        { $set: { "profile.registrationStatus": "pending" } },
      );
      const res = await request("/api/admin/users/approve", {
        body: { userId },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await listedUser()).registrationStatus, "approved");
      const audit = await DeviceAuditLog.findOneAsync({
        userId,
        action: "admin_user_approved",
      });
      assert.strictEqual(audit.details, `by ${ADMIN}`);
    });
  });
}
