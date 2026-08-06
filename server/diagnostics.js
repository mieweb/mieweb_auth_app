import { Meteor } from "meteor/meteor";
import { Email } from "meteor/email";
import { check, Match } from "meteor/check";
import { DDPRateLimiter } from "meteor/ddp-rate-limiter";
import { createEmailLog } from "../utils/api/emailLog.js";

const MAX_LOG_LENGTH = 1_000_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RecipientEmail = Match.Where((email) => {
  check(email, String);
  return email.length <= 254 && EMAIL_PATTERN.test(email);
});

const redactLogs = (logs) =>
  logs
    .replace(/(authorization\s*[:=]\s*)(?:basic|bearer)\s+[^\s,;]+/gi, "$1***")
    .replace(
      /((?:access[_-]?token|auth[_-]?token|refresh[_-]?token|password|pin|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,
      "$1***",
    );

Meteor.methods({
  async "diagnostics.sendLogs"({ recipientEmail, logs, device }) {
    check(recipientEmail, RecipientEmail);
    check(logs, String);
    check(
      device,
      Match.Maybe({
        platform: String,
        version: String,
        model: String,
      }),
    );

    if (!this.userId) {
      throw new Meteor.Error("not-authorized", "You must be signed in.");
    }

    const fromEmail = process.env.EMAIL_FROM;
    if (!fromEmail) {
      throw new Meteor.Error(
        "configuration-error",
        "Email configuration is missing.",
      );
    }

    this.unblock();

    const normalizedEmail = recipientEmail.trim();
    const attachmentLogs = redactLogs(logs.slice(-MAX_LOG_LENGTH));
    const deviceSummary = device
      ? `${device.platform} ${device.version} (${device.model})`
      : "Unknown device";
    const subject = "MIE Auth diagnostics logs";

    try {
      await Email.sendAsync({
        to: normalizedEmail,
        from: fromEmail,
        subject,
        text: `MIE Auth diagnostics\nDevice: ${deviceSummary}\nGenerated: ${new Date().toISOString()}\n\nThe diagnostics logs are attached.`,
        attachments: [
          {
            filename: `mie-auth-diagnostics-${Date.now()}.txt`,
            content: attachmentLogs,
            contentType: "text/plain; charset=utf-8",
          },
        ],
      });

      await createEmailLog({
        type: "diagnostics_logs",
        to: normalizedEmail,
        from: fromEmail,
        subject,
        userId: this.userId,
        status: "sent",
      });

      return { success: true, truncated: logs.length > MAX_LOG_LENGTH };
    } catch (error) {
      console.error("Error sending diagnostics logs:", error);
      await createEmailLog({
        type: "diagnostics_logs",
        to: normalizedEmail,
        from: fromEmail,
        subject,
        userId: this.userId,
        status: "failed",
        error: error.message,
      }).catch(() => {});
      throw new Meteor.Error("email-error", "Failed to send diagnostics logs.");
    }
  },
});

DDPRateLimiter.addRule(
  {
    type: "method",
    name: "diagnostics.sendLogs",
    userId: () => true,
  },
  3,
  5 * 60 * 1000,
);
