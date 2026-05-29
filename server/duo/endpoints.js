import {
  createInviteRecord,
  getInviteTokenStatus,
  Invites,
} from "../../utils/api/invites.js";
import { DUO_ERRORS, sendOk, sendFail } from "./response.js";
import { resolveDuoUser, approvedDevices } from "./users.js";
import { sendPushAndWait } from "./push.js";
import { buildBarcodeUrl } from "./qr.js";

const nowSecs = () => Math.floor(Date.now() / 1000);

/** Pull the first value for a key from a merged params object. */
const param = (params, ...keys) => {
  for (const key of keys) {
    const v = params[key];
    if (Array.isArray(v)) {
      if (v.length) return v[0];
    } else if (v !== undefined && v !== null) {
      return v;
    }
  }
  return undefined;
};

const isEmail = (s) => typeof s === "string" && /.+@.+\..+/.test(s);

/* ------------------------------------------------------------------ *
 * GET /auth/v2/ping  — no authentication required
 * ------------------------------------------------------------------ */
export const ping = async (_ctx, res) => {
  sendOk(res, { time: nowSecs() });
};

/* ------------------------------------------------------------------ *
 * GET /auth/v2/check — verifies credentials are valid
 * ------------------------------------------------------------------ */
export const check = async (_ctx, res) => {
  sendOk(res, { time: nowSecs() });
};

/* ------------------------------------------------------------------ *
 * POST /auth/v2/preauth — determine how a user may authenticate
 * ------------------------------------------------------------------ */
export const preauth = async (ctx, res) => {
  const { params } = ctx;
  const username = param(params, "username");
  const userId = param(params, "user_id");

  if (!username && !userId) {
    return sendFail(res, DUO_ERRORS.MISSING_PARAM, "username or user_id");
  }

  const subject = await resolveDuoUser({ userId, username });
  if (!subject.found) {
    return sendOk(res, {
      result: "enroll",
      status_msg: "Enroll an authentication device to proceed.",
      enroll_portal_url: "",
    });
  }

  const devices = approvedDevices(subject);
  if (devices.length === 0) {
    return sendOk(res, {
      result: "enroll",
      status_msg: "Enroll an authentication device to proceed.",
      enroll_portal_url: "",
    });
  }

  return sendOk(res, {
    result: "auth",
    status_msg: "Account is active; choose an authentication method.",
    devices: devices.map((d) => ({
      device: d.appId || d.deviceUUID,
      type: "phone",
      display_name: d.deviceModel || "MIEAuth device",
      capabilities: ["push"],
    })),
  });
};

/* ------------------------------------------------------------------ *
 * POST /auth/v2/enroll — create an enrollment (invite) for a user
 * ------------------------------------------------------------------ */
export const enroll = async (ctx, res) => {
  const { params, baseUrl } = ctx;
  const username = param(params, "username") || "";
  const validSecs = parseInt(param(params, "valid_secs"), 10);

  try {
    const email = username || "";
    const { token, inviteDoc } = await createInviteRecord({
      email,
      username: isEmail(username) ? "" : username,
    });

    const activationUrl = `${String(baseUrl).replace(/\/$/, "")}/register?token=${encodeURIComponent(token)}`;
    const expiration =
      Number.isFinite(validSecs) && validSecs > 0
        ? nowSecs() + validSecs
        : Math.floor(inviteDoc.expiresAt.getTime() / 1000);

    return sendOk(res, {
      activation_barcode: buildBarcodeUrl(baseUrl, activationUrl),
      activation_code: token,
      activation_url: activationUrl,
      expiration,
      user_id: inviteDoc._id,
      username: username || inviteDoc._id,
    });
  } catch (error) {
    console.error("[duo] enroll failed:", error);
    return sendFail(res, DUO_ERRORS.SERVER_ERROR, error.message);
  }
};

/* ------------------------------------------------------------------ *
 * POST /auth/v2/enroll_status — poll enrollment progress
 *   response is a bare status string: "success" | "waiting" | "invalid"
 * ------------------------------------------------------------------ */
