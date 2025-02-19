Package["core-runtime"].queue("http",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var URL = Package.url.URL;
var URLSearchParams = Package.url.URLSearchParams;
var ECMAScript = Package.ecmascript.ECMAScript;
var fetch = Package.fetch.fetch;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var HTTP, HTTPInternals;

var require = meteorInstall({"node_modules":{"meteor":{"http":{"httpcall_server.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/http/httpcall_server.js                                                                                 //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      HTTP: () => HTTP,
      HTTPInternals: () => HTTPInternals
    });
    let Util;
    module.link("util", {
      default(v) {
        Util = v;
      }
    }, 0);
    let fetch, Request;
    module.link("meteor/fetch", {
      fetch(v) {
        fetch = v;
      },
      Request(v) {
        Request = v;
      }
    }, 1);
    let URL, URLSearchParams;
    module.link("meteor/url", {
      URL(v) {
        URL = v;
      },
      URLSearchParams(v) {
        URLSearchParams = v;
      }
    }, 2);
    let HTTP, makeErrorByStatus, populateData;
    module.link("./httpcall_common.js", {
      HTTP(v) {
        HTTP = v;
      },
      makeErrorByStatus(v) {
        makeErrorByStatus = v;
      },
      populateData(v) {
        populateData = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const hasOwn = Object.prototype.hasOwnProperty;

    /**
     * @deprecated
     */
    const HTTPInternals = {};
    // _call always runs asynchronously; HTTP.call, defined below,
    // wraps _call and runs synchronously when no callback is provided.
    function _call(method, url, options, callback) {
      ////////// Process arguments //////////

      if (!callback && typeof options === 'function') {
        // support (method, url, callback) argument list
        callback = options;
        options = null;
      }
      options = options || {};
      if (hasOwn.call(options, 'beforeSend')) {
        throw new Error('Option beforeSend not supported on server.');
      }
      method = (method || '').toUpperCase();
      if (!/^https?:\/\//.test(url)) {
        throw new Error('url must be absolute and start with http:// or https://');
      }
      const headers = {};
      let content = options.content;
      if (options.data) {
        content = JSON.stringify(options.data);
        headers['Content-Type'] = 'application/json';
      }
      let paramsForUrl;
      let paramsForBody;
      if (content || method === 'GET' || method === 'HEAD') {
        paramsForUrl = options.params;
      } else {
        paramsForBody = options.params;
      }
      const newUrl = URL._constructUrl(url, options.query, paramsForUrl);
      if (options.auth) {
        if (options.auth.indexOf(':') < 0) {
          throw new Error('auth option should be of the form "username:password"');
        }
        const base64 = Buffer.from(options.auth, 'ascii').toString('base64');
        headers['Authorization'] = "Basic ".concat(base64);
      }
      if (paramsForBody) {
        const data = new URLSearchParams();
        Object.entries(paramsForBody).forEach(_ref => {
          let [key, value] = _ref;
          data.append(key, value);
        });
        content = data;
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      if (options.headers) {
        Object.keys(options.headers).forEach(function (key) {
          headers[key] = options.headers[key];
        });
      }
      let caching;
      if (options.caching) {
        // TODO implement fetch-specific options
      }
      let corsMode;
      if (options.mode) {
        // TODO implement fetch-specific options
      }
      let credentials;

      // wrap callback to add a 'response' property on an error, in case
      // we have both (http 4xx/5xx error, which has a response payload)
      callback = function (cb) {
        let called = false;
        return function (error, response) {
          if (!called) {
            called = true;
            if (error && response) {
              error.response = response;
            }
            cb(error, response);
          }
        };
      }(callback);

      // is false if false, otherwise always true
      const followRedirects = options.followRedirects === false ? 'manual' : 'follow';

      ////////// Kickoff! //////////

      const requestOptions = {
        method: method,
        caching: caching,
        mode: corsMode,
        jar: false,
        timeout: options.timeout,
        body: content,
        redirect: followRedirects,
        referrer: options.referrer,
        integrity: options.integrity,
        headers: headers
      };
      const request = new Request(newUrl, requestOptions);
      fetch(request).then(async res => {
        const content = await res.text();
        const response = {};
        response.statusCode = res.status;
        response.content = '' + content;

        // fetch headers don't allow simple read using bracket notation
        // so we iterate their entries and assign them to a new Object
        response.headers = {};
        for (const entry of res.headers.entries()) {
          const [key, val] = entry;
          response.headers[key] = val;
        }
        response.ok = res.ok;
        response.redirected = res.redirected;
        populateData(response);
        if (response.statusCode >= 400) {
          const error = makeErrorByStatus(response.statusCode, response.content);
          callback(error, response);
        } else {
          callback(undefined, response);
        }
      }).catch(err => callback(err));
    }
    HTTP.call = function () {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      const cb = args.pop();
      if (typeof cb === 'function') {
        return _call(...args, cb);
      }
      return Util.promisify(_call)(...args, cb);
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
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"httpcall_common.js":function module(require,exports){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/http/httpcall_common.js                                                                                 //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
var MAX_LENGTH = 500; // if you change this, also change the appropriate test
var slice = Array.prototype.slice;
exports.makeErrorByStatus = function (statusCode, content) {
  var message = "failed [" + statusCode + "]";
  if (content) {
    var stringContent = typeof content == "string" ? content : content.toString();
    message += ' ' + truncate(stringContent.replace(/\n/g, ' '), MAX_LENGTH);
  }
  return new Error(message);
};
function truncate(str, length) {
  return str.length > length ? str.slice(0, length) + '...' : str;
}

// Fill in `response.data` if the content-type is JSON.
exports.populateData = function (response) {
  // Read Content-Type header, up to a ';' if there is one.
  // A typical header might be "application/json; charset=utf-8"
  // or just "application/json".
  var contentType = (response.headers['content-type'] || ';').split(';')[0];

  // Only try to parse data as JSON if server sets correct content type.
  if (['application/json', 'text/javascript', 'application/javascript', 'application/x-javascript'].indexOf(contentType) >= 0) {
    try {
      response.data = JSON.parse(response.content);
    } catch (err) {
      response.data = null;
    }
  } else {
    response.data = null;
  }
};
var HTTP = exports.HTTP = {};

/**
 * @summary Send an HTTP `GET` request. Equivalent to calling [`HTTP.call`](#http_call) with "GET" as the first argument.
 * @param {String} url The URL to which the request should be sent.
 * @param {Object} [callOptions] Options passed on to [`HTTP.call`](#http_call).
 * @param {Function} [asyncCallback] Callback that is called when the request is completed. Required on the client.
 * @locus Anywhere
 * @deprecated
 */
HTTP.get = function /* varargs */
() {
  return HTTP.call.apply(this, ["GET"].concat(slice.call(arguments)));
};

/**
 * @summary Send an HTTP `POST` request. Equivalent to calling [`HTTP.call`](#http_call) with "POST" as the first argument.
 * @param {String} url The URL to which the request should be sent.
 * @param {Object} [callOptions] Options passed on to [`HTTP.call`](#http_call).
 * @param {Function} [asyncCallback] Callback that is called when the request is completed. Required on the client.
 * @locus Anywhere
 * @deprecated
 */
HTTP.post = function /* varargs */
() {
  return HTTP.call.apply(this, ["POST"].concat(slice.call(arguments)));
};

/**
 * @summary Send an HTTP `PUT` request. Equivalent to calling [`HTTP.call`](#http_call) with "PUT" as the first argument.
 * @param {String} url The URL to which the request should be sent.
 * @param {Object} [callOptions] Options passed on to [`HTTP.call`](#http_call).
 * @param {Function} [asyncCallback] Callback that is called when the request is completed. Required on the client.
 * @locus Anywhere
 * @deprecated
 */
HTTP.put = function /* varargs */
() {
  return HTTP.call.apply(this, ["PUT"].concat(slice.call(arguments)));
};

/**
 * @summary Send an HTTP `DELETE` request. Equivalent to calling [`HTTP.call`](#http_call) with "DELETE" as the first argument. (Named `del` to avoid conflict with the Javascript keyword `delete`)
 * @param {String} url The URL to which the request should be sent.
 * @param {Object} [callOptions] Options passed on to [`HTTP.call`](#http_call).
 * @param {Function} [asyncCallback] Callback that is called when the request is completed. Required on the client.
 * @locus Anywhere
 * @deprecated
 */
HTTP.del = function /* varargs */
() {
  return HTTP.call.apply(this, ["DELETE"].concat(slice.call(arguments)));
};

/**
 * @summary Send an HTTP `PATCH` request. Equivalent to calling [`HTTP.call`](#http_call) with "PATCH" as the first argument.
 * @param {String} url The URL to which the request should be sent.
 * @param {Object} [callOptions] Options passed on to [`HTTP.call`](#http_call).
 * @param {Function} [asyncCallback] Callback that is called when the request is completed. Required on the client.
 * @locus Anywhere
 * @deprecated
 */
HTTP.patch = function /* varargs */
() {
  return HTTP.call.apply(this, ["PATCH"].concat(slice.call(arguments)));
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      HTTP: HTTP,
      HTTPInternals: HTTPInternals
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/http/httpcall_server.js"
  ],
  mainModulePath: "/node_modules/meteor/http/httpcall_server.js"
}});

//# sourceURL=meteor://💻app/packages/http.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaHR0cC9odHRwY2FsbF9zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2h0dHAvaHR0cGNhbGxfY29tbW9uLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkhUVFAiLCJIVFRQSW50ZXJuYWxzIiwiVXRpbCIsImxpbmsiLCJkZWZhdWx0IiwidiIsImZldGNoIiwiUmVxdWVzdCIsIlVSTCIsIlVSTFNlYXJjaFBhcmFtcyIsIm1ha2VFcnJvckJ5U3RhdHVzIiwicG9wdWxhdGVEYXRhIiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJoYXNPd24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsIl9jYWxsIiwibWV0aG9kIiwidXJsIiwib3B0aW9ucyIsImNhbGxiYWNrIiwiY2FsbCIsIkVycm9yIiwidG9VcHBlckNhc2UiLCJ0ZXN0IiwiaGVhZGVycyIsImNvbnRlbnQiLCJkYXRhIiwiSlNPTiIsInN0cmluZ2lmeSIsInBhcmFtc0ZvclVybCIsInBhcmFtc0ZvckJvZHkiLCJwYXJhbXMiLCJuZXdVcmwiLCJfY29uc3RydWN0VXJsIiwicXVlcnkiLCJhdXRoIiwiaW5kZXhPZiIsImJhc2U2NCIsIkJ1ZmZlciIsImZyb20iLCJ0b1N0cmluZyIsImNvbmNhdCIsImVudHJpZXMiLCJmb3JFYWNoIiwiX3JlZiIsImtleSIsInZhbHVlIiwiYXBwZW5kIiwia2V5cyIsImNhY2hpbmciLCJjb3JzTW9kZSIsIm1vZGUiLCJjcmVkZW50aWFscyIsImNiIiwiY2FsbGVkIiwiZXJyb3IiLCJyZXNwb25zZSIsImZvbGxvd1JlZGlyZWN0cyIsInJlcXVlc3RPcHRpb25zIiwiamFyIiwidGltZW91dCIsImJvZHkiLCJyZWRpcmVjdCIsInJlZmVycmVyIiwiaW50ZWdyaXR5IiwicmVxdWVzdCIsInRoZW4iLCJyZXMiLCJ0ZXh0Iiwic3RhdHVzQ29kZSIsInN0YXR1cyIsImVudHJ5IiwidmFsIiwib2siLCJyZWRpcmVjdGVkIiwidW5kZWZpbmVkIiwiY2F0Y2giLCJlcnIiLCJfbGVuIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwiYXJncyIsIkFycmF5IiwiX2tleSIsInBvcCIsInByb21pc2lmeSIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsInNlbGYiLCJhc3luYyIsIk1BWF9MRU5HVEgiLCJzbGljZSIsImV4cG9ydHMiLCJtZXNzYWdlIiwic3RyaW5nQ29udGVudCIsInRydW5jYXRlIiwicmVwbGFjZSIsInN0ciIsImNvbnRlbnRUeXBlIiwic3BsaXQiLCJwYXJzZSIsImdldCIsImFwcGx5IiwicG9zdCIsInB1dCIsImRlbCIsInBhdGNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBQSxNQUFNLENBQUNDLE1BQU0sQ0FBQztNQUFDQyxJQUFJLEVBQUNBLENBQUEsS0FBSUEsSUFBSTtNQUFDQyxhQUFhLEVBQUNBLENBQUEsS0FBSUE7SUFBYSxDQUFDLENBQUM7SUFBQyxJQUFJQyxJQUFJO0lBQUNKLE1BQU0sQ0FBQ0ssSUFBSSxDQUFDLE1BQU0sRUFBQztNQUFDQyxPQUFPQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0gsSUFBSSxHQUFDRyxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsS0FBSyxFQUFDQyxPQUFPO0lBQUNULE1BQU0sQ0FBQ0ssSUFBSSxDQUFDLGNBQWMsRUFBQztNQUFDRyxLQUFLQSxDQUFDRCxDQUFDLEVBQUM7UUFBQ0MsS0FBSyxHQUFDRCxDQUFDO01BQUEsQ0FBQztNQUFDRSxPQUFPQSxDQUFDRixDQUFDLEVBQUM7UUFBQ0UsT0FBTyxHQUFDRixDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUcsR0FBRyxFQUFDQyxlQUFlO0lBQUNYLE1BQU0sQ0FBQ0ssSUFBSSxDQUFDLFlBQVksRUFBQztNQUFDSyxHQUFHQSxDQUFDSCxDQUFDLEVBQUM7UUFB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QUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDN0QsTUFBTSxDQUFDa0QsS0FBSyxDQUFDdkUsSUFBSSxDQUFDMkQsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUN0RSxDQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQWpGLElBQUksQ0FBQzBHLEdBQUcsR0FBRyxTQUFVO0FBQUEsR0FBZTtFQUNsQyxPQUFPMUcsSUFBSSxDQUFDc0IsSUFBSSxDQUFDa0YsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDN0QsTUFBTSxDQUFDa0QsS0FBSyxDQUFDdkUsSUFBSSxDQUFDMkQsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUNyRSxDQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQWpGLElBQUksQ0FBQzJHLEdBQUcsR0FBRyxTQUFVO0FBQUEsR0FBZTtFQUNsQyxPQUFPM0csSUFBSSxDQUFDc0IsSUFBSSxDQUFDa0YsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDN0QsTUFBTSxDQUFDa0QsS0FBSyxDQUFDdkUsSUFBSSxDQUFDMkQsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUN4RSxDQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQWpGLElBQUksQ0FBQzRHLEtBQUssR0FBRyxTQUFVO0FBQUEsR0FBZTtFQUNwQyxPQUFPNUcsSUFBSSxDQUFDc0IsSUFBSSxDQUFDa0YsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDN0QsTUFBTSxDQUFDa0QsS0FBSyxDQUFDdkUsSUFBSSxDQUFDMkQsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUN2RSxDQUFDLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2h0dHAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgVXRpbCBmcm9tICd1dGlsJztcbmltcG9ydCB7IGZldGNoLCBSZXF1ZXN0IH0gZnJvbSAnbWV0ZW9yL2ZldGNoJztcbmltcG9ydCB7IFVSTCwgVVJMU2VhcmNoUGFyYW1zIH0gZnJvbSAnbWV0ZW9yL3VybCc7XG5pbXBvcnQgeyBIVFRQLCBtYWtlRXJyb3JCeVN0YXR1cywgcG9wdWxhdGVEYXRhIH0gZnJvbSAnLi9odHRwY2FsbF9jb21tb24uanMnO1xuXG5leHBvcnQgeyBIVFRQIH07XG5jb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKi9cbmV4cG9ydCBjb25zdCBIVFRQSW50ZXJuYWxzID0ge307XG5cbi8vIF9jYWxsIGFsd2F5cyBydW5zIGFzeW5jaHJvbm91c2x5OyBIVFRQLmNhbGwsIGRlZmluZWQgYmVsb3csXG4vLyB3cmFwcyBfY2FsbCBhbmQgcnVucyBzeW5jaHJvbm91c2x5IHdoZW4gbm8gY2FsbGJhY2sgaXMgcHJvdmlkZWQuXG5mdW5jdGlvbiBfY2FsbCAobWV0aG9kLCB1cmwsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIC8vLy8vLy8vLy8gUHJvY2VzcyBhcmd1bWVudHMgLy8vLy8vLy8vL1xuXG4gIGlmICghY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAvLyBzdXBwb3J0IChtZXRob2QsIHVybCwgY2FsbGJhY2spIGFyZ3VtZW50IGxpc3RcbiAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgb3B0aW9ucyA9IG51bGw7XG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICBpZiAoaGFzT3duLmNhbGwob3B0aW9ucywgJ2JlZm9yZVNlbmQnKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignT3B0aW9uIGJlZm9yZVNlbmQgbm90IHN1cHBvcnRlZCBvbiBzZXJ2ZXIuJyk7XG4gIH1cblxuICBtZXRob2QgPSAobWV0aG9kIHx8ICcnKS50b1VwcGVyQ2FzZSgpO1xuXG4gIGlmICghL15odHRwcz86XFwvXFwvLy50ZXN0KHVybCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VybCBtdXN0IGJlIGFic29sdXRlIGFuZCBzdGFydCB3aXRoIGh0dHA6Ly8gb3IgaHR0cHM6Ly8nKTtcbiAgfVxuXG4gIGNvbnN0IGhlYWRlcnMgPSB7fTtcbiAgbGV0IGNvbnRlbnQgPSBvcHRpb25zLmNvbnRlbnQ7XG5cbiAgaWYgKG9wdGlvbnMuZGF0YSkge1xuICAgIGNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShvcHRpb25zLmRhdGEpO1xuICAgIGhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID0gJ2FwcGxpY2F0aW9uL2pzb24nO1xuICB9XG5cbiAgbGV0IHBhcmFtc0ZvclVybDtcbiAgbGV0IHBhcmFtc0ZvckJvZHk7XG5cbiAgaWYgKGNvbnRlbnQgfHwgbWV0aG9kID09PSAnR0VUJyB8fCBtZXRob2QgPT09ICdIRUFEJykge1xuICAgIHBhcmFtc0ZvclVybCA9IG9wdGlvbnMucGFyYW1zO1xuICB9XG4gIGVsc2Uge1xuICAgIHBhcmFtc0ZvckJvZHkgPSBvcHRpb25zLnBhcmFtcztcbiAgfVxuXG4gIGNvbnN0IG5ld1VybCA9IFVSTC5fY29uc3RydWN0VXJsKHVybCwgb3B0aW9ucy5xdWVyeSwgcGFyYW1zRm9yVXJsKTtcblxuICBpZiAob3B0aW9ucy5hdXRoKSB7XG4gICAgaWYgKG9wdGlvbnMuYXV0aC5pbmRleE9mKCc6JykgPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2F1dGggb3B0aW9uIHNob3VsZCBiZSBvZiB0aGUgZm9ybSBcInVzZXJuYW1lOnBhc3N3b3JkXCInKTtcbiAgICB9XG5cbiAgICBjb25zdCBiYXNlNjQgPSBCdWZmZXIuZnJvbShvcHRpb25zLmF1dGgsICdhc2NpaScpLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICBoZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgQmFzaWMgJHtiYXNlNjR9YDtcbiAgfVxuXG4gIGlmIChwYXJhbXNGb3JCb2R5KSB7XG4gICAgY29uc3QgZGF0YSA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcbiAgICBPYmplY3QuZW50cmllcyhwYXJhbXNGb3JCb2R5KS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGRhdGEuYXBwZW5kKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICAgIGNvbnRlbnQgPSBkYXRhO1xuICAgIGhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID0gJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCc7XG4gIH1cblxuICBpZiAob3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgT2JqZWN0LmtleXMob3B0aW9ucy5oZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIGhlYWRlcnNba2V5XSA9IG9wdGlvbnMuaGVhZGVyc1trZXldO1xuICAgIH0pO1xuICB9XG5cbiAgbGV0IGNhY2hpbmc7XG4gIGlmIChvcHRpb25zLmNhY2hpbmcpIHtcbiAgICAvLyBUT0RPIGltcGxlbWVudCBmZXRjaC1zcGVjaWZpYyBvcHRpb25zXG4gIH1cblxuICBsZXQgY29yc01vZGU7XG4gIGlmIChvcHRpb25zLm1vZGUpIHtcbiAgICAvLyBUT0RPIGltcGxlbWVudCBmZXRjaC1zcGVjaWZpYyBvcHRpb25zXG4gIH1cblxuICBsZXQgY3JlZGVudGlhbHM7XG5cbiAgLy8gd3JhcCBjYWxsYmFjayB0byBhZGQgYSAncmVzcG9uc2UnIHByb3BlcnR5IG9uIGFuIGVycm9yLCBpbiBjYXNlXG4gIC8vIHdlIGhhdmUgYm90aCAoaHR0cCA0eHgvNXh4IGVycm9yLCB3aGljaCBoYXMgYSByZXNwb25zZSBwYXlsb2FkKVxuICBjYWxsYmFjayA9IChmdW5jdGlvbiAoY2IpIHtcbiAgICBsZXQgY2FsbGVkID0gZmFsc2U7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChlcnJvciwgcmVzcG9uc2UpIHtcbiAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgICAgIGlmIChlcnJvciAmJiByZXNwb25zZSkge1xuICAgICAgICAgIGVycm9yLnJlc3BvbnNlID0gcmVzcG9uc2U7XG4gICAgICAgIH1cbiAgICAgICAgY2IoZXJyb3IsIHJlc3BvbnNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pKGNhbGxiYWNrKTtcblxuICAvLyBpcyBmYWxzZSBpZiBmYWxzZSwgb3RoZXJ3aXNlIGFsd2F5cyB0cnVlXG4gIGNvbnN0IGZvbGxvd1JlZGlyZWN0cyA9IG9wdGlvbnMuZm9sbG93UmVkaXJlY3RzID09PSBmYWxzZVxuICAgID8gJ21hbnVhbCdcbiAgICA6ICdmb2xsb3cnO1xuXG4gIC8vLy8vLy8vLy8gS2lja29mZiEgLy8vLy8vLy8vL1xuXG4gIGNvbnN0IHJlcXVlc3RPcHRpb25zID0ge1xuICAgIG1ldGhvZDogbWV0aG9kLFxuICAgIGNhY2hpbmc6IGNhY2hpbmcsXG4gICAgbW9kZTogY29yc01vZGUsXG5cbiAgICBqYXI6IGZhbHNlLFxuICAgIHRpbWVvdXQ6IG9wdGlvbnMudGltZW91dCxcbiAgICBib2R5OiBjb250ZW50LFxuICAgIHJlZGlyZWN0OiBmb2xsb3dSZWRpcmVjdHMsXG4gICAgcmVmZXJyZXI6IG9wdGlvbnMucmVmZXJyZXIsXG4gICAgaW50ZWdyaXR5OiBvcHRpb25zLmludGVncml0eSxcbiAgICBoZWFkZXJzOiBoZWFkZXJzXG4gIH07XG5cbiAgY29uc3QgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KG5ld1VybCwgcmVxdWVzdE9wdGlvbnMpO1xuXG4gIGZldGNoKHJlcXVlc3QpXG4gICAgLnRoZW4oYXN5bmMgcmVzID0+IHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCByZXMudGV4dCgpO1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSB7fTtcbiAgICAgIHJlc3BvbnNlLnN0YXR1c0NvZGUgPSByZXMuc3RhdHVzO1xuICAgICAgcmVzcG9uc2UuY29udGVudCA9ICcnICsgY29udGVudDtcblxuICAgICAgLy8gZmV0Y2ggaGVhZGVycyBkb24ndCBhbGxvdyBzaW1wbGUgcmVhZCB1c2luZyBicmFja2V0IG5vdGF0aW9uXG4gICAgICAvLyBzbyB3ZSBpdGVyYXRlIHRoZWlyIGVudHJpZXMgYW5kIGFzc2lnbiB0aGVtIHRvIGEgbmV3IE9iamVjdFxuICAgICAgcmVzcG9uc2UuaGVhZGVycyA9IHt9O1xuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiByZXMuaGVhZGVycy5lbnRyaWVzKCkpIHtcbiAgICAgICAgY29uc3QgW2tleSwgdmFsXSA9IGVudHJ5O1xuICAgICAgICByZXNwb25zZS5oZWFkZXJzW2tleV0gPSB2YWw7XG4gICAgICB9XG5cbiAgICAgIHJlc3BvbnNlLm9rID0gcmVzLm9rO1xuICAgICAgcmVzcG9uc2UucmVkaXJlY3RlZCA9IHJlcy5yZWRpcmVjdGVkO1xuXG4gICAgICBwb3B1bGF0ZURhdGEocmVzcG9uc2UpO1xuXG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzQ29kZSA+PSA0MDApIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSBtYWtlRXJyb3JCeVN0YXR1cyhcbiAgICAgICAgICByZXNwb25zZS5zdGF0dXNDb2RlLFxuICAgICAgICAgIHJlc3BvbnNlLmNvbnRlbnRcbiAgICAgICAgKTtcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIHJlc3BvbnNlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKHVuZGVmaW5lZCwgcmVzcG9uc2UpO1xuICAgICAgfVxuICAgIH0pXG4gICAgLmNhdGNoKGVyciA9PiBjYWxsYmFjayhlcnIpKTtcbn1cblxuSFRUUC5jYWxsID0gZnVuY3Rpb24oLi4uYXJncykge1xuICBjb25zdCBjYiA9IGFyZ3MucG9wKCk7XG4gIGlmICh0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gX2NhbGwoLi4uYXJncywgY2IpO1xuICB9XG4gIHJldHVybiBVdGlsLnByb21pc2lmeShfY2FsbCkoLi4uYXJncywgY2IpO1xufVxuIiwidmFyIE1BWF9MRU5HVEggPSA1MDA7IC8vIGlmIHlvdSBjaGFuZ2UgdGhpcywgYWxzbyBjaGFuZ2UgdGhlIGFwcHJvcHJpYXRlIHRlc3RcbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcblxuZXhwb3J0cy5tYWtlRXJyb3JCeVN0YXR1cyA9IGZ1bmN0aW9uKHN0YXR1c0NvZGUsIGNvbnRlbnQpIHtcbiAgdmFyIG1lc3NhZ2UgPSBcImZhaWxlZCBbXCIgKyBzdGF0dXNDb2RlICsgXCJdXCI7XG5cbiAgaWYgKGNvbnRlbnQpIHtcbiAgICB2YXIgc3RyaW5nQ29udGVudCA9IHR5cGVvZiBjb250ZW50ID09IFwic3RyaW5nXCIgP1xuICAgICAgY29udGVudCA6IGNvbnRlbnQudG9TdHJpbmcoKTtcblxuICAgIG1lc3NhZ2UgKz0gJyAnICsgdHJ1bmNhdGUoc3RyaW5nQ29udGVudC5yZXBsYWNlKC9cXG4vZywgJyAnKSwgTUFYX0xFTkdUSCk7XG4gIH1cblxuICByZXR1cm4gbmV3IEVycm9yKG1lc3NhZ2UpO1xufTtcblxuZnVuY3Rpb24gdHJ1bmNhdGUoc3RyLCBsZW5ndGgpIHtcbiAgcmV0dXJuIHN0ci5sZW5ndGggPiBsZW5ndGggPyBzdHIuc2xpY2UoMCwgbGVuZ3RoKSArICcuLi4nIDogc3RyO1xufVxuXG4vLyBGaWxsIGluIGByZXNwb25zZS5kYXRhYCBpZiB0aGUgY29udGVudC10eXBlIGlzIEpTT04uXG5leHBvcnRzLnBvcHVsYXRlRGF0YSA9IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gIC8vIFJlYWQgQ29udGVudC1UeXBlIGhlYWRlciwgdXAgdG8gYSAnOycgaWYgdGhlcmUgaXMgb25lLlxuICAvLyBBIHR5cGljYWwgaGVhZGVyIG1pZ2h0IGJlIFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiXG4gIC8vIG9yIGp1c3QgXCJhcHBsaWNhdGlvbi9qc29uXCIuXG4gIHZhciBjb250ZW50VHlwZSA9IChyZXNwb25zZS5oZWFkZXJzWydjb250ZW50LXR5cGUnXSB8fCAnOycpLnNwbGl0KCc7JylbMF07XG5cbiAgLy8gT25seSB0cnkgdG8gcGFyc2UgZGF0YSBhcyBKU09OIGlmIHNlcnZlciBzZXRzIGNvcnJlY3QgY29udGVudCB0eXBlLlxuICBpZiAoWydhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAndGV4dC9qYXZhc2NyaXB0JyxcbiAgICAgICAnYXBwbGljYXRpb24vamF2YXNjcmlwdCcsXG4gICAgICAgJ2FwcGxpY2F0aW9uL3gtamF2YXNjcmlwdCcsXG4gICAgICBdLmluZGV4T2YoY29udGVudFR5cGUpID49IDApIHtcbiAgICB0cnkge1xuICAgICAgcmVzcG9uc2UuZGF0YSA9IEpTT04ucGFyc2UocmVzcG9uc2UuY29udGVudCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXNwb25zZS5kYXRhID0gbnVsbDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmVzcG9uc2UuZGF0YSA9IG51bGw7XG4gIH1cbn07XG5cbnZhciBIVFRQID0gZXhwb3J0cy5IVFRQID0ge307XG5cbi8qKlxuICogQHN1bW1hcnkgU2VuZCBhbiBIVFRQIGBHRVRgIHJlcXVlc3QuIEVxdWl2YWxlbnQgdG8gY2FsbGluZyBbYEhUVFAuY2FsbGBdKCNodHRwX2NhbGwpIHdpdGggXCJHRVRcIiBhcyB0aGUgZmlyc3QgYXJndW1lbnQuXG4gKiBAcGFyYW0ge1N0cmluZ30gdXJsIFRoZSBVUkwgdG8gd2hpY2ggdGhlIHJlcXVlc3Qgc2hvdWxkIGJlIHNlbnQuXG4gKiBAcGFyYW0ge09iamVjdH0gW2NhbGxPcHRpb25zXSBPcHRpb25zIHBhc3NlZCBvbiB0byBbYEhUVFAuY2FsbGBdKCNodHRwX2NhbGwpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2FzeW5jQ2FsbGJhY2tdIENhbGxiYWNrIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIHJlcXVlc3QgaXMgY29tcGxldGVkLiBSZXF1aXJlZCBvbiB0aGUgY2xpZW50LlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAZGVwcmVjYXRlZFxuICovXG5IVFRQLmdldCA9IGZ1bmN0aW9uICgvKiB2YXJhcmdzICovKSB7XG4gIHJldHVybiBIVFRQLmNhbGwuYXBwbHkodGhpcywgW1wiR0VUXCJdLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgU2VuZCBhbiBIVFRQIGBQT1NUYCByZXF1ZXN0LiBFcXVpdmFsZW50IHRvIGNhbGxpbmcgW2BIVFRQLmNhbGxgXSgjaHR0cF9jYWxsKSB3aXRoIFwiUE9TVFwiIGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAqIEBwYXJhbSB7U3RyaW5nfSB1cmwgVGhlIFVSTCB0byB3aGljaCB0aGUgcmVxdWVzdCBzaG91bGQgYmUgc2VudC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbY2FsbE9wdGlvbnNdIE9wdGlvbnMgcGFzc2VkIG9uIHRvIFtgSFRUUC5jYWxsYF0oI2h0dHBfY2FsbCkuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbYXN5bmNDYWxsYmFja10gQ2FsbGJhY2sgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgcmVxdWVzdCBpcyBjb21wbGV0ZWQuIFJlcXVpcmVkIG9uIHRoZSBjbGllbnQuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBkZXByZWNhdGVkXG4gKi9cbkhUVFAucG9zdCA9IGZ1bmN0aW9uICgvKiB2YXJhcmdzICovKSB7XG4gIHJldHVybiBIVFRQLmNhbGwuYXBwbHkodGhpcywgW1wiUE9TVFwiXS5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFNlbmQgYW4gSFRUUCBgUFVUYCByZXF1ZXN0LiBFcXVpdmFsZW50IHRvIGNhbGxpbmcgW2BIVFRQLmNhbGxgXSgjaHR0cF9jYWxsKSB3aXRoIFwiUFVUXCIgYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICogQHBhcmFtIHtTdHJpbmd9IHVybCBUaGUgVVJMIHRvIHdoaWNoIHRoZSByZXF1ZXN0IHNob3VsZCBiZSBzZW50LlxuICogQHBhcmFtIHtPYmplY3R9IFtjYWxsT3B0aW9uc10gT3B0aW9ucyBwYXNzZWQgb24gdG8gW2BIVFRQLmNhbGxgXSgjaHR0cF9jYWxsKS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFthc3luY0NhbGxiYWNrXSBDYWxsYmFjayB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSByZXF1ZXN0IGlzIGNvbXBsZXRlZC4gUmVxdWlyZWQgb24gdGhlIGNsaWVudC5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQGRlcHJlY2F0ZWRcbiAqL1xuSFRUUC5wdXQgPSBmdW5jdGlvbiAoLyogdmFyYXJncyAqLykge1xuICByZXR1cm4gSFRUUC5jYWxsLmFwcGx5KHRoaXMsIFtcIlBVVFwiXS5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFNlbmQgYW4gSFRUUCBgREVMRVRFYCByZXF1ZXN0LiBFcXVpdmFsZW50IHRvIGNhbGxpbmcgW2BIVFRQLmNhbGxgXSgjaHR0cF9jYWxsKSB3aXRoIFwiREVMRVRFXCIgYXMgdGhlIGZpcnN0IGFyZ3VtZW50LiAoTmFtZWQgYGRlbGAgdG8gYXZvaWQgY29uZmxpY3Qgd2l0aCB0aGUgSmF2YXNjcmlwdCBrZXl3b3JkIGBkZWxldGVgKVxuICogQHBhcmFtIHtTdHJpbmd9IHVybCBUaGUgVVJMIHRvIHdoaWNoIHRoZSByZXF1ZXN0IHNob3VsZCBiZSBzZW50LlxuICogQHBhcmFtIHtPYmplY3R9IFtjYWxsT3B0aW9uc10gT3B0aW9ucyBwYXNzZWQgb24gdG8gW2BIVFRQLmNhbGxgXSgjaHR0cF9jYWxsKS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFthc3luY0NhbGxiYWNrXSBDYWxsYmFjayB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSByZXF1ZXN0IGlzIGNvbXBsZXRlZC4gUmVxdWlyZWQgb24gdGhlIGNsaWVudC5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQGRlcHJlY2F0ZWRcbiAqL1xuSFRUUC5kZWwgPSBmdW5jdGlvbiAoLyogdmFyYXJncyAqLykge1xuICByZXR1cm4gSFRUUC5jYWxsLmFwcGx5KHRoaXMsIFtcIkRFTEVURVwiXS5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFNlbmQgYW4gSFRUUCBgUEFUQ0hgIHJlcXVlc3QuIEVxdWl2YWxlbnQgdG8gY2FsbGluZyBbYEhUVFAuY2FsbGBdKCNodHRwX2NhbGwpIHdpdGggXCJQQVRDSFwiIGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAqIEBwYXJhbSB7U3RyaW5nfSB1cmwgVGhlIFVSTCB0byB3aGljaCB0aGUgcmVxdWVzdCBzaG91bGQgYmUgc2VudC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbY2FsbE9wdGlvbnNdIE9wdGlvbnMgcGFzc2VkIG9uIHRvIFtgSFRUUC5jYWxsYF0oI2h0dHBfY2FsbCkuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbYXN5bmNDYWxsYmFja10gQ2FsbGJhY2sgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgcmVxdWVzdCBpcyBjb21wbGV0ZWQuIFJlcXVpcmVkIG9uIHRoZSBjbGllbnQuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBkZXByZWNhdGVkXG4gKi9cbkhUVFAucGF0Y2ggPSBmdW5jdGlvbiAoLyogdmFyYXJncyAqLykge1xuICByZXR1cm4gSFRUUC5jYWxsLmFwcGx5KHRoaXMsIFtcIlBBVENIXCJdLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbn07XG4iXX0=
