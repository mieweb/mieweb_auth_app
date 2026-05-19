const { defineConfig } = require("@meteorjs/rspack");
module.exports = defineConfig((Meteor) => {
  return {
    optimization: {
      minimizer: [
        {
          type: "swc-js",
          extractComments: false,
          minimizer: {
            mangle: {
              keepClassNames: true,
            },
          },
        },
      ],
    },
  };
});
