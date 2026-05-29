import { URL } from "url";
import {
  findIntegrationByIkey,
  touchIntegration,
} from "../../utils/api/duoIntegrations.js";
import { verifySignature } from "./signature.js";
import { DUO_ERRORS } from "./response.js";

/**
 * Parse the HTTP Basic Authorization header used by Duo clients.
 * Duo sends `Authorization: Basic base64(ikey:signature)`.
 * @returns {{ikey: string, sig: string}|null}
 */
export const parseBasicAuth = (authHeader) => {
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }
  const match = /^Basic\s+(.+)$/i.exec(authHeader.trim());
  if (!match) {
    return null;
  }
  let decoded;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch (e) {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx === -1) {
    return null;
  }
  return {
    ikey: decoded.slice(0, idx),
    sig: decoded.slice(idx + 1),
  };
};

/**
 * Parse a query string into the duo_client param shape (key -> [values]).
 */
const parseQueryParams = (rawUrl, host) => {
  const params = {};
  try {
    const u = new URL(rawUrl, `http://${host || "localhost"}`);
    for (const key of new Set(u.searchParams.keys())) {
      params[key] = u.searchParams.getAll(key);
    }
  } catch (e) {
    // ignore malformed URL; return empty params
  }
  return params;
};

/**
 * Reject requests whose Date header is too far from the server clock. Duo
 * clients include a Date header that is part of the signed canonical string;
 * enforcing skew limits replay windows.
 */
const MAX_DATE_SKEW_MS = 300 * 1000; // 5 minutes

export const isDateFresh = (dateHeader, now = Date.now()) => {
  if (!dateHeader) {
    return false;
  }
  const t = Date.parse(dateHeader);
  if (Number.isNaN(t)) {
    return false;
  }
  return Math.abs(now - t) <= MAX_DATE_SKEW_MS;
};

/**
 * Authenticate a Duo-signed request.
 *
 * @param {Object} ctx
 * @param {IncomingMessage} ctx.req  the raw node request
 * @param {string} ctx.path          the request path (no query string)
 * @param {string} ctx.rawBody       raw request body string
 * @returns {Promise<{ok: boolean, integration?: Object, error?: Object,
 *                     detail?: string}>}
 */
export const authenticateRequest = async ({ req, path, rawBody = "" }) => {
  const auth = parseBasicAuth(req.headers["authorization"]);
  if (!auth) {
    return { ok: false, error: DUO_ERRORS.UNAUTHORIZED };
  }

  const date = req.headers["date"];
  if (!isDateFresh(date)) {
    return {
      ok: false,
      error: DUO_ERRORS.INVALID_SIGNATURE,
      detail: "Date header missing, unparseable, or outside allowed skew",
    };
  }

  const integration = await findIntegrationByIkey(auth.ikey);
  if (!integration || !integration.skey) {
    return { ok: false, error: DUO_ERRORS.INVALID_IKEY };
  }

  const host = req.headers["host"] || "";
  const queryParams = parseQueryParams(req.url, host);

  const valid = verifySignature({
    skey: integration.skey,
    providedSig: auth.sig,
    method: req.method,
    host,
    path,
    date,
    queryParams,
    body: rawBody,
    headers: req.headers,
  });

  if (!valid) {
    return { ok: false, error: DUO_ERRORS.INVALID_SIGNATURE };
  }

  touchIntegration(auth.ikey);
  return { ok: true, integration };
};
