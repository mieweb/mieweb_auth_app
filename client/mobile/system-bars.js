// Tints the Android system bars to the page background so they follow dark mode.
const syncSystemBars = () => {
  const [red, green, blue] = getComputedStyle(document.body)
    .backgroundColor.match(/\d+/g)
    .map(Number);
  window.SystemBars.setColor(red, green, blue);
};

export const initializeSystemBars = () => {
  // Android-only plugin; iOS already keeps the WebView below the status bar.
  if (!window.SystemBars) return;

  syncSystemBars();
  new MutationObserver(syncSystemBars).observe(document.documentElement, {
    attributeFilter: ["class"],
  });
};
