Package["core-runtime"].queue("autoupdate",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Autoupdate;

var require = meteorInstall({"node_modules":{"meteor":{"autoupdate":{"autoupdate_server.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/autoupdate/autoupdate_server.js                                                                       //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
!module.wrapAsync(async function (module1, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module1.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    module1.export({
      Autoupdate: () => Autoupdate
    });
    let ClientVersions;
    module1.link("./client_versions.js", {
      ClientVersions(v) {
        ClientVersions = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const Autoupdate = __meteor_runtime_config__.autoupdate = {
      // Map from client architectures (web.browser, web.browser.legacy,
      // web.cordova) to version fields { version, versionRefreshable,
      // versionNonRefreshable, refreshable } that will be stored in
      // ClientVersions documents (whose IDs are client architectures). This
      // data gets serialized into the boilerplate because it's stored in
      // __meteor_runtime_config__.autoupdate.versions.
      versions: {}
    };
    // Stores acceptable client versions.
    const clientVersions = new ClientVersions();

    // The client hash includes __meteor_runtime_config__, so wait until
    // all packages have loaded and have had a chance to populate the
    // runtime config before using the client hash as our default auto
    // update version id.

    // Note: Tests allow people to override Autoupdate.autoupdateVersion before
    // startup.
    Autoupdate.autoupdateVersion = null;
    Autoupdate.autoupdateVersionRefreshable = null;
    Autoupdate.autoupdateVersionCordova = null;
    Autoupdate.appId = __meteor_runtime_config__.appId = process.env.APP_ID;
    var syncQueue = new Meteor._AsynchronousQueue();
    async function updateVersions(shouldReloadClientProgram) {
      // Step 1: load the current client program on the server
      if (shouldReloadClientProgram) {
        await WebAppInternals.reloadClientPrograms();
      }
      const {
        // If the AUTOUPDATE_VERSION environment variable is defined, it takes
        // precedence, but Autoupdate.autoupdateVersion is still supported as
        // a fallback. In most cases neither of these values will be defined.
        AUTOUPDATE_VERSION = Autoupdate.autoupdateVersion
      } = process.env;

      // Step 2: update __meteor_runtime_config__.autoupdate.versions.
      const clientArchs = Object.keys(WebApp.clientPrograms);
      clientArchs.forEach(arch => {
        Autoupdate.versions[arch] = {
          version: AUTOUPDATE_VERSION || WebApp.calculateClientHash(arch),
          versionRefreshable: AUTOUPDATE_VERSION || WebApp.calculateClientHashRefreshable(arch),
          versionNonRefreshable: AUTOUPDATE_VERSION || WebApp.calculateClientHashNonRefreshable(arch),
          versionReplaceable: AUTOUPDATE_VERSION || WebApp.calculateClientHashReplaceable(arch),
          versionHmr: WebApp.clientPrograms[arch].hmrVersion
        };
      });

      // Step 3: form the new client boilerplate which contains the updated
      // assets and __meteor_runtime_config__.
      if (shouldReloadClientProgram) {
        await WebAppInternals.generateBoilerplate();
      }

      // Step 4: update the ClientVersions collection.
      // We use `onListening` here because we need to use
      // `WebApp.getRefreshableAssets`, which is only set after
      // `WebApp.generateBoilerplate` is called by `main` in webapp.
      WebApp.onListening(() => {
        clientArchs.forEach(arch => {
          const payload = _objectSpread(_objectSpread({}, Autoupdate.versions[arch]), {}, {
            assets: WebApp.getRefreshableAssets(arch)
          });
          clientVersions.set(arch, payload);
        });
      });
    }
    Meteor.publish("meteor_autoupdate_clientVersions", function (appId) {
      // `null` happens when a client doesn't have an appId and passes
      // `undefined` to `Meteor.subscribe`. `undefined` is translated to
      // `null` as JSON doesn't have `undefined.
      check(appId, Match.OneOf(String, undefined, null));

      // Don't notify clients using wrong appId such as mobile apps built with a
      // different server but pointing at the same local url
      if (Autoupdate.appId && appId && Autoupdate.appId !== appId) return [];
      const stop = clientVersions.watch((version, isNew) => {
        (isNew ? this.added : this.changed).call(this, "meteor_autoupdate_clientVersions", version._id, version);
      });
      this.onStop(() => stop());
      this.ready();
    }, {
      is_auto: true
    });
    Meteor.startup(async function () {
      await updateVersions(false);

      // Force any connected clients that are still looking for these older
      // document IDs to reload.
      ["version", "version-refreshable", "version-cordova"].forEach(_id => {
        clientVersions.set(_id, {
          version: "outdated"
        });
      });
    });
    function enqueueVersionsRefresh() {
      syncQueue.queueTask(async function () {
        await updateVersions(true);
      });
    }
    const setupListeners = () => {
      let onMessage;
      module1.link("meteor/inter-process-messaging", {
        onMessage(v) {
          onMessage = v;
        }
      }, 1);
      onMessage("client-refresh", enqueueVersionsRefresh);

      // Another way to tell the process to refresh: send SIGHUP signal
      process.on('SIGHUP', Meteor.bindEnvironment(function () {
        enqueueVersionsRefresh();
      }, "handling SIGHUP signal for refresh"));
    };
    if (Meteor._isFibersEnabled) {
      var Future = Npm.require("fibers/future");
      var fut = new Future();

      // We only want 'refresh' to trigger 'updateVersions' AFTER onListen,
      // so we add a queued task that waits for onListen before 'refresh' can queue
      // tasks. Note that the `onListening` callbacks do not fire until after
      // Meteor.startup, so there is no concern that the 'updateVersions' calls from
      // 'refresh' will overlap with the `updateVersions` call from Meteor.startup.

      syncQueue.queueTask(function () {
        fut.wait();
      });
      WebApp.onListening(function () {
        fut.return();
      });
      setupListeners();
    } else {
      WebApp.onListening(function () {
        Promise.resolve(setupListeners());
      });
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"client_versions.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/autoupdate/client_versions.js                                                                         //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
      ClientVersions: () => ClientVersions
    });
    let Tracker;
    module.link("meteor/tracker", {
      Tracker(v) {
        Tracker = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class ClientVersions {
      constructor() {
        this._versions = new Map();
        this._watchCallbacks = new Set();
      }

      // Creates a Livedata store for use with `Meteor.connection.registerStore`.
      // After the store is registered, document updates reported by Livedata are
      // merged with the documents in this `ClientVersions` instance.
      createStore() {
        return {
          update: _ref => {
            let {
              id,
              msg,
              fields
            } = _ref;
            if (msg === "added" || msg === "changed") {
              this.set(id, fields);
            }
          }
        };
      }
      hasVersions() {
        return this._versions.size > 0;
      }
      get(id) {
        return this._versions.get(id);
      }

      // Adds or updates a version document and invokes registered callbacks for the
      // added/updated document. If a document with the given ID already exists, its
      // fields are merged with `fields`.
      set(id, fields) {
        let version = this._versions.get(id);
        let isNew = false;
        if (version) {
          Object.assign(version, fields);
        } else {
          version = _objectSpread({
            _id: id
          }, fields);
          isNew = true;
          this._versions.set(id, version);
        }
        this._watchCallbacks.forEach(_ref2 => {
          let {
            fn,
            filter
          } = _ref2;
          if (!filter || filter === version._id) {
            fn(version, isNew);
          }
        });
      }

      // Registers a callback that will be invoked when a version document is added
      // or changed. Calling the function returned by `watch` removes the callback.
      // If `skipInitial` is true, the callback isn't be invoked for existing
      // documents. If `filter` is set, the callback is only invoked for documents
      // with ID `filter`.
      watch(fn) {
        let {
          skipInitial,
          filter
        } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (!skipInitial) {
          const resolved = Promise.resolve();
          this._versions.forEach(version => {
            if (!filter || filter === version._id) {
              resolved.then(() => fn(version, true));
            }
          });
        }
        const callback = {
          fn,
          filter
        };
        this._watchCallbacks.add(callback);
        return () => this._watchCallbacks.delete(callback);
      }

      // A reactive data source for `Autoupdate.newClientAvailable`.
      newClientAvailable(id, fields, currentVersion) {
        function isNewVersion(version) {
          return version._id === id && fields.some(field => version[field] !== currentVersion[field]);
        }
        const dependency = new Tracker.Dependency();
        const version = this.get(id);
        dependency.depend();
        const stop = this.watch(version => {
          if (isNewVersion(version)) {
            dependency.changed();
            stop();
          }
        }, {
          skipInitial: true
        });
        return !!version && isNewVersion(version);
      }
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      Autoupdate: Autoupdate
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/autoupdate/autoupdate_server.js"
  ],
  mainModulePath: "/node_modules/meteor/autoupdate/autoupdate_server.js"
}});

//# sourceURL=meteor://💻app/packages/autoupdate.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYXV0b3VwZGF0ZS9hdXRvdXBkYXRlX3NlcnZlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYXV0b3VwZGF0ZS9jbGllbnRfdmVyc2lvbnMuanMiXSwibmFtZXMiOlsiX29iamVjdFNwcmVhZCIsIm1vZHVsZTEiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJleHBvcnQiLCJBdXRvdXBkYXRlIiwiQ2xpZW50VmVyc2lvbnMiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsIl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18iLCJhdXRvdXBkYXRlIiwidmVyc2lvbnMiLCJjbGllbnRWZXJzaW9ucyIsImF1dG91cGRhdGVWZXJzaW9uIiwiYXV0b3VwZGF0ZVZlcnNpb25SZWZyZXNoYWJsZSIsImF1dG91cGRhdGVWZXJzaW9uQ29yZG92YSIsImFwcElkIiwicHJvY2VzcyIsImVudiIsIkFQUF9JRCIsInN5bmNRdWV1ZSIsIk1ldGVvciIsIl9Bc3luY2hyb25vdXNRdWV1ZSIsInVwZGF0ZVZlcnNpb25zIiwic2hvdWxkUmVsb2FkQ2xpZW50UHJvZ3JhbSIsIldlYkFwcEludGVybmFscyIsInJlbG9hZENsaWVudFByb2dyYW1zIiwiQVVUT1VQREFURV9WRVJTSU9OIiwiY2xpZW50QXJjaHMiLCJPYmplY3QiLCJrZXlzIiwiV2ViQXBwIiwiY2xpZW50UHJvZ3JhbXMiLCJmb3JFYWNoIiwiYXJjaCIsInZlcnNpb24iLCJjYWxjdWxhdGVDbGllbnRIYXNoIiwidmVyc2lvblJlZnJlc2hhYmxlIiwiY2FsY3VsYXRlQ2xpZW50SGFzaFJlZnJlc2hhYmxlIiwidmVyc2lvbk5vblJlZnJlc2hhYmxlIiwiY2FsY3VsYXRlQ2xpZW50SGFzaE5vblJlZnJlc2hhYmxlIiwidmVyc2lvblJlcGxhY2VhYmxlIiwiY2FsY3VsYXRlQ2xpZW50SGFzaFJlcGxhY2VhYmxlIiwidmVyc2lvbkhtciIsImhtclZlcnNpb24iLCJnZW5lcmF0ZUJvaWxlcnBsYXRlIiwib25MaXN0ZW5pbmciLCJwYXlsb2FkIiwiYXNzZXRzIiwiZ2V0UmVmcmVzaGFibGVBc3NldHMiLCJzZXQiLCJwdWJsaXNoIiwiY2hlY2siLCJNYXRjaCIsIk9uZU9mIiwiU3RyaW5nIiwidW5kZWZpbmVkIiwic3RvcCIsIndhdGNoIiwiaXNOZXciLCJhZGRlZCIsImNoYW5nZWQiLCJjYWxsIiwiX2lkIiwib25TdG9wIiwicmVhZHkiLCJpc19hdXRvIiwic3RhcnR1cCIsImVucXVldWVWZXJzaW9uc1JlZnJlc2giLCJxdWV1ZVRhc2siLCJzZXR1cExpc3RlbmVycyIsIm9uTWVzc2FnZSIsIm9uIiwiYmluZEVudmlyb25tZW50IiwiX2lzRmliZXJzRW5hYmxlZCIsIkZ1dHVyZSIsIk5wbSIsInJlcXVpcmUiLCJmdXQiLCJ3YWl0IiwicmV0dXJuIiwiUHJvbWlzZSIsInJlc29sdmUiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiLCJtb2R1bGUiLCJUcmFja2VyIiwiY29uc3RydWN0b3IiLCJfdmVyc2lvbnMiLCJNYXAiLCJfd2F0Y2hDYWxsYmFja3MiLCJTZXQiLCJjcmVhdGVTdG9yZSIsInVwZGF0ZSIsIl9yZWYiLCJpZCIsIm1zZyIsImZpZWxkcyIsImhhc1ZlcnNpb25zIiwic2l6ZSIsImdldCIsImFzc2lnbiIsIl9yZWYyIiwiZm4iLCJmaWx0ZXIiLCJza2lwSW5pdGlhbCIsImFyZ3VtZW50cyIsImxlbmd0aCIsInJlc29sdmVkIiwidGhlbiIsImNhbGxiYWNrIiwiYWRkIiwiZGVsZXRlIiwibmV3Q2xpZW50QXZhaWxhYmxlIiwiY3VycmVudFZlcnNpb24iLCJpc05ld1ZlcnNpb24iLCJzb21lIiwiZmllbGQiLCJkZXBlbmRlbmN5IiwiRGVwZW5kZW5jeSIsImRlcGVuZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsYUFBYTtJQUFDQyxPQUFPLENBQUNDLElBQUksQ0FBQyxz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LEtBQUtILGNBQWMsQ0FBQ0csS0FBSyxDQUFDLENBQUM7UUFFcEU7UUFFQSxNQUFNQyxVQUFVLEdBQUcsSUFBSWhDLE9BQU8sQ0FBQ2lDLFVBQVUsQ0FBQyxDQUFDO1FBQzNDLE1BQU10RixPQUFPLEdBQUcsSUFBSSxDQUFDbUUsR0FBRyxDQUFDTCxFQUFFLENBQUM7UUFFNUJ1QixVQUFVLENBQUNFLE1BQU0sQ0FBQyxDQUFDO1FBRW5CLE1BQU1qRSxJQUFJLEdBQUcsSUFBSSxDQUFDQyxLQUFLLENBQ3BCdkIsT0FBTyxJQUFLO1VBQ1gsSUFBSWtGLFlBQVksQ0FBQ2xGLE9BQU8sQ0FBQyxFQUFFO1lBQ3pCcUYsVUFBVSxDQUFDM0QsT0FBTyxDQUFDLENBQUM7WUFDcEJKLElBQUksQ0FBQyxDQUFDO1VBQ1I7UUFDRixDQUFDLEVBQ0Q7VUFBRWtELFdBQVcsRUFBRTtRQUFLLENBQ3RCLENBQUM7UUFFRCxPQUFPLENBQUMsQ0FBRXhFLE9BQU8sSUFBSWtGLFlBQVksQ0FBQ2xGLE9BQU8sQ0FBQztNQUM1QztJQUNGO0lBQUNnRCxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9hdXRvdXBkYXRlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gUHVibGlzaCB0aGUgY3VycmVudCBjbGllbnQgdmVyc2lvbnMgZm9yIGVhY2ggY2xpZW50IGFyY2hpdGVjdHVyZVxuLy8gKHdlYi5icm93c2VyLCB3ZWIuYnJvd3Nlci5sZWdhY3ksIHdlYi5jb3Jkb3ZhKS4gV2hlbiBhIGNsaWVudCBvYnNlcnZlc1xuLy8gYSBjaGFuZ2UgaW4gdGhlIHZlcnNpb25zIGFzc29jaWF0ZWQgd2l0aCBpdHMgY2xpZW50IGFyY2hpdGVjdHVyZSxcbi8vIGl0IHdpbGwgcmVmcmVzaCBpdHNlbGYsIGVpdGhlciBieSBzd2FwcGluZyBvdXQgQ1NTIGFzc2V0cyBvciBieVxuLy8gcmVsb2FkaW5nIHRoZSBwYWdlLiBDaGFuZ2VzIHRvIHRoZSByZXBsYWNlYWJsZSB2ZXJzaW9uIGFyZSBpZ25vcmVkXG4vLyBhbmQgaGFuZGxlZCBieSB0aGUgaG90LW1vZHVsZS1yZXBsYWNlbWVudCBwYWNrYWdlLlxuLy9cbi8vIFRoZXJlIGFyZSBmb3VyIHZlcnNpb25zIGZvciBhbnkgZ2l2ZW4gY2xpZW50IGFyY2hpdGVjdHVyZTogYHZlcnNpb25gLFxuLy8gYHZlcnNpb25SZWZyZXNoYWJsZWAsIGB2ZXJzaW9uTm9uUmVmcmVzaGFibGVgLCBhbmRcbi8vIGB2ZXJzaW9uUmVwbGFjZWFibGVgLiBUaGUgcmVmcmVzaGFibGUgdmVyc2lvbiBpcyBhIGhhc2ggb2YganVzdCB0aGVcbi8vIGNsaWVudCByZXNvdXJjZXMgdGhhdCBhcmUgcmVmcmVzaGFibGUsIHN1Y2ggYXMgQ1NTLiBUaGUgcmVwbGFjZWFibGVcbi8vIHZlcnNpb24gaXMgYSBoYXNoIG9mIGZpbGVzIHRoYXQgY2FuIGJlIHVwZGF0ZWQgd2l0aCBITVIuIFRoZVxuLy8gbm9uLXJlZnJlc2hhYmxlIHZlcnNpb24gaXMgYSBoYXNoIG9mIHRoZSByZXN0IG9mIHRoZSBjbGllbnQgYXNzZXRzLFxuLy8gZXhjbHVkaW5nIHRoZSByZWZyZXNoYWJsZSBvbmVzOiBIVE1MLCBKUyB0aGF0IGlzIG5vdCByZXBsYWNlYWJsZSwgYW5kXG4vLyBzdGF0aWMgZmlsZXMgaW4gdGhlIGBwdWJsaWNgIGRpcmVjdG9yeS4gVGhlIGB2ZXJzaW9uYCB2ZXJzaW9uIGlzIGFcbi8vIGNvbWJpbmVkIGhhc2ggb2YgZXZlcnl0aGluZy5cbi8vXG4vLyBJZiB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgYEFVVE9VUERBVEVfVkVSU0lPTmAgaXMgc2V0LCBpdCB3aWxsIGJlXG4vLyB1c2VkIGluIHBsYWNlIG9mIGFsbCBjbGllbnQgdmVyc2lvbnMuIFlvdSBjYW4gdXNlIHRoaXMgdmFyaWFibGUgdG9cbi8vIGNvbnRyb2wgd2hlbiB0aGUgY2xpZW50IHJlbG9hZHMuIEZvciBleGFtcGxlLCBpZiB5b3Ugd2FudCB0byBmb3JjZSBhXG4vLyByZWxvYWQgb25seSBhZnRlciBtYWpvciBjaGFuZ2VzLCB1c2UgYSBjdXN0b20gQVVUT1VQREFURV9WRVJTSU9OIGFuZFxuLy8gY2hhbmdlIGl0IG9ubHkgd2hlbiBzb21ldGhpbmcgd29ydGggcHVzaGluZyB0byBjbGllbnRzIGhhcHBlbnMuXG4vL1xuLy8gVGhlIHNlcnZlciBwdWJsaXNoZXMgYSBgbWV0ZW9yX2F1dG91cGRhdGVfY2xpZW50VmVyc2lvbnNgIGNvbGxlY3Rpb24uXG4vLyBUaGUgSUQgb2YgZWFjaCBkb2N1bWVudCBpcyB0aGUgY2xpZW50IGFyY2hpdGVjdHVyZSwgYW5kIHRoZSBmaWVsZHMgb2Zcbi8vIHRoZSBkb2N1bWVudCBhcmUgdGhlIHZlcnNpb25zIGRlc2NyaWJlZCBhYm92ZS5cblxuaW1wb3J0IHsgQ2xpZW50VmVyc2lvbnMgfSBmcm9tIFwiLi9jbGllbnRfdmVyc2lvbnMuanNcIjtcblxuZXhwb3J0IGNvbnN0IEF1dG91cGRhdGUgPSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLmF1dG91cGRhdGUgPSB7XG4gIC8vIE1hcCBmcm9tIGNsaWVudCBhcmNoaXRlY3R1cmVzICh3ZWIuYnJvd3Nlciwgd2ViLmJyb3dzZXIubGVnYWN5LFxuICAvLyB3ZWIuY29yZG92YSkgdG8gdmVyc2lvbiBmaWVsZHMgeyB2ZXJzaW9uLCB2ZXJzaW9uUmVmcmVzaGFibGUsXG4gIC8vIHZlcnNpb25Ob25SZWZyZXNoYWJsZSwgcmVmcmVzaGFibGUgfSB0aGF0IHdpbGwgYmUgc3RvcmVkIGluXG4gIC8vIENsaWVudFZlcnNpb25zIGRvY3VtZW50cyAod2hvc2UgSURzIGFyZSBjbGllbnQgYXJjaGl0ZWN0dXJlcykuIFRoaXNcbiAgLy8gZGF0YSBnZXRzIHNlcmlhbGl6ZWQgaW50byB0aGUgYm9pbGVycGxhdGUgYmVjYXVzZSBpdCdzIHN0b3JlZCBpblxuICAvLyBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLmF1dG91cGRhdGUudmVyc2lvbnMuXG4gIHZlcnNpb25zOiB7fVxufTtcblxuLy8gU3RvcmVzIGFjY2VwdGFibGUgY2xpZW50IHZlcnNpb25zLlxuY29uc3QgY2xpZW50VmVyc2lvbnMgPSBuZXcgQ2xpZW50VmVyc2lvbnMoKTtcblxuLy8gVGhlIGNsaWVudCBoYXNoIGluY2x1ZGVzIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18sIHNvIHdhaXQgdW50aWxcbi8vIGFsbCBwYWNrYWdlcyBoYXZlIGxvYWRlZCBhbmQgaGF2ZSBoYWQgYSBjaGFuY2UgdG8gcG9wdWxhdGUgdGhlXG4vLyBydW50aW1lIGNvbmZpZyBiZWZvcmUgdXNpbmcgdGhlIGNsaWVudCBoYXNoIGFzIG91ciBkZWZhdWx0IGF1dG9cbi8vIHVwZGF0ZSB2ZXJzaW9uIGlkLlxuXG4vLyBOb3RlOiBUZXN0cyBhbGxvdyBwZW9wbGUgdG8gb3ZlcnJpZGUgQXV0b3VwZGF0ZS5hdXRvdXBkYXRlVmVyc2lvbiBiZWZvcmVcbi8vIHN0YXJ0dXAuXG5BdXRvdXBkYXRlLmF1dG91cGRhdGVWZXJzaW9uID0gbnVsbDtcbkF1dG91cGRhdGUuYXV0b3VwZGF0ZVZlcnNpb25SZWZyZXNoYWJsZSA9IG51bGw7XG5BdXRvdXBkYXRlLmF1dG91cGRhdGVWZXJzaW9uQ29yZG92YSA9IG51bGw7XG5BdXRvdXBkYXRlLmFwcElkID0gX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5hcHBJZCA9IHByb2Nlc3MuZW52LkFQUF9JRDtcblxudmFyIHN5bmNRdWV1ZSA9IG5ldyBNZXRlb3IuX0FzeW5jaHJvbm91c1F1ZXVlKCk7XG5cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVZlcnNpb25zKHNob3VsZFJlbG9hZENsaWVudFByb2dyYW0pIHtcbiAgLy8gU3RlcCAxOiBsb2FkIHRoZSBjdXJyZW50IGNsaWVudCBwcm9ncmFtIG9uIHRoZSBzZXJ2ZXJcbiAgaWYgKHNob3VsZFJlbG9hZENsaWVudFByb2dyYW0pIHtcbiAgICBhd2FpdCBXZWJBcHBJbnRlcm5hbHMucmVsb2FkQ2xpZW50UHJvZ3JhbXMoKTtcbiAgfVxuXG4gIGNvbnN0IHtcbiAgICAvLyBJZiB0aGUgQVVUT1VQREFURV9WRVJTSU9OIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIGRlZmluZWQsIGl0IHRha2VzXG4gICAgLy8gcHJlY2VkZW5jZSwgYnV0IEF1dG91cGRhdGUuYXV0b3VwZGF0ZVZlcnNpb24gaXMgc3RpbGwgc3VwcG9ydGVkIGFzXG4gICAgLy8gYSBmYWxsYmFjay4gSW4gbW9zdCBjYXNlcyBuZWl0aGVyIG9mIHRoZXNlIHZhbHVlcyB3aWxsIGJlIGRlZmluZWQuXG4gICAgQVVUT1VQREFURV9WRVJTSU9OID0gQXV0b3VwZGF0ZS5hdXRvdXBkYXRlVmVyc2lvblxuICB9ID0gcHJvY2Vzcy5lbnY7XG5cbiAgLy8gU3RlcCAyOiB1cGRhdGUgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5hdXRvdXBkYXRlLnZlcnNpb25zLlxuICBjb25zdCBjbGllbnRBcmNocyA9IE9iamVjdC5rZXlzKFdlYkFwcC5jbGllbnRQcm9ncmFtcyk7XG4gIGNsaWVudEFyY2hzLmZvckVhY2goYXJjaCA9PiB7XG4gICAgQXV0b3VwZGF0ZS52ZXJzaW9uc1thcmNoXSA9IHtcbiAgICAgIHZlcnNpb246IEFVVE9VUERBVEVfVkVSU0lPTiB8fFxuICAgICAgICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaChhcmNoKSxcbiAgICAgIHZlcnNpb25SZWZyZXNoYWJsZTogQVVUT1VQREFURV9WRVJTSU9OIHx8XG4gICAgICAgIFdlYkFwcC5jYWxjdWxhdGVDbGllbnRIYXNoUmVmcmVzaGFibGUoYXJjaCksXG4gICAgICB2ZXJzaW9uTm9uUmVmcmVzaGFibGU6IEFVVE9VUERBVEVfVkVSU0lPTiB8fFxuICAgICAgICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaE5vblJlZnJlc2hhYmxlKGFyY2gpLFxuICAgICAgdmVyc2lvblJlcGxhY2VhYmxlOiBBVVRPVVBEQVRFX1ZFUlNJT04gfHxcbiAgICAgICAgV2ViQXBwLmNhbGN1bGF0ZUNsaWVudEhhc2hSZXBsYWNlYWJsZShhcmNoKSxcbiAgICAgIHZlcnNpb25IbXI6IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXS5obXJWZXJzaW9uXG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gU3RlcCAzOiBmb3JtIHRoZSBuZXcgY2xpZW50IGJvaWxlcnBsYXRlIHdoaWNoIGNvbnRhaW5zIHRoZSB1cGRhdGVkXG4gIC8vIGFzc2V0cyBhbmQgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5cbiAgaWYgKHNob3VsZFJlbG9hZENsaWVudFByb2dyYW0pIHtcbiAgICBhd2FpdCBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVCb2lsZXJwbGF0ZSgpO1xuICB9XG5cbiAgLy8gU3RlcCA0OiB1cGRhdGUgdGhlIENsaWVudFZlcnNpb25zIGNvbGxlY3Rpb24uXG4gIC8vIFdlIHVzZSBgb25MaXN0ZW5pbmdgIGhlcmUgYmVjYXVzZSB3ZSBuZWVkIHRvIHVzZVxuICAvLyBgV2ViQXBwLmdldFJlZnJlc2hhYmxlQXNzZXRzYCwgd2hpY2ggaXMgb25seSBzZXQgYWZ0ZXJcbiAgLy8gYFdlYkFwcC5nZW5lcmF0ZUJvaWxlcnBsYXRlYCBpcyBjYWxsZWQgYnkgYG1haW5gIGluIHdlYmFwcC5cbiAgV2ViQXBwLm9uTGlzdGVuaW5nKCgpID0+IHtcbiAgICBjbGllbnRBcmNocy5mb3JFYWNoKGFyY2ggPT4ge1xuICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgLi4uQXV0b3VwZGF0ZS52ZXJzaW9uc1thcmNoXSxcbiAgICAgICAgYXNzZXRzOiBXZWJBcHAuZ2V0UmVmcmVzaGFibGVBc3NldHMoYXJjaCksXG4gICAgICB9O1xuXG4gICAgICBjbGllbnRWZXJzaW9ucy5zZXQoYXJjaCwgcGF5bG9hZCk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5NZXRlb3IucHVibGlzaChcbiAgXCJtZXRlb3JfYXV0b3VwZGF0ZV9jbGllbnRWZXJzaW9uc1wiLFxuICBmdW5jdGlvbiAoYXBwSWQpIHtcbiAgICAvLyBgbnVsbGAgaGFwcGVucyB3aGVuIGEgY2xpZW50IGRvZXNuJ3QgaGF2ZSBhbiBhcHBJZCBhbmQgcGFzc2VzXG4gICAgLy8gYHVuZGVmaW5lZGAgdG8gYE1ldGVvci5zdWJzY3JpYmVgLiBgdW5kZWZpbmVkYCBpcyB0cmFuc2xhdGVkIHRvXG4gICAgLy8gYG51bGxgIGFzIEpTT04gZG9lc24ndCBoYXZlIGB1bmRlZmluZWQuXG4gICAgY2hlY2soYXBwSWQsIE1hdGNoLk9uZU9mKFN0cmluZywgdW5kZWZpbmVkLCBudWxsKSk7XG5cbiAgICAvLyBEb24ndCBub3RpZnkgY2xpZW50cyB1c2luZyB3cm9uZyBhcHBJZCBzdWNoIGFzIG1vYmlsZSBhcHBzIGJ1aWx0IHdpdGggYVxuICAgIC8vIGRpZmZlcmVudCBzZXJ2ZXIgYnV0IHBvaW50aW5nIGF0IHRoZSBzYW1lIGxvY2FsIHVybFxuICAgIGlmIChBdXRvdXBkYXRlLmFwcElkICYmIGFwcElkICYmIEF1dG91cGRhdGUuYXBwSWQgIT09IGFwcElkKVxuICAgICAgcmV0dXJuIFtdO1xuXG4gICAgY29uc3Qgc3RvcCA9IGNsaWVudFZlcnNpb25zLndhdGNoKCh2ZXJzaW9uLCBpc05ldykgPT4ge1xuICAgICAgKGlzTmV3ID8gdGhpcy5hZGRlZCA6IHRoaXMuY2hhbmdlZClcbiAgICAgICAgLmNhbGwodGhpcywgXCJtZXRlb3JfYXV0b3VwZGF0ZV9jbGllbnRWZXJzaW9uc1wiLCB2ZXJzaW9uLl9pZCwgdmVyc2lvbik7XG4gICAgfSk7XG5cbiAgICB0aGlzLm9uU3RvcCgoKSA9PiBzdG9wKCkpO1xuICAgIHRoaXMucmVhZHkoKTtcbiAgfSxcbiAge2lzX2F1dG86IHRydWV9XG4pO1xuXG5NZXRlb3Iuc3RhcnR1cChhc3luYyBmdW5jdGlvbiAoKSB7XG4gIGF3YWl0IHVwZGF0ZVZlcnNpb25zKGZhbHNlKTtcblxuICAvLyBGb3JjZSBhbnkgY29ubmVjdGVkIGNsaWVudHMgdGhhdCBhcmUgc3RpbGwgbG9va2luZyBmb3IgdGhlc2Ugb2xkZXJcbiAgLy8gZG9jdW1lbnQgSURzIHRvIHJlbG9hZC5cbiAgW1widmVyc2lvblwiLFxuICAgXCJ2ZXJzaW9uLXJlZnJlc2hhYmxlXCIsXG4gICBcInZlcnNpb24tY29yZG92YVwiLFxuICBdLmZvckVhY2goX2lkID0+IHtcbiAgICBjbGllbnRWZXJzaW9ucy5zZXQoX2lkLCB7XG4gICAgICB2ZXJzaW9uOiBcIm91dGRhdGVkXCJcbiAgICB9KTtcbiAgfSk7XG59KTtcblxuZnVuY3Rpb24gZW5xdWV1ZVZlcnNpb25zUmVmcmVzaCgpIHtcbiAgc3luY1F1ZXVlLnF1ZXVlVGFzayhhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgYXdhaXQgdXBkYXRlVmVyc2lvbnModHJ1ZSk7XG4gIH0pO1xufVxuXG5jb25zdCBzZXR1cExpc3RlbmVycyA9ICgpID0+IHtcbiAgLy8gTGlzdGVuIGZvciBtZXNzYWdlcyBwZXJ0YWluaW5nIHRvIHRoZSBjbGllbnQtcmVmcmVzaCB0b3BpYy5cbiAgaW1wb3J0IHsgb25NZXNzYWdlIH0gZnJvbSBcIm1ldGVvci9pbnRlci1wcm9jZXNzLW1lc3NhZ2luZ1wiO1xuICBvbk1lc3NhZ2UoXCJjbGllbnQtcmVmcmVzaFwiLCBlbnF1ZXVlVmVyc2lvbnNSZWZyZXNoKTtcblxuICAvLyBBbm90aGVyIHdheSB0byB0ZWxsIHRoZSBwcm9jZXNzIHRvIHJlZnJlc2g6IHNlbmQgU0lHSFVQIHNpZ25hbFxuICBwcm9jZXNzLm9uKCdTSUdIVVAnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uICgpIHtcbiAgICBlbnF1ZXVlVmVyc2lvbnNSZWZyZXNoKCk7XG4gIH0sIFwiaGFuZGxpbmcgU0lHSFVQIHNpZ25hbCBmb3IgcmVmcmVzaFwiKSk7XG59O1xuXG5pZiAoTWV0ZW9yLl9pc0ZpYmVyc0VuYWJsZWQpIHtcbiAgdmFyIEZ1dHVyZSA9IE5wbS5yZXF1aXJlKFwiZmliZXJzL2Z1dHVyZVwiKTtcblxuICB2YXIgZnV0ID0gbmV3IEZ1dHVyZSgpO1xuXG4gIC8vIFdlIG9ubHkgd2FudCAncmVmcmVzaCcgdG8gdHJpZ2dlciAndXBkYXRlVmVyc2lvbnMnIEFGVEVSIG9uTGlzdGVuLFxuICAvLyBzbyB3ZSBhZGQgYSBxdWV1ZWQgdGFzayB0aGF0IHdhaXRzIGZvciBvbkxpc3RlbiBiZWZvcmUgJ3JlZnJlc2gnIGNhbiBxdWV1ZVxuICAvLyB0YXNrcy4gTm90ZSB0aGF0IHRoZSBgb25MaXN0ZW5pbmdgIGNhbGxiYWNrcyBkbyBub3QgZmlyZSB1bnRpbCBhZnRlclxuICAvLyBNZXRlb3Iuc3RhcnR1cCwgc28gdGhlcmUgaXMgbm8gY29uY2VybiB0aGF0IHRoZSAndXBkYXRlVmVyc2lvbnMnIGNhbGxzIGZyb21cbiAgLy8gJ3JlZnJlc2gnIHdpbGwgb3ZlcmxhcCB3aXRoIHRoZSBgdXBkYXRlVmVyc2lvbnNgIGNhbGwgZnJvbSBNZXRlb3Iuc3RhcnR1cC5cblxuICBzeW5jUXVldWUucXVldWVUYXNrKGZ1bmN0aW9uICgpIHtcbiAgICBmdXQud2FpdCgpO1xuICB9KTtcblxuICBXZWJBcHAub25MaXN0ZW5pbmcoZnVuY3Rpb24gKCkge1xuICAgIGZ1dC5yZXR1cm4oKTtcbiAgfSk7XG5cbiAgc2V0dXBMaXN0ZW5lcnMoKTtcblxufSBlbHNlIHtcbiAgV2ViQXBwLm9uTGlzdGVuaW5nKGZ1bmN0aW9uICgpIHtcbiAgICBQcm9taXNlLnJlc29sdmUoc2V0dXBMaXN0ZW5lcnMoKSk7XG4gIH0pO1xufVxuIiwiaW1wb3J0IHsgVHJhY2tlciB9IGZyb20gXCJtZXRlb3IvdHJhY2tlclwiO1xuXG5leHBvcnQgY2xhc3MgQ2xpZW50VmVyc2lvbnMge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl92ZXJzaW9ucyA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLl93YXRjaENhbGxiYWNrcyA9IG5ldyBTZXQoKTtcbiAgfVxuXG4gIC8vIENyZWF0ZXMgYSBMaXZlZGF0YSBzdG9yZSBmb3IgdXNlIHdpdGggYE1ldGVvci5jb25uZWN0aW9uLnJlZ2lzdGVyU3RvcmVgLlxuICAvLyBBZnRlciB0aGUgc3RvcmUgaXMgcmVnaXN0ZXJlZCwgZG9jdW1lbnQgdXBkYXRlcyByZXBvcnRlZCBieSBMaXZlZGF0YSBhcmVcbiAgLy8gbWVyZ2VkIHdpdGggdGhlIGRvY3VtZW50cyBpbiB0aGlzIGBDbGllbnRWZXJzaW9uc2AgaW5zdGFuY2UuXG4gIGNyZWF0ZVN0b3JlKCkge1xuICAgIHJldHVybiB7XG4gICAgICB1cGRhdGU6ICh7IGlkLCBtc2csIGZpZWxkcyB9KSA9PiB7XG4gICAgICAgIGlmIChtc2cgPT09IFwiYWRkZWRcIiB8fCBtc2cgPT09IFwiY2hhbmdlZFwiKSB7XG4gICAgICAgICAgdGhpcy5zZXQoaWQsIGZpZWxkcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgaGFzVmVyc2lvbnMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3ZlcnNpb25zLnNpemUgPiAwO1xuICB9XG5cbiAgZ2V0KGlkKSB7XG4gICAgcmV0dXJuIHRoaXMuX3ZlcnNpb25zLmdldChpZCk7XG4gIH1cblxuICAvLyBBZGRzIG9yIHVwZGF0ZXMgYSB2ZXJzaW9uIGRvY3VtZW50IGFuZCBpbnZva2VzIHJlZ2lzdGVyZWQgY2FsbGJhY2tzIGZvciB0aGVcbiAgLy8gYWRkZWQvdXBkYXRlZCBkb2N1bWVudC4gSWYgYSBkb2N1bWVudCB3aXRoIHRoZSBnaXZlbiBJRCBhbHJlYWR5IGV4aXN0cywgaXRzXG4gIC8vIGZpZWxkcyBhcmUgbWVyZ2VkIHdpdGggYGZpZWxkc2AuXG4gIHNldChpZCwgZmllbGRzKSB7XG4gICAgbGV0IHZlcnNpb24gPSB0aGlzLl92ZXJzaW9ucy5nZXQoaWQpO1xuICAgIGxldCBpc05ldyA9IGZhbHNlO1xuXG4gICAgaWYgKHZlcnNpb24pIHtcbiAgICAgIE9iamVjdC5hc3NpZ24odmVyc2lvbiwgZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmVyc2lvbiA9IHtcbiAgICAgICAgX2lkOiBpZCxcbiAgICAgICAgLi4uZmllbGRzXG4gICAgICB9O1xuXG4gICAgICBpc05ldyA9IHRydWU7XG4gICAgICB0aGlzLl92ZXJzaW9ucy5zZXQoaWQsIHZlcnNpb24pO1xuICAgIH1cblxuICAgIHRoaXMuX3dhdGNoQ2FsbGJhY2tzLmZvckVhY2goKHsgZm4sIGZpbHRlciB9KSA9PiB7XG4gICAgICBpZiAoISBmaWx0ZXIgfHwgZmlsdGVyID09PSB2ZXJzaW9uLl9pZCkge1xuICAgICAgICBmbih2ZXJzaW9uLCBpc05ldyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZWdpc3RlcnMgYSBjYWxsYmFjayB0aGF0IHdpbGwgYmUgaW52b2tlZCB3aGVuIGEgdmVyc2lvbiBkb2N1bWVudCBpcyBhZGRlZFxuICAvLyBvciBjaGFuZ2VkLiBDYWxsaW5nIHRoZSBmdW5jdGlvbiByZXR1cm5lZCBieSBgd2F0Y2hgIHJlbW92ZXMgdGhlIGNhbGxiYWNrLlxuICAvLyBJZiBgc2tpcEluaXRpYWxgIGlzIHRydWUsIHRoZSBjYWxsYmFjayBpc24ndCBiZSBpbnZva2VkIGZvciBleGlzdGluZ1xuICAvLyBkb2N1bWVudHMuIElmIGBmaWx0ZXJgIGlzIHNldCwgdGhlIGNhbGxiYWNrIGlzIG9ubHkgaW52b2tlZCBmb3IgZG9jdW1lbnRzXG4gIC8vIHdpdGggSUQgYGZpbHRlcmAuXG4gIHdhdGNoKGZuLCB7IHNraXBJbml0aWFsLCBmaWx0ZXIgfSA9IHt9KSB7XG4gICAgaWYgKCEgc2tpcEluaXRpYWwpIHtcbiAgICAgIGNvbnN0IHJlc29sdmVkID0gUHJvbWlzZS5yZXNvbHZlKCk7XG5cbiAgICAgIHRoaXMuX3ZlcnNpb25zLmZvckVhY2goKHZlcnNpb24pID0+IHtcbiAgICAgICAgaWYgKCEgZmlsdGVyIHx8IGZpbHRlciA9PT0gdmVyc2lvbi5faWQpIHtcbiAgICAgICAgICByZXNvbHZlZC50aGVuKCgpID0+IGZuKHZlcnNpb24sIHRydWUpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2FsbGJhY2sgPSB7IGZuLCBmaWx0ZXIgfTtcbiAgICB0aGlzLl93YXRjaENhbGxiYWNrcy5hZGQoY2FsbGJhY2spO1xuXG4gICAgcmV0dXJuICgpID0+IHRoaXMuX3dhdGNoQ2FsbGJhY2tzLmRlbGV0ZShjYWxsYmFjayk7XG4gIH1cblxuICAvLyBBIHJlYWN0aXZlIGRhdGEgc291cmNlIGZvciBgQXV0b3VwZGF0ZS5uZXdDbGllbnRBdmFpbGFibGVgLlxuICBuZXdDbGllbnRBdmFpbGFibGUoaWQsIGZpZWxkcywgY3VycmVudFZlcnNpb24pIHtcbiAgICBmdW5jdGlvbiBpc05ld1ZlcnNpb24odmVyc2lvbikge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgdmVyc2lvbi5faWQgPT09IGlkICYmXG4gICAgICAgIGZpZWxkcy5zb21lKChmaWVsZCkgPT4gdmVyc2lvbltmaWVsZF0gIT09IGN1cnJlbnRWZXJzaW9uW2ZpZWxkXSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgZGVwZW5kZW5jeSA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcbiAgICBjb25zdCB2ZXJzaW9uID0gdGhpcy5nZXQoaWQpO1xuXG4gICAgZGVwZW5kZW5jeS5kZXBlbmQoKTtcblxuICAgIGNvbnN0IHN0b3AgPSB0aGlzLndhdGNoKFxuICAgICAgKHZlcnNpb24pID0+IHtcbiAgICAgICAgaWYgKGlzTmV3VmVyc2lvbih2ZXJzaW9uKSkge1xuICAgICAgICAgIGRlcGVuZGVuY3kuY2hhbmdlZCgpO1xuICAgICAgICAgIHN0b3AoKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHsgc2tpcEluaXRpYWw6IHRydWUgfVxuICAgICk7XG5cbiAgICByZXR1cm4gISEgdmVyc2lvbiAmJiBpc05ld1ZlcnNpb24odmVyc2lvbik7XG4gIH1cbn1cbiJdfQ==
