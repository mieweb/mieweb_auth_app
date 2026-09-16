import { useEffect, useState } from "react";

// MIEWeb Auth (org.mieweb.auth) listings. Used for local dev and as the
// fallback whenever a deploy did not stamp per-variant URLs into buildInfo.json.
const DEFAULT_STORE_URLS = {
  appStoreUrl: "https://apps.apple.com/us/app/mieweb-auth/id6802469232",
  playStoreUrl: "https://play.google.com/store/apps/details?id=org.mieweb.auth",
};

// buildInfo.json is same-origin, but its values end up in href/src attributes,
// so only absolute https URLs are accepted.
const safeUrl = (value, fallback) =>
  typeof value === "string" && value.startsWith("https://") ? value : fallback;

let storeUrlsPromise;

const loadStoreUrls = () => {
  if (!storeUrlsPromise) {
    storeUrlsPromise = fetch("/buildInfo.json")
      .then((response) => response.json())
      .then((info) => ({
        appStoreUrl: safeUrl(info.appStoreUrl, DEFAULT_STORE_URLS.appStoreUrl),
        playStoreUrl: safeUrl(
          info.playStoreUrl,
          DEFAULT_STORE_URLS.playStoreUrl,
        ),
      }))
      .catch(() => DEFAULT_STORE_URLS);
  }

  return storeUrlsPromise;
};

/**
 * Store listings for the instance this client was served from.
 * Renders with the defaults until buildInfo.json resolves.
 */
export const useStoreUrls = () => {
  const [urls, setUrls] = useState(DEFAULT_STORE_URLS);

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
