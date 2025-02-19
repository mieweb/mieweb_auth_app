Package["core-runtime"].queue("mongo-dev-server",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var meteorInstall = Package.modules.meteorInstall;

var require = meteorInstall({"node_modules":{"meteor":{"mongo-dev-server":{"server.js":function module(){

////////////////////////////////////////////////////////////////////////
//                                                                    //
// packages/mongo-dev-server/server.js                                //
//                                                                    //
////////////////////////////////////////////////////////////////////////
                                                                      //
if (process.env.MONGO_URL === 'no-mongo-server') {
  Meteor._debug('Note: Restart Meteor to start the MongoDB server.');
}

////////////////////////////////////////////////////////////////////////

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
    "/node_modules/meteor/mongo-dev-server/server.js"
  ],
  mainModulePath: "/node_modules/meteor/mongo-dev-server/server.js"
}});
