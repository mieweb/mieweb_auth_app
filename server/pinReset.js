import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import { check } from "meteor/check";
import { Random } from "meteor/random";
import { Email } from "meteor/email";
import { DDPRateLimiter } from "meteor/ddp-rate-limiter";
import crypto from "crypto";
import { promisify } from "util";
import { createEmailLog } from "../utils/api/emailLog.js";
import { escapeHtml } from "../utils/utils";
import {
  PIN_PATTERN,
  PIN_RESET_EXPIRY_MS,
  PIN_RESET_RESEND_COOLDOWN_MS,
  PIN_RESET_MAX_ATTEMPTS,
  PIN_RESET_REQUEST_COOLDOWN_MS,
} from "../utils/constants.js";
import { logDeviceAudit, timingSafeEquals } from "./deviceManagement.js";

/**
 * Admin-initiated PIN reset.
 *
 * An admin issues a single-use temporary PIN (stored only as a salted scrypt
 * hash in the never-published `services.pinReset`). The temporary PIN is NOT
 * a login credential: it is accepted solely by `users.resetPinWithTemporary`,
 * which sets the user's new PIN. Issuing a reset replaces the account password
 * with a random secret, so the old PIN stops working and all sessions end.
 */

const scrypt = promisify(crypto.scrypt);

const hashPin = async (pin) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(pin, salt, 32);
  return `${salt}:${derived.toString("hex")}`;
};

const verifyPin = async (pin, stored) => {
  const [salt, expected] = String(stored).split(":");
  const derived = await scrypt(pin, salt || "", 32);
  return timingSafeEquals(derived.toString("hex"), expected);
};

// Verified against when no reset exists so unknown accounts cost the same work.
const DUMMY_HASH_PROMISE = hashPin(Random.secret());

// Mongo filter: `field` is unset or older than `ms` ago.
const cooldownElapsed = (field, ms) => ({
  [field]: { $not: { $gt: new Date(Date.now() - ms) } },
});

const invalidTempPinError = () =>
  new Meteor.Error("invalid-temp-pin", "Invalid or expired temporary PIN.");

const sendTempPinEmail = async ({ user, tempPin, expiresAt }) => {
  const to = user.emails?.[0]?.address;
  const from = process.env.EMAIL_FROM;
  if (!to || !from) return false;

  const subject = "Your temporary PIN";
  const logEntry = {
    type: "pin_reset_temp",
    to,
    from,
    subject,
    userId: user._id,
    username: user.username,
  };
  try {
    await Email.sendAsync({
      to,
      from,
      subject,
      html: `
        <p>Hello ${escapeHtml(user.username || "")},</p>
        <p>Your administrator has reset your PIN. Your temporary PIN is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${tempPin}</p>
        <p>Open the app, tap <strong>Forgot PIN?</strong> on the sign-in screen and enter this temporary PIN to choose a new one.</p>
        <p>It expires on ${expiresAt.toUTCString()} and can only be used once.</p>
        <p>If you did not expect this, contact your administrator.</p>
      `,
    });
    await createEmailLog({ ...logEntry, status: "sent" });
    return true;
  } catch (error) {
    console.error("Failed to send temporary PIN email:", error.message);
    await createEmailLog({
      ...logEntry,
      status: "failed",
      error: error.message,
    }).catch(() => {});
    return false;
  }
};

/**
 * Issue (or re-issue) a temporary PIN for an approved user.
 * @returns {Promise<{ tempPin: string, emailSent: boolean, expiresAt: Date }>}
 */
export const issueTemporaryPin = async ({ userId, adminUser }) => {
  const user = await Meteor.users.findOneAsync(
    { _id: userId },
    { fields: { username: 1, emails: 1, profile: 1 } },
  );
  if (!user) throw new Meteor.Error("user-not-found", "User not found");
  if (user.profile?.registrationStatus !== "approved") {
    throw new Meteor.Error(
      "invalid-state",
      "Only approved users can have their PIN reset.",
    );
  }

  const tempPin = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const hash = await hashPin(tempPin);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + PIN_RESET_EXPIRY_MS);

  // Atomic cooldown claim: holds across restarts and multiple instances.
  const claimed = await Meteor.users.updateAsync(
    {
      _id: userId,
      ...cooldownElapsed(
        "services.pinReset.issuedAt",
        PIN_RESET_RESEND_COOLDOWN_MS,
      ),
    },
    {
      $set: {
        "services.pinReset": {
          hash,
          issuedAt,
          expiresAt,
          attempts: 0,
          issuedBy: adminUser,
        },
      },
    },
  );
  if (!claimed) {
    throw new Meteor.Error(
      "rate-limited",
      "A temporary PIN was just issued. Please wait a minute before resending.",
    );
  }

  // Invalidates the old PIN and signs the user out on every device.
  await Accounts.setPasswordAsync(userId, Random.secret());

  const emailSent = await sendTempPinEmail({ user, tempPin, expiresAt });
  await logDeviceAudit({
    userId,
    action: "pin_reset_issued",
    details: `by ${adminUser}`,
  });

  return { tempPin, emailSent, expiresAt };
};

