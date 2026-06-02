import { WebApp } from "meteor/webapp";
import { URL } from "url";
import { authenticateRequest } from "./auth.js";
import { ROUTES } from "./endpoints.js";
import { renderQrPng } from "./qr.js";
import { DUO_ERRORS, sendFail, sendDuo } from "./response.js";
import { readRawBody, buildParams, setCors, baseUrl } from "./http.js";

const MOUNT = "/auth/v2";

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
      requiredType: "auth",
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
