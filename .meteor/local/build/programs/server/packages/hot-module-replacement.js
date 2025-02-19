Package["core-runtime"].queue("hot-module-replacement",function () {/* Imports */
var meteorInstall = Package.modules.meteorInstall;
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;

var require = meteorInstall({"node_modules":{"meteor":{"hot-module-replacement":{"server.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////
//                                                                              //
// packages/hot-module-replacement/server.js                                    //
//                                                                              //
//////////////////////////////////////////////////////////////////////////////////
                                                                                //
if (process.env.METEOR_HMR_SECRET) {
  __meteor_runtime_config__._hmrSecret = process.env.METEOR_HMR_SECRET;
} else if (process.env.METEOR_PARENT_PID) {
  // if METEOR_PARENT_PID isn't set, then the app isn't being run by the meteor
  // tool and restarting won't enable HRM.
  console.log('Restart Meteor to enable hot module replacement.');
}

//////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/hot-module-replacement/server.js"
  ]
}});
