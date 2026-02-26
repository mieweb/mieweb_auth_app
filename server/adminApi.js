import { Meteor } from "meteor/meteor";
import { WebApp } from "meteor/webapp";
import { ApiKeys } from "../utils/api/apiKeys";
import { DeviceDetails } from "../utils/api/deviceDetails";
import { EmailLog } from "../utils/api/emailLog";
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
