import { WebApp } from "meteor/webapp";
import { Meteor } from "meteor/meteor";
import { URL } from "url";
import { authenticateRequest } from "./auth.js";
import { ROUTES } from "./endpoints.js";
import { renderQrPng } from "./qr.js";
import { DUO_ERRORS, sendFail, sendDuo } from "./response.js";

const MOUNT = "/auth/v2";
const MAX_BODY_BYTES = 1024 * 256; // 256 KB cap

/** Read the raw request body as a string (bounded). */
const readRawBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

/** Merge query-string + body params into a single key -> value(s) object. */
const buildParams = (req, rawBody) => {
  const params = {};
  const host = req.headers["host"] || "localhost";

  // Query string params.
  try {
    const u = new URL(req.url, `http://${host}`);
    for (const key of new Set(u.searchParams.keys())) {
      params[key] = u.searchParams.getAll(key);
    }
  } catch (e) {
    /* ignore */
  }

  if (!rawBody) {
    return params;
  }

  const contentType = (req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody);
      for (const [k, v] of Object.entries(parsed)) {
        params[k] = Array.isArray(v) ? v.map(String) : v;
      }
    } catch (e) {
      /* leave query params only */
    }
  } else {
    // default: treat as form-urlencoded
    try {
      const form = new URLSearchParams(rawBody);
      for (const key of new Set(form.keys())) {
        params[key] = form.getAll(key);
      }
    } catch (e) {
      /* ignore */
    }
  }
  return params;
};

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Date, X-Duo-Date",
  );
};

const baseUrl = () => {
  try {
    return Meteor.absoluteUrl().replace(/\/$/, "");
  } catch (e) {
    return (process.env.ROOT_URL || "http://localhost:3000").replace(/\/$/, "");
  }
};

WebApp.connectHandlers.use(MOUNT, async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Sub-path within the /auth/v2 mount (without query string).
  const subPath = (req.url || "/").split("?")[0].replace(/\/$/, "") || "/";
  const fullPath = MOUNT + (subPath === "/" ? "" : subPath);

  // --- QR image endpoint (no Duo signature; renders a URL the client owns) ---
  if (subPath === "/qr" && req.method === "GET") {
    try {
      const host = req.headers["host"] || "localhost";
      const u = new URL(req.url, `http://${host}`);
      const value = u.searchParams.get("value");
      if (!value) {
        res.writeHead(400);
        res.end("Missing value");
        return;
      }
      const png = await renderQrPng(value);
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": png.length,
        "Cache-Control": "no-store",
      });
      res.end(png);
    } catch (error) {
      console.error("[duo] qr render failed:", error);
      res.writeHead(500);
      res.end("QR render error");
    }
    return;
  }

  const route = ROUTES[subPath];
  if (!route) {
    return sendFail(res, DUO_ERRORS.NOT_FOUND, fullPath);
  }
  if (route.method !== req.method) {
    return sendDuo(res, 405, {
      stat: "FAIL",
      code: DUO_ERRORS.INVALID_REQUEST.code,
      message: "Method not allowed",
      message_detail: `${req.method} ${fullPath}`,
    });
  }

  // Capture the raw body for body-bearing methods (needed for sig v5 hashing).
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

  // Authenticate (signature verification) unless the route is public.
  let integration = null;
  if (route.auth) {
    const authResult = await authenticateRequest({
      req,
      path: fullPath,
      rawBody,
    });
    if (!authResult.ok) {
      return sendFail(res, authResult.error, authResult.detail);
    }
    integration = authResult.integration;
  }

  const params = buildParams(req, rawBody);
  const ctx = {
    req,
    params,
    rawBody,
    integration,
    baseUrl: baseUrl(),
  };

  try {
    await route.handler(ctx, res);
  } catch (error) {
    console.error(`[duo] handler error for ${fullPath}:`, error);
    if (!res.headersSent) {
      sendFail(res, DUO_ERRORS.SERVER_ERROR, error.message);
    }
  }
});

console.log("[duo] Auth API v2 compatibility layer mounted at /auth/v2");
