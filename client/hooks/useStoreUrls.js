import { useEffect, useState } from "react";

// MIEWeb Auth (org.mieweb.auth) listings. Used for local dev and as the
// fallback whenever a deploy did not stamp per-variant URLs into buildInfo.json.
const DEFAULT_STORE_URLS = {
  appStoreUrl: "https://apps.apple.com/us/app/mieweb-auth/id6802469232",
  playStoreUrl: "https://play.google.com/store/apps/details?id=org.mieweb.auth",
};

// No default scheme: guessing one opens the wrong app on other instances.
const INITIAL_STATE = { ...DEFAULT_STORE_URLS, urlScheme: null, loading: true };
const FAILED_STATE = { ...DEFAULT_STORE_URLS, urlScheme: null, loading: false };

const BUILD_INFO_TIMEOUT_MS = 5000;

// buildInfo.json is same-origin, but its values end up in href/src attributes,
// so only absolute https URLs are accepted.
const safeUrl = (value, fallback) =>
  typeof value === "string" && value.startsWith("https://") ? value : fallback;

const safeScheme = (value) =>
  typeof value === "string" && /^[a-z][a-z0-9+.-]*$/.test(value) ? value : null;

let storeUrlsPromise;

const loadStoreUrls = () => {
  if (!storeUrlsPromise) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BUILD_INFO_TIMEOUT_MS);

    storeUrlsPromise = fetch("/buildInfo.json", {
      cache: "no-cache",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((info) => ({
        appStoreUrl: safeUrl(info.appStoreUrl, DEFAULT_STORE_URLS.appStoreUrl),
        playStoreUrl: safeUrl(
          info.playStoreUrl,
          DEFAULT_STORE_URLS.playStoreUrl,
        ),
        urlScheme: safeScheme(info.urlScheme),
        loading: false,
      }))
      .catch(() => FAILED_STATE)
      .finally(() => clearTimeout(timer));
  }

  return storeUrlsPromise;
};

/**
 * Store listings and deep-link scheme for the instance this client was served from.
 * `urlScheme` stays null while loading and when it could not be determined.
 */
export const useStoreUrls = () => {
  const [urls, setUrls] = useState(INITIAL_STATE);

  useEffect(() => {
    let active = true;
    loadStoreUrls().then((resolved) => {
      if (active) setUrls(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  return urls;
};
