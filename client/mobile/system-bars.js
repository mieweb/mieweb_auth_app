// Tints the Android system bars to the page background so they follow dark mode.
// A 1px canvas converts any CSS color format (hex, rgb, oklch, color()) to sRGB bytes.
const syncSystemBars = (pixel) => {
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = getComputedStyle(document.body).backgroundColor;
  pixel.fillRect(0, 0, 1, 1);
  const [red, green, blue] = pixel.getImageData(0, 0, 1, 1).data;
  window.SystemBars.setColor(red, green, blue);
};

export const initializeSystemBars = () => {
  // Android-only plugin; iOS already keeps the WebView below the status bar.
  if (!window.SystemBars) return;

  const pixel = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  const sync = () => syncSystemBars(pixel);

  sync();
  new MutationObserver(sync).observe(document.documentElement, {
    attributeFilter: ["class"],
  });
};
