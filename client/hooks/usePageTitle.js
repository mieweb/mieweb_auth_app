import { useEffect } from "react";

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