const notifyAdminOfPinResetRequest = async (user) => {
  const to = process.env.EMAIL_ADMIN;
  const from = process.env.EMAIL_FROM;
  const email = user.emails?.[0]?.address;
  const subject = `PIN reset requested by user: ${user.username}`;
  const logEntry = {
    type: "pin_reset_request",
    to,
    from,
    subject,
    userId: user._id,
    username: user.username,
    email,
  };
  try {
    await Email.sendAsync({
      to,
      from,
      subject,
      html: `
        <p>A user has asked for their PIN to be reset:</p>
        <ul>
          <li><strong>Username:</strong> ${escapeHtml(user.username || "")}</li>
          <li><strong>Email:</strong> ${escapeHtml(email || "")}</li>
        </ul>
        <p>Open the admin dashboard, go to the <strong>Users</strong> tab and choose <strong>Reset PIN</strong> for this user.</p>
      `,
    });
    await createEmailLog({ ...logEntry, status: "sent" });
  } catch (error) {
    console.error("Failed to send PIN reset request email:", error.message);
    await createEmailLog({
      ...logEntry,
      status: "failed",
      error: error.message,
    }).catch(() => {});
  }
};

const recordFailedAttempt = async (userId, issuedAt) => {
  const current = { _id: userId, "services.pinReset.issuedAt": issuedAt };
  await Meteor.users.updateAsync(current, {
    $inc: { "services.pinReset.attempts": 1 },
  });
  await Meteor.users.updateAsync(
    {
      ...current,
      "services.pinReset.attempts": { $gte: PIN_RESET_MAX_ATTEMPTS },
    },
    { $unset: { "services.pinReset": "" } },
  );
};

Meteor.methods({
  async "users.resetPinWithTemporary"(data) {
    check(data, { email: String, tempPin: String, newPin: String });
    const { email, tempPin, newPin } = data;

    // Validate input first so a typo never costs an attempt.
    if (!PIN_PATTERN.test(tempPin)) throw invalidTempPinError();
    if (!PIN_PATTERN.test(newPin)) {
      throw new Meteor.Error("invalid-pin", "PIN must be 4 to 6 digits.");
    }
    if (newPin === tempPin) {
      throw new Meteor.Error(
        "invalid-pin",
        "Your new PIN must be different from the temporary PIN.",
      );
    }

    const user = await Accounts.findUserByEmail(email.trim(), {
      fields: { profile: 1, "services.pinReset": 1 },
    });
    const reset = user?.services?.pinReset;
    const matches = await verifyPin(
      tempPin,
      reset?.hash || (await DUMMY_HASH_PROMISE),
    );

    const usable =
      reset &&
      user.profile?.registrationStatus === "approved" &&
      reset.expiresAt > new Date() &&
      reset.attempts < PIN_RESET_MAX_ATTEMPTS;
    if (!usable) throw invalidTempPinError();

    if (!matches) {
      await recordFailedAttempt(user._id, reset.issuedAt);
      throw invalidTempPinError();
    }

    // Atomic single-use claim; fails if already used or replaced by a resend.
    const claimed = await Meteor.users.updateAsync(
      {
        _id: user._id,
        "services.pinReset.issuedAt": reset.issuedAt,
        "services.pinReset.attempts": { $lt: PIN_RESET_MAX_ATTEMPTS },
      },
      { $unset: { "services.pinReset": "" } },
    );
    if (!claimed) throw invalidTempPinError();

    // Sessions were already cleared when the reset was issued.
    await Accounts.setPasswordAsync(user._id, newPin, { logout: false });
    await logDeviceAudit({ userId: user._id, action: "pin_reset_completed" });

    return { success: true };
  },

  async "users.requestPinReset"(data) {
    check(data, { email: String });

    if (!process.env.EMAIL_ADMIN || !process.env.EMAIL_FROM) {
      throw new Meteor.Error(
        "configuration-error",
        "Email configuration is missing. Please contact support.",
      );
    }

    const user = await Accounts.findUserByEmail(data.email.trim(), {
      fields: { username: 1, emails: 1, profile: 1 },
    });
    if (user?.profile?.registrationStatus === "approved") {
      const claimed = await Meteor.users.updateAsync(
        {
          _id: user._id,
          ...cooldownElapsed(
            "services.pinResetRequestedAt",
            PIN_RESET_REQUEST_COOLDOWN_MS,
          ),
        },
        { $set: { "services.pinResetRequestedAt": new Date() } },
      );
      if (claimed) {
        await logDeviceAudit({
          userId: user._id,
          action: "pin_reset_requested",
        });
        // Not awaited so response timing does not reveal whether the account exists.
        notifyAdminOfPinResetRequest(user);
      }
    }

    // Same response whether or not the account exists (anti-enumeration).
    return { success: true };
  },
});

DDPRateLimiter.addRule(
  {
    type: "method",
    name: (name) =>
      name === "users.resetPinWithTemporary" ||
      name === "users.requestPinReset",
    connectionId: () => true,
  },
  5, // max 5 calls
  60 * 1000, // per minute, per connection
);
