Package["core-runtime"].queue("logging",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var EJSON = Package.ejson.EJSON;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Formatter, Log;

var require = meteorInstall({"node_modules":{"meteor":{"logging":{"logging.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/logging/logging.js                                                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    module.export({
      Log: () => Log
    });
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const hasOwn = Object.prototype.hasOwnProperty;
    function Log() {
      Log.info(...arguments);
    }

    /// FOR TESTING
    let intercept = 0;
    let interceptedLines = [];
    let suppress = 0;

    // Intercept the next 'count' calls to a Log function. The actual
    // lines printed to the console can be cleared and read by calling
    // Log._intercepted().
    Log._intercept = count => {
      intercept += count;
    };

    // Suppress the next 'count' calls to a Log function. Use this to stop
    // tests from spamming the console, especially with red errors that
    // might look like a failing test.
    Log._suppress = count => {
      suppress += count;
    };

    // Returns intercepted lines and resets the intercept counter.
    Log._intercepted = () => {
      const lines = interceptedLines;
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
    const LEVEL_COLORS = {
      debug: 'green',
      // leave info as the default color
      warn: 'magenta',
      error: 'red'
    };
    const META_COLOR = 'blue';

    // Default colors cause readability problems on Windows Powershell,
    // switch to bright variants. While still capable of millions of
    // operations per second, the benchmark showed a 25%+ increase in
    // ops per second (on Node 8) by caching "process.platform".
    const isWin32 = typeof process === 'object' && process.platform === 'win32';
    const platformColor = color => {
      if (isWin32 && typeof color === 'string' && !color.endsWith('Bright')) {
        return "".concat(color, "Bright");
      }
      return color;
    };

    // XXX package
    const RESTRICTED_KEYS = ['time', 'timeInexact', 'level', 'file', 'line', 'program', 'originApp', 'satellite', 'stderr'];
    const FORMATTED_KEYS = [...RESTRICTED_KEYS, 'app', 'message'];
    const logInBrowser = obj => {
      const str = Log.format(obj);

      // XXX Some levels should be probably be sent to the server
      const level = obj.level;
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
          const log = Function.prototype.bind.call(console.log, console);
          log.apply(console, [str]);
        }
      }
    };

    // @returns {Object: { line: Number, file: String }}
    Log._getCallerDetails = () => {
      const getStack = () => {
        // We do NOT use Error.prepareStackTrace here (a V8 extension that gets us a
        // pre-parsed stack) since it's impossible to compose it with the use of
        // Error.prepareStackTrace used on the server for source maps.
        const err = new Error();
        const stack = err.stack;
        return stack;
      };
      const stack = getStack();
      if (!stack) return {};

      // looking for the first line outside the logging package (or an
      // eval if we find that first)
      let line;
      const lines = stack.split('\n').slice(1);
      for (line of lines) {
        if (line.match(/^\s*(at eval \(eval)|(eval:)/)) {
          return {
            file: "eval"
          };
        }
        if (!line.match(/packages\/(?:local-test[:_])?logging(?:\/|\.js)/)) {
          break;
        }
      }
      const details = {};

      // The format for FF is 'functionName@filePath:lineNumber'
      // The format for V8 is 'functionName (packages/logging/logging.js:81)' or
      //                      'packages/logging/logging.js:81'
      const match = /(?:[@(]| at )([^(]+?):([0-9:]+)(?:\)|$)/.exec(line);
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
    ['debug', 'info', 'warn', 'error'].forEach(level => {
      // @param arg {String|Object}
      Log[level] = arg => {
        if (suppress) {
          suppress--;
          return;
        }
        let intercepted = false;
        if (intercept) {
          intercept--;
          intercepted = true;
        }
        let obj = arg === Object(arg) && !(arg instanceof RegExp) && !(arg instanceof Date) ? arg : {
          message: new String(arg).toString()
        };
        RESTRICTED_KEYS.forEach(key => {
          if (obj[key]) {
            throw new Error("Can't set '".concat(key, "' in log message"));
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
            throw new Error("Unknown logging output format: ".concat(Log.outputFormat));
          }
        } else {
          logInBrowser(obj);
        }
      };
    });

    // tries to parse line as EJSON. returns object if parse is successful, or null if not
    Log.parse = line => {
      let obj = null;
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
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      obj = _objectSpread({}, obj); // don't mutate the argument
      let {
        time,
        timeInexact,
        level = 'info',
        file,
        line: lineNumber,
        app: appName = '',
        originApp,
        message = '',
        program = '',
        satellite = '',
        stderr = ''
      } = obj;
      if (!(time instanceof Date)) {
        throw new Error("'time' must be a Date object");
      }
      FORMATTED_KEYS.forEach(key => {
        delete obj[key];
      });
      if (Object.keys(obj).length > 0) {
        if (message) {
          message += ' ';
        }
        message += EJSON.stringify(obj);
      }
      const pad2 = n => n.toString().padStart(2, '0');
      const pad3 = n => n.toString().padStart(3, '0');
      const dateStamp = time.getFullYear().toString() + pad2(time.getMonth() + 1 /*0-based*/) + pad2(time.getDate());
      const timeStamp = pad2(time.getHours()) + ':' + pad2(time.getMinutes()) + ':' + pad2(time.getSeconds()) + '.' + pad3(time.getMilliseconds());

      // eg in San Francisco in June this will be '(-7)'
      const utcOffsetStr = "(".concat(-(new Date().getTimezoneOffset() / 60), ")");
      let appInfo = '';
      if (appName) {
        appInfo += appName;
      }
      if (originApp && originApp !== appName) {
        appInfo += " via ".concat(originApp);
      }
      if (appInfo) {
        appInfo = "[".concat(appInfo, "] ");
      }
      const sourceInfoParts = [];
      if (program) {
        sourceInfoParts.push(program);
      }
      if (file) {
        sourceInfoParts.push(file);
      }
      if (lineNumber) {
        sourceInfoParts.push(lineNumber);
      }
      let sourceInfo = !sourceInfoParts.length ? '' : "(".concat(sourceInfoParts.join(':'), ") ");
      if (satellite) sourceInfo += "[".concat(satellite, "]");
      const stderrIndicator = stderr ? '(STDERR) ' : '';
      const metaPrefix = [level.charAt(0).toUpperCase(), dateStamp, '-', timeStamp, utcOffsetStr, timeInexact ? '? ' : ' ', appInfo, sourceInfo, stderrIndicator].join('');
      return Formatter.prettify(metaPrefix, options.color && platformColor(options.metaColor || META_COLOR)) + Formatter.prettify(message, options.color && platformColor(LEVEL_COLORS[level]));
    };

    // Turn a line of text into a loggable object.
    // @param line {String}
    // @param override {Object}
    Log.objFromText = (line, override) => {
      return _objectSpread({
        message: line,
        level: 'info',
        time: new Date(),
        timeInexact: true
      }, override);
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"logging_server.js":function module(require){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/logging/logging_server.js                                                                                 //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
Formatter = {};
Formatter.prettify = function (line, color) {
  if (!color) return line;
  return require("chalk")[color](line);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"@babel":{"runtime":{"helpers":{"objectSpread2.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/logging/node_modules/@babel/runtime/helpers/objectSpread2.js                                   //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}},"chalk":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/logging/node_modules/chalk/package.json                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.exports = {
  "name": "chalk",
  "version": "4.1.2",
  "main": "source"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"source":{"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// node_modules/meteor/logging/node_modules/chalk/source/index.js                                                     //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
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
    "/node_modules/meteor/logging/logging_server.js"
  ],
  mainModulePath: "/node_modules/meteor/logging/logging.js"
}});

//# sourceURL=meteor://💻app/packages/logging.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbG9nZ2luZy9sb2dnaW5nLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9sb2dnaW5nL2xvZ2dpbmdfc2VydmVyLmpzIl0sIm5hbWVzIjpbIl9vYmplY3RTcHJlYWQiLCJtb2R1bGUiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJleHBvcnQiLCJMb2ciLCJNZXRlb3IiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsImhhc093biIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiaW5mbyIsImFyZ3VtZW50cyIsImludGVyY2VwdCIsImludGVyY2VwdGVkTGluZXMiLCJzdXBwcmVzcyIsIl9pbnRlcmNlcHQiLCJjb3VudCIsIl9zdXBwcmVzcyIsIl9pbnRlcmNlcHRlZCIsImxpbmVzIiwib3V0cHV0Rm9ybWF0IiwiTEVWRUxfQ09MT1JTIiwiZGVidWciLCJ3YXJuIiwiZXJyb3IiLCJNRVRBX0NPTE9SIiwiaXNXaW4zMiIsInByb2Nlc3MiLCJwbGF0Zm9ybSIsInBsYXRmb3JtQ29sb3IiLCJjb2xvciIsImVuZHNXaXRoIiwiY29uY2F0IiwiUkVTVFJJQ1RFRF9LRVlTIiwiRk9STUFUVEVEX0tFWVMiLCJsb2dJbkJyb3dzZXIiLCJvYmoiLCJzdHIiLCJmb3JtYXQiLCJsZXZlbCIsImNvbnNvbGUiLCJsb2ciLCJhcHBseSIsIkZ1bmN0aW9uIiwiYmluZCIsImNhbGwiLCJfZ2V0Q2FsbGVyRGV0YWlscyIsImdldFN0YWNrIiwiZXJyIiwiRXJyb3IiLCJzdGFjayIsImxpbmUiLCJzcGxpdCIsInNsaWNlIiwibWF0Y2giLCJmaWxlIiwiZGV0YWlscyIsImV4ZWMiLCJmb3JFYWNoIiwiYXJnIiwiaW50ZXJjZXB0ZWQiLCJSZWdFeHAiLCJEYXRlIiwibWVzc2FnZSIsIlN0cmluZyIsInRvU3RyaW5nIiwia2V5Iiwib21pdENhbGxlckRldGFpbHMiLCJ0aW1lIiwiaXNQcm9kdWN0aW9uIiwicHVzaCIsIkVKU09OIiwic3RyaW5naWZ5IiwiaXNTZXJ2ZXIiLCJwYXJzZSIsInN0YXJ0c1dpdGgiLCJlIiwib3B0aW9ucyIsImxlbmd0aCIsInVuZGVmaW5lZCIsInRpbWVJbmV4YWN0IiwibGluZU51bWJlciIsImFwcCIsImFwcE5hbWUiLCJvcmlnaW5BcHAiLCJwcm9ncmFtIiwic2F0ZWxsaXRlIiwic3RkZXJyIiwia2V5cyIsInBhZDIiLCJuIiwicGFkU3RhcnQiLCJwYWQzIiwiZGF0ZVN0YW1wIiwiZ2V0RnVsbFllYXIiLCJnZXRNb250aCIsImdldERhdGUiLCJ0aW1lU3RhbXAiLCJnZXRIb3VycyIsImdldE1pbnV0ZXMiLCJnZXRTZWNvbmRzIiwiZ2V0TWlsbGlzZWNvbmRzIiwidXRjT2Zmc2V0U3RyIiwiZ2V0VGltZXpvbmVPZmZzZXQiLCJhcHBJbmZvIiwic291cmNlSW5mb1BhcnRzIiwic291cmNlSW5mbyIsImpvaW4iLCJzdGRlcnJJbmRpY2F0b3IiLCJtZXRhUHJlZml4IiwiY2hhckF0IiwidG9VcHBlckNhc2UiLCJGb3JtYXR0ZXIiLCJwcmV0dGlmeSIsIm1ldGFDb2xvciIsIm9iakZyb21UZXh0Iiwib3ZlcnJpZGUiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiLCJyZXF1aXJlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQSxJQUFJQSxhQUFhO0lBQUNDLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLHNDQUFzQyxFQUFDO01BQUNDLE9BQU9BLENBQUNDLENBQUMsRUFBQztRQUFDSixhQUFhLEdBQUNJLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBckdILE1BQU0sQ0FBQ0ksTUFBTSxDQUFDO01BQUNDLEdBQUcsRUFBQ0EsQ0FBQSxLQUFJQTtJQUFHLENBQUMsQ0FBQztJQUFDLElBQUlDLE1BQU07SUFBQ04sTUFBTSxDQUFDQyxJQUFJLENBQUMsZUFBZSxFQUFDO01BQUNLLE1BQU1BLENBQUNILENB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Ozs7Ozs7Ozs7QUNyVUZSLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDZEEsU0FBUyxDQUFDQyxRQUFRLEdBQUcsVUFBUzlELElBQUksRUFBRXJCLEtBQUssRUFBQztFQUN0QyxJQUFHLENBQUNBLEtBQUssRUFBRSxPQUFPcUIsSUFBSTtFQUN0QixPQUFPc0UsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDM0YsS0FBSyxDQUFDLENBQUNxQixJQUFJLENBQUM7QUFDeEMsQ0FBQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9sb2dnaW5nLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5cbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmZ1bmN0aW9uIExvZyguLi5hcmdzKSB7XG4gIExvZy5pbmZvKC4uLmFyZ3MpO1xufVxuXG4vLy8gRk9SIFRFU1RJTkdcbmxldCBpbnRlcmNlcHQgPSAwO1xubGV0IGludGVyY2VwdGVkTGluZXMgPSBbXTtcbmxldCBzdXBwcmVzcyA9IDA7XG5cbi8vIEludGVyY2VwdCB0aGUgbmV4dCAnY291bnQnIGNhbGxzIHRvIGEgTG9nIGZ1bmN0aW9uLiBUaGUgYWN0dWFsXG4vLyBsaW5lcyBwcmludGVkIHRvIHRoZSBjb25zb2xlIGNhbiBiZSBjbGVhcmVkIGFuZCByZWFkIGJ5IGNhbGxpbmdcbi8vIExvZy5faW50ZXJjZXB0ZWQoKS5cbkxvZy5faW50ZXJjZXB0ID0gKGNvdW50KSA9PiB7XG4gIGludGVyY2VwdCArPSBjb3VudDtcbn07XG5cbi8vIFN1cHByZXNzIHRoZSBuZXh0ICdjb3VudCcgY2FsbHMgdG8gYSBMb2cgZnVuY3Rpb24uIFVzZSB0aGlzIHRvIHN0b3Bcbi8vIHRlc3RzIGZyb20gc3BhbW1pbmcgdGhlIGNvbnNvbGUsIGVzcGVjaWFsbHkgd2l0aCByZWQgZXJyb3JzIHRoYXRcbi8vIG1pZ2h0IGxvb2sgbGlrZSBhIGZhaWxpbmcgdGVzdC5cbkxvZy5fc3VwcHJlc3MgPSAoY291bnQpID0+IHtcbiAgc3VwcHJlc3MgKz0gY291bnQ7XG59O1xuXG4vLyBSZXR1cm5zIGludGVyY2VwdGVkIGxpbmVzIGFuZCByZXNldHMgdGhlIGludGVyY2VwdCBjb3VudGVyLlxuTG9nLl9pbnRlcmNlcHRlZCA9ICgpID0+IHtcbiAgY29uc3QgbGluZXMgPSBpbnRlcmNlcHRlZExpbmVzO1xuICBpbnRlcmNlcHRlZExpbmVzID0gW107XG4gIGludGVyY2VwdCA9IDA7XG4gIHJldHVybiBsaW5lcztcbn07XG5cbi8vIEVpdGhlciAnanNvbicgb3IgJ2NvbG9yZWQtdGV4dCcuXG4vL1xuLy8gV2hlbiB0aGlzIGlzIHNldCB0byAnanNvbicsIHByaW50IEpTT04gZG9jdW1lbnRzIHRoYXQgYXJlIHBhcnNlZCBieSBhbm90aGVyXG4vLyBwcm9jZXNzICgnc2F0ZWxsaXRlJyBvciAnbWV0ZW9yIHJ1bicpLiBUaGlzIG90aGVyIHByb2Nlc3Mgc2hvdWxkIGNhbGxcbi8vICdMb2cuZm9ybWF0JyBmb3IgbmljZSBvdXRwdXQuXG4vL1xuLy8gV2hlbiB0aGlzIGlzIHNldCB0byAnY29sb3JlZC10ZXh0JywgY2FsbCAnTG9nLmZvcm1hdCcgYmVmb3JlIHByaW50aW5nLlxuLy8gVGhpcyBzaG91bGQgYmUgdXNlZCBmb3IgbG9nZ2luZyBmcm9tIHdpdGhpbiBzYXRlbGxpdGUsIHNpbmNlIHRoZXJlIGlzIG5vXG4vLyBvdGhlciBwcm9jZXNzIHRoYXQgd2lsbCBiZSByZWFkaW5nIGl0cyBzdGFuZGFyZCBvdXRwdXQuXG5Mb2cub3V0cHV0Rm9ybWF0ID0gJ2pzb24nO1xuXG5jb25zdCBMRVZFTF9DT0xPUlMgPSB7XG4gIGRlYnVnOiAnZ3JlZW4nLFxuICAvLyBsZWF2ZSBpbmZvIGFzIHRoZSBkZWZhdWx0IGNvbG9yXG4gIHdhcm46ICdtYWdlbnRhJyxcbiAgZXJyb3I6ICdyZWQnXG59O1xuXG5jb25zdCBNRVRBX0NPTE9SID0gJ2JsdWUnO1xuXG4vLyBEZWZhdWx0IGNvbG9ycyBjYXVzZSByZWFkYWJpbGl0eSBwcm9ibGVtcyBvbiBXaW5kb3dzIFBvd2Vyc2hlbGwsXG4vLyBzd2l0Y2ggdG8gYnJpZ2h0IHZhcmlhbnRzLiBXaGlsZSBzdGlsbCBjYXBhYmxlIG9mIG1pbGxpb25zIG9mXG4vLyBvcGVyYXRpb25zIHBlciBzZWNvbmQsIHRoZSBiZW5jaG1hcmsgc2hvd2VkIGEgMjUlKyBpbmNyZWFzZSBpblxuLy8gb3BzIHBlciBzZWNvbmQgKG9uIE5vZGUgOCkgYnkgY2FjaGluZyBcInByb2Nlc3MucGxhdGZvcm1cIi5cbmNvbnN0IGlzV2luMzIgPSB0eXBlb2YgcHJvY2VzcyA9PT0gJ29iamVjdCcgJiYgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJztcbmNvbnN0IHBsYXRmb3JtQ29sb3IgPSAoY29sb3IpID0+IHtcbiAgaWYgKGlzV2luMzIgJiYgdHlwZW9mIGNvbG9yID09PSAnc3RyaW5nJyAmJiAhY29sb3IuZW5kc1dpdGgoJ0JyaWdodCcpKSB7XG4gICAgcmV0dXJuIGAke2NvbG9yfUJyaWdodGA7XG4gIH1cbiAgcmV0dXJuIGNvbG9yO1xufTtcblxuLy8gWFhYIHBhY2thZ2VcbmNvbnN0IFJFU1RSSUNURURfS0VZUyA9IFsndGltZScsICd0aW1lSW5leGFjdCcsICdsZXZlbCcsICdmaWxlJywgJ2xpbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3Byb2dyYW0nLCAnb3JpZ2luQXBwJywgJ3NhdGVsbGl0ZScsICdzdGRlcnInXTtcblxuY29uc3QgRk9STUFUVEVEX0tFWVMgPSBbLi4uUkVTVFJJQ1RFRF9LRVlTLCAnYXBwJywgJ21lc3NhZ2UnXTtcblxuY29uc3QgbG9nSW5Ccm93c2VyID0gb2JqID0+IHtcbiAgY29uc3Qgc3RyID0gTG9nLmZvcm1hdChvYmopO1xuXG4gIC8vIFhYWCBTb21lIGxldmVscyBzaG91bGQgYmUgcHJvYmFibHkgYmUgc2VudCB0byB0aGUgc2VydmVyXG4gIGNvbnN0IGxldmVsID0gb2JqLmxldmVsO1xuXG4gIGlmICgodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnKSAmJiBjb25zb2xlW2xldmVsXSkge1xuICAgIGNvbnNvbGVbbGV2ZWxdKHN0cik7XG4gIH0gZWxzZSB7XG4gICAgLy8gSUUgZG9lc24ndCBoYXZlIGNvbnNvbGUubG9nLmFwcGx5LCBpdCdzIG5vdCBhIHJlYWwgT2JqZWN0LlxuICAgIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNTUzODk3Mi9jb25zb2xlLWxvZy1hcHBseS1ub3Qtd29ya2luZy1pbi1pZTlcbiAgICAvLyBodHRwOi8vcGF0aWsuY29tL2Jsb2cvY29tcGxldGUtY3Jvc3MtYnJvd3Nlci1jb25zb2xlLWxvZy9cbiAgICBpZiAodHlwZW9mIGNvbnNvbGUubG9nLmFwcGx5ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIC8vIE1vc3QgYnJvd3NlcnNcbiAgICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIFtzdHJdKTtcblxuICAgIH0gZWxzZSBpZiAodHlwZW9mIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIC8vIElFOVxuICAgICAgY29uc3QgbG9nID0gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSk7XG4gICAgICBsb2cuYXBwbHkoY29uc29sZSwgW3N0cl0pO1xuICAgIH1cbiAgfVxufTtcblxuLy8gQHJldHVybnMge09iamVjdDogeyBsaW5lOiBOdW1iZXIsIGZpbGU6IFN0cmluZyB9fVxuTG9nLl9nZXRDYWxsZXJEZXRhaWxzID0gKCkgPT4ge1xuICBjb25zdCBnZXRTdGFjayA9ICgpID0+IHtcbiAgICAvLyBXZSBkbyBOT1QgdXNlIEVycm9yLnByZXBhcmVTdGFja1RyYWNlIGhlcmUgKGEgVjggZXh0ZW5zaW9uIHRoYXQgZ2V0cyB1cyBhXG4gICAgLy8gcHJlLXBhcnNlZCBzdGFjaykgc2luY2UgaXQncyBpbXBvc3NpYmxlIHRvIGNvbXBvc2UgaXQgd2l0aCB0aGUgdXNlIG9mXG4gICAgLy8gRXJyb3IucHJlcGFyZVN0YWNrVHJhY2UgdXNlZCBvbiB0aGUgc2VydmVyIGZvciBzb3VyY2UgbWFwcy5cbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3I7XG4gICAgY29uc3Qgc3RhY2sgPSBlcnIuc3RhY2s7XG4gICAgcmV0dXJuIHN0YWNrO1xuICB9O1xuXG4gIGNvbnN0IHN0YWNrID0gZ2V0U3RhY2soKTtcblxuICBpZiAoIXN0YWNrKSByZXR1cm4ge307XG5cbiAgLy8gbG9va2luZyBmb3IgdGhlIGZpcnN0IGxpbmUgb3V0c2lkZSB0aGUgbG9nZ2luZyBwYWNrYWdlIChvciBhblxuICAvLyBldmFsIGlmIHdlIGZpbmQgdGhhdCBmaXJzdClcbiAgbGV0IGxpbmU7XG4gIGNvbnN0IGxpbmVzID0gc3RhY2suc3BsaXQoJ1xcbicpLnNsaWNlKDEpO1xuICBmb3IgKGxpbmUgb2YgbGluZXMpIHtcbiAgICBpZiAobGluZS5tYXRjaCgvXlxccyooYXQgZXZhbCBcXChldmFsKXwoZXZhbDopLykpIHtcbiAgICAgIHJldHVybiB7ZmlsZTogXCJldmFsXCJ9O1xuICAgIH1cblxuICAgIGlmICghbGluZS5tYXRjaCgvcGFja2FnZXNcXC8oPzpsb2NhbC10ZXN0WzpfXSk/bG9nZ2luZyg/OlxcL3xcXC5qcykvKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZGV0YWlscyA9IHt9O1xuXG4gIC8vIFRoZSBmb3JtYXQgZm9yIEZGIGlzICdmdW5jdGlvbk5hbWVAZmlsZVBhdGg6bGluZU51bWJlcidcbiAgLy8gVGhlIGZvcm1hdCBmb3IgVjggaXMgJ2Z1bmN0aW9uTmFtZSAocGFja2FnZXMvbG9nZ2luZy9sb2dnaW5nLmpzOjgxKScgb3JcbiAgLy8gICAgICAgICAgICAgICAgICAgICAgJ3BhY2thZ2VzL2xvZ2dpbmcvbG9nZ2luZy5qczo4MSdcbiAgY29uc3QgbWF0Y2ggPSAvKD86W0AoXXwgYXQgKShbXihdKz8pOihbMC05Ol0rKSg/OlxcKXwkKS8uZXhlYyhsaW5lKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG5cbiAgLy8gaW4gY2FzZSB0aGUgbWF0Y2hlZCBibG9jayBoZXJlIGlzIGxpbmU6Y29sdW1uXG4gIGRldGFpbHMubGluZSA9IG1hdGNoWzJdLnNwbGl0KCc6JylbMF07XG5cbiAgLy8gUG9zc2libGUgZm9ybWF0OiBodHRwczovL2Zvby5iYXIuY29tL3NjcmlwdHMvZmlsZS5qcz9yYW5kb209Zm9vYmFyXG4gIC8vIFhYWDogaWYgeW91IGNhbiB3cml0ZSB0aGUgZm9sbG93aW5nIGluIGJldHRlciB3YXksIHBsZWFzZSBkbyBpdFxuICAvLyBYWFg6IHdoYXQgYWJvdXQgZXZhbHM/XG4gIGRldGFpbHMuZmlsZSA9IG1hdGNoWzFdLnNwbGl0KCcvJykuc2xpY2UoLTEpWzBdLnNwbGl0KCc/JylbMF07XG5cbiAgcmV0dXJuIGRldGFpbHM7XG59O1xuXG5bJ2RlYnVnJywgJ2luZm8nLCAnd2FybicsICdlcnJvciddLmZvckVhY2goKGxldmVsKSA9PiB7XG4gLy8gQHBhcmFtIGFyZyB7U3RyaW5nfE9iamVjdH1cbiBMb2dbbGV2ZWxdID0gKGFyZykgPT4ge1xuICBpZiAoc3VwcHJlc3MpIHtcbiAgICBzdXBwcmVzcy0tO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBpbnRlcmNlcHRlZCA9IGZhbHNlO1xuICBpZiAoaW50ZXJjZXB0KSB7XG4gICAgaW50ZXJjZXB0LS07XG4gICAgaW50ZXJjZXB0ZWQgPSB0cnVlO1xuICB9XG5cbiAgbGV0IG9iaiA9IChhcmcgPT09IE9iamVjdChhcmcpXG4gICAgJiYgIShhcmcgaW5zdGFuY2VvZiBSZWdFeHApXG4gICAgJiYgIShhcmcgaW5zdGFuY2VvZiBEYXRlKSlcbiAgICA/IGFyZ1xuICAgIDogeyBtZXNzYWdlOiBuZXcgU3RyaW5nKGFyZykudG9TdHJpbmcoKSB9O1xuXG4gIFJFU1RSSUNURURfS0VZUy5mb3JFYWNoKGtleSA9PiB7XG4gICAgaWYgKG9ialtrZXldKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IHNldCAnJHtrZXl9JyBpbiBsb2cgbWVzc2FnZWApO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKGhhc093bi5jYWxsKG9iaiwgJ21lc3NhZ2UnKSAmJiB0eXBlb2Ygb2JqLm1lc3NhZ2UgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlICdtZXNzYWdlJyBmaWVsZCBpbiBsb2cgb2JqZWN0cyBtdXN0IGJlIGEgc3RyaW5nXCIpO1xuICB9XG5cbiAgaWYgKCFvYmoub21pdENhbGxlckRldGFpbHMpIHtcbiAgICBvYmogPSB7IC4uLkxvZy5fZ2V0Q2FsbGVyRGV0YWlscygpLCAuLi5vYmogfTtcbiAgfVxuXG4gIG9iai50aW1lID0gbmV3IERhdGUoKTtcbiAgb2JqLmxldmVsID0gbGV2ZWw7XG5cbiAgLy8gSWYgd2UgYXJlIGluIHByb2R1Y3Rpb24gZG9uJ3Qgd3JpdGUgb3V0IGRlYnVnIGxvZ3MuXG4gIGlmIChsZXZlbCA9PT0gJ2RlYnVnJyAmJiBNZXRlb3IuaXNQcm9kdWN0aW9uKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKGludGVyY2VwdGVkKSB7XG4gICAgaW50ZXJjZXB0ZWRMaW5lcy5wdXNoKEVKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgfSBlbHNlIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICBpZiAoTG9nLm91dHB1dEZvcm1hdCA9PT0gJ2NvbG9yZWQtdGV4dCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKExvZy5mb3JtYXQob2JqLCB7Y29sb3I6IHRydWV9KSk7XG4gICAgfSBlbHNlIGlmIChMb2cub3V0cHV0Rm9ybWF0ID09PSAnanNvbicpIHtcbiAgICAgIGNvbnNvbGUubG9nKEVKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGxvZ2dpbmcgb3V0cHV0IGZvcm1hdDogJHtMb2cub3V0cHV0Rm9ybWF0fWApO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBsb2dJbkJyb3dzZXIob2JqKTtcbiAgfVxufTtcbn0pO1xuXG5cbi8vIHRyaWVzIHRvIHBhcnNlIGxpbmUgYXMgRUpTT04uIHJldHVybnMgb2JqZWN0IGlmIHBhcnNlIGlzIHN1Y2Nlc3NmdWwsIG9yIG51bGwgaWYgbm90XG5Mb2cucGFyc2UgPSAobGluZSkgPT4ge1xuICBsZXQgb2JqID0gbnVsbDtcbiAgaWYgKGxpbmUgJiYgbGluZS5zdGFydHNXaXRoKCd7JykpIHsgLy8gbWlnaHQgYmUganNvbiBnZW5lcmF0ZWQgZnJvbSBjYWxsaW5nICdMb2cnXG4gICAgdHJ5IHsgb2JqID0gRUpTT04ucGFyc2UobGluZSk7IH0gY2F0Y2ggKGUpIHt9XG4gIH1cblxuICAvLyBYWFggc2hvdWxkIHByb2JhYmx5IGNoZWNrIGZpZWxkcyBvdGhlciB0aGFuICd0aW1lJ1xuICBpZiAob2JqICYmIG9iai50aW1lICYmIChvYmoudGltZSBpbnN0YW5jZW9mIERhdGUpKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuLy8gZm9ybWF0cyBhIGxvZyBvYmplY3QgaW50byBjb2xvcmVkIGh1bWFuIGFuZCBtYWNoaW5lLXJlYWRhYmxlIHRleHRcbkxvZy5mb3JtYXQgPSAob2JqLCBvcHRpb25zID0ge30pID0+IHtcbiAgb2JqID0geyAuLi5vYmogfTsgLy8gZG9uJ3QgbXV0YXRlIHRoZSBhcmd1bWVudFxuICBsZXQge1xuICAgIHRpbWUsXG4gICAgdGltZUluZXhhY3QsXG4gICAgbGV2ZWwgPSAnaW5mbycsXG4gICAgZmlsZSxcbiAgICBsaW5lOiBsaW5lTnVtYmVyLFxuICAgIGFwcDogYXBwTmFtZSA9ICcnLFxuICAgIG9yaWdpbkFwcCxcbiAgICBtZXNzYWdlID0gJycsXG4gICAgcHJvZ3JhbSA9ICcnLFxuICAgIHNhdGVsbGl0ZSA9ICcnLFxuICAgIHN0ZGVyciA9ICcnLFxuICB9ID0gb2JqO1xuXG4gIGlmICghKHRpbWUgaW5zdGFuY2VvZiBEYXRlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIid0aW1lJyBtdXN0IGJlIGEgRGF0ZSBvYmplY3RcIik7XG4gIH1cblxuICBGT1JNQVRURURfS0VZUy5mb3JFYWNoKChrZXkpID0+IHsgZGVsZXRlIG9ialtrZXldOyB9KTtcblxuICBpZiAoT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPiAwKSB7XG4gICAgaWYgKG1lc3NhZ2UpIHtcbiAgICAgIG1lc3NhZ2UgKz0gJyAnO1xuICAgIH1cbiAgICBtZXNzYWdlICs9IEVKU09OLnN0cmluZ2lmeShvYmopO1xuICB9XG5cbiAgY29uc3QgcGFkMiA9IG4gPT4gbi50b1N0cmluZygpLnBhZFN0YXJ0KDIsICcwJyk7XG4gIGNvbnN0IHBhZDMgPSBuID0+IG4udG9TdHJpbmcoKS5wYWRTdGFydCgzLCAnMCcpO1xuXG4gIGNvbnN0IGRhdGVTdGFtcCA9IHRpbWUuZ2V0RnVsbFllYXIoKS50b1N0cmluZygpICtcbiAgICBwYWQyKHRpbWUuZ2V0TW9udGgoKSArIDEgLyowLWJhc2VkKi8pICtcbiAgICBwYWQyKHRpbWUuZ2V0RGF0ZSgpKTtcbiAgY29uc3QgdGltZVN0YW1wID0gcGFkMih0aW1lLmdldEhvdXJzKCkpICtcbiAgICAgICAgJzonICtcbiAgICAgICAgcGFkMih0aW1lLmdldE1pbnV0ZXMoKSkgK1xuICAgICAgICAnOicgK1xuICAgICAgICBwYWQyKHRpbWUuZ2V0U2Vjb25kcygpKSArXG4gICAgICAgICcuJyArXG4gICAgICAgIHBhZDModGltZS5nZXRNaWxsaXNlY29uZHMoKSk7XG5cbiAgLy8gZWcgaW4gU2FuIEZyYW5jaXNjbyBpbiBKdW5lIHRoaXMgd2lsbCBiZSAnKC03KSdcbiAgY29uc3QgdXRjT2Zmc2V0U3RyID0gYCgkeygtKG5ldyBEYXRlKCkuZ2V0VGltZXpvbmVPZmZzZXQoKSAvIDYwKSl9KWA7XG5cbiAgbGV0IGFwcEluZm8gPSAnJztcbiAgaWYgKGFwcE5hbWUpIHtcbiAgICBhcHBJbmZvICs9IGFwcE5hbWU7XG4gIH1cbiAgaWYgKG9yaWdpbkFwcCAmJiBvcmlnaW5BcHAgIT09IGFwcE5hbWUpIHtcbiAgICBhcHBJbmZvICs9IGAgdmlhICR7b3JpZ2luQXBwfWA7XG4gIH1cbiAgaWYgKGFwcEluZm8pIHtcbiAgICBhcHBJbmZvID0gYFske2FwcEluZm99XSBgO1xuICB9XG5cbiAgY29uc3Qgc291cmNlSW5mb1BhcnRzID0gW107XG4gIGlmIChwcm9ncmFtKSB7XG4gICAgc291cmNlSW5mb1BhcnRzLnB1c2gocHJvZ3JhbSk7XG4gIH1cbiAgaWYgKGZpbGUpIHtcbiAgICBzb3VyY2VJbmZvUGFydHMucHVzaChmaWxlKTtcbiAgfVxuICBpZiAobGluZU51bWJlcikge1xuICAgIHNvdXJjZUluZm9QYXJ0cy5wdXNoKGxpbmVOdW1iZXIpO1xuICB9XG5cbiAgbGV0IHNvdXJjZUluZm8gPSAhc291cmNlSW5mb1BhcnRzLmxlbmd0aCA/XG4gICAgJycgOiBgKCR7c291cmNlSW5mb1BhcnRzLmpvaW4oJzonKX0pIGA7XG5cbiAgaWYgKHNhdGVsbGl0ZSlcbiAgICBzb3VyY2VJbmZvICs9IGBbJHtzYXRlbGxpdGV9XWA7XG5cbiAgY29uc3Qgc3RkZXJySW5kaWNhdG9yID0gc3RkZXJyID8gJyhTVERFUlIpICcgOiAnJztcblxuICBjb25zdCBtZXRhUHJlZml4ID0gW1xuICAgIGxldmVsLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpLFxuICAgIGRhdGVTdGFtcCxcbiAgICAnLScsXG4gICAgdGltZVN0YW1wLFxuICAgIHV0Y09mZnNldFN0cixcbiAgICB0aW1lSW5leGFjdCA/ICc/ICcgOiAnICcsXG4gICAgYXBwSW5mbyxcbiAgICBzb3VyY2VJbmZvLFxuICAgIHN0ZGVyckluZGljYXRvcl0uam9pbignJyk7XG5cblxuICByZXR1cm4gRm9ybWF0dGVyLnByZXR0aWZ5KG1ldGFQcmVmaXgsIG9wdGlvbnMuY29sb3IgJiYgcGxhdGZvcm1Db2xvcihvcHRpb25zLm1ldGFDb2xvciB8fCBNRVRBX0NPTE9SKSkgK1xuICAgICAgRm9ybWF0dGVyLnByZXR0aWZ5KG1lc3NhZ2UsIG9wdGlvbnMuY29sb3IgJiYgcGxhdGZvcm1Db2xvcihMRVZFTF9DT0xPUlNbbGV2ZWxdKSk7XG59O1xuXG4vLyBUdXJuIGEgbGluZSBvZiB0ZXh0IGludG8gYSBsb2dnYWJsZSBvYmplY3QuXG4vLyBAcGFyYW0gbGluZSB7U3RyaW5nfVxuLy8gQHBhcmFtIG92ZXJyaWRlIHtPYmplY3R9XG5Mb2cub2JqRnJvbVRleHQgPSAobGluZSwgb3ZlcnJpZGUpID0+IHtcbiAgcmV0dXJuIHtcbiAgICBtZXNzYWdlOiBsaW5lLFxuICAgIGxldmVsOiAnaW5mbycsXG4gICAgdGltZTogbmV3IERhdGUoKSxcbiAgICB0aW1lSW5leGFjdDogdHJ1ZSxcbiAgICAuLi5vdmVycmlkZVxuICB9O1xufTtcblxuZXhwb3J0IHsgTG9nIH07XG4iLCJGb3JtYXR0ZXIgPSB7fTtcbkZvcm1hdHRlci5wcmV0dGlmeSA9IGZ1bmN0aW9uKGxpbmUsIGNvbG9yKXtcbiAgICBpZighY29sb3IpIHJldHVybiBsaW5lO1xuICAgIHJldHVybiByZXF1aXJlKFwiY2hhbGtcIilbY29sb3JdKGxpbmUpO1xufTtcbiJdfQ==
