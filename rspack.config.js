const { defineConfig } = require("@meteorjs/rspack");
const { SwcJsMinimizerRspackPlugin } = require("@rspack/core");
module.exports = defineConfig((Meteor) => {
  return {
    optimization: {
      minimizer: [
        new SwcJsMinimizerRspackPlugin({
          minimizerOptions: {
            mangle: {
              keepClassNames: true,
            },
          },
        }),
      ],
    },
  };
});
