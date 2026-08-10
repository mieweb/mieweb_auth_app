import { Meteor } from "meteor/meteor";
import { WebApp } from "meteor/webapp";
import crypto from "crypto";
import { ApiKeys } from "../utils/api/apiKeys";
import { DeviceDetails } from "../utils/api/deviceDetails";
import { EmailLog } from "../utils/api/emailLog";
import { MigrationEvents } from "../utils/api/migrationEvents";
import { NotificationHistory } from "../utils/api/notificationHistory";
import { sendNotification } from "./firebase";
import {
  requireAdminAuth,
  validateCredentials,
  createSession,
  destroySession,
  parseJsonBody,
  sendJson,
  getPublicKey,
  decryptPassword,
} from "./adminAuth";
import { mapMeteorError } from "../utils/errorHelpers";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Origin, Content-Type, Accept, Authorization",
  "Access-Control-Max-Age": "86400",
};

const setCors = (res) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
};

// ─── Public key endpoint (for client-side password encryption) ───
WebApp.connectHandlers.use("/api/admin/pubkey", (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "GET")
    return sendJson(res, 405, { error: "Method not allowed" });
  sendJson(res, 200, { publicKey: getPublicKey() });
});

// ─── Login: LDAP bind + group check → session token ──────────────
WebApp.connectHandlers.use("/api/admin/auth", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  let username = "(unknown)";
  try {
    const body = await parseJsonBody(req);
    username = body.username;

    // Support both encrypted and plaintext passwords
    let password;
    if (body.encryptedPassword) {
      try {
        password = decryptPassword(body.encryptedPassword);
      } catch (decryptErr) {
        console.error(
          "[AdminApi] Password decryption failed:",
          decryptErr.message,
        );
        return sendJson(res, 400, {
          error: "Failed to decrypt credentials. Please refresh and try again.",
        });
      }
    } else {
      password = body.password;
    }

    if (!username || !password)
      return sendJson(res, 400, {
        error: "Username and password are required",
      });

    // validateCredentials does LDAP bind + group membership check
    // Throws with err.ldapTag on failure
    await validateCredentials(username, password);

    const token = createSession(username);
    sendJson(res, 200, { success: true, token, username });
  } catch (err) {
    // Map tagged LDAP errors to user-friendly messages + appropriate HTTP status
    const TAG_MAP = {
      INVALID_CREDENTIALS: { status: 401, msg: "Invalid username or password" },
      USER_NOT_FOUND: { status: 401, msg: "Invalid username or password" },
      NOT_IN_GROUP: { status: 401, msg: "Invalid username or password" }, // normalised to prevent admin-group enumeration
      CONNECTION_FAILED: {
        status: 503,
        msg: "Cannot reach the authentication server. Please try again later.",
      },
      LDAP_NOT_CONFIGURED: {
        status: 500,
        msg: "Authentication is not configured on this server. Contact the system administrator.",
      },
      MISSING_INPUT: { status: 400, msg: "Username and password are required" },
      INSUFFICIENT_ACCESS: {
        status: 403,
        msg: "Your LDAP account does not have sufficient access rights",
      },
    };

    const tag = err.ldapTag || "UNKNOWN";
    const mapped = TAG_MAP[tag] || {
      status: 401,
      msg: "Authentication failed. Please check your credentials and try again.",
    };

    console.error(
      `[AdminApi] Login failed for user "${username}": [${tag}] ${err.message}`,
    );
    sendJson(res, mapped.status, { error: mapped.msg });
  }
});

// ─── Verify session (for UI session restore) ─────────────────────
WebApp.connectHandlers.use("/api/admin/verify", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "GET")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, () => {
    sendJson(res, 200, { success: true, username: req.adminUser });
  });
});

// ─── Logout ──────────────────────────────────────────────────────
WebApp.connectHandlers.use("/api/admin/logout", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) destroySession(token);
  sendJson(res, 200, { success: true });
});

// ─── Client API Keys ──────────────────────────────────────────────

// List all client API keys
WebApp.connectHandlers.use("/api/admin/api-keys/list", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "GET")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const keys = await ApiKeys.find(
        {},
        { fields: { clientId: 1, keyPrefix: 1, createdAt: 1, lastUsed: 1 } },
      ).fetchAsync();
      sendJson(res, 200, {
        success: true,
        keys: keys.map((k) => ({
          clientId: k.clientId,
          keyPrefix: k.keyPrefix || "•••••",
          createdAt: k.createdAt,
          lastUsed: k.lastUsed,
        })),
      });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Create a new client API key
