import crypto from "crypto";

/**
 * Duo request-signature verification.
 *
 * Mirrors duo_client's canonicalization so that requests signed by any
 * official Duo client library (Python/Node/etc.) validate unchanged.
 *
 * Reference: duo_client/client.py `canonicalize`, `canon_params`,
 * `canon_x_duo_headers`, and `sign`.
 *
 * We support:
 *   - sig_version 5 (default in modern duo_client; HMAC-SHA512, JSON body,
 *     canonical includes sha512(body) and sha512(canon X-Duo headers))
 *   - sig_version 2 (legacy; HMAC-SHA1, params canonicalized, no body hash)
 */

const sha512Hex = (str) =>
  crypto.createHash("sha512").update(str, "utf8").digest("hex");

/**
 * URL-encode a value the way duo_client does: urllib.parse.quote(v, "~").
 * Unreserved set = A-Za-z0-9 plus "_.-~"; everything else is percent-encoded
 * with UPPER-case hex. Note "/" IS encoded (it is not in the safe set here).
 */
export const duoQuote = (value) =>
  encodeURIComponent(String(value)).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );

/**
 * Canonicalize a params object (key -> array of string values) exactly as
 * duo_client's canon_params: quote keys+values, sort by quoted key, then by
 * quoted value, join "key=value" pairs with "&".
 */
export const canonParams = (params) => {
  const entries = [];
  for (const key of Object.keys(params)) {
    const qkey = duoQuote(key);
    const vals = params[key];
    const list = Array.isArray(vals) ? vals : [vals];
    entries.push([qkey, list.map((v) => duoQuote(v))]);
  }
  // Sort by quoted key
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const args = [];
  for (const [qkey, qvals] of entries) {
    const sortedVals = [...qvals].sort();
    for (const qval of sortedVals) {
      args.push(`${qkey}=${qval}`);
    }
  }
  return args.join("&");
};

/**
 * Hash the canonical representation of X-Duo-* headers (sig_version 5).
 * For requests with no such headers this is sha512("").
 */
export const canonXDuoHeaders = (additionalHeaders = {}) => {
  const lowered = {};
  for (const [name, value] of Object.entries(additionalHeaders)) {
    if (name == null) continue;
    lowered[name.toLowerCase()] = value;
  }
  const canonList = [];
  for (const name of Object.keys(lowered).sort()) {
    canonList.push(name, lowered[name]);
  }
  return sha512Hex(canonList.join("\x00"));
};

/**
 * Build the canonical string for a given signature version.
 * @param {Object} o
 * @param {string} o.method  HTTP method (upper-cased here)
 * @param {string} o.host    request host (lower-cased here)
 * @param {string} o.path    request path
 * @param {Object} o.params  params object (key -> array of values)
 * @param {string} o.date    exact Date header value
 * @param {number} o.sigVersion
 * @param {string} o.body    raw request body string (sig 4/5)
 * @param {Object} o.additionalHeaders  X-Duo-* headers (sig 5)
 */
export const canonicalize = ({
  method,
  host,
  path,
  params,
  date,
  sigVersion,
  body = "",
  additionalHeaders = {},
}) => {
  const m = method.toUpperCase();
  const h = host.toLowerCase();
  if (sigVersion === 2) {
    return [date, m, h, path, canonParams(params)].join("\n");
  }
  if (sigVersion === 4) {
    return [date, m, h, path, canonParams(params), sha512Hex(body)].join("\n");
  }
  if (sigVersion === 5) {
    return [
      date,
      m,
      h,
      path,
      canonParams(params),
      sha512Hex(body),
      canonXDuoHeaders(additionalHeaders),
    ].join("\n");
  }
  throw new Error(`Unsupported sig_version: ${sigVersion}`);
};

/**
 * Compute the hex HMAC signature for a canonical string.
 */
export const signCanonical = (skey, canonical, sigVersion) => {
  const algo = sigVersion === 2 ? "sha1" : "sha512";
  return crypto.createHmac(algo, skey).update(canonical, "utf8").digest("hex");
};

const timingSafeHexEqual = (a, b) => {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
};

/**
 * Extract any X-Duo-* request headers (sig_version 5 input).
 */
const extractXDuoHeaders = (headers = {}) => {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    if (name && name.toLowerCase().startsWith("x-duo-")) {
      out[name] = Array.isArray(value) ? value.join(",") : value;
    }
  }
  return out;
};

/**
 * Verify a Duo-signed request.
 *
 * Attempts sig_version 5 then 2 so that both modern and legacy clients work.
 *
 * @param {Object} o
 * @param {string} o.skey            plaintext secret key
 * @param {string} o.providedSig     hex signature from the Authorization header
 * @param {string} o.method
 * @param {string} o.host            Host header (may include port)
 * @param {string} o.path
 * @param {string} o.date            Date header
 * @param {Object} o.queryParams     parsed query-string params (key -> [values])
 * @param {string} o.body            raw request body
 * @param {Object} o.headers         all request headers (for X-Duo-* extraction)
 * @returns {boolean}
 */
export const verifySignature = ({
  skey,
  providedSig,
  method,
  host,
  path,
  date,
  queryParams = {},
  body = "",
  headers = {},
}) => {
  if (!skey || !providedSig || !date || !host) {
    return false;
  }
  const additionalHeaders = extractXDuoHeaders(headers);
  const isBodyMethod = ["POST", "PUT", "PATCH"].includes(method.toUpperCase());

  // sig_version 5: params live in the JSON body; query params used as the
  // canonical params only for non-body methods.
  const v5Params = isBodyMethod ? {} : queryParams;
  const v5Canon = canonicalize({
    method,
    host,
    path,
    params: v5Params,
    date,
    sigVersion: 5,
    body: isBodyMethod ? body : "",
    additionalHeaders,
  });
  if (timingSafeHexEqual(signCanonical(skey, v5Canon, 5), providedSig)) {
    return true;
  }

  // sig_version 2: legacy form-encoded / query params, no body hash.
  // For form-encoded POSTs the body params are merged into the param set.
  let v2Params = queryParams;
  if (isBodyMethod) {
    v2Params = { ...queryParams };
    try {
      const form = new URLSearchParams(body);
      for (const key of new Set(form.keys())) {
        v2Params[key] = form.getAll(key);
      }
    } catch (e) {
      // body not form-encoded; leave query params only
    }
  }
  const v2Canon = canonicalize({
    method,
    host,
    path,
    params: v2Params,
    date,
    sigVersion: 2,
  });
  if (timingSafeHexEqual(signCanonical(skey, v2Canon, 2), providedSig)) {
    return true;
  }

  return false;
};
