import { Meteor } from "meteor/meteor";

const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let initialized = false;

const redactLogs = (logs) =>
  logs
    .replace(/(authorization\s*[:=]\s*)(?:basic|bearer)\s+[^\s,;]+/gi, "$1***")
    .replace(
      /((?:access[_-]?token|auth[_-]?token|refresh[_-]?token|password|pin|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,
      "$1***",
    );

const getDeviceInfo = () => {
  if (typeof device === "undefined") return null;

  return {
    platform: device.platform || "Unknown",
    version: device.version || "Unknown",
    model: device.model || "Unknown",
    uuid: device.uuid || "Unknown",
  };
};

const getDefaultRecipient = () => Meteor.user()?.emails?.[0]?.address || "";

const sendLogs = async (logs) => {
  const recipientEmail = window.prompt(
    "Send diagnostics logs to:",
    getDefaultRecipient(),
  );

  if (recipientEmail === null) return;

  const normalizedEmail = recipientEmail.trim();
  if (
    normalizedEmail.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    window.alert("Enter a valid email address.");
    throw new Error("Invalid recipient email address");
  }

  try {
    await Meteor.callAsync("diagnostics.sendLogs", {
      recipientEmail: normalizedEmail,
      logs,
      device: getDeviceInfo(),
    });
    window.alert(`Diagnostics logs sent to ${normalizedEmail}.`);
    window.DiagnosticsViewer?.close();
  } catch (error) {
    window.alert(
      error.reason || error.message || "Unable to send diagnostics logs.",
    );
    throw error;
  }
};

export const initializeDiagnostics = () => {
  if (initialized || !Meteor.isCordova) return initialized;

  const viewer = window.DiagnosticsViewer;
  if (!viewer) return false;

  try {
    viewer.init({
      title: "MIE Auth Diagnostics",
      lineLimit: 10000,
      redactionCallback: redactLogs,
      sendHandler: sendLogs,
    });
  } catch (error) {
    console.error("Unable to initialize diagnostics viewer:", error);
    return false;
  }

  initialized = true;
  return true;
};

export const openDiagnostics = () => {
  if (!initializeDiagnostics()) {
    window.alert(
      "Diagnostics are available only in the installed Android or iOS app.",
    );
    return;
  }

  try {
    window.DiagnosticsViewer.open();
  } catch (error) {
    console.error("Unable to open diagnostics viewer:", error);
    window.alert("Unable to open diagnostics.");
  }
};
