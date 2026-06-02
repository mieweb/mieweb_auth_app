import { WebApp } from "meteor/webapp";
import { Meteor } from "meteor/meteor";
import { authenticateRequest } from "./auth.js";
import {
  DUO_ERRORS,
  sendOk,
  sendFail,
  sendDuo,
  sendOkPaged,
} from "./response.js";
import { readRawBody, buildParams, setCors, firstParam } from "./http.js";
import {
  listDuoUsers,
  getDuoUserById,
  getDuoUserPhones,
  listDuoPhones,
  getDuoPhoneById,
  adminSummary,
} from "./adminModel.js";
import { createInviteRecord, Invites } from "../../utils/api/invites.js";

const MOUNT = "/admin/v1";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

/** Parse Duo Admin API pagination params (limit/offset) from merged params. */
const parsePagination = (params) => {
  let limit = parseInt(firstParam(params, "limit"), 10);
  let offset = parseInt(firstParam(params, "offset"), 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { limit, offset };
};

const isEmail = (s) => typeof s === "string" && /.+@.+\..+/.test(s);

/* ------------------------------------------------------------------ *
 * Handlers. Each receives ({ params, match, rawBody }, res).
 *   match[] holds captured path params (e.g. the user/phone id).
 * ------------------------------------------------------------------ */

const listUsers = async ({ params }, res) => {
  const username = firstParam(params, "username");
  const users = await listDuoUsers({ username });
  return sendOkPaged(res, users, parsePagination(params));
};

const createUser = async ({ params }, res) => {
  const username = firstParam(params, "username");
  if (!username) {
    return sendFail(res, DUO_ERRORS.MISSING_PARAM, "username");
  }
  const email =
    firstParam(params, "email") || (isEmail(username) ? username : "");
  try {
    const { inviteDoc } = await createInviteRecord({
      email: email || "",
      username: isEmail(username) ? "" : username,
    });
    return sendOk(res, {
      user_id: inviteDoc._id,
      username,
      realname: "",
      email: email || "",
      status: "disabled",
      is_enrolled: false,
      created: Math.floor(inviteDoc.createdAt?.getTime?.() / 1000) || null,
      notes: "Pending enrollment (invite created)",
      phones: [],
      tokens: [],
      groups: [],
    });
  } catch (error) {
    console.error("[duo-admin] createUser failed:", error);
    return sendFail(res, DUO_ERRORS.SERVER_ERROR, error.message);
  }
};

const getUser = async ({ match }, res) => {
  const user = await getDuoUserById(match[0]);
  if (!user) {
    return sendFail(res, DUO_ERRORS.NOT_FOUND, `user ${match[0]}`);
  }
  return sendOk(res, user);
};

const deleteUser = async ({ match }, res) => {
  const userId = match[0];
  const existing = await getDuoUserById(userId);
  if (!existing) {
    return sendFail(res, DUO_ERRORS.NOT_FOUND, `user ${userId}`);
  }
  // An unconsumed invite has no Meteor user; remove the invite directly.
  const invite = await Invites.findOneAsync({ _id: userId });
  if (invite && !invite.consumedByUserId) {
    await Invites.removeAsync({ _id: userId });
    return sendOk(res, {});
  }
  await Meteor.callAsync("users.removeCompletely", userId);
  return sendOk(res, {});
};

const getUserPhones = async ({ match }, res) => {
  const phones = await getDuoUserPhones(match[0]);
  if (phones === null) {
    return sendFail(res, DUO_ERRORS.NOT_FOUND, `user ${match[0]}`);
  }
  return sendOk(res, phones);
};

const listPhones = async ({ params }, res) => {
  const phones = await listDuoPhones();
  return sendOkPaged(res, phones, parsePagination(params));
};

const getPhone = async ({ match }, res) => {
  const phone = await getDuoPhoneById(match[0]);
  if (!phone) {
    return sendFail(res, DUO_ERRORS.NOT_FOUND, `phone ${match[0]}`);
  }
  return sendOk(res, phone);
};

const infoSummary = async (_ctx, res) => {
  const summary = await adminSummary();
  return sendOk(res, summary);
};

/* ------------------------------------------------------------------ *
 * Route table. `pattern` matches the sub-path (after /admin/v1).
 * ------------------------------------------------------------------ */
const ID = "([^/]+)";
const ROUTES = [
  { method: "GET", pattern: new RegExp(`^/users$`), handler: listUsers },
  { method: "POST", pattern: new RegExp(`^/users$`), handler: createUser },
  {
    method: "GET",
    pattern: new RegExp(`^/users/${ID}/phones$`),
    handler: getUserPhones,
  },
  { method: "GET", pattern: new RegExp(`^/users/${ID}$`), handler: getUser },
  {
    method: "DELETE",
    pattern: new RegExp(`^/users/${ID}$`),
    handler: deleteUser,
  },
  {
    method: "POST",
    pattern: new RegExp(`^/users/${ID}$`),
    handler: deleteUser,
  },
  { method: "GET", pattern: new RegExp(`^/phones$`), handler: listPhones },
  { method: "GET", pattern: new RegExp(`^/phones/${ID}$`), handler: getPhone },
  {
    method: "GET",
    pattern: new RegExp(`^/info/summary$`),
    handler: infoSummary,
  },
];

WebApp.connectHandlers.use(MOUNT, async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const subPath = (req.url || "/").split("?")[0].replace(/\/$/, "") || "/";
  const fullPath = MOUNT + (subPath === "/" ? "" : subPath);

  // Find a route whose pattern matches the sub-path.
  let matched = null;
  let pathMatchedDifferentMethod = false;
  for (const route of ROUTES) {
    const m = route.pattern.exec(subPath);
    if (!m) continue;
    if (route.method !== req.method) {
      pathMatchedDifferentMethod = true;
      continue;
    }
    matched = { route, match: m.slice(1).map((v) => decodeURIComponent(v)) };
    break;
  }

  if (!matched) {
    if (pathMatchedDifferentMethod) {
      return sendDuo(res, 405, {
        stat: "FAIL",
        code: DUO_ERRORS.INVALID_REQUEST.code,
        message: "Method not allowed",
        message_detail: `${req.method} ${fullPath}`,
      });
    }
    return sendFail(res, DUO_ERRORS.NOT_FOUND, fullPath);
  }

  // Read the body for body-bearing methods (needed for sig v5 hashing).
  let rawBody = "";
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    try {
      rawBody = await readRawBody(req);
    } catch (error) {
      const tooLarge = error.message === "Payload too large";
      return sendFail(
        res,
        DUO_ERRORS.INVALID_REQUEST,
        tooLarge ? "Payload too large" : "Unable to read request body",
      );
    }
  }

  // Authenticate: requires an "admin"-type integration key.
  const authResult = await authenticateRequest({
    req,
    path: fullPath,
    rawBody,
    requiredType: "admin",
  });
  if (!authResult.ok) {
    return sendFail(res, authResult.error, authResult.detail);
  }

  const params = buildParams(req, rawBody);
  const ctx = {
    req,
    params,
    rawBody,
    match: matched.match,
    integration: authResult.integration,
  };

  try {
    await matched.route.handler(ctx, res);
  } catch (error) {
    console.error(`[duo-admin] handler error for ${fullPath}:`, error);
    if (!res.headersSent) {
      sendFail(res, DUO_ERRORS.SERVER_ERROR, error.message);
    }
  }
});

console.log("[duo] Admin API v1 compatibility layer mounted at /admin/v1");
