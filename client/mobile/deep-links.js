const INVITE_ROUTE = "/register";
const INVITE_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

export const extractInviteToken = (urlValue) => {
  if (!urlValue) {
    return "";
  }

  const normalizedValue = String(urlValue).trim();

  if (INVITE_TOKEN_REGEX.test(normalizedValue)) {
    return normalizedValue;
  }

  try {
    const parsedUrl = new URL(
      normalizedValue,
      typeof window === "undefined"
        ? "https://localhost"
        : window.location.origin,
    );

    const queryToken = parsedUrl.searchParams.get("token")?.trim();
    if (queryToken) {
      return queryToken;
    }

    const pathValue = parsedUrl.pathname.replace(/^\/+|\/+$/g, "");
    return INVITE_TOKEN_REGEX.test(pathValue) ? pathValue : "";
  } catch {
    return "";
  }
};

export const getInviteRegistrationPath = (urlValue) => {
  const token = extractInviteToken(urlValue);
  return token ? `${INVITE_ROUTE}?token=${encodeURIComponent(token)}` : "";
};

export const navigateToInviteRoute = (urlValue) => {
  if (typeof window === "undefined") {
    return;
  }

  const targetPath = getInviteRegistrationPath(urlValue);

  if (!targetPath) {
    return;
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;

  if (currentPath === targetPath) {
    return;
  }

  window.history.replaceState({}, "", targetPath);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const handleInviteUrl = (urlValue) => {
  navigateToInviteRoute(urlValue);
};

export const initializeDeepLinks = () => {
  if (typeof window === "undefined") {
    return;
  }

  handleInviteUrl(window.location.href);

  window.handleOpenURL = (urlValue) => {
    window.setTimeout(() => {
      handleInviteUrl(urlValue);
    }, 0);
  };

  if (window.universalLinks?.subscribe) {
    try {
      window.universalLinks.subscribe("registerInvite", (eventData = {}) => {
        handleInviteUrl(
          eventData.url || eventData.deepLink || eventData.link || "",
        );
      });
    } catch (error) {
      console.warn("Unable to subscribe to universal links", error);
    }
  }
};