export const enrollStatus = async (ctx, res) => {
  const { params } = ctx;
  const userId = param(params, "user_id");
  const activationCode = param(params, "activation_code");

  if (!userId) {
    return sendFail(res, DUO_ERRORS.MISSING_PARAM, "user_id");
  }

  const invite = await Invites.findOneAsync({ _id: userId });
  if (!invite) {
    // Maybe enrollment already completed and the user_id is a Meteor id.
    const subject = await resolveDuoUser({ userId });
    if (subject.found && approvedDevices(subject).length > 0) {
      return sendOk(res, "success");
    }
    return sendOk(res, "invalid");
  }

  // Validate the activation code if supplied.
  if (activationCode) {
    const { status } = await getInviteTokenStatus(activationCode);
    if (status === "invalid") {
      return sendOk(res, "invalid");
    }
    if (status === "expired") {
      return sendOk(res, "invalid");
    }
  } else if (invite.expiresAt <= new Date()) {
    return sendOk(res, "invalid");
  }

  // Consumed (registration completed + auto-approved) => success.
  if (invite.usedAt) {
    return sendOk(res, "success");
  }
  return sendOk(res, "waiting");
};

/* ------------------------------------------------------------------ *
 * POST /auth/v2/auth — perform a (synchronous) authentication
 * ------------------------------------------------------------------ */
export const auth = async (ctx, res) => {
  const { params } = ctx;
  const factor = param(params, "factor") || "push";
  const username = param(params, "username");
  const userId = param(params, "user_id");
  const device = param(params, "device") || "auto";
  const type = param(params, "type");
  const displayUsername = param(params, "display_username");
  const pushinfo = param(params, "pushinfo");
  const asyncMode = param(params, "async");

  if (!username && !userId) {
    return sendFail(res, DUO_ERRORS.MISSING_PARAM, "username or user_id");
  }

  // We only support the push factor. Any other factor is denied (Duo-style).
  const normalizedFactor = String(factor).toLowerCase();
  if (normalizedFactor !== "push" && normalizedFactor !== "auto") {
    return sendOk(res, {
      result: "deny",
      status: "deny",
      status_msg: `The "${factor}" factor is not supported; only push is available.`,
    });
  }

  const subject = await resolveDuoUser({ userId, username });
  if (!subject.found) {
    return sendFail(res, DUO_ERRORS.USER_NOT_FOUND, username || userId);
  }

  if (approvedDevices(subject).length === 0) {
    return sendOk(res, {
      result: "deny",
      status: "no_devices",
      status_msg: "User has no approved devices enrolled.",
    });
  }

  // Async mode is not implemented; we always resolve synchronously.
  if (asyncMode && String(asyncMode) === "1") {
    console.warn("[duo] async auth requested; serving synchronously instead");
  }

  const result = await sendPushAndWait({
    subject,
    device,
    type,
    displayUsername,
    pushinfo,
  });
  return sendOk(res, result);
};

/* ------------------------------------------------------------------ *
 * GET /auth/v2/auth_status — poll an async auth (minimal support)
 * ------------------------------------------------------------------ */
export const authStatus = async (_ctx, res) => {
  // We do not support async transactions; report a terminal deny so callers
  // do not poll indefinitely.
  return sendOk(res, {
    result: "deny",
    status: "deny",
    status_msg: "Asynchronous authentication is not supported.",
  });
};

/**
 * Endpoint table: path (after /auth/v2) -> { method, auth, handler }.
 */
export const ROUTES = {
  "/ping": { method: "GET", auth: false, handler: ping },
  "/check": { method: "GET", auth: true, handler: check },
  "/preauth": { method: "POST", auth: true, handler: preauth },
  "/enroll": { method: "POST", auth: true, handler: enroll },
  "/enroll_status": { method: "POST", auth: true, handler: enrollStatus },
  "/auth": { method: "POST", auth: true, handler: auth },
  "/auth_status": { method: "GET", auth: true, handler: authStatus },
};
