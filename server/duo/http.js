import { Meteor } from "meteor/meteor";
import { URL } from "url";

/**
 * Shared low-level HTTP helpers for the Duo compatibility mounts
 * (Auth API at /auth/v2 and Admin API at /admin/v1). Keeping these in one
 * place avoids duplicating body parsing / param building / CORS logic.
 */

export const MAX_BODY_BYTES = 1024 * 256; // 256 KB cap

/** Read the raw request body as a string (bounded by MAX_BODY_BYTES). */
export const readRawBody = (req) =>
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
export const buildParams = (req, rawBody) => {
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

/** Apply permissive CORS headers used by both Duo mounts. */
export const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Date, X-Duo-Date",
  );
};

/** Resolve this server's base URL (no trailing slash). */
export const baseUrl = () => {
  try {
    return Meteor.absoluteUrl().replace(/\/$/, "");
  } catch (e) {
    return (process.env.ROOT_URL || "http://localhost:3000").replace(/\/$/, "");
  }
};

/** Pull the first value for a key from a merged params object. */
export const firstParam = (params, ...keys) => {
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
