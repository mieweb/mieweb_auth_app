Package["core-runtime"].queue("boilerplate-generator",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Boilerplate;

var require = meteorInstall({"node_modules":{"meteor":{"boilerplate-generator":{"generator.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/boilerplate-generator/generator.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
      Boilerplate: () => Boilerplate
    });
    let readFileSync;
    module.link("fs", {
      readFileSync(v) {
        readFileSync = v;
      }
    }, 0);
    let createStream;
    module.link("combined-stream2", {
      create(v) {
        createStream = v;
      }
    }, 1);
    let WebBrowserTemplate;
    module.link("./template-web.browser", {
      default(v) {
        WebBrowserTemplate = v;
      }
    }, 2);
    let WebCordovaTemplate;
    module.link("./template-web.cordova", {
      default(v) {
        WebCordovaTemplate = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Copied from webapp_server
    const readUtf8FileSync = filename => readFileSync(filename, 'utf8');
    const identity = value => value;
    function appendToStream(chunk, stream) {
      if (typeof chunk === "string") {
        stream.append(Buffer.from(chunk, "utf8"));
      } else if (Buffer.isBuffer(chunk) || typeof chunk.read === "function") {
        stream.append(chunk);
      }
    }
    class Boilerplate {
      constructor(arch, manifest) {
        let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        const {
          headTemplate,
          closeTemplate
        } = getTemplate(arch);
        this.headTemplate = headTemplate;
        this.closeTemplate = closeTemplate;
        this.baseData = null;
        this._generateBoilerplateFromManifest(manifest, options);
      }
      toHTML(extraData) {
        throw new Error("The Boilerplate#toHTML method has been removed. " + "Please use Boilerplate#toHTMLStream instead.");
      }

      // Returns a Promise that resolves to a string of HTML.
      toHTMLAsync(extraData) {
        return new Promise((resolve, reject) => {
          const stream = this.toHTMLStream(extraData);
          const chunks = [];
          stream.on("data", chunk => chunks.push(chunk));
          stream.on("end", () => {
            resolve(Buffer.concat(chunks).toString("utf8"));
          });
          stream.on("error", reject);
        });
      }

      // The 'extraData' argument can be used to extend 'self.baseData'. Its
      // purpose is to allow you to specify data that you might not know at
      // the time that you construct the Boilerplate object. (e.g. it is used
      // by 'webapp' to specify data that is only known at request-time).
      // this returns a stream
      toHTMLStream(extraData) {
        if (!this.baseData || !this.headTemplate || !this.closeTemplate) {
          throw new Error('Boilerplate did not instantiate correctly.');
        }
        const data = _objectSpread(_objectSpread({}, this.baseData), extraData);
        const start = "<!DOCTYPE html>\n" + this.headTemplate(data);
        const {
          body,
          dynamicBody
        } = data;
        const end = this.closeTemplate(data);
        const response = createStream();
        appendToStream(start, response);
        if (body) {
          appendToStream(body, response);
        }
        if (dynamicBody) {
          appendToStream(dynamicBody, response);
        }
        appendToStream(end, response);
        return response;
      }

      // XXX Exported to allow client-side only changes to rebuild the boilerplate
      // without requiring a full server restart.
      // Produces an HTML string with given manifest and boilerplateSource.
      // Optionally takes urlMapper in case urls from manifest need to be prefixed
      // or rewritten.
      // Optionally takes pathMapper for resolving relative file system paths.
      // Optionally allows to override fields of the data context.
      _generateBoilerplateFromManifest(manifest) {
        let {
          urlMapper = identity,
          pathMapper = identity,
          baseDataExtension,
          inline
        } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        const boilerplateBaseData = _objectSpread({
          css: [],
          js: [],
          head: '',
          body: '',
          meteorManifest: JSON.stringify(manifest)
        }, baseDataExtension);
        manifest.forEach(item => {
          const urlPath = urlMapper(item.url);
          const itemObj = {
            url: urlPath
          };
          if (inline) {
            itemObj.scriptContent = readUtf8FileSync(pathMapper(item.path));
            itemObj.inline = true;
          } else if (item.sri) {
            itemObj.sri = item.sri;
          }
          if (item.type === 'css' && item.where === 'client') {
            boilerplateBaseData.css.push(itemObj);
          }
          if (item.type === 'js' && item.where === 'client' &&
          // Dynamic JS modules should not be loaded eagerly in the
          // initial HTML of the app.
          !item.path.startsWith('dynamic/')) {
            boilerplateBaseData.js.push(itemObj);
          }
          if (item.type === 'head') {
            boilerplateBaseData.head = readUtf8FileSync(pathMapper(item.path));
          }
          if (item.type === 'body') {
            boilerplateBaseData.body = readUtf8FileSync(pathMapper(item.path));
          }
        });
        this.baseData = boilerplateBaseData;
      }
    }
    ;

    // Returns a template function that, when called, produces the boilerplate
    // html as a string.
    function getTemplate(arch) {
      const prefix = arch.split(".", 2).join(".");
      if (prefix === "web.browser") {
        return WebBrowserTemplate;
      }
      if (prefix === "web.cordova") {
        return WebCordovaTemplate;
      }
      throw new Error("Unsupported arch: " + arch);
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"template-web.browser.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/boilerplate-generator/template-web.browser.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      headTemplate: () => headTemplate,
      closeTemplate: () => closeTemplate
    });
    let template;
    module.link("./template", {
      default(v) {
        template = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const sri = (sri, mode) => sri && mode ? " integrity=\"sha512-".concat(sri, "\" crossorigin=\"").concat(mode, "\"") : '';
    const headTemplate = _ref => {
      let {
        css,
        htmlAttributes,
        bundledJsCssUrlRewriteHook,
        sriMode,
        head,
        dynamicHead
      } = _ref;
      var headSections = head.split(/<meteor-bundled-css[^<>]*>/, 2);
      var cssBundle = [...(css || []).map(file => template('  <link rel="stylesheet" type="text/css" class="__meteor-css__" href="<%- href %>"<%= sri %>>')({
        href: bundledJsCssUrlRewriteHook(file.url),
        sri: sri(file.sri, sriMode)
      }))].join('\n');
      return ['<html' + Object.keys(htmlAttributes || {}).map(key => template(' <%= attrName %>="<%- attrValue %>"')({
        attrName: key,
        attrValue: htmlAttributes[key]
      })).join('') + '>', '<head>', headSections.length === 1 ? [cssBundle, headSections[0]].join('\n') : [headSections[0], cssBundle, headSections[1]].join('\n'), dynamicHead, '</head>', '<body>'].join('\n');
    };
    const closeTemplate = _ref2 => {
      let {
        meteorRuntimeConfig,
        meteorRuntimeHash,
        rootUrlPathPrefix,
        inlineScriptsAllowed,
        js,
        additionalStaticJs,
        bundledJsCssUrlRewriteHook,
        sriMode
      } = _ref2;
      return ['', inlineScriptsAllowed ? template('  <script type="text/javascript">__meteor_runtime_config__ = JSON.parse(decodeURIComponent(<%= conf %>))</script>')({
        conf: meteorRuntimeConfig
      }) : template('  <script type="text/javascript" src="<%- src %>/meteor_runtime_config.js?hash=<%- hash %>"></script>')({
        src: rootUrlPathPrefix,
        hash: meteorRuntimeHash
      }), '', ...(js || []).map(file => template('  <script type="text/javascript" src="<%- src %>"<%= sri %>></script>')({
        src: bundledJsCssUrlRewriteHook(file.url),
        sri: sri(file.sri, sriMode)
      })), ...(additionalStaticJs || []).map(_ref3 => {
        let {
          contents,
          pathname
        } = _ref3;
        return inlineScriptsAllowed ? template('  <script><%= contents %></script>')({
          contents
        }) : template('  <script type="text/javascript" src="<%- src %>"></script>')({
          src: rootUrlPathPrefix + pathname
        });
      }), '', '', '</body>', '</html>'].join('\n');
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"template-web.cordova.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/boilerplate-generator/template-web.cordova.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      headTemplate: () => headTemplate,
      closeTemplate: () => closeTemplate
    });
    let template;
    module.link("./template", {
      default(v) {
        template = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const headTemplate = _ref => {
      let {
        meteorRuntimeConfig,
        rootUrlPathPrefix,
        inlineScriptsAllowed,
        css,
        js,
        additionalStaticJs,
        htmlAttributes,
        bundledJsCssUrlRewriteHook,
        head,
        dynamicHead
      } = _ref;
      var headSections = head.split(/<meteor-bundled-css[^<>]*>/, 2);
      var cssBundle = [
      // We are explicitly not using bundledJsCssUrlRewriteHook: in cordova we serve assets up directly from disk, so rewriting the URL does not make sense
      ...(css || []).map(file => template('  <link rel="stylesheet" type="text/css" class="__meteor-css__" href="<%- href %>">')({
        href: file.url
      }))].join('\n');
      return ['<html>', '<head>', '  <meta charset="utf-8">', '  <meta name="format-detection" content="telephone=no">', '  <meta name="viewport" content="user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1, width=device-width, height=device-height, viewport-fit=cover">', '  <meta name="msapplication-tap-highlight" content="no">', '  <meta http-equiv="Content-Security-Policy" content="default-src * android-webview-video-poster: gap: data: blob: \'unsafe-inline\' \'unsafe-eval\' ws: wss:;">', headSections.length === 1 ? [cssBundle, headSections[0]].join('\n') : [headSections[0], cssBundle, headSections[1]].join('\n'), '  <script type="text/javascript">', template('    __meteor_runtime_config__ = JSON.parse(decodeURIComponent(<%= conf %>));')({
        conf: meteorRuntimeConfig
      }), '    if (/Android/i.test(navigator.userAgent)) {',
      // When Android app is emulated, it cannot connect to localhost,
      // instead it should connect to 10.0.2.2
      // (unless we\'re using an http proxy; then it works!)
      '      if (!__meteor_runtime_config__.httpProxyPort) {', '        __meteor_runtime_config__.ROOT_URL = (__meteor_runtime_config__.ROOT_URL || \'\').replace(/localhost/i, \'10.0.2.2\');', '        __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL = (__meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL || \'\').replace(/localhost/i, \'10.0.2.2\');', '      }', '    }', '  </script>', '', '  <script type="text/javascript" src="/cordova.js"></script>', ...(js || []).map(file => template('  <script type="text/javascript" src="<%- src %>"></script>')({
        src: file.url
      })), ...(additionalStaticJs || []).map(_ref2 => {
        let {
          contents,
          pathname
        } = _ref2;
        return inlineScriptsAllowed ? template('  <script><%= contents %></script>')({
          contents
        }) : template('  <script type="text/javascript" src="<%- src %>"></script>')({
          src: rootUrlPathPrefix + pathname
        });
      }), '', '</head>', '', '<body>'].join('\n');
    };
    function closeTemplate() {
      return "</body>\n</html>";
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"template.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/boilerplate-generator/template.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      default: () => template
    });
    let lodashTemplate;
    module.link("lodash.template", {
      default(v) {
        lodashTemplate = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    function template(text) {
      return lodashTemplate(text, null, {
        evaluate: /<%([\s\S]+?)%>/g,
        interpolate: /<%=([\s\S]+?)%>/g,
        escape: /<%-([\s\S]+?)%>/g
      });
    }
    ;
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"combined-stream2":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/boilerplate-generator/node_modules/combined-stream2/package.json                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "combined-stream2",
  "version": "1.1.2",
  "main": "index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/boilerplate-generator/node_modules/combined-stream2/index.js                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.template":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/boilerplate-generator/node_modules/lodash.template/package.json                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.template",
  "version": "4.5.0"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/boilerplate-generator/node_modules/lodash.template/index.js                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      Boilerplate: Boilerplate
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/boilerplate-generator/generator.js"
  ],
  mainModulePath: "/node_modules/meteor/boilerplate-generator/generator.js"
}});

//# sourceURL=meteor://💻app/packages/boilerplate-generator.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYm9pbGVycGxhdGUtZ2VuZXJhdG9yL2dlbmVyYXRvci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYm9pbGVycGxhdGUtZ2VuZXJhdG9yL3RlbXBsYXRlLXdlYi5icm93c2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ib2lsZXJwbGF0ZS1nZW5lcmF0b3IvdGVtcGxhdGUtd2ViLmNvcmRvdmEuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JvaWxlcnBsYXRlLWdlbmVyYXRvci90ZW1wbGF0ZS5qcyJdLCJuYW1lcyI6WyJfb2JqZWN0U3ByZWFkIiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJ2IiwiZXhwb3J0IiwiQm9pbGVycGxhdGUiLCJyZWFkRmlsZVN5bmMiLCJjcmVhdGVTdHJlYW0iLCJjcmVhdGUiLCJXZWJCcm93c2VyVGVtcGxhdGUiLCJXZWJDb3Jkb3ZhVGVtcGxhdGUiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsInJlYWRVdGY4RmlsZVN5bmMiLCJmaWxlbmFtZSIsImlkZW50aXR5IiwidmFsdWUiLCJhcHBlbmRUb1N0cmVhbSIsImNodW5rIiwic3RyZWFtIiwiYXBwZW5kIiwiQnVmZmVyIiwiZnJvbSIsImlzQnVmZmVyIiwicmVhZCIsImNvbnN0cnVjdG9yIiwiYXJjaCIsIm1hbmlmZXN0Iiwib3B0aW9ucyIsImFyZ3VtZW50cyIsImxlbmd0aCIsInVuZGVmaW5lZCIsImhlYWRUZW1wbGF0ZSIsImNsb3NlVGVtcGxhdGUiLCJnZXRUZW1wbGF0ZSIsImJhc2VEYXRhIiwiX2dlbmVyYXRlQm9pbGVycGxhdGVGcm9tTWFuaWZlc3QiLCJ0b0hUTUwiLCJleHRyYURhdGEiLCJFcnJvciIsInRvSFRNTEFzeW5jIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJ0b0hUTUxTdHJlYW0iLCJjaHVua3MiLCJvbiIsInB1c2giLCJjb25jYXQiLCJ0b1N0cmluZyIsImRhdGEiLCJzdGFydCIsImJvZHkiLCJkeW5hbWljQm9keSIsImVuZCIsInJlc3BvbnNlIiwidXJsTWFwcGVyIiwicGF0aE1hcHBlciIsImJhc2VEYXRhRXh0ZW5zaW9uIiwiaW5saW5lIiwiYm9pbGVycGxhdGVCYXNlRGF0YSIsImNzcyIsImpzIiwiaGVhZCIsIm1ldGVvck1hbmlmZXN0IiwiSlNPTiIsInN0cmluZ2lmeSIsImZvckVhY2giLCJpdGVtIiwidXJsUGF0aCIsInVybCIsIml0ZW1PYmoiLCJzY3JpcHRDb250ZW50IiwicGF0aCIsInNyaSIsInR5cGUiLCJ3aGVyZSIsInN0YXJ0c1dpdGgiLCJwcmVmaXgiLCJzcGxpdCIsImpvaW4iLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiLCJ0ZW1wbGF0ZSIsIm1vZGUiLCJfcmVmIiwiaHRtbEF0dHJpYnV0ZXMiLCJidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayIsInNyaU1vZGUiLCJkeW5hbWljSGVhZCIsImhlYWRTZWN0aW9ucyIsImNzc0J1bmRsZSIsIm1hcCIsImZpbGUiLCJocmVmIiwiT2JqZWN0Iiwia2V5cyIsImtleSIsImF0dHJOYW1lIiwiYXR0clZhbHVlIiwiX3JlZjIiLCJtZXRlb3JSdW50aW1lQ29uZmlnIiwibWV0ZW9yUnVudGltZUhhc2giLCJyb290VXJsUGF0aFByZWZpeCIsImlubGluZVNjcmlwdHNBbGxvd2VkIiwiYWRkaXRpb25hbFN0YXRpY0pzIiwiY29uZiIsInNyYyIsImhhc2giLCJfcmVmMyIsImNvbnRlbnRzIiwicGF0aG5hbWUiLCJsb2Rhc2hUZW1wbGF0ZSIsInRleHQiLCJldmFsdWF0ZSIsImludGVycG9sYXRlIiwiZXNjYXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBLElBQUlBLGFBQWE7SUFBQ0MsTUFBTSxDQUFDQyxJQUFJLENBQUMsc0NBQXNDLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUNKLGFBQWEs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YUEsQ0FBQSxFQUFHO01BQzlCLE9BQU8sa0JBQWtCO0lBQzNCO0lBQUNnRCxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHOzs7Ozs7Ozs7Ozs7OztJQzlFRG5GLE1BQU0sQ0FBQ0ksTUFBTSxDQUFDO01BQUNGLE9BQU8sRUFBQ0EsQ0FBQSxLQUFJa0Y7SUFBUSxDQUFDLENBQUM7SUFBQyxJQUFJNkIsY0FBYztJQUFDakgsTUFBTSxDQUFDQyxJQUFJLENBQUMsaUJBQWlCLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUM4RyxjQUFjLEdBQUM5RyxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSVEsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFPdEssU0FBU3lFLFFBQVFBLENBQUM4QixJQUFJLEVBQUU7TUFDckMsT0FBT0QsY0FBYyxDQUFDQyxJQUFJLEVBQUUsSUFBSSxFQUFFO1FBQ2hDQyxRQUFRLEVBQU0saUJBQWlCO1FBQy9CQyxXQUFXLEVBQUcsa0JBQWtCO1FBQ2hDQyxNQUFNLEVBQVE7TUFDaEIsQ0FBQyxDQUFDO0lBQ0o7SUFBQztJQUFDckMsc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRyIsImZpbGUiOiIvcGFja2FnZXMvYm9pbGVycGxhdGUtZ2VuZXJhdG9yLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtyZWFkRmlsZVN5bmN9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGNyZWF0ZSBhcyBjcmVhdGVTdHJlYW0gfSBmcm9tIFwiY29tYmluZWQtc3RyZWFtMlwiO1xuXG5pbXBvcnQgV2ViQnJvd3NlclRlbXBsYXRlIGZyb20gJy4vdGVtcGxhdGUtd2ViLmJyb3dzZXInO1xuaW1wb3J0IFdlYkNvcmRvdmFUZW1wbGF0ZSBmcm9tICcuL3RlbXBsYXRlLXdlYi5jb3Jkb3ZhJztcblxuLy8gQ29waWVkIGZyb20gd2ViYXBwX3NlcnZlclxuY29uc3QgcmVhZFV0ZjhGaWxlU3luYyA9IGZpbGVuYW1lID0+IHJlYWRGaWxlU3luYyhmaWxlbmFtZSwgJ3V0ZjgnKTtcblxuY29uc3QgaWRlbnRpdHkgPSB2YWx1ZSA9PiB2YWx1ZTtcblxuZnVuY3Rpb24gYXBwZW5kVG9TdHJlYW0oY2h1bmssIHN0cmVhbSkge1xuICBpZiAodHlwZW9mIGNodW5rID09PSBcInN0cmluZ1wiKSB7XG4gICAgc3RyZWFtLmFwcGVuZChCdWZmZXIuZnJvbShjaHVuaywgXCJ1dGY4XCIpKTtcbiAgfSBlbHNlIGlmIChCdWZmZXIuaXNCdWZmZXIoY2h1bmspIHx8XG4gICAgICAgICAgICAgdHlwZW9mIGNodW5rLnJlYWQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHN0cmVhbS5hcHBlbmQoY2h1bmspO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCb2lsZXJwbGF0ZSB7XG4gIGNvbnN0cnVjdG9yKGFyY2gsIG1hbmlmZXN0LCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IGhlYWRUZW1wbGF0ZSwgY2xvc2VUZW1wbGF0ZSB9ID0gZ2V0VGVtcGxhdGUoYXJjaCk7XG4gICAgdGhpcy5oZWFkVGVtcGxhdGUgPSBoZWFkVGVtcGxhdGU7XG4gICAgdGhpcy5jbG9zZVRlbXBsYXRlID0gY2xvc2VUZW1wbGF0ZTtcbiAgICB0aGlzLmJhc2VEYXRhID0gbnVsbDtcblxuICAgIHRoaXMuX2dlbmVyYXRlQm9pbGVycGxhdGVGcm9tTWFuaWZlc3QoXG4gICAgICBtYW5pZmVzdCxcbiAgICAgIG9wdGlvbnNcbiAgICApO1xuICB9XG5cbiAgdG9IVE1MKGV4dHJhRGF0YSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwiVGhlIEJvaWxlcnBsYXRlI3RvSFRNTCBtZXRob2QgaGFzIGJlZW4gcmVtb3ZlZC4gXCIgK1xuICAgICAgICBcIlBsZWFzZSB1c2UgQm9pbGVycGxhdGUjdG9IVE1MU3RyZWFtIGluc3RlYWQuXCJcbiAgICApO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIFByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhIHN0cmluZyBvZiBIVE1MLlxuICB0b0hUTUxBc3luYyhleHRyYURhdGEpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3Qgc3RyZWFtID0gdGhpcy50b0hUTUxTdHJlYW0oZXh0cmFEYXRhKTtcbiAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgc3RyZWFtLm9uKFwiZGF0YVwiLCBjaHVuayA9PiBjaHVua3MucHVzaChjaHVuaykpO1xuICAgICAgc3RyZWFtLm9uKFwiZW5kXCIsICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShCdWZmZXIuY29uY2F0KGNodW5rcykudG9TdHJpbmcoXCJ1dGY4XCIpKTtcbiAgICAgIH0pO1xuICAgICAgc3RyZWFtLm9uKFwiZXJyb3JcIiwgcmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFRoZSAnZXh0cmFEYXRhJyBhcmd1bWVudCBjYW4gYmUgdXNlZCB0byBleHRlbmQgJ3NlbGYuYmFzZURhdGEnLiBJdHNcbiAgLy8gcHVycG9zZSBpcyB0byBhbGxvdyB5b3UgdG8gc3BlY2lmeSBkYXRhIHRoYXQgeW91IG1pZ2h0IG5vdCBrbm93IGF0XG4gIC8vIHRoZSB0aW1lIHRoYXQgeW91IGNvbnN0cnVjdCB0aGUgQm9pbGVycGxhdGUgb2JqZWN0LiAoZS5nLiBpdCBpcyB1c2VkXG4gIC8vIGJ5ICd3ZWJhcHAnIHRvIHNwZWNpZnkgZGF0YSB0aGF0IGlzIG9ubHkga25vd24gYXQgcmVxdWVzdC10aW1lKS5cbiAgLy8gdGhpcyByZXR1cm5zIGEgc3RyZWFtXG4gIHRvSFRNTFN0cmVhbShleHRyYURhdGEpIHtcbiAgICBpZiAoIXRoaXMuYmFzZURhdGEgfHwgIXRoaXMuaGVhZFRlbXBsYXRlIHx8ICF0aGlzLmNsb3NlVGVtcGxhdGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQm9pbGVycGxhdGUgZGlkIG5vdCBpbnN0YW50aWF0ZSBjb3JyZWN0bHkuJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IHsuLi50aGlzLmJhc2VEYXRhLCAuLi5leHRyYURhdGF9O1xuICAgIGNvbnN0IHN0YXJ0ID0gXCI8IURPQ1RZUEUgaHRtbD5cXG5cIiArIHRoaXMuaGVhZFRlbXBsYXRlKGRhdGEpO1xuXG4gICAgY29uc3QgeyBib2R5LCBkeW5hbWljQm9keSB9ID0gZGF0YTtcblxuICAgIGNvbnN0IGVuZCA9IHRoaXMuY2xvc2VUZW1wbGF0ZShkYXRhKTtcbiAgICBjb25zdCByZXNwb25zZSA9IGNyZWF0ZVN0cmVhbSgpO1xuXG4gICAgYXBwZW5kVG9TdHJlYW0oc3RhcnQsIHJlc3BvbnNlKTtcblxuICAgIGlmIChib2R5KSB7XG4gICAgICBhcHBlbmRUb1N0cmVhbShib2R5LCByZXNwb25zZSk7XG4gICAgfVxuXG4gICAgaWYgKGR5bmFtaWNCb2R5KSB7XG4gICAgICBhcHBlbmRUb1N0cmVhbShkeW5hbWljQm9keSwgcmVzcG9uc2UpO1xuICAgIH1cblxuICAgIGFwcGVuZFRvU3RyZWFtKGVuZCwgcmVzcG9uc2UpO1xuXG4gICAgcmV0dXJuIHJlc3BvbnNlO1xuICB9XG5cbiAgLy8gWFhYIEV4cG9ydGVkIHRvIGFsbG93IGNsaWVudC1zaWRlIG9ubHkgY2hhbmdlcyB0byByZWJ1aWxkIHRoZSBib2lsZXJwbGF0ZVxuICAvLyB3aXRob3V0IHJlcXVpcmluZyBhIGZ1bGwgc2VydmVyIHJlc3RhcnQuXG4gIC8vIFByb2R1Y2VzIGFuIEhUTUwgc3RyaW5nIHdpdGggZ2l2ZW4gbWFuaWZlc3QgYW5kIGJvaWxlcnBsYXRlU291cmNlLlxuICAvLyBPcHRpb25hbGx5IHRha2VzIHVybE1hcHBlciBpbiBjYXNlIHVybHMgZnJvbSBtYW5pZmVzdCBuZWVkIHRvIGJlIHByZWZpeGVkXG4gIC8vIG9yIHJld3JpdHRlbi5cbiAgLy8gT3B0aW9uYWxseSB0YWtlcyBwYXRoTWFwcGVyIGZvciByZXNvbHZpbmcgcmVsYXRpdmUgZmlsZSBzeXN0ZW0gcGF0aHMuXG4gIC8vIE9wdGlvbmFsbHkgYWxsb3dzIHRvIG92ZXJyaWRlIGZpZWxkcyBvZiB0aGUgZGF0YSBjb250ZXh0LlxuICBfZ2VuZXJhdGVCb2lsZXJwbGF0ZUZyb21NYW5pZmVzdChtYW5pZmVzdCwge1xuICAgIHVybE1hcHBlciA9IGlkZW50aXR5LFxuICAgIHBhdGhNYXBwZXIgPSBpZGVudGl0eSxcbiAgICBiYXNlRGF0YUV4dGVuc2lvbixcbiAgICBpbmxpbmUsXG4gIH0gPSB7fSkge1xuXG4gICAgY29uc3QgYm9pbGVycGxhdGVCYXNlRGF0YSA9IHtcbiAgICAgIGNzczogW10sXG4gICAgICBqczogW10sXG4gICAgICBoZWFkOiAnJyxcbiAgICAgIGJvZHk6ICcnLFxuICAgICAgbWV0ZW9yTWFuaWZlc3Q6IEpTT04uc3RyaW5naWZ5KG1hbmlmZXN0KSxcbiAgICAgIC4uLmJhc2VEYXRhRXh0ZW5zaW9uLFxuICAgIH07XG5cbiAgICBtYW5pZmVzdC5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgY29uc3QgdXJsUGF0aCA9IHVybE1hcHBlcihpdGVtLnVybCk7XG4gICAgICBjb25zdCBpdGVtT2JqID0geyB1cmw6IHVybFBhdGggfTtcblxuICAgICAgaWYgKGlubGluZSkge1xuICAgICAgICBpdGVtT2JqLnNjcmlwdENvbnRlbnQgPSByZWFkVXRmOEZpbGVTeW5jKFxuICAgICAgICAgIHBhdGhNYXBwZXIoaXRlbS5wYXRoKSk7XG4gICAgICAgIGl0ZW1PYmouaW5saW5lID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoaXRlbS5zcmkpIHtcbiAgICAgICAgaXRlbU9iai5zcmkgPSBpdGVtLnNyaTtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gJ2NzcycgJiYgaXRlbS53aGVyZSA9PT0gJ2NsaWVudCcpIHtcbiAgICAgICAgYm9pbGVycGxhdGVCYXNlRGF0YS5jc3MucHVzaChpdGVtT2JqKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gJ2pzJyAmJiBpdGVtLndoZXJlID09PSAnY2xpZW50JyAmJlxuICAgICAgICAvLyBEeW5hbWljIEpTIG1vZHVsZXMgc2hvdWxkIG5vdCBiZSBsb2FkZWQgZWFnZXJseSBpbiB0aGVcbiAgICAgICAgLy8gaW5pdGlhbCBIVE1MIG9mIHRoZSBhcHAuXG4gICAgICAgICFpdGVtLnBhdGguc3RhcnRzV2l0aCgnZHluYW1pYy8nKSkge1xuICAgICAgICBib2lsZXJwbGF0ZUJhc2VEYXRhLmpzLnB1c2goaXRlbU9iaik7XG4gICAgICB9XG5cbiAgICAgIGlmIChpdGVtLnR5cGUgPT09ICdoZWFkJykge1xuICAgICAgICBib2lsZXJwbGF0ZUJhc2VEYXRhLmhlYWQgPVxuICAgICAgICAgIHJlYWRVdGY4RmlsZVN5bmMocGF0aE1hcHBlcihpdGVtLnBhdGgpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gJ2JvZHknKSB7XG4gICAgICAgIGJvaWxlcnBsYXRlQmFzZURhdGEuYm9keSA9XG4gICAgICAgICAgcmVhZFV0ZjhGaWxlU3luYyhwYXRoTWFwcGVyKGl0ZW0ucGF0aCkpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5iYXNlRGF0YSA9IGJvaWxlcnBsYXRlQmFzZURhdGE7XG4gIH1cbn07XG5cbi8vIFJldHVybnMgYSB0ZW1wbGF0ZSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCwgcHJvZHVjZXMgdGhlIGJvaWxlcnBsYXRlXG4vLyBodG1sIGFzIGEgc3RyaW5nLlxuZnVuY3Rpb24gZ2V0VGVtcGxhdGUoYXJjaCkge1xuICBjb25zdCBwcmVmaXggPSBhcmNoLnNwbGl0KFwiLlwiLCAyKS5qb2luKFwiLlwiKTtcblxuICBpZiAocHJlZml4ID09PSBcIndlYi5icm93c2VyXCIpIHtcbiAgICByZXR1cm4gV2ViQnJvd3NlclRlbXBsYXRlO1xuICB9XG5cbiAgaWYgKHByZWZpeCA9PT0gXCJ3ZWIuY29yZG92YVwiKSB7XG4gICAgcmV0dXJuIFdlYkNvcmRvdmFUZW1wbGF0ZTtcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGFyY2g6IFwiICsgYXJjaCk7XG59XG4iLCJpbXBvcnQgdGVtcGxhdGUgZnJvbSAnLi90ZW1wbGF0ZSc7XG5cbmNvbnN0IHNyaSA9IChzcmksIG1vZGUpID0+XG4gIChzcmkgJiYgbW9kZSkgPyBgIGludGVncml0eT1cInNoYTUxMi0ke3NyaX1cIiBjcm9zc29yaWdpbj1cIiR7bW9kZX1cImAgOiAnJztcblxuZXhwb3J0IGNvbnN0IGhlYWRUZW1wbGF0ZSA9ICh7XG4gIGNzcyxcbiAgaHRtbEF0dHJpYnV0ZXMsXG4gIGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rLFxuICBzcmlNb2RlLFxuICBoZWFkLFxuICBkeW5hbWljSGVhZCxcbn0pID0+IHtcbiAgdmFyIGhlYWRTZWN0aW9ucyA9IGhlYWQuc3BsaXQoLzxtZXRlb3ItYnVuZGxlZC1jc3NbXjw+XSo+LywgMik7XG4gIHZhciBjc3NCdW5kbGUgPSBbLi4uKGNzcyB8fCBbXSkubWFwKGZpbGUgPT5cbiAgICB0ZW1wbGF0ZSgnICA8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgdHlwZT1cInRleHQvY3NzXCIgY2xhc3M9XCJfX21ldGVvci1jc3NfX1wiIGhyZWY9XCI8JS0gaHJlZiAlPlwiPCU9IHNyaSAlPj4nKSh7XG4gICAgICBocmVmOiBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayhmaWxlLnVybCksXG4gICAgICBzcmk6IHNyaShmaWxlLnNyaSwgc3JpTW9kZSksXG4gICAgfSlcbiAgKV0uam9pbignXFxuJyk7XG5cbiAgcmV0dXJuIFtcbiAgICAnPGh0bWwnICsgT2JqZWN0LmtleXMoaHRtbEF0dHJpYnV0ZXMgfHwge30pLm1hcChcbiAgICAgIGtleSA9PiB0ZW1wbGF0ZSgnIDwlPSBhdHRyTmFtZSAlPj1cIjwlLSBhdHRyVmFsdWUgJT5cIicpKHtcbiAgICAgICAgYXR0ck5hbWU6IGtleSxcbiAgICAgICAgYXR0clZhbHVlOiBodG1sQXR0cmlidXRlc1trZXldLFxuICAgICAgfSlcbiAgICApLmpvaW4oJycpICsgJz4nLFxuXG4gICAgJzxoZWFkPicsXG5cbiAgICAoaGVhZFNlY3Rpb25zLmxlbmd0aCA9PT0gMSlcbiAgICAgID8gW2Nzc0J1bmRsZSwgaGVhZFNlY3Rpb25zWzBdXS5qb2luKCdcXG4nKVxuICAgICAgOiBbaGVhZFNlY3Rpb25zWzBdLCBjc3NCdW5kbGUsIGhlYWRTZWN0aW9uc1sxXV0uam9pbignXFxuJyksXG5cbiAgICBkeW5hbWljSGVhZCxcbiAgICAnPC9oZWFkPicsXG4gICAgJzxib2R5PicsXG4gIF0uam9pbignXFxuJyk7XG59O1xuXG4vLyBUZW1wbGF0ZSBmdW5jdGlvbiBmb3IgcmVuZGVyaW5nIHRoZSBib2lsZXJwbGF0ZSBodG1sIGZvciBicm93c2Vyc1xuZXhwb3J0IGNvbnN0IGNsb3NlVGVtcGxhdGUgPSAoe1xuICBtZXRlb3JSdW50aW1lQ29uZmlnLFxuICBtZXRlb3JSdW50aW1lSGFzaCxcbiAgcm9vdFVybFBhdGhQcmVmaXgsXG4gIGlubGluZVNjcmlwdHNBbGxvd2VkLFxuICBqcyxcbiAgYWRkaXRpb25hbFN0YXRpY0pzLFxuICBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayxcbiAgc3JpTW9kZSxcbn0pID0+IFtcbiAgJycsXG4gIGlubGluZVNjcmlwdHNBbGxvd2VkXG4gICAgPyB0ZW1wbGF0ZSgnICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIj5fX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fID0gSlNPTi5wYXJzZShkZWNvZGVVUklDb21wb25lbnQoPCU9IGNvbmYgJT4pKTwvc2NyaXB0PicpKHtcbiAgICAgIGNvbmY6IG1ldGVvclJ1bnRpbWVDb25maWcsXG4gICAgfSlcbiAgICA6IHRlbXBsYXRlKCcgIDxzY3JpcHQgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiIHNyYz1cIjwlLSBzcmMgJT4vbWV0ZW9yX3J1bnRpbWVfY29uZmlnLmpzP2hhc2g9PCUtIGhhc2ggJT5cIj48L3NjcmlwdD4nKSh7XG4gICAgICBzcmM6IHJvb3RVcmxQYXRoUHJlZml4LFxuICAgICAgaGFzaDogbWV0ZW9yUnVudGltZUhhc2gsXG4gICAgfSksXG4gICcnLFxuXG4gIC4uLihqcyB8fCBbXSkubWFwKGZpbGUgPT5cbiAgICB0ZW1wbGF0ZSgnICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIiBzcmM9XCI8JS0gc3JjICU+XCI8JT0gc3JpICU+Pjwvc2NyaXB0PicpKHtcbiAgICAgIHNyYzogYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2soZmlsZS51cmwpLFxuICAgICAgc3JpOiBzcmkoZmlsZS5zcmksIHNyaU1vZGUpLFxuICAgIH0pXG4gICksXG5cbiAgLi4uKGFkZGl0aW9uYWxTdGF0aWNKcyB8fCBbXSkubWFwKCh7IGNvbnRlbnRzLCBwYXRobmFtZSB9KSA9PiAoXG4gICAgaW5saW5lU2NyaXB0c0FsbG93ZWRcbiAgICAgID8gdGVtcGxhdGUoJyAgPHNjcmlwdD48JT0gY29udGVudHMgJT48L3NjcmlwdD4nKSh7XG4gICAgICAgIGNvbnRlbnRzLFxuICAgICAgfSlcbiAgICAgIDogdGVtcGxhdGUoJyAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCIgc3JjPVwiPCUtIHNyYyAlPlwiPjwvc2NyaXB0PicpKHtcbiAgICAgICAgc3JjOiByb290VXJsUGF0aFByZWZpeCArIHBhdGhuYW1lLFxuICAgICAgfSlcbiAgKSksXG5cbiAgJycsXG4gICcnLFxuICAnPC9ib2R5PicsXG4gICc8L2h0bWw+J1xuXS5qb2luKCdcXG4nKTtcbiIsImltcG9ydCB0ZW1wbGF0ZSBmcm9tICcuL3RlbXBsYXRlJztcblxuLy8gVGVtcGxhdGUgZnVuY3Rpb24gZm9yIHJlbmRlcmluZyB0aGUgYm9pbGVycGxhdGUgaHRtbCBmb3IgY29yZG92YVxuZXhwb3J0IGNvbnN0IGhlYWRUZW1wbGF0ZSA9ICh7XG4gIG1ldGVvclJ1bnRpbWVDb25maWcsXG4gIHJvb3RVcmxQYXRoUHJlZml4LFxuICBpbmxpbmVTY3JpcHRzQWxsb3dlZCxcbiAgY3NzLFxuICBqcyxcbiAgYWRkaXRpb25hbFN0YXRpY0pzLFxuICBodG1sQXR0cmlidXRlcyxcbiAgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2ssXG4gIGhlYWQsXG4gIGR5bmFtaWNIZWFkLFxufSkgPT4ge1xuICB2YXIgaGVhZFNlY3Rpb25zID0gaGVhZC5zcGxpdCgvPG1ldGVvci1idW5kbGVkLWNzc1tePD5dKj4vLCAyKTtcbiAgdmFyIGNzc0J1bmRsZSA9IFtcbiAgICAvLyBXZSBhcmUgZXhwbGljaXRseSBub3QgdXNpbmcgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2s6IGluIGNvcmRvdmEgd2Ugc2VydmUgYXNzZXRzIHVwIGRpcmVjdGx5IGZyb20gZGlzaywgc28gcmV3cml0aW5nIHRoZSBVUkwgZG9lcyBub3QgbWFrZSBzZW5zZVxuICAgIC4uLihjc3MgfHwgW10pLm1hcChmaWxlID0+XG4gICAgICB0ZW1wbGF0ZSgnICA8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgdHlwZT1cInRleHQvY3NzXCIgY2xhc3M9XCJfX21ldGVvci1jc3NfX1wiIGhyZWY9XCI8JS0gaHJlZiAlPlwiPicpKHtcbiAgICAgICAgaHJlZjogZmlsZS51cmwsXG4gICAgICB9KVxuICApXS5qb2luKCdcXG4nKTtcblxuICByZXR1cm4gW1xuICAgICc8aHRtbD4nLFxuICAgICc8aGVhZD4nLFxuICAgICcgIDxtZXRhIGNoYXJzZXQ9XCJ1dGYtOFwiPicsXG4gICAgJyAgPG1ldGEgbmFtZT1cImZvcm1hdC1kZXRlY3Rpb25cIiBjb250ZW50PVwidGVsZXBob25lPW5vXCI+JyxcbiAgICAnICA8bWV0YSBuYW1lPVwidmlld3BvcnRcIiBjb250ZW50PVwidXNlci1zY2FsYWJsZT1ubywgaW5pdGlhbC1zY2FsZT0xLCBtYXhpbXVtLXNjYWxlPTEsIG1pbmltdW0tc2NhbGU9MSwgd2lkdGg9ZGV2aWNlLXdpZHRoLCBoZWlnaHQ9ZGV2aWNlLWhlaWdodCwgdmlld3BvcnQtZml0PWNvdmVyXCI+JyxcbiAgICAnICA8bWV0YSBuYW1lPVwibXNhcHBsaWNhdGlvbi10YXAtaGlnaGxpZ2h0XCIgY29udGVudD1cIm5vXCI+JyxcbiAgICAnICA8bWV0YSBodHRwLWVxdWl2PVwiQ29udGVudC1TZWN1cml0eS1Qb2xpY3lcIiBjb250ZW50PVwiZGVmYXVsdC1zcmMgKiBhbmRyb2lkLXdlYnZpZXctdmlkZW8tcG9zdGVyOiBnYXA6IGRhdGE6IGJsb2I6IFxcJ3Vuc2FmZS1pbmxpbmVcXCcgXFwndW5zYWZlLWV2YWxcXCcgd3M6IHdzczo7XCI+JyxcblxuICAoaGVhZFNlY3Rpb25zLmxlbmd0aCA9PT0gMSlcbiAgICA/IFtjc3NCdW5kbGUsIGhlYWRTZWN0aW9uc1swXV0uam9pbignXFxuJylcbiAgICA6IFtoZWFkU2VjdGlvbnNbMF0sIGNzc0J1bmRsZSwgaGVhZFNlY3Rpb25zWzFdXS5qb2luKCdcXG4nKSxcblxuICAgICcgIDxzY3JpcHQgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiPicsXG4gICAgdGVtcGxhdGUoJyAgICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fID0gSlNPTi5wYXJzZShkZWNvZGVVUklDb21wb25lbnQoPCU9IGNvbmYgJT4pKTsnKSh7XG4gICAgICBjb25mOiBtZXRlb3JSdW50aW1lQ29uZmlnLFxuICAgIH0pLFxuICAgICcgICAgaWYgKC9BbmRyb2lkL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSkgeycsXG4gICAgLy8gV2hlbiBBbmRyb2lkIGFwcCBpcyBlbXVsYXRlZCwgaXQgY2Fubm90IGNvbm5lY3QgdG8gbG9jYWxob3N0LFxuICAgIC8vIGluc3RlYWQgaXQgc2hvdWxkIGNvbm5lY3QgdG8gMTAuMC4yLjJcbiAgICAvLyAodW5sZXNzIHdlXFwncmUgdXNpbmcgYW4gaHR0cCBwcm94eTsgdGhlbiBpdCB3b3JrcyEpXG4gICAgJyAgICAgIGlmICghX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5odHRwUHJveHlQb3J0KSB7JyxcbiAgICAnICAgICAgICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMID0gKF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkwgfHwgXFwnXFwnKS5yZXBsYWNlKC9sb2NhbGhvc3QvaSwgXFwnMTAuMC4yLjJcXCcpOycsXG4gICAgJyAgICAgICAgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCA9IChfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMIHx8IFxcJ1xcJykucmVwbGFjZSgvbG9jYWxob3N0L2ksIFxcJzEwLjAuMi4yXFwnKTsnLFxuICAgICcgICAgICB9JyxcbiAgICAnICAgIH0nLFxuICAgICcgIDwvc2NyaXB0PicsXG4gICAgJycsXG4gICAgJyAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCIgc3JjPVwiL2NvcmRvdmEuanNcIj48L3NjcmlwdD4nLFxuXG4gICAgLi4uKGpzIHx8IFtdKS5tYXAoZmlsZSA9PlxuICAgICAgdGVtcGxhdGUoJyAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCIgc3JjPVwiPCUtIHNyYyAlPlwiPjwvc2NyaXB0PicpKHtcbiAgICAgICAgc3JjOiBmaWxlLnVybCxcbiAgICAgIH0pXG4gICAgKSxcblxuICAgIC4uLihhZGRpdGlvbmFsU3RhdGljSnMgfHwgW10pLm1hcCgoeyBjb250ZW50cywgcGF0aG5hbWUgfSkgPT4gKFxuICAgICAgaW5saW5lU2NyaXB0c0FsbG93ZWRcbiAgICAgICAgPyB0ZW1wbGF0ZSgnICA8c2NyaXB0PjwlPSBjb250ZW50cyAlPjwvc2NyaXB0PicpKHtcbiAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgfSlcbiAgICAgICAgOiB0ZW1wbGF0ZSgnICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIiBzcmM9XCI8JS0gc3JjICU+XCI+PC9zY3JpcHQ+Jykoe1xuICAgICAgICAgIHNyYzogcm9vdFVybFBhdGhQcmVmaXggKyBwYXRobmFtZVxuICAgICAgICB9KVxuICAgICkpLFxuICAgICcnLFxuICAgICc8L2hlYWQ+JyxcbiAgICAnJyxcbiAgICAnPGJvZHk+JyxcbiAgXS5qb2luKCdcXG4nKTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZVRlbXBsYXRlKCkge1xuICByZXR1cm4gXCI8L2JvZHk+XFxuPC9odG1sPlwiO1xufVxuIiwiaW1wb3J0IGxvZGFzaFRlbXBsYXRlIGZyb20gJ2xvZGFzaC50ZW1wbGF0ZSc7XG5cbi8vIEFzIGlkZW50aWZpZWQgaW4gaXNzdWUgIzkxNDksIHdoZW4gYW4gYXBwbGljYXRpb24gb3ZlcnJpZGVzIHRoZSBkZWZhdWx0XG4vLyBfLnRlbXBsYXRlIHNldHRpbmdzIHVzaW5nIF8udGVtcGxhdGVTZXR0aW5ncywgdGhvc2UgbmV3IHNldHRpbmdzIGFyZVxuLy8gdXNlZCBhbnl3aGVyZSBfLnRlbXBsYXRlIGlzIHVzZWQsIGluY2x1ZGluZyB3aXRoaW4gdGhlXG4vLyBib2lsZXJwbGF0ZS1nZW5lcmF0b3IuIFRvIGhhbmRsZSB0aGlzLCBfLnRlbXBsYXRlIHNldHRpbmdzIHRoYXQgaGF2ZVxuLy8gYmVlbiB2ZXJpZmllZCB0byB3b3JrIGFyZSBvdmVycmlkZGVuIGhlcmUgb24gZWFjaCBfLnRlbXBsYXRlIGNhbGwuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB0ZW1wbGF0ZSh0ZXh0KSB7XG4gIHJldHVybiBsb2Rhc2hUZW1wbGF0ZSh0ZXh0LCBudWxsLCB7XG4gICAgZXZhbHVhdGUgICAgOiAvPCUoW1xcc1xcU10rPyklPi9nLFxuICAgIGludGVycG9sYXRlIDogLzwlPShbXFxzXFxTXSs/KSU+L2csXG4gICAgZXNjYXBlICAgICAgOiAvPCUtKFtcXHNcXFNdKz8pJT4vZyxcbiAgfSk7XG59OyJdfQ==
