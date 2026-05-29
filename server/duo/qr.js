import QRCode from "qrcode";

/**
 * Server-side QR generation for Duo enrollment.
 *
 * Authentik renders the Duo `activation_barcode` field as an <img> source.
 * We point that field at our own `/auth/v2/qr` endpoint, which renders a PNG
 * QR code encoding the MIEAuth registration deep link. The mobile app scans
 * this to complete enrollment via the normal invite flow.
 */

/** Render `value` as a PNG buffer QR code. */
export const renderQrPng = (value) =>
  QRCode.toBuffer(String(value), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
  });

/** Render `value` as a data: URI (used when embedding inline). */
export const renderQrDataUri = (value) =>
  QRCode.toDataURL(String(value), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
  });

/**
 * Build the absolute URL Authentik should use as the activation barcode image.
 * @param {string} baseUrl       app root URL (no trailing slash needed)
 * @param {string} activationUrl the registration deep link to encode
 */
export const buildBarcodeUrl = (baseUrl, activationUrl) => {
  const trimmed = String(baseUrl).replace(/\/$/, "");
  return `${trimmed}/auth/v2/qr?value=${encodeURIComponent(activationUrl)}`;
};
