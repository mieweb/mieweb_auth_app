#!/usr/bin/env node

/**
 * Generate build information including app version and git commit hash
 * This script should be run during the build process to create buildInfo.json
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getAppVersion() {
  try {
    const mobileConfigPath = path.join(__dirname, 'mobile-config.js');
    const mobileConfig = fs.readFileSync(mobileConfigPath, 'utf8');
    
    // Extract version from mobile-config.js using regex
    const versionMatch = mobileConfig.match(/version:\s*['"]([^'"]+)['"]/);
    
    if (versionMatch && versionMatch[1]) {
      return versionMatch[1];
    }
    
    console.warn('Could not find version in mobile-config.js');
    return 'unknown';
  } catch (error) {
    console.error('Error reading app version:', error.message);
    return 'unknown';
  }
}

function getCommitHash() {
  try {
    // Get the short commit hash of the current HEAD (whatever branch is checked out)
    const hash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    return hash;
  } catch (error) {
    console.error('Error getting commit hash:', error.message);
    return 'unknown';
  }
}

function getCommitDate() {
  try {
    const date = execSync('git log -1 HEAD --format=%cd --date=iso', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    return date;
  } catch (error) {
    console.error('Error getting commit date:', error.message);
    return new Date().toISOString();
  }
}

function generateBuildInfo() {
  const buildInfo = {
    appVersion: getAppVersion(),
    buildNumber: getCommitHash(),
    buildDate: new Date().toISOString(),
    commitDate: getCommitDate()
  };
  
  const outputPath = path.join(__dirname, 'public', 'buildInfo.json');
  
  try {
    fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2), 'utf8');
    console.log('Build info generated successfully:');
    console.log(JSON.stringify(buildInfo, null, 2));
  } catch (error) {
    console.error('Error writing build info:', error.message);
    process.exit(1);
  }
}

// Run the script
generateBuildInfo();