WebApp.connectHandlers.use("/api/admin/api-keys/create", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const { clientId } = await parseJsonBody(req);
      if (!clientId)
        return sendJson(res, 400, {
          error: "clientId required",
          errorCode: "missing-field",
        });

      const apiKey = await Meteor.callAsync("apiKeys.create", clientId);
      sendJson(res, 201, {
        success: true,
        clientId,
        apiKey,
        message: "Store this key securely. It will not be shown again.",
      });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Delete a client API key
WebApp.connectHandlers.use("/api/admin/api-keys/delete", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "DELETE" && req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const { clientId } = await parseJsonBody(req);
      if (!clientId)
        return sendJson(res, 400, {
          error: "clientId required",
          errorCode: "missing-field",
        });

      const deleted = await Meteor.callAsync("apiKeys.delete", clientId);
      sendJson(res, deleted ? 200 : 404, {
        success: deleted,
        message: deleted ? "API key deleted" : "Key not found",
        errorCode: deleted ? undefined : "client-not-found",
      });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// ─── Users ────────────────────────────────────────────────────────

// List all users
WebApp.connectHandlers.use("/api/admin/users/list", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "GET")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const users = await Meteor.users
        .find(
          {},
          {
            fields: { username: 1, emails: 1, profile: 1, createdAt: 1 },
          },
        )
        .fetchAsync();

      sendJson(res, 200, {
        success: true,
        users: users.map((u) => ({
          _id: u._id,
          username: u.username,
          email: u.emails?.[0]?.address,
          firstName: u.profile?.firstName,
          lastName: u.profile?.lastName,
          registrationStatus: u.profile?.registrationStatus || "pending",
          createdAt: u.createdAt,
        })),
      });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Approve a user
WebApp.connectHandlers.use("/api/admin/users/approve", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const { userId } = await parseJsonBody(req);
      if (!userId)
        return sendJson(res, 400, {
          error: "userId required",
          errorCode: "missing-field",
        });

      const user = await Meteor.users.findOneAsync({ _id: userId });
      if (!user)
        return sendJson(res, 404, {
          error: "User not found",
          errorCode: "user-not-found",
        });

      await Meteor.users.updateAsync(
        { _id: userId },
        { $set: { "profile.registrationStatus": "approved" } },
      );
      await DeviceDetails.updateAsync(
        { userId },
        { $set: { "devices.$[].deviceRegistrationStatus": "approved" } },
      );

      sendJson(res, 200, { success: true, message: "User approved" });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Delete a user (and all related data)
WebApp.connectHandlers.use("/api/admin/users/delete", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "DELETE" && req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const { userId } = await parseJsonBody(req);
      if (!userId)
        return sendJson(res, 400, {
          error: "userId required",
          errorCode: "missing-field",
        });

      const result = await Meteor.callAsync("users.removeCompletely", userId);
      sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// ─── Devices ──────────────────────────────────────────────────────

// List all devices (with user info)
WebApp.connectHandlers.use("/api/admin/devices/list", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "GET")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const allUsers = await DeviceDetails.find({}).fetchAsync();
      const devices = [];
      allUsers.forEach((u) => {
        (u.devices || []).forEach((d) => {
          devices.push({
            userId: u.userId,
            username: u.username,
            email: u.email,
            deviceUUID: d.deviceUUID,
            appId: d.appId,
            deviceModel: d.deviceModel,
            devicePlatform: d.devicePlatform,
            isPrimary: d.isPrimary,
            status: d.deviceRegistrationStatus,
            lastUpdated: d.lastUpdated,
          });
        });
      });
      sendJson(res, 200, { success: true, devices });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Approve a device
WebApp.connectHandlers.use("/api/admin/devices/approve", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const { userId, deviceUUID } = await parseJsonBody(req);
      if (!userId || !deviceUUID)
        return sendJson(res, 400, {
          error: "userId and deviceUUID required",
          errorCode: "missing-field",
        });

      const userDoc = await DeviceDetails.findOneAsync({
        userId,
        "devices.deviceUUID": deviceUUID,
      });
      if (!userDoc)
        return sendJson(res, 404, {
          error: "Device not found",
          errorCode: "device-not-found",
        });

      await DeviceDetails.updateAsync(
        { userId, "devices.deviceUUID": deviceUUID },
        {
          $set: {
            "devices.$.deviceRegistrationStatus": "approved",
            "devices.$.lastUpdated": new Date(),
          },
        },
      );

      sendJson(res, 200, { success: true, message: "Device approved" });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Revoke a device
WebApp.connectHandlers.use("/api/admin/devices/revoke", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const { userId, deviceUUID } = await parseJsonBody(req);
      if (!userId || !deviceUUID)
        return sendJson(res, 400, {
          error: "userId and deviceUUID required",
          errorCode: "missing-field",
        });

      const userDoc = await DeviceDetails.findOneAsync({
        userId,
        "devices.deviceUUID": deviceUUID,
      });
      if (!userDoc)
        return sendJson(res, 404, {
          error: "Device not found",
          errorCode: "device-not-found",
        });

      // Remove the device from the user's devices array
      await DeviceDetails.updateAsync(
        { userId },
        { $pull: { devices: { deviceUUID } } },
      );

      sendJson(res, 200, {
        success: true,
        message: "Device revoked and removed",
      });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// ─── Emails ───────────────────────────────────────────────────────

// List all email logs (newest first)
WebApp.connectHandlers.use("/api/admin/emails/list", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "GET")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const emails = await EmailLog.find(
        {},
        { sort: { createdAt: -1 }, limit: 200 },
      ).fetchAsync();

      // Enrich registration_approval emails with the user's current registration status
      const enriched = await Promise.all(
        emails.map(async (e) => {
          const doc = { ...e };
          if (e.type === "registration_approval" && e.userId) {
            const user = await Meteor.users.findOneAsync(
              { _id: e.userId },
              { fields: { "profile.registrationStatus": 1 } },
            );
            doc.registrationStatus =
              user?.profile?.registrationStatus || "deleted";
          }
          return doc;
        }),
      );

      sendJson(res, 200, { success: true, emails: enriched });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// ─── Duo Integrations ─────────────────────────────────────────────
// Credentials used by Duo client libraries (Authentik Duo stage / duo_client)
// to talk to MIEAuth's Duo Auth API (/auth/v2/*) and Admin API (/admin/v1/*).

// List all Duo integrations
WebApp.connectHandlers.use("/api/admin/duo/list", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "GET")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const integrations = await Meteor.callAsync("duoIntegrations.list");
      sendJson(res, 200, { success: true, integrations });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Create a new Duo integration
WebApp.connectHandlers.use("/api/admin/duo/create", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const { name, type } = await parseJsonBody(req);
      if (!name)
        return sendJson(res, 400, {
          error: "name required",
          errorCode: "missing-field",
        });

      const result = await Meteor.callAsync(
        "duoIntegrations.create",
        name,
        type || "auth",
      );
      sendJson(res, 201, {
        success: true,
        ...result,
        message:
          "Store the secret key (skey) securely. It will not be shown again.",
      });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Enable / disable a Duo integration
WebApp.connectHandlers.use("/api/admin/duo/set-enabled", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const { name, enabled } = await parseJsonBody(req);
      if (!name || typeof enabled !== "boolean")
        return sendJson(res, 400, {
          error: "name and enabled (boolean) required",
          errorCode: "missing-field",
        });

      const updated = await Meteor.callAsync(
        "duoIntegrations.setEnabled",
        name,
        enabled,
      );
      sendJson(res, updated ? 200 : 404, {
        success: updated,
        message: updated
          ? `Integration ${enabled ? "enabled" : "disabled"}`
          : "Integration not found",
        errorCode: updated ? undefined : "integration-not-found",
      });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Regenerate (rotate) a Duo integration's credentials
WebApp.connectHandlers.use("/api/admin/duo/regenerate", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const { name } = await parseJsonBody(req);
      if (!name)
        return sendJson(res, 400, {
          error: "name required",
          errorCode: "missing-field",
        });

      const result = await Meteor.callAsync("duoIntegrations.regenerate", name);
      sendJson(res, 200, {
        success: true,
        ...result,
        message:
          "Store the new secret key (skey) securely. It will not be shown again.",
      });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Delete a Duo integration
WebApp.connectHandlers.use("/api/admin/duo/delete", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "DELETE" && req.method !== "POST")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const { name } = await parseJsonBody(req);
      if (!name)
        return sendJson(res, 400, {
          error: "name required",
          errorCode: "missing-field",
        });

      const deleted = await Meteor.callAsync("duoIntegrations.delete", name);
      sendJson(res, deleted ? 200 : 404, {
        success: deleted,
        message: deleted ? "Integration deleted" : "Integration not found",
        errorCode: deleted ? undefined : "integration-not-found",
      });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// ─── Diagnostics ──────────────────────────────────────────────────
// Read-only troubleshooting view of a user's database state, so admins can
// diagnose push-delivery issues (e.g. stale FCM tokens) without direct
// MongoDB access.

// Summarise an FCM token without exposing the full send-capable value.
// The preview (first 12 + last 6 chars) is enough to compare against the
// token printed in a device's diagnostics logs; the SHA-256 fingerprint
// allows exact comparison when two previews look alike.
const fcmTokenInfo = (token) => {
  if (!token) return { present: false };
  return {
    present: true,
    length: token.length,
    preview: `${token.slice(0, 12)}…${token.slice(-6)}`,
    sha256: crypto
      .createHash("sha256")
      .update(token)
      .digest("hex")
      .slice(0, 16),
  };
};

// Look up a user by username, email, or userId and return their account,
// device, and recent-notification state.
WebApp.connectHandlers.use("/api/admin/diagnostics/user", async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "GET")
    return sendJson(res, 405, { error: "Method not allowed" });

  await requireAdminAuth(req, res, async () => {
    try {
      const query = new URL(req.url, "http://localhost").searchParams
        .get("q")
        ?.trim();
      if (!query)
        return sendJson(res, 400, {
          error: "Query parameter q (username, email, or userId) required",
          errorCode: "missing-field",
        });

      // Case-insensitive exact match on username/email; exact match on _id.
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const exact = new RegExp(`^${escaped}$`, "i");

      const user = await Meteor.users.findOneAsync(
        {
          $or: [
            { _id: query },
            { username: exact },
            { "emails.address": exact },
          ],
        },
        {
          fields: {
            username: 1,
            emails: 1,
            profile: 1,
            createdAt: 1,
            "services.resume.loginTokens": 1,
          },
        },
      );

      const deviceDoc = await DeviceDetails.findOneAsync({
        $or: [
          { userId: user?._id || query },
          { username: exact },
          { email: exact },
        ],
      });

      if (!user && !deviceDoc)
        return sendJson(res, 404, {
          error: "No user or device record matched that query",
          errorCode: "user-not-found",
        });

      const userId = user?._id || deviceDoc?.userId;

      const notifications = await NotificationHistory.find(
        { userId },
        { sort: { createdAt: -1 }, limit: 15 },
      ).fetchAsync();

      sendJson(res, 200, {
        success: true,
        account: user
          ? {
              userId: user._id,
              username: user.username,
              email: user.emails?.[0]?.address,
              registrationStatus: user.profile?.registrationStatus || "pending",
              createdAt: user.createdAt,
              activeSessionCount:
                user.services?.resume?.loginTokens?.length || 0,
            }
          : null,
        deviceRecord: deviceDoc
          ? {
              userId: deviceDoc.userId,
              username: deviceDoc.username,
              email: deviceDoc.email,
              lastUpdated: deviceDoc.lastUpdated,
              devices: (deviceDoc.devices || []).map((d) => ({
                deviceUUID: d.deviceUUID,
                appId: d.appId,
                customName: d.customName,
                deviceModel: d.deviceModel,
                devicePlatform: d.devicePlatform,
                status: d.deviceRegistrationStatus,
                isPrimary: !!d.isPrimary,
                lastUsed: d.lastUsed,
                lastUpdated: d.lastUpdated,
                hasBiometricSecret: !!d.biometricSecret,
                fcmToken: fcmTokenInfo(d.fcmToken),
              })),
            }
          : null,
        // Flag account/device inconsistencies that commonly break pushes.
        warnings: [
          user && !deviceDoc && "User exists but has no device record.",
          deviceDoc &&
            !user &&
            "Device record exists but the user account was deleted.",
          deviceDoc &&
            (deviceDoc.devices || []).some((d) => !d.fcmToken) &&
            "One or more devices have no FCM token stored — pushes cannot be delivered to them.",
          deviceDoc &&
            (deviceDoc.devices || []).length > 0 &&
            !(deviceDoc.devices || []).some(
              (d) => d.deviceRegistrationStatus === "approved" && d.isPrimary,
            ) &&
            "No approved primary device — approval pushes may not be routed.",
        ].filter(Boolean),
        notifications: notifications.map((n) => ({
          notificationId: n.notificationId,
          title: n.title,
          status: n.status,
          clientId: n.clientId,
          createdAt: n.createdAt,
        })),
      });
    } catch (err) {
      const mapped = mapMeteorError(err);
      sendJson(res, mapped.status, {
        error: mapped.error,
        errorCode: mapped.errorCode,
      });
    }
  });
});

// Send a test push to one stored device token and report the live FCM
// result. A "messaging/registration-token-not-registered" error proves the
// stored token is stale (device reinstalled / token rotated but never
// re-persisted).
WebApp.connectHandlers.use(
  "/api/admin/diagnostics/test-push",
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }
    if (req.method !== "POST")
      return sendJson(res, 405, { error: "Method not allowed" });

    await requireAdminAuth(req, res, async () => {
      try {
        const { userId, deviceUUID } = await parseJsonBody(req);
        if (!userId || !deviceUUID)
          return sendJson(res, 400, {
            error: "userId and deviceUUID required",
            errorCode: "missing-field",
          });

        const userDoc = await DeviceDetails.findOneAsync({ userId });
        const device = userDoc?.devices?.find(
          (d) => d.deviceUUID === deviceUUID,
        );
        if (!device)
          return sendJson(res, 404, {
            error: "Device not found",
            errorCode: "device-not-found",
          });
        if (!device.fcmToken)
          return sendJson(res, 200, {
            success: false,
            result: "no-token",
            message: "No FCM token is stored for this device.",
          });

        try {
          const messageId = await sendNotification(
            device.fcmToken,
            "Test Notification",
            "This is a diagnostic test push sent by an administrator.",
            {
              notificationType: "test",
              isDismissal: "false",
              isSync: "false",
            },
          );
          if (!messageId)
            return sendJson(res, 200, {
              success: false,
              result: "firebase-disabled",
              message:
                "Firebase is not initialised on this server — push notifications are disabled.",
            });
          sendJson(res, 200, {
            success: true,
            result: "sent",
            messageId,
            message:
              "FCM accepted the message. If the device did not receive it, check its OS notification permissions.",
          });
        } catch (fcmErr) {
          const code = fcmErr.code || "unknown";
          const STALE_CODES = [
            "messaging/registration-token-not-registered",
            "messaging/invalid-registration-token",
            "messaging/invalid-argument",
          ];
          sendJson(res, 200, {
            success: false,
            result: "fcm-error",
            fcmErrorCode: code,
            message: STALE_CODES.includes(code)
              ? "The stored FCM token is stale or invalid — the device must re-register to receive pushes."
              : `FCM rejected the message: ${fcmErr.message}`,
          });
        }
      } catch (err) {
        const mapped = mapMeteorError(err);
        sendJson(res, mapped.status, {
          error: mapped.error,
          errorCode: mapped.errorCode,
        });
      }
    });
  },
);

// Rollout coverage for the v1 -> v2 identity migration (migration-plan.md
// Phase 3): device counts per identity version / proof, and recent failures.
WebApp.connectHandlers.use(
  "/api/admin/diagnostics/identity-migration",
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }
    if (req.method !== "GET")
      return sendJson(res, 405, { error: "Method not allowed" });

    await requireAdminAuth(req, res, async () => {
      try {
        const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [stats] = await DeviceDetails.rawCollection()
          .aggregate([
            { $unwind: "$devices" },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                v2: {
                  $sum: {
                    $cond: [{ $eq: ["$devices.identityVersion", 2] }, 1, 0],
                  },
                },
                v2ActiveLast30d: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$devices.identityVersion", 2] },
                          { $gte: ["$devices.lastUsed", THIRTY_DAYS_AGO] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                activeLast30d: {
                  $sum: {
                    $cond: [
                      { $gte: ["$devices.lastUsed", THIRTY_DAYS_AGO] },
                      1,
                      0,
                    ],
                  },
                },
                byProof: { $push: "$devices.migrationProof" },
              },
            },
          ])
          .toArray();

        const proofCounts = {};
        (stats?.byProof || []).forEach((proof) => {
          if (proof) proofCounts[proof] = (proofCounts[proof] || 0) + 1;
        });

        const recentFailures = await MigrationEvents.find(
          { outcome: { $ne: "success" } },
          { sort: { createdAt: -1 }, limit: 20 },
        ).fetchAsync();

        sendJson(res, 200, {
          success: true,
          devices: {
            total: stats?.total || 0,
            v2: stats?.v2 || 0,
            v1: (stats?.total || 0) - (stats?.v2 || 0),
            activeLast30d: stats?.activeLast30d || 0,
            v2ActiveLast30d: stats?.v2ActiveLast30d || 0,
            byProof: proofCounts,
          },
          recentFailures: recentFailures.map((event) => ({
            action: event.action,
            outcome: event.outcome,
            message: event.message,
            userId: event.userId,
            deviceUUID: event.deviceUUID,
            createdAt: event.createdAt,
          })),
        });
      } catch (err) {
        const mapped = mapMeteorError(err);
        sendJson(res, mapped.status, {
          error: mapped.error,
          errorCode: mapped.errorCode,
        });
      }
    });
  },
);
