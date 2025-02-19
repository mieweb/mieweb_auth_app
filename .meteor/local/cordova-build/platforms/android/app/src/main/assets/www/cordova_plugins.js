cordova.define('cordova/plugin_list', function(require, exports, module) {
  module.exports = [
    {
      "id": "cordova-plugin-meteor-webapp.WebAppLocalServer",
      "file": "plugins/cordova-plugin-meteor-webapp/www/webapp_local_server.js",
      "pluginId": "cordova-plugin-meteor-webapp",
      "merges": [
        "WebAppLocalServer"
      ]
    },
    {
      "id": "cordova-plugin-statusbar.statusbar",
      "file": "plugins/cordova-plugin-statusbar/www/statusbar.js",
      "pluginId": "cordova-plugin-statusbar",
      "clobbers": [
        "window.StatusBar"
      ]
    },
    {
      "id": "@havesource/cordova-plugin-push.PushNotification",
      "file": "plugins/@havesource/cordova-plugin-push/www/push.js",
      "pluginId": "@havesource/cordova-plugin-push",
      "clobbers": [
        "PushNotification"
      ]
    },
    {
      "id": "cordova-plugin-device.device",
      "file": "plugins/cordova-plugin-device/www/device.js",
      "pluginId": "cordova-plugin-device",
      "clobbers": [
        "device"
      ]
    }
  ];
  module.exports.metadata = {
    "cordova-plugin-meteor-webapp": "1.6.5",
    "cordova-plugin-statusbar": "2.4.3",
    "@havesource/cordova-plugin-push": "5.0.5",
    "cordova-plugin-device": "3.0.0"
  };
});