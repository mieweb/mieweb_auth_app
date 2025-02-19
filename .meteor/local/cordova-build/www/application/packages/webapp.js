//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
// Source maps are supported by all recent versions of Chrome, Safari,  //
// and Firefox, and by Internet Explorer 11.                            //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


Package["core-runtime"].queue("webapp",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package.modules.meteorBabelHelpers;
var Promise = Package.promise.Promise;
var Symbol = Package['ecmascript-runtime-client'].Symbol;
var Map = Package['ecmascript-runtime-client'].Map;
var Set = Package['ecmascript-runtime-client'].Set;

/* Package-scope variables */
var WebApp;

var require = meteorInstall({"node_modules":{"meteor":{"webapp":{"webapp_cordova.js":function module(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/webapp/webapp_cordova.js                                 //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
Meteor.startup(function () {
  WebAppLocalServer.onError(function (error) {
    console.error(error);
  });
});
///////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      WebApp: WebApp
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/webapp/webapp_cordova.js"
  ],
  mainModulePath: "/node_modules/meteor/webapp/webapp_cordova.js"
}});
