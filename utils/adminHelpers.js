// Pure helpers for the admin dashboard (kept outside client/ so tests can import them).

/** Format a duration as mm:ss, rounding up so "00:00" only shows once it has elapsed. */
export const formatCountdown = (ms) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

/** Case-insensitive substring match of `query` against any of `fields`. */
export const matchesQuery = (query, ...fields) => {
  const needle = (query || "").trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) =>
    String(field ?? "")
      .toLowerCase()
      .includes(needle),
  );
};

/** Count items per key, e.g. countBy(users, (u) => u.registrationStatus). */
export const countBy = (items, keyFn) =>
  items.reduce((counts, item) => {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

/** Slice `items` into a clamped page. */
export const paginate = (items, page, pageSize) => {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
};

/**
 * Convert a server-reported remaining cooldown into a local deadline. Using
 * the time the response was received avoids client/server clock skew.
 */
export const cooldownDeadline = (receivedAt, remainingMs) =>
  remainingMs > 0 ? receivedAt + remainingMs : 0;

const UNITS = [
  ["d", 24 * 60 * 60 * 1000],
  ["h", 60 * 60 * 1000],
  ["m", 60 * 1000],
];

/** Compact relative time ("just now", "5m ago", "3d ago"); falls back to a date after a week. */
export const formatRelativeTime = (value, now = Date.now()) => {
  if (!value) return "Never";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "—";
  const diff = now - time;
  if (diff < 60 * 1000) return "just now";
  if (diff > 7 * UNITS[0][1]) return new Date(time).toLocaleDateString();
  const [unit, size] = UNITS.find(([, ms]) => diff >= ms);
  return `${Math.floor(diff / size)}${unit} ago`;
};

/** Full timestamp for tooltips/titles. */
export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString() : "—";
