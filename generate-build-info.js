#!/usr/bin/env node

/**
 * Generate build information including app version and git commit hash
 * This script should be run during the build process to create buildInfo.json
 */

const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// The target becomes part of a path and a git argument — same anchored
// whitelist as variant.sh.
const TARGET_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function getTarget() {
  const target = process.argv[2] || process.env.TARGET;
  if (!target) return null;
  if (!TARGET_RE.test(target)) {
    console.warn(`Ignoring invalid target '${target}'`);
    return null;
  }
  return target;
}

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
 * the client falls back to its own defaults.
 */
function getStoreUrls(target) {
  if (!target) return {};

  const variantPath = path.join(__dirname, "variants", `${target}.env`);

  let contents;
  try {
    contents = fs.readFileSync(variantPath, "utf8");
  } catch (error) {
    console.warn(`Could not read ${variantPath}: ${error.message}`);
    return {};
  }

  // A Map keeps the lookup off Object.prototype, so a stray key like
  // "constructor" cannot match.
  const fields = new Map([
    ["APP_STORE_URL", "appStoreUrl"],
    ["PLAY_STORE_URL", "playStoreUrl"],
  ]);
  const urls = {};

  for (const line of contents.split("\n")) {
    const separator = line.indexOf("=");
    if (line.startsWith("#") || separator === -1) continue;

    const field = fields.get(line.slice(0, separator).trim());
    const value = line.slice(separator + 1).trim();

    // These are rendered as href/src attributes, so only absolute https URLs.
    if (field && value.startsWith("https://")) {
      urls[field] = value;
    }
  }

  return urls;
}

/**
 * Version from the nearest release tag: {tag}-{commits since tag}[-dirty].
 * --long fixes the output shape to tag-N-gsha[-dirty], so parsing stays
 * unambiguous even though tag names contain dashes.
 */
function getGitDescribe(target, appVersion) {
  const fallback = {
    version: `v${appVersion}`,
    tag: null,
    commitsSinceTag: null,
    dirty: false,
  };

  let described;
  try {
    const args = ["describe", "--tags", "--long", "--dirty"];
    if (target) args.push("--match", `${target}-v*`);
    described = execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    console.warn("git describe failed, using app version:", error.message);
    return fallback;
  }

  const parsed = described.match(/^(.+)-(\d+)-g[0-9a-f]+(-dirty)?$/);
  if (!parsed) {
    console.warn(`Unexpected git describe output '${described}'`);
    return fallback;
  }

  const [, tag, commits, dirtyFlag] = parsed;
  const commitsSinceTag = Number(commits);
  const dirty = Boolean(dirtyFlag);

  // mie-os-dev-v1.7.0 → v1.7.0
  const displayTag = (tag.match(/v\d.*$/) || [tag])[0];
  const version =
    displayTag +
    (commitsSinceTag > 0 ? `-${commitsSinceTag}` : "") +
    (dirty ? "-dirty" : "");

  return { version, tag, commitsSinceTag, dirty };
}

function generateBuildInfo() {
  const target = getTarget();
  const appVersion = getAppVersion();
  const buildInfo = {
    appVersion,
    ...getGitDescribe(target, appVersion),
    buildNumber: getCommitHash(),
    buildDate: new Date().toISOString(),
    commitDate: getCommitDate(),
    ...getStoreUrls(target),
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
