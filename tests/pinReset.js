import assert from "assert";

if (Meteor.isServer) {
  describe("Admin-initiated PIN reset", function () {
    const { Accounts } = require("meteor/accounts-base");
    const { Email } = require("meteor/email");
    const {
      issueTemporaryPin,
      getResendCooldownMs,
      resendCooldownRemainingMs,
    } = require("../server/pinReset");
    const { DeviceAuditLog } = require("../server/deviceManagement");
    const { EmailLog } = require("../utils/api/emailLog");
    const {
      PIN_RESET_EXPIRY_MS,
      PIN_RESET_MAX_ATTEMPTS,
      PIN_RESET_RESEND_COOLDOWN_MS,
    } = require("../utils/constants");

    const EMAIL = "pin-reset-user@example.com";
    const OLD_PIN = "1234";
    const ADMIN = "test-admin";
    const GENERIC_ERROR = /invalid-temp-pin/;

    const originalSendAsync = Email.sendAsync;
    const originalEnv = {
      EMAIL_FROM: process.env.EMAIL_FROM,
      EMAIL_ADMIN: process.env.EMAIL_ADMIN,
      PIN_RESET_RESEND_COOLDOWN_SECONDS:
        process.env.PIN_RESET_RESEND_COOLDOWN_SECONDS,
    };
    let sentEmails;
    let userId;

    const callMethod = (name, ...args) =>
      Meteor.server.method_handlers[name].call({}, ...args);

    const getUser = () => Meteor.users.findOneAsync({ _id: userId });

    const pinVerifies = async (pin) =>
      !(await Accounts._checkPasswordAsync(await getUser(), pin)).error;

    const resetWith = (tempPin, newPin = "5678", email = EMAIL) =>
      callMethod("users.resetPinWithTemporary", { email, tempPin, newPin });

    const wrongPinFor = (tempPin) =>
      String((Number(tempPin) + 1) % 1_000_000).padStart(6, "0");

    const backdateLastIssue = (ms) =>
      Meteor.users.updateAsync(
        { _id: userId },
        { $set: { "services.pinResetIssuedAt": new Date(Date.now() - ms) } },
      );

    const waitUntil = async (predicate, timeoutMs = 2000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return false;
    };

    beforeEach(async function () {
      sentEmails = [];
      Email.sendAsync = async (options) => {
        sentEmails.push(options);
      };
      process.env.EMAIL_FROM = "noreply@example.com";
      process.env.EMAIL_ADMIN = "admin@example.com";
      delete process.env.PIN_RESET_RESEND_COOLDOWN_SECONDS;

      await Meteor.users.removeAsync({ "emails.address": EMAIL });
      userId = await Accounts.createUserAsync({
        email: EMAIL,
        username: "pin-reset-user",
        password: OLD_PIN,
        profile: { registrationStatus: "approved" },
      });
      await Meteor.users.updateAsync(
        { _id: userId },
        {
          $set: {
            "services.resume.loginTokens": [
              { when: new Date(), hashedToken: "existing-session" },
            ],
          },
        },
      );
    });

    afterEach(async function () {
      Email.sendAsync = originalSendAsync;
      Object.entries(originalEnv).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      });
      await Meteor.users.removeAsync({ _id: userId });
      await DeviceAuditLog.removeAsync({ userId });
      await EmailLog.removeAsync({ userId });
    });

    describe("issueTemporaryPin", function () {
      it("issues a hashed single-use PIN, kills the old PIN and signs out every device", async function () {
        const result = await issueTemporaryPin({ userId, adminUser: ADMIN });

        assert.match(result.tempPin, /^\d{6}$/);
        assert.strictEqual(result.emailSent, true);
        assert.ok(result.expiresAt > new Date());

        const user = await getUser();
        const reset = user.services.pinReset;
        assert.ok(reset.hash);
        assert.ok(!reset.hash.includes(result.tempPin));
        assert.strictEqual(reset.attempts, 0);
        assert.strictEqual(reset.issuedBy, ADMIN);
        assert.strictEqual(
          reset.expiresAt.getTime() - reset.issuedAt.getTime(),
          PIN_RESET_EXPIRY_MS,
        );
        assert.strictEqual(await pinVerifies(OLD_PIN), false);
        assert.strictEqual(user.services.resume?.loginTokens, undefined);

        assert.strictEqual(sentEmails.length, 1);
        assert.strictEqual(sentEmails[0].to, EMAIL);
        assert.ok(sentEmails[0].html.includes(result.tempPin));
        assert.ok(!sentEmails[0].subject.includes(result.tempPin));
        const log = await EmailLog.findOneAsync({ userId });
        assert.strictEqual(log.type, "pin_reset_temp");
        assert.ok(!JSON.stringify(log).includes(result.tempPin));

        const audit = await DeviceAuditLog.findOneAsync({ userId });
        assert.strictEqual(audit.action, "pin_reset_issued");
      });

      it("still succeeds without email, reporting emailSent: false", async function () {
        delete process.env.EMAIL_FROM;
        const result = await issueTemporaryPin({ userId, adminUser: ADMIN });
        assert.strictEqual(result.emailSent, false);
        assert.strictEqual(sentEmails.length, 0);
      });

      it("rate-limits resends, and a later resend replaces the previous PIN", async function () {
        const first = await issueTemporaryPin({ userId, adminUser: ADMIN });
        assert.strictEqual(first.cooldownMs, PIN_RESET_RESEND_COOLDOWN_MS);
        const hashAfterFirst = (await getUser()).services.pinReset.hash;

        const rateLimited = await issueTemporaryPin({
          userId,
          adminUser: ADMIN,
        }).catch((err) => err);
        assert.strictEqual(rateLimited.error, "rate-limited");
        assert.ok(rateLimited.details.retryAfterMs > 0);
        assert.ok(
          rateLimited.details.retryAfterMs <= PIN_RESET_RESEND_COOLDOWN_MS,
        );
        assert.strictEqual(
          (await getUser()).services.pinReset.hash,
          hashAfterFirst,
        );

        await backdateLastIssue(PIN_RESET_RESEND_COOLDOWN_MS + 1000);
        const second = await issueTemporaryPin({ userId, adminUser: ADMIN });

        if (first.tempPin !== second.tempPin) {
          await assert.rejects(resetWith(first.tempPin), GENERIC_ERROR);
        }
        await resetWith(second.tempPin);
        assert.strictEqual(await pinVerifies("5678"), true);
      });

      it("keeps the cooldown after the PIN is redeemed or invalidated", async function () {
        const { tempPin } = await issueTemporaryPin({
          userId,
          adminUser: ADMIN,
        });
        await resetWith(tempPin);
        await assert.rejects(
          issueTemporaryPin({ userId, adminUser: ADMIN }),
          /rate-limited/,
        );

        await backdateLastIssue(PIN_RESET_RESEND_COOLDOWN_MS + 1000);
        const second = await issueTemporaryPin({ userId, adminUser: ADMIN });
        for (let i = 0; i < PIN_RESET_MAX_ATTEMPTS; i++) {
          await assert.rejects(
            resetWith(wrongPinFor(second.tempPin)),
            GENERIC_ERROR,
          );
        }
        assert.strictEqual((await getUser()).services.pinReset, undefined);
        await assert.rejects(
          issueTemporaryPin({ userId, adminUser: ADMIN }),
          /rate-limited/,
        );
      });

      it("refuses unknown and non-approved users", async function () {
        await assert.rejects(
          issueTemporaryPin({ userId: "no-such-user", adminUser: ADMIN }),
          /user-not-found/,
        );
        for (const status of ["pending", "rejected"]) {
          await Meteor.users.updateAsync(
            { _id: userId },
            { $set: { "profile.registrationStatus": status } },
          );
          await assert.rejects(
            issueTemporaryPin({ userId, adminUser: ADMIN }),
            /invalid-state/,
          );
        }
        assert.strictEqual(await pinVerifies(OLD_PIN), true);
      });
    });

    describe("resend cooldown", function () {
      it("defaults to 30 seconds and clamps the configured value to 15–30s", function () {
        assert.strictEqual(getResendCooldownMs(), 30 * 1000);
        const cases = {
          20: 20000,
          15: 15000,
          5: 15000,
          120: 30000,
          abc: 30000,
          "": 30000,
        };
        Object.entries(cases).forEach(([value, expected]) => {
          process.env.PIN_RESET_RESEND_COOLDOWN_SECONDS = value;
          assert.strictEqual(
            getResendCooldownMs(),
            expected,
            `value "${value}"`,
          );
        });
      });

      it("reports the remaining time from the last issue", function () {
        const now = Date.now();
        assert.strictEqual(resendCooldownRemainingMs(undefined, now), 0);
        assert.strictEqual(
          resendCooldownRemainingMs(new Date(now - 10000), now),
          20000,
        );
        assert.strictEqual(
          resendCooldownRemainingMs(new Date(now - 60000), now),
          0,
        );
        // A future timestamp (clock skew) never exceeds the full cooldown.
        assert.strictEqual(
          resendCooldownRemainingMs(new Date(now + 60000), now),
          30000,
        );
      });

      it("enforces a shorter configured cooldown server-side", async function () {
        process.env.PIN_RESET_RESEND_COOLDOWN_SECONDS = "15";
        const { cooldownMs } = await issueTemporaryPin({
          userId,
          adminUser: ADMIN,
        });
        assert.strictEqual(cooldownMs, 15000);

        await backdateLastIssue(10000);
        const err = await issueTemporaryPin({ userId, adminUser: ADMIN }).catch(
          (e) => e,
        );
        assert.strictEqual(err.error, "rate-limited");
        assert.ok(err.details.retryAfterMs <= 5000);

        await backdateLastIssue(15000 + 1000);
        await issueTemporaryPin({ userId, adminUser: ADMIN });
      });
    });

    describe("users.resetPinWithTemporary", function () {
      let tempPin;

      beforeEach(async function () {
        ({ tempPin } = await issueTemporaryPin({ userId, adminUser: ADMIN }));
      });

      it("sets the new PIN once and rejects reuse", async function () {
        const result = await resetWith(tempPin, "5678", EMAIL.toUpperCase());
        assert.deepStrictEqual(result, { success: true });

        const user = await getUser();
        assert.strictEqual(user.services.pinReset, undefined);
        assert.strictEqual(await pinVerifies("5678"), true);
        const audit = await DeviceAuditLog.findOneAsync({
          userId,
          action: "pin_reset_completed",
        });
        assert.ok(audit);

        await assert.rejects(resetWith(tempPin, "4321"), GENERIC_ERROR);
        assert.strictEqual(await pinVerifies("5678"), true);
      });

      it("rejects an expired temporary PIN", async function () {
        await Meteor.users.updateAsync(
          { _id: userId },
          { $set: { "services.pinReset.expiresAt": new Date(Date.now() - 1) } },
        );
        await assert.rejects(resetWith(tempPin), GENERIC_ERROR);
      });

      it("lets an admin resend issued mid-redemption win over the redeemed PIN", async function () {
        const originalSetPassword = Accounts.setPasswordAsync;
        let resend;
        Accounts.setPasswordAsync = async (id, password, options) => {
          if (password === "5678" && !resend) {
            // Admin resends after the claim but before the new PIN is written.
            await backdateLastIssue(PIN_RESET_RESEND_COOLDOWN_MS + 1000);
            resend = await issueTemporaryPin({ userId, adminUser: ADMIN });
          }
          return originalSetPassword.call(Accounts, id, password, options);
        };
        try {
          await assert.rejects(resetWith(tempPin), GENERIC_ERROR);
        } finally {
          Accounts.setPasswordAsync = originalSetPassword;
        }

        assert.strictEqual(await pinVerifies("5678"), false);
        assert.ok((await getUser()).services.pinReset);
        await resetWith(resend.tempPin, "2468");
        assert.strictEqual(await pinVerifies("2468"), true);
      });

      it("counts wrong attempts and invalidates the reset at the limit", async function () {
        const wrongPin = wrongPinFor(tempPin);
        await assert.rejects(resetWith(wrongPin), GENERIC_ERROR);
        assert.strictEqual((await getUser()).services.pinReset.attempts, 1);

        for (let i = 1; i < PIN_RESET_MAX_ATTEMPTS; i++) {
          await assert.rejects(resetWith(wrongPin), GENERIC_ERROR);
        }
        assert.strictEqual((await getUser()).services.pinReset, undefined);
        await assert.rejects(resetWith(tempPin), GENERIC_ERROR);
      });

      it("rejects invalid input before using an attempt", async function () {
        await assert.rejects(resetWith(tempPin, "12"), /invalid-pin/);
        await assert.rejects(resetWith(tempPin, "abcd"), /invalid-pin/);
        await assert.rejects(resetWith(tempPin, tempPin), /invalid-pin/);
        await assert.rejects(resetWith("not-a-pin"), GENERIC_ERROR);
        assert.strictEqual((await getUser()).services.pinReset.attempts, 0);
      });

      it("returns the same generic error for an unknown email", async function () {
        await assert.rejects(
          resetWith(tempPin, "5678", "nobody@example.com"),
          GENERIC_ERROR,
        );
      });

      it("rejects users who are no longer approved", async function () {
        await Meteor.users.updateAsync(
          { _id: userId },
          { $set: { "profile.registrationStatus": "rejected" } },
        );
        await assert.rejects(resetWith(tempPin), GENERIC_ERROR);
      });
    });

    describe("users.requestPinReset", function () {
      const requestReset = (email) =>
        callMethod("users.requestPinReset", { email });

      it("returns the same response for unknown and known emails", async function () {
        assert.deepStrictEqual(await requestReset("nobody@example.com"), {
          success: true,
        });
        assert.deepStrictEqual(await requestReset(EMAIL), { success: true });
        assert.ok(await waitUntil(() => sentEmails.length === 1));
        assert.strictEqual(sentEmails[0].to, "admin@example.com");
      });

      it("sends at most one admin email per cooldown window", async function () {
        await requestReset(EMAIL);
        assert.ok((await getUser()).services.pinResetRequestedAt);
        assert.ok(await waitUntil(() => sentEmails.length === 1));

        await requestReset(EMAIL);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.strictEqual(sentEmails.length, 1);
      });

      it("escapes user data in the admin email", async function () {
        await Meteor.users.updateAsync(
          { _id: userId },
          { $set: { username: "<b>evil</b>" } },
        );
        await requestReset(EMAIL);
        assert.ok(await waitUntil(() => sentEmails.length === 1));
        assert.ok(!sentEmails[0].html.includes("<b>evil</b>"));
        assert.ok(sentEmails[0].html.includes("&lt;b&gt;evil&lt;/b&gt;"));
      });

      it("fails clearly when admin email is not configured", async function () {
        delete process.env.EMAIL_ADMIN;
        await assert.rejects(requestReset(EMAIL), /configuration-error/);
      });
    });
  });
}
