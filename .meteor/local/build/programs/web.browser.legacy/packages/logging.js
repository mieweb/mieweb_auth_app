//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
// Source maps are supported by all recent versions of Chrome, Safari,  //
// and Firefox, and by Internet Explorer 11.                            //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


Package["core-runtime"].queue("logging",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EJSON = Package.ejson.EJSON;
var Symbol = Package['ecmascript-runtime-client'].Symbol;
var Map = Package['ecmascript-runtime-client'].Map;
var Set = Package['ecmascript-runtime-client'].Set;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package.modules.meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Formatter, Log;

var require = meteorInstall({"node_modules":{"meteor":{"logging":{"logging.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/logging/logging.js                                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var _objectSpread;
module.link("@babel/runtime/helpers/objectSpread2", {
  default: function (v) {
    _objectSpread = v;
  }
}, 0);
var _createForOfIteratorHelperLoose;
module.link("@babel/runtime/helpers/createForOfIteratorHelperLoose", {
  default: function (v) {
    _createForOfIteratorHelperLoose = v;
  }
}, 1);
var _typeof;
module.link("@babel/runtime/helpers/typeof", {
  default: function (v) {
    _typeof = v;
  }
}, 2);
module.export({
  Log: function () {
    return Log;
  }
});
var Meteor;
module.link("meteor/meteor", {
  Meteor: function (v) {
    Meteor = v;
  }
}, 0);
var hasOwn = Object.prototype.hasOwnProperty;
function Log() {
  Log.info.apply(Log, arguments);
}

/// FOR TESTING
var intercept = 0;
var interceptedLines = [];
var suppress = 0;

// Intercept the next 'count' calls to a Log function. The actual
// lines printed to the console can be cleared and read by calling
// Log._intercepted().
Log._intercept = function (count) {
  intercept += count;
};

// Suppress the next 'count' calls to a Log function. Use this to stop
// tests from spamming the console, especially with red errors that
// might look like a failing test.
Log._suppress = function (count) {
  suppress += count;
};

// Returns intercepted lines and resets the intercept counter.
Log._intercepted = function () {
  var lines = interceptedLines;
  interceptedLines = [];
  intercept = 0;
  return lines;
};

// Either 'json' or 'colored-text'.
//
// When this is set to 'json', print JSON documents that are parsed by another
// process ('satellite' or 'meteor run'). This other process should call
// 'Log.format' for nice output.
//
// When this is set to 'colored-text', call 'Log.format' before printing.
// This should be used for logging from within satellite, since there is no
// other process that will be reading its standard output.
Log.outputFormat = 'json';
var LEVEL_COLORS = {
  debug: 'green',
  // leave info as the default color
  warn: 'magenta',
  error: 'red'
};
var META_COLOR = 'blue';

// Default colors cause readability problems on Windows Powershell,
// switch to bright variants. While still capable of millions of
// operations per second, the benchmark showed a 25%+ increase in
// ops per second (on Node 8) by caching "process.platform".
var isWin32 = (typeof process === "undefined" ? "undefined" : _typeof(process)) === 'object' && process.platform === 'win32';
var platformColor = function (color) {
  if (isWin32 && typeof color === 'string' && !color.endsWith('Bright')) {
    return color + "Bright";
  }
  return color;
};

// XXX package
var RESTRICTED_KEYS = ['time', 'timeInexact', 'level', 'file', 'line', 'program', 'originApp', 'satellite', 'stderr'];
var FORMATTED_KEYS = [].concat(RESTRICTED_KEYS, ['app', 'message']);
var logInBrowser = function (obj) {
  var str = Log.format(obj);

  // XXX Some levels should be probably be sent to the server
  var level = obj.level;
  if (typeof console !== 'undefined' && console[level]) {
    console[level](str);
  } else {
    // IE doesn't have console.log.apply, it's not a real Object.
    // http://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9
    // http://patik.com/blog/complete-cross-browser-console-log/
    if (typeof console.log.apply === "function") {
      // Most browsers
      console.log.apply(console, [str]);
    } else if (typeof Function.prototype.bind === "function") {
      // IE9
      var log = Function.prototype.bind.call(console.log, console);
      log.apply(console, [str]);
    }
  }
};

// @returns {Object: { line: Number, file: String }}
Log._getCallerDetails = function () {
  var getStack = function () {
    // We do NOT use Error.prepareStackTrace here (a V8 extension that gets us a
    // pre-parsed stack) since it's impossible to compose it with the use of
    // Error.prepareStackTrace used on the server for source maps.
    var err = new Error();
    var stack = err.stack;
    return stack;
  };
  var stack = getStack();
  if (!stack) return {};

  // looking for the first line outside the logging package (or an
  // eval if we find that first)
  var line;
  var lines = stack.split('\n').slice(1);
  for (var _iterator = _createForOfIteratorHelperLoose(lines), _step; !(_step = _iterator()).done;) {
    line = _step.value;
    if (line.match(/^\s*(at eval \(eval)|(eval:)/)) {
      return {
        file: "eval"
      };
    }
    if (!line.match(/packages\/(?:local-test[:_])?logging(?:\/|\.js)/)) {
      break;
    }
  }
  var details = {};

  // The format for FF is 'functionName@filePath:lineNumber'
  // The format for V8 is 'functionName (packages/logging/logging.js:81)' or
  //                      'packages/logging/logging.js:81'
  var match = /(?:[@(]| at )([^(]+?):([0-9:]+)(?:\)|$)/.exec(line);
  if (!match) {
    return details;
  }

  // in case the matched block here is line:column
  details.line = match[2].split(':')[0];

  // Possible format: https://foo.bar.com/scripts/file.js?random=foobar
  // XXX: if you can write the following in better way, please do it
  // XXX: what about evals?
  details.file = match[1].split('/').slice(-1)[0].split('?')[0];
  return details;
};
['debug', 'info', 'warn', 'error'].forEach(function (level) {
  // @param arg {String|Object}
  Log[level] = function (arg) {
    if (suppress) {
      suppress--;
      return;
    }
    var intercepted = false;
    if (intercept) {
      intercept--;
      intercepted = true;
    }
    var obj = arg === Object(arg) && !(arg instanceof RegExp) && !(arg instanceof Date) ? arg : {
      message: new String(arg).toString()
    };
    RESTRICTED_KEYS.forEach(function (key) {
      if (obj[key]) {
        throw new Error("Can't set '" + key + "' in log message");
      }
    });
    if (hasOwn.call(obj, 'message') && typeof obj.message !== 'string') {
      throw new Error("The 'message' field in log objects must be a string");
    }
    if (!obj.omitCallerDetails) {
      obj = _objectSpread(_objectSpread({}, Log._getCallerDetails()), obj);
    }
    obj.time = new Date();
    obj.level = level;

    // If we are in production don't write out debug logs.
    if (level === 'debug' && Meteor.isProduction) {
      return;
    }
    if (intercepted) {
      interceptedLines.push(EJSON.stringify(obj));
    } else if (Meteor.isServer) {
      if (Log.outputFormat === 'colored-text') {
        console.log(Log.format(obj, {
          color: true
        }));
      } else if (Log.outputFormat === 'json') {
        console.log(EJSON.stringify(obj));
      } else {
        throw new Error("Unknown logging output format: " + Log.outputFormat);
      }
    } else {
      logInBrowser(obj);
    }
  };
});

// tries to parse line as EJSON. returns object if parse is successful, or null if not
Log.parse = function (line) {
  var obj = null;
  if (line && line.startsWith('{')) {
    // might be json generated from calling 'Log'
    try {
      obj = EJSON.parse(line);
    } catch (e) {}
  }

  // XXX should probably check fields other than 'time'
  if (obj && obj.time && obj.time instanceof Date) {
    return obj;
  } else {
    return null;
  }
};

// formats a log object into colored human and machine-readable text
Log.format = function (obj) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  obj = _objectSpread({}, obj); // don't mutate the argument
  var _obj = obj,
    time = _obj.time,
    timeInexact = _obj.timeInexact,
    _obj$level = _obj.level,
    level = _obj$level === void 0 ? 'info' : _obj$level,
    file = _obj.file,
    lineNumber = _obj.line,
    _obj$app = _obj.app,
    appName = _obj$app === void 0 ? '' : _obj$app,
    originApp = _obj.originApp,
    _obj$message = _obj.message,
    message = _obj$message === void 0 ? '' : _obj$message,
    _obj$program = _obj.program,
    program = _obj$program === void 0 ? '' : _obj$program,
    _obj$satellite = _obj.satellite,
    satellite = _obj$satellite === void 0 ? '' : _obj$satellite,
    _obj$stderr = _obj.stderr,
    stderr = _obj$stderr === void 0 ? '' : _obj$stderr;
  if (!(time instanceof Date)) {
    throw new Error("'time' must be a Date object");
  }
  FORMATTED_KEYS.forEach(function (key) {
    delete obj[key];
  });
  if (Object.keys(obj).length > 0) {
    if (message) {
      message += ' ';
    }
    message += EJSON.stringify(obj);
  }
  var pad2 = function (n) {
    return n.toString().padStart(2, '0');
  };
  var pad3 = function (n) {
    return n.toString().padStart(3, '0');
  };
  var dateStamp = time.getFullYear().toString() + pad2(time.getMonth() + 1 /*0-based*/) + pad2(time.getDate());
  var timeStamp = pad2(time.getHours()) + ':' + pad2(time.getMinutes()) + ':' + pad2(time.getSeconds()) + '.' + pad3(time.getMilliseconds());

  // eg in San Francisco in June this will be '(-7)'
  var utcOffsetStr = "(" + -(new Date().getTimezoneOffset() / 60) + ")";
  var appInfo = '';
  if (appName) {
    appInfo += appName;
  }
  if (originApp && originApp !== appName) {
    appInfo += " via " + originApp;
  }
  if (appInfo) {
    appInfo = "[" + appInfo + "] ";
  }
  var sourceInfoParts = [];
  if (program) {
    sourceInfoParts.push(program);
  }
  if (file) {
    sourceInfoParts.push(file);
  }
  if (lineNumber) {
    sourceInfoParts.push(lineNumber);
  }
  var sourceInfo = !sourceInfoParts.length ? '' : "(" + sourceInfoParts.join(':') + ") ";
  if (satellite) sourceInfo += "[" + satellite + "]";
  var stderrIndicator = stderr ? '(STDERR) ' : '';
  var metaPrefix = [level.charAt(0).toUpperCase(), dateStamp, '-', timeStamp, utcOffsetStr, timeInexact ? '? ' : ' ', appInfo, sourceInfo, stderrIndicator].join('');
  return Formatter.prettify(metaPrefix, options.color && platformColor(options.metaColor || META_COLOR)) + Formatter.prettify(message, options.color && platformColor(LEVEL_COLORS[level]));
};

// Turn a line of text into a loggable object.
// @param line {String}
// @param override {Object}
Log.objFromText = function (line, override) {
  return _objectSpread({
    message: line,
    level: 'info',
    time: new Date(),
    timeInexact: true
  }, override);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"logging_browser.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/logging/logging_browser.js                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Formatter = {};
Formatter.prettify = function (line, color) {
  return line;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"@babel":{"runtime":{"helpers":{"objectSpread2.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/logging/node_modules/@babel/runtime/helpers/objectSpread2.js                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var defineProperty = require("./defineProperty.js");
function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    enumerableOnly && (symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    })), keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = null != arguments[i] ? arguments[i] : {};
    i % 2 ? ownKeys(Object(source), !0).forEach(function (key) {
      defineProperty(target, key, source[key]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    });
  }
  return target;
}
module.exports = _objectSpread2, module.exports.__esModule = true, module.exports["default"] = module.exports;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"defineProperty.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/logging/node_modules/@babel/runtime/helpers/defineProperty.js                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var toPropertyKey = require("./toPropertyKey.js");
function _defineProperty(obj, key, value) {
  key = toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
module.exports = _defineProperty, module.exports.__esModule = true, module.exports["default"] = module.exports;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"toPropertyKey.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/logging/node_modules/@babel/runtime/helpers/toPropertyKey.js                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var _typeof = require("./typeof.js")["default"];
var toPrimitive = require("./toPrimitive.js");
function _toPropertyKey(arg) {
  var key = toPrimitive(arg, "string");
  return _typeof(key) === "symbol" ? key : String(key);
}
module.exports = _toPropertyKey, module.exports.__esModule = true, module.exports["default"] = module.exports;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"typeof.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/logging/node_modules/@babel/runtime/helpers/typeof.js                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
function _typeof(obj) {
  "@babel/helpers - typeof";

  return (module.exports = _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  }, module.exports.__esModule = true, module.exports["default"] = module.exports), _typeof(obj);
}
module.exports = _typeof, module.exports.__esModule = true, module.exports["default"] = module.exports;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"toPrimitive.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/logging/node_modules/@babel/runtime/helpers/toPrimitive.js                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var _typeof = require("./typeof.js")["default"];
function _toPrimitive(input, hint) {
  if (_typeof(input) !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== undefined) {
    var res = prim.call(input, hint || "default");
    if (_typeof(res) !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
module.exports = _toPrimitive, module.exports.__esModule = true, module.exports["default"] = module.exports;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"createForOfIteratorHelperLoose.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/logging/node_modules/@babel/runtime/helpers/createForOfIteratorHelperLoose.js                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var unsupportedIterableToArray = require("./unsupportedIterableToArray.js");
function _createForOfIteratorHelperLoose(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it) return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
    if (it) o = it;
    var i = 0;
    return function () {
      if (i >= o.length) return {
        done: true
      };
      return {
        done: false,
        value: o[i++]
      };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
module.exports = _createForOfIteratorHelperLoose, module.exports.__esModule = true, module.exports["default"] = module.exports;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"unsupportedIterableToArray.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/logging/node_modules/@babel/runtime/helpers/unsupportedIterableToArray.js                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var arrayLikeToArray = require("./arrayLikeToArray.js");
function _unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
}
module.exports = _unsupportedIterableToArray, module.exports.__esModule = true, module.exports["default"] = module.exports;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"arrayLikeToArray.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/logging/node_modules/@babel/runtime/helpers/arrayLikeToArray.js                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
  return arr2;
}
module.exports = _arrayLikeToArray, module.exports.__esModule = true, module.exports["default"] = module.exports;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}}},{
  "extensions": [
    ".js",
    ".json",
    ".ts"
  ]
});


/* Exports */
return {
  export: function () { return {
      Log: Log
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/logging/logging.js",
    "/node_modules/meteor/logging/logging_browser.js"
  ],
  mainModulePath: "/node_modules/meteor/logging/logging.js"
}});
