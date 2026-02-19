import { useEffect } from "react";

/**
 * Sets the document title for the current page.
 * Appends " — MIE Auth" suffix automatically.
 * @param {string} title - Page-specific title
 */
export const usePageTitle = (title) => {
  useEffect(() => {
    const prev = document.title;
    document.title = title
      ? `${title} — MIE Auth`
      : "MIE Auth — Open Source Two-Factor Authentication";
    return () => {
      document.title = prev;
    };
  }, [title]);
};
