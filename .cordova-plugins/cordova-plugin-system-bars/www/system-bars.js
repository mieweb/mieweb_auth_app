var exec = require("cordova/exec");

module.exports = {
  setColor: function (red, green, blue) {
    exec(null, null, "SystemBars", "setColor", [red, green, blue]);
  },
};
