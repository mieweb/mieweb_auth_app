import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

/**
 * Tiny stale-while-revalidate cache for admin GET endpoints.
 *
 * - One entry per path, shared by every component that reads it.
 * - In-flight requests are de-duplicated; a refresh requested mid-flight
 *   (e.g. right after a mutation) re-runs once the current one settles, so the
 *   UI never ends on a response that predates the mutation.
 * - While any resource is mounted, a single timer re-polls them every
 *   POLL_MS while the page is visible, and on focus/visibility changes.
 */

const POLL_MS = 15 * 1000;
const FOCUS_THROTTLE_MS = 2 * 1000;
const IDLE = { data: undefined, error: null, fetchedAt: 0, refreshing: false };

const entries = new Map();
let pollTimer = null;
let lastActiveRefresh = 0;

const getEntry = (path) => {
  if (!entries.has(path)) {
    entries.set(path, {
      snapshot: IDLE,
      listeners: new Set(),
      inFlight: null,
      rerun: false,
    });
  }
  return entries.get(path);
};

const update = (entry, patch) => {
  entry.snapshot = { ...entry.snapshot, ...patch };
  entry.listeners.forEach((listener) => listener());
};

export const refresh = (path) => {
  const entry = getEntry(path);
  if (entry.inFlight) {
    entry.rerun = true;
    return entry.inFlight;
  }
  update(entry, { refreshing: true });
  // Resolves only after any rerun queued mid-flight, so callers awaiting a
  // refresh see data fetched after their mutation.
  entry.inFlight = (async () => {
    do {
      entry.rerun = false;
      try {
        const data = await api(path);
        update(entry, { data, error: null, fetchedAt: Date.now() });
      } catch (error) {
        update(entry, { error });
      }
      // Stop if the cache was cleared (sign-out) meanwhile.
    } while (entry.rerun && entries.get(path) === entry);
    entry.inFlight = null;
    update(entry, { refreshing: false });
  })();
  return entry.inFlight;
};

/** Refetch cached resources after a mutation; resolves once they are fresh. */
export const invalidate = (...paths) =>
  Promise.all(
    paths.filter((path) => entries.has(path)).map((path) => refresh(path)),
  );

const refreshActive = () => {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - lastActiveRefresh < FOCUS_THROTTLE_MS) return;
  lastActiveRefresh = Date.now();
  entries.forEach((entry, path) => entry.listeners.size && refresh(path));
};

const startPolling = () => {
  if (pollTimer) return;
  pollTimer = setInterval(refreshActive, POLL_MS);
  document.addEventListener("visibilitychange", refreshActive);
  window.addEventListener("focus", refreshActive);
};

/** Drop all cached admin data (on sign-out / session expiry). */
export const clearResources = () => {
  clearInterval(pollTimer);
  pollTimer = null;
  document.removeEventListener("visibilitychange", refreshActive);
  window.removeEventListener("focus", refreshActive);
  entries.clear();
};

const noopSubscribe = () => () => {};
const idleSnapshot = () => IDLE;

/**
 * Subscribe to an admin GET endpoint. Pass a falsy path to stay idle.
 * @returns {{ data, error, fetchedAt, refreshing, loading, refresh }}
 */
export const useResource = (path) => {
  const subscribe = useCallback(
    (listener) => {
      const { listeners } = getEntry(path);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    [path],
  );
  const getSnapshot = useCallback(() => getEntry(path).snapshot, [path]);

  const snapshot = useSyncExternalStore(
    path ? subscribe : noopSubscribe,
    path ? getSnapshot : idleSnapshot,
  );

  useEffect(() => {
    if (!path) return;
    refresh(path);
    startPolling();
  }, [path]);

  const reload = useCallback(() => path && refresh(path), [path]);

  return {
    ...snapshot,
    loading: !!path && !snapshot.fetchedAt && !snapshot.error,
    refresh: reload,
  };
};
