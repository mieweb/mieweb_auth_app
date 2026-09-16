#!/usr/bin/env node

/**
 * Generate build information including app version and git commit hash
 * This script should be run during the build process to create buildInfo.json
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function getAppVersion() {
  try {
    const mobileConfigPath = path.join(__dirname, "mobile-config.js");
    const mobileConfig = fs.readFileSync(mobileConfigPath, "utf8");

    // Extract version from mobile-config.js using regex
    const versionMatch = mobileConfig.match(/version:\s*['"]([^'"]+)['"]/);

    if (versionMatch && versionMatch[1]) {
      return versionMatch[1];
    }

    console.warn("Could not find version in mobile-config.js");
    return "unknown";
  } catch (error) {
    console.error("Error reading app version:", error.message);
    return "unknown";
  }
}

function getCommitHash() {
  try {
    // Get the short commit hash of the current HEAD (whatever branch is checked out)
    const hash = execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    return hash;
  } catch (error) {
    console.error("Error getting commit hash:", error.message);
    return "unknown";
  }
}

function getCommitDate() {
  try {
    const date = execSync("git log -1 HEAD --format=%cd --date=iso", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    return date;
  } catch (error) {
    console.error("Error getting commit date:", error.message);
    return new Date().toISOString();
  }
}

/**
 * Per-variant store listings, read from variants/<target>.env.
 * No target (local dev) or no keys set leaves them out of buildInfo.json, and
 * the client falls back to the opensource listings.
 */
function getStoreUrls(target) {
  // The target becomes part of a path — same anchored whitelist as variant.sh.
  if (!target || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(target)) {
    if (target) console.warn(`Ignoring invalid target '${target}'`);
    return {};
  }

  const variantPath = path.join(__dirname, "variants", `${target}.env`);

  let contents;
  try {
    contents = fs.readFileSync(variantPath, "utf8");
  } catch (error) {
    console.warn(`Could not read ${variantPath}: ${error.message}`);
    return {};
  }

  const fields = {
    APP_STORE_URL: "appStoreUrl",
    PLAY_STORE_URL: "playStoreUrl",
  };
  const urls = {};

  for (const line of contents.split("\n")) {
    const separator = line.indexOf("=");
    if (line.startsWith("#") || separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    // These are rendered as href/src attributes, so only absolute https URLs.
    if (Object.hasOwn(fields, key) && value.startsWith("https://")) {
      urls[fields[key]] = value;
    }
  }

  return urls;
}

function generateBuildInfo() {
  const buildInfo = {
    appVersion: getAppVersion(),
    buildNumber: getCommitHash(),
    buildDate: new Date().toISOString(),
    commitDate: getCommitDate(),
    ...getStoreUrls(process.argv[2] || process.env.TARGET),
  };

  const outputPath = path.join(__dirname, "public", "buildInfo.json");

  try {
    fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2), "utf8");
    console.log("Build info generated successfully:");
    console.log(JSON.stringify(buildInfo, null, 2));
  } catch (error) {
    console.error("Error writing build info:", error.message);
    process.exit(1);
  }
}

// Run the script
generateBuildInfo();
