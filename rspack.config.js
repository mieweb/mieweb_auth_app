const { defineConfig } = require("@meteorjs/rspack");

/**
 * Rspack configuration for Meteor projects.
 *
 * Provides typed flags on the `Meteor` object, such as:
 * - `Meteor.isClient` / `Meteor.isServer`
 * - `Meteor.isDevelopment` / `Meteor.isProduction`
 * - …and other flags available
 *
 * Use these flags to adjust your build settings based on environment.
 */
module.exports = defineConfig((Meteor) => {
  return {
    devServer: {
      // Use 'only' to prevent full page reload when HMR updates fail.
      // Without this, a stale hash causes an infinite reload loop:
      // HMR signal → 404 on .hot-update.json → full reload → repeat.
      hot: "only",
      // Disable live-reload so it doesn't independently trigger full
      // page reloads when HMR can't apply an update.
      liveReload: false,
    },
  };
});
