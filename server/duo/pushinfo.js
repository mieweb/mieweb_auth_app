/**
 * Helpers for rendering Duo `/auth` context (pushinfo + ipaddr) into a
 * human-readable push notification body.
 *
 * Duo's `pushinfo` is a URL-encoded query string of key/value pairs, e.g.
 * `from=login%20portal&domain=example.com`. Duo renders these as labeled
 * rows in the push; we do the same as "Label: value" lines.
 */

const MAX_ENTRIES = 10;
const MAX_KEY_LENGTH = 40;
const MAX_VALUE_LENGTH = 200;

const truncate = (s, max) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// Strip control characters (incl. newlines) so values cannot forge extra lines.
const clean = (s) =>
  String(s ?? "")
     
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim();

/** "remote_host" / "remote-host" -> "Remote host" */
export const humanizeKey = (key) => {
  const spaced = clean(key).replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : spaced;
};

/**
 * Parse a Duo pushinfo string into an ordered list of { key, label, value }.
 * Malformed input never throws; empty keys/values are dropped.
 */
export const parsePushinfo = (pushinfo) => {
  if (!pushinfo || typeof pushinfo !== "string") return [];
  const entries = [];
  for (const [rawKey, rawValue] of new URLSearchParams(pushinfo)) {
    const key = clean(rawKey);
    const value = clean(rawValue);
    if (!key || !value) continue;
    entries.push({
      key,
      label: truncate(humanizeKey(key), MAX_KEY_LENGTH),
      value: truncate(value, MAX_VALUE_LENGTH),
    });
    if (entries.length >= MAX_ENTRIES) break;
  }
  return entries;
};

/**
 * Build the notification body shown to the user.
 *
 * @param {Object} o
 * @param {string} o.who       username to display
 * @param {string} o.ipaddr    client IP passed to Duo /auth (optional)
 * @param {string} o.pushinfo  Duo pushinfo string (optional)
 * @returns {string} multi-line body
 */
export const formatPushBody = ({ who, ipaddr, pushinfo }) => {
  const lines = [`Approve login for ${clean(who)}`];
  const ip = clean(ipaddr);
  if (ip) lines.push(`IP address: ${truncate(ip, 64)}`);
  for (const { label, value } of parsePushinfo(pushinfo)) {
    lines.push(`${label}: ${value}`);
  }
  return lines.join("\n");
};
