Package["core-runtime"].queue("ddp-client",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Retry = Package.retry.Retry;
var IdMap = Package['id-map'].IdMap;
var ECMAScript = Package.ecmascript.ECMAScript;
var Hook = Package['callback-hook'].Hook;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var options, callback, args, DDP;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-client":{"server":{"server.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/server/server.js                                                                               //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("../common/namespace.js", {
      DDP: "DDP"
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
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

}},"common":{"MethodInvoker.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/MethodInvoker.js                                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
  default: () => MethodInvoker
});
class MethodInvoker {
  constructor(options) {
    // Public (within this file) fields.
    this.methodId = options.methodId;
    this.sentMessage = false;
    this._callback = options.callback;
    this._connection = options.connection;
    this._message = options.message;
    this._onResultReceived = options.onResultReceived || (() => {});
    this._wait = options.wait;
    this.noRetry = options.noRetry;
    this._methodResult = null;
    this._dataVisible = false;

    // Register with the connection.
    this._connection._methodInvokers[this.methodId] = this;
  }
  // Sends the method message to the server. May be called additional times if
  // we lose the connection and reconnect before receiving a result.
  sendMessage() {
    // This function is called before sending a method (including resending on
    // reconnect). We should only (re)send methods where we don't already have a
    // result!
    if (this.gotResult()) throw new Error('sendingMethod is called on method with result');

    // If we're re-sending it, it doesn't matter if data was written the first
    // time.
    this._dataVisible = false;
    this.sentMessage = true;

    // If this is a wait method, make all data messages be buffered until it is
    // done.
    if (this._wait) this._connection._methodsBlockingQuiescence[this.methodId] = true;

    // Actually send the message.
    this._connection._send(this._message);
  }
  // Invoke the callback, if we have both a result and know that all data has
  // been written to the local cache.
  _maybeInvokeCallback() {
    if (this._methodResult && this._dataVisible) {
      // Call the callback. (This won't throw: the callback was wrapped with
      // bindEnvironment.)
      this._callback(this._methodResult[0], this._methodResult[1]);

      // Forget about this method.
      delete this._connection._methodInvokers[this.methodId];

      // Let the connection know that this method is finished, so it can try to
      // move on to the next block of methods.
      this._connection._outstandingMethodFinished();
    }
  }
  // Call with the result of the method from the server. Only may be called
  // once; once it is called, you should not call sendMessage again.
  // If the user provided an onResultReceived callback, call it immediately.
  // Then invoke the main callback if data is also visible.
  receiveResult(err, result) {
    if (this.gotResult()) throw new Error('Methods should only receive results once');
    this._methodResult = [err, result];
    this._onResultReceived(err, result);
    this._maybeInvokeCallback();
  }
  // Call this when all data written by the method is visible. This means that
  // the method has returns its "data is done" message *AND* all server
  // documents that are buffered at that time have been written to the local
  // cache. Invokes the main callback if the result has been received.
  dataVisible() {
    this._dataVisible = true;
    this._maybeInvokeCallback();
  }
  // True if receiveResult has been called.
  gotResult() {
    return !!this._methodResult;
  }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_connection.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/livedata_connection.js                                                                  //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 0);
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 1);
    const _excluded = ["stubInvocation", "invocation"],
      _excluded2 = ["stubInvocation", "invocation"];
    module.export({
      Connection: () => Connection
    });
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 1);
    let Tracker;
    module.link("meteor/tracker", {
      Tracker(v) {
        Tracker = v;
      }
    }, 2);
    let EJSON;
    module.link("meteor/ejson", {
      EJSON(v) {
        EJSON = v;
      }
    }, 3);
    let Random;
    module.link("meteor/random", {
      Random(v) {
        Random = v;
      }
    }, 4);
    let MongoID;
    module.link("meteor/mongo-id", {
      MongoID(v) {
        MongoID = v;
      }
    }, 5);
    let DDP;
    module.link("./namespace.js", {
      DDP(v) {
        DDP = v;
      }
    }, 6);
    let MethodInvoker;
    module.link("./MethodInvoker.js", {
      default(v) {
        MethodInvoker = v;
      }
    }, 7);
    let hasOwn, slice, keys, isEmpty, last;
    module.link("meteor/ddp-common/utils.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      slice(v) {
        slice = v;
      },
      keys(v) {
        keys = v;
      },
      isEmpty(v) {
        isEmpty = v;
      },
      last(v) {
        last = v;
      }
    }, 8);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class MongoIDMap extends IdMap {
      constructor() {
        super(MongoID.idStringify, MongoID.idParse);
      }
    }

    // @param url {String|Object} URL to Meteor app,
    //   or an object as a test hook (see code)
    // Options:
    //   reloadWithOutstanding: is it OK to reload if there are outstanding methods?
    //   headers: extra headers to send on the websockets connection, for
    //     server-to-server DDP only
    //   _sockjsOptions: Specifies options to pass through to the sockjs client
    //   onDDPNegotiationVersionFailure: callback when version negotiation fails.
    //
    // XXX There should be a way to destroy a DDP connection, causing all
    // outstanding method calls to fail.
    //
    // XXX Our current way of handling failure and reconnection is great
    // for an app (where we want to tolerate being disconnected as an
    // expect state, and keep trying forever to reconnect) but cumbersome
    // for something like a command line tool that wants to make a
    // connection, call a method, and print an error if connection
    // fails. We should have better usability in the latter case (while
    // still transparently reconnecting if it's just a transient failure
    // or the server migrating us).
    class Connection {
      constructor(url, options) {
        const self = this;
        this.options = options = _objectSpread({
          onConnected() {},
          onDDPVersionNegotiationFailure(description) {
            Meteor._debug(description);
          },
          heartbeatInterval: 17500,
          heartbeatTimeout: 15000,
          npmFayeOptions: Object.create(null),
          // These options are only for testing.
          reloadWithOutstanding: false,
          supportedDDPVersions: DDPCommon.SUPPORTED_DDP_VERSIONS,
          retry: true,
          respondToPings: true,
          // When updates are coming within this ms interval, batch them together.
          bufferedWritesInterval: 5,
          // Flush buffers immediately if writes are happening continuously for more than this many ms.
          bufferedWritesMaxAge: 500
        }, options);

        // If set, called when we reconnect, queuing method calls _before_ the
        // existing outstanding ones.
        // NOTE: This feature has been preserved for backwards compatibility. The
        // preferred method of setting a callback on reconnect is to use
        // DDP.onReconnect.
        self.onReconnect = null;

        // as a test hook, allow passing a stream instead of a url.
        if (typeof url === 'object') {
          self._stream = url;
        } else {
          let ClientStream;
          module.link("meteor/socket-stream-client", {
            ClientStream(v) {
              ClientStream = v;
            }
          }, 9);
          self._stream = new ClientStream(url, {
            retry: options.retry,
            ConnectionError: DDP.ConnectionError,
            headers: options.headers,
            _sockjsOptions: options._sockjsOptions,
            // Used to keep some tests quiet, or for other cases in which
            // the right thing to do with connection errors is to silently
            // fail (e.g. sending package usage stats). At some point we
            // should have a real API for handling client-stream-level
            // errors.
            _dontPrintErrors: options._dontPrintErrors,
            connectTimeoutMs: options.connectTimeoutMs,
            npmFayeOptions: options.npmFayeOptions
          });
        }
        self._lastSessionId = null;
        self._versionSuggestion = null; // The last proposed DDP version.
        self._version = null; // The DDP version agreed on by client and server.
        self._stores = Object.create(null); // name -> object with methods
        self._methodHandlers = Object.create(null); // name -> func
        self._nextMethodId = 1;
        self._supportedDDPVersions = options.supportedDDPVersions;
        self._heartbeatInterval = options.heartbeatInterval;
        self._heartbeatTimeout = options.heartbeatTimeout;

        // Tracks methods which the user has tried to call but which have not yet
        // called their user callback (ie, they are waiting on their result or for all
        // of their writes to be written to the local cache). Map from method ID to
        // MethodInvoker object.
        self._methodInvokers = Object.create(null);

        // Tracks methods which the user has called but whose result messages have not
        // arrived yet.
        //
        // _outstandingMethodBlocks is an array of blocks of methods. Each block
        // represents a set of methods that can run at the same time. The first block
        // represents the methods which are currently in flight; subsequent blocks
        // must wait for previous blocks to be fully finished before they can be sent
        // to the server.
        //
        // Each block is an object with the following fields:
        // - methods: a list of MethodInvoker objects
        // - wait: a boolean; if true, this block had a single method invoked with
        //         the "wait" option
        //
        // There will never be adjacent blocks with wait=false, because the only thing
        // that makes methods need to be serialized is a wait method.
        //
        // Methods are removed from the first block when their "result" is
        // received. The entire first block is only removed when all of the in-flight
        // methods have received their results (so the "methods" list is empty) *AND*
        // all of the data written by those methods are visible in the local cache. So
        // it is possible for the first block's methods list to be empty, if we are
        // still waiting for some objects to quiesce.
        //
        // Example:
        //  _outstandingMethodBlocks = [
        //    {wait: false, methods: []},
        //    {wait: true, methods: [<MethodInvoker for 'login'>]},
        //    {wait: false, methods: [<MethodInvoker for 'foo'>,
        //                            <MethodInvoker for 'bar'>]}]
        // This means that there were some methods which were sent to the server and
        // which have returned their results, but some of the data written by
        // the methods may not be visible in the local cache. Once all that data is
        // visible, we will send a 'login' method. Once the login method has returned
        // and all the data is visible (including re-running subs if userId changes),
        // we will send the 'foo' and 'bar' methods in parallel.
        self._outstandingMethodBlocks = [];

        // method ID -> array of objects with keys 'collection' and 'id', listing
        // documents written by a given method's stub. keys are associated with
        // methods whose stub wrote at least one document, and whose data-done message
        // has not yet been received.
        self._documentsWrittenByStub = {};
        // collection -> IdMap of "server document" object. A "server document" has:
        // - "document": the version of the document according the
        //   server (ie, the snapshot before a stub wrote it, amended by any changes
        //   received from the server)
        //   It is undefined if we think the document does not exist
        // - "writtenByStubs": a set of method IDs whose stubs wrote to the document
        //   whose "data done" messages have not yet been processed
        self._serverDocuments = {};

        // Array of callbacks to be called after the next update of the local
        // cache. Used for:
        //  - Calling methodInvoker.dataVisible and sub ready callbacks after
        //    the relevant data is flushed.
        //  - Invoking the callbacks of "half-finished" methods after reconnect
        //    quiescence. Specifically, methods whose result was received over the old
        //    connection (so we don't re-send it) but whose data had not been made
        //    visible.
        self._afterUpdateCallbacks = [];

        // In two contexts, we buffer all incoming data messages and then process them
        // all at once in a single update:
        //   - During reconnect, we buffer all data messages until all subs that had
        //     been ready before reconnect are ready again, and all methods that are
        //     active have returned their "data done message"; then
        //   - During the execution of a "wait" method, we buffer all data messages
        //     until the wait method gets its "data done" message. (If the wait method
        //     occurs during reconnect, it doesn't get any special handling.)
        // all data messages are processed in one update.
        //
        // The following fields are used for this "quiescence" process.

        // This buffers the messages that aren't being processed yet.
        self._messagesBufferedUntilQuiescence = [];
        // Map from method ID -> true. Methods are removed from this when their
        // "data done" message is received, and we will not quiesce until it is
        // empty.
        self._methodsBlockingQuiescence = {};
        // map from sub ID -> true for subs that were ready (ie, called the sub
        // ready callback) before reconnect but haven't become ready again yet
        self._subsBeingRevived = {}; // map from sub._id -> true
        // if true, the next data update should reset all stores. (set during
        // reconnect.)
        self._resetStores = false;

        // name -> array of updates for (yet to be created) collections
        self._updatesForUnknownStores = {};
        // if we're blocking a migration, the retry func
        self._retryMigrate = null;
        self.__flushBufferedWrites = Meteor.bindEnvironment(self._flushBufferedWrites, 'flushing DDP buffered writes', self);
        // Collection name -> array of messages.
        self._bufferedWrites = {};
        // When current buffer of updates must be flushed at, in ms timestamp.
        self._bufferedWritesFlushAt = null;
        // Timeout handle for the next processing of all pending writes
        self._bufferedWritesFlushHandle = null;
        self._bufferedWritesInterval = options.bufferedWritesInterval;
        self._bufferedWritesMaxAge = options.bufferedWritesMaxAge;

        // metadata for subscriptions.  Map from sub ID to object with keys:
        //   - id
        //   - name
        //   - params
        //   - inactive (if true, will be cleaned up if not reused in re-run)
        //   - ready (has the 'ready' message been received?)
        //   - readyCallback (an optional callback to call when ready)
        //   - errorCallback (an optional callback to call if the sub terminates with
        //                    an error, XXX COMPAT WITH 1.0.3.1)
        //   - stopCallback (an optional callback to call when the sub terminates
        //     for any reason, with an error argument if an error triggered the stop)
        self._subscriptions = {};

        // Reactive userId.
        self._userId = null;
        self._userIdDeps = new Tracker.Dependency();

        // Block auto-reload while we're waiting for method responses.
        if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {
          Package.reload.Reload._onMigrate(retry => {
            if (!self._readyToMigrate()) {
              self._retryMigrate = retry;
              return [false];
            } else {
              return [true];
            }
          });
        }
        const onDisconnect = () => {
          if (self._heartbeat) {
            self._heartbeat.stop();
            self._heartbeat = null;
          }
        };
        if (Meteor.isServer) {
          self._stream.on('message', Meteor.bindEnvironment(this.onMessage.bind(this), 'handling DDP message'));
          self._stream.on('reset', Meteor.bindEnvironment(this.onReset.bind(this), 'handling DDP reset'));
          self._stream.on('disconnect', Meteor.bindEnvironment(onDisconnect, 'handling DDP disconnect'));
        } else {
          self._stream.on('message', this.onMessage.bind(this));
          self._stream.on('reset', this.onReset.bind(this));
          self._stream.on('disconnect', onDisconnect);
        }
      }

      // 'name' is the name of the data on the wire that should go in the
      // store. 'wrappedStore' should be an object with methods beginUpdate, update,
      // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.
      createStoreMethods(name, wrappedStore) {
        const self = this;
        if (name in self._stores) return false;

        // Wrap the input object in an object which makes any store method not
        // implemented by 'store' into a no-op.
        const store = Object.create(null);
        const keysOfStore = ['update', 'beginUpdate', 'endUpdate', 'saveOriginals', 'retrieveOriginals', 'getDoc', '_getCollection'];
        keysOfStore.forEach(method => {
          store[method] = function () {
            if (wrappedStore[method]) {
              return wrappedStore[method](...arguments);
            }
          };
        });
        self._stores[name] = store;
        return store;
      }
      registerStoreClient(name, wrappedStore) {
        const self = this;
        const store = self.createStoreMethods(name, wrappedStore);
        const queued = self._updatesForUnknownStores[name];
        if (Array.isArray(queued)) {
          store.beginUpdate(queued.length, false);
          queued.forEach(msg => {
            store.update(msg);
          });
          store.endUpdate();
          delete self._updatesForUnknownStores[name];
        }
        return true;
      }
      async registerStoreServer(name, wrappedStore) {
        const self = this;
        const store = self.createStoreMethods(name, wrappedStore);
        const queued = self._updatesForUnknownStores[name];
        if (Array.isArray(queued)) {
          await store.beginUpdate(queued.length, false);
          for (const msg of queued) {
            await store.update(msg);
          }
          await store.endUpdate();
          delete self._updatesForUnknownStores[name];
        }
        return true;
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.subscribe
       * @summary Subscribe to a record set.  Returns a handle that provides
       * `stop()` and `ready()` methods.
       * @locus Client
       * @param {String} name Name of the subscription.  Matches the name of the
       * server's `publish()` call.
       * @param {EJSONable} [arg1,arg2...] Optional arguments passed to publisher
       * function on server.
       * @param {Function|Object} [callbacks] Optional. May include `onStop`
       * and `onReady` callbacks. If there is an error, it is passed as an
       * argument to `onStop`. If a function is passed instead of an object, it
       * is interpreted as an `onReady` callback.
       */
      subscribe(name /* .. [arguments] .. (callback|callbacks) */) {
        const self = this;
        const params = slice.call(arguments, 1);
        let callbacks = Object.create(null);
        if (params.length) {
          const lastParam = params[params.length - 1];
          if (typeof lastParam === 'function') {
            callbacks.onReady = params.pop();
          } else if (lastParam && [lastParam.onReady,
          // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
          // onStop with an error callback instead.
          lastParam.onError, lastParam.onStop].some(f => typeof f === "function")) {
            callbacks = params.pop();
          }
        }

        // Is there an existing sub with the same name and param, run in an
        // invalidated Computation? This will happen if we are rerunning an
        // existing computation.
        //
        // For example, consider a rerun of:
        //
        //     Tracker.autorun(function () {
        //       Meteor.subscribe("foo", Session.get("foo"));
        //       Meteor.subscribe("bar", Session.get("bar"));
        //     });
        //
        // If "foo" has changed but "bar" has not, we will match the "bar"
        // subcribe to an existing inactive subscription in order to not
        // unsub and resub the subscription unnecessarily.
        //
        // We only look for one such sub; if there are N apparently-identical subs
        // being invalidated, we will require N matching subscribe calls to keep
        // them all active.
        const existing = Object.values(self._subscriptions).find(sub => sub.inactive && sub.name === name && EJSON.equals(sub.params, params));
        let id;
        if (existing) {
          id = existing.id;
          existing.inactive = false; // reactivate

          if (callbacks.onReady) {
            // If the sub is not already ready, replace any ready callback with the
            // one provided now. (It's not really clear what users would expect for
            // an onReady callback inside an autorun; the semantics we provide is
            // that at the time the sub first becomes ready, we call the last
            // onReady callback provided, if any.)
            // If the sub is already ready, run the ready callback right away.
            // It seems that users would expect an onReady callback inside an
            // autorun to trigger once the sub first becomes ready and also
            // when re-subs happens.
            if (existing.ready) {
              callbacks.onReady();
            } else {
              existing.readyCallback = callbacks.onReady;
            }
          }

          // XXX COMPAT WITH 1.0.3.1 we used to have onError but now we call
          // onStop with an optional error argument
          if (callbacks.onError) {
            // Replace existing callback if any, so that errors aren't
            // double-reported.
            existing.errorCallback = callbacks.onError;
          }
          if (callbacks.onStop) {
            existing.stopCallback = callbacks.onStop;
          }
        } else {
          // New sub! Generate an id, save it locally, and send message.
          id = Random.id();
          self._subscriptions[id] = {
            id: id,
            name: name,
            params: EJSON.clone(params),
            inactive: false,
            ready: false,
            readyDeps: new Tracker.Dependency(),
            readyCallback: callbacks.onReady,
            // XXX COMPAT WITH 1.0.3.1 #errorCallback
            errorCallback: callbacks.onError,
            stopCallback: callbacks.onStop,
            connection: self,
            remove() {
              delete this.connection._subscriptions[this.id];
              this.ready && this.readyDeps.changed();
            },
            stop() {
              this.connection._sendQueued({
                msg: 'unsub',
                id: id
              });
              this.remove();
              if (callbacks.onStop) {
                callbacks.onStop();
              }
            }
          };
          self._send({
            msg: 'sub',
            id: id,
            name: name,
            params: params
          });
        }

        // return a handle to the application.
        const handle = {
          stop() {
            if (!hasOwn.call(self._subscriptions, id)) {
              return;
            }
            self._subscriptions[id].stop();
          },
          ready() {
            // return false if we've unsubscribed.
            if (!hasOwn.call(self._subscriptions, id)) {
              return false;
            }
            const record = self._subscriptions[id];
            record.readyDeps.depend();
            return record.ready;
          },
          subscriptionId: id
        };
        if (Tracker.active) {
          // We're in a reactive computation, so we'd like to unsubscribe when the
          // computation is invalidated... but not if the rerun just re-subscribes
          // to the same subscription!  When a rerun happens, we use onInvalidate
          // as a change to mark the subscription "inactive" so that it can
          // be reused from the rerun.  If it isn't reused, it's killed from
          // an afterFlush.
          Tracker.onInvalidate(c => {
            if (hasOwn.call(self._subscriptions, id)) {
              self._subscriptions[id].inactive = true;
            }
            Tracker.afterFlush(() => {
              if (hasOwn.call(self._subscriptions, id) && self._subscriptions[id].inactive) {
                handle.stop();
              }
            });
          });
        }
        return handle;
      }

      /**
       * @summary Tells if the method call came from a call or a callAsync.
       * @alias Meteor.isAsyncCall
       * @locus Anywhere
       * @memberOf Meteor
       * @importFromPackage meteor
       * @returns boolean
       */
      isAsyncCall() {
        return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      }
      methods(methods) {
        Object.entries(methods).forEach(_ref => {
          let [name, func] = _ref;
          if (typeof func !== 'function') {
            throw new Error("Method '" + name + "' must be a function");
          }
          if (this._methodHandlers[name]) {
            throw new Error("A method named '" + name + "' is already defined");
          }
          this._methodHandlers[name] = func;
        });
      }
      _getIsSimulation(_ref2) {
        let {
          isFromCallAsync,
          alreadyInSimulation
        } = _ref2;
        if (!isFromCallAsync) {
          return alreadyInSimulation;
        }
        return alreadyInSimulation && DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.call
       * @summary Invokes a method with a sync stub, passing any number of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable} [arg1,arg2...] Optional method arguments
       * @param {Function} [asyncCallback] Optional callback, which is called asynchronously with the error or result after the method is complete. If not provided, the method runs synchronously if possible (see below).
       */
      call(name /* .. [arguments] .. callback */) {
        // if it's a function, the last argument is the result callback,
        // not a parameter to the remote method.
        const args = slice.call(arguments, 1);
        let callback;
        if (args.length && typeof args[args.length - 1] === 'function') {
          callback = args.pop();
        }
        return this.apply(name, args, callback);
      }
      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.callAsync
       * @summary Invokes a method with an async stub, passing any number of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable} [arg1,arg2...] Optional method arguments
       * @returns {Promise}
       */
      callAsync(name /* .. [arguments] .. */) {
        const args = slice.call(arguments, 1);
        if (args.length && typeof args[args.length - 1] === 'function') {
          throw new Error("Meteor.callAsync() does not accept a callback. You should 'await' the result, or use .then().");
        }
        return this.applyAsync(name, args, {
          returnServerResultPromise: true
        });
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.apply
       * @summary Invoke a method passing an array of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable[]} args Method arguments
       * @param {Object} [options]
       * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
       * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
       * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
       * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
       * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
       * @param {Function} [asyncCallback] Optional callback; same semantics as in [`Meteor.call`](#meteor_call).
       */
      apply(name, args, options, callback) {
        const _this$_stubCall = this._stubCall(name, EJSON.clone(args)),
          {
            stubInvocation,
            invocation
          } = _this$_stubCall,
          stubOptions = _objectWithoutProperties(_this$_stubCall, _excluded);
        if (stubOptions.hasStub) {
          if (!this._getIsSimulation({
            alreadyInSimulation: stubOptions.alreadyInSimulation,
            isFromCallAsync: stubOptions.isFromCallAsync
          })) {
            this._saveOriginals();
          }
          try {
            stubOptions.stubReturnValue = DDP._CurrentMethodInvocation.withValue(invocation, stubInvocation);
            if (Meteor._isPromise(stubOptions.stubReturnValue)) {
              Meteor._debug("Method ".concat(name, ": Calling a method that has an async method stub with call/apply can lead to unexpected behaviors. Use callAsync/applyAsync instead."));
            }
          } catch (e) {
            stubOptions.exception = e;
          }
        }
        return this._apply(name, stubOptions, args, options, callback);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.applyAsync
       * @summary Invoke a method passing an array of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable[]} args Method arguments
       * @param {Object} [options]
       * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
       * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
       * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
       * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
       * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
       * @param {Boolean} options.returnServerResultPromise (Client only) If true, the promise returned by applyAsync will resolve to the server's return value, rather than the stub's return value. This is useful when you want to ensure that the server's return value is used, even if the stub returns a promise. The same behavior as `callAsync`.
       */
      applyAsync(name, args, options) {
        let callback = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
        const stubPromise = this._applyAsyncStubInvocation(name, args, options);
        const promise = this._applyAsync({
          name,
          args,
          options,
          callback,
          stubPromise
        });
        if (Meteor.isClient) {
          // only return the stubReturnValue
          promise.stubPromise = stubPromise.then(o => {
            if (o.exception) {
              throw o.exception;
            }
            return o.stubReturnValue;
          });
          // this avoids attribute recursion
          promise.serverPromise = new Promise((resolve, reject) => promise.then(resolve).catch(reject));
        }
        return promise;
      }
      async _applyAsyncStubInvocation(name, args, options) {
        const _this$_stubCall2 = this._stubCall(name, EJSON.clone(args), options),
          {
            stubInvocation,
            invocation
          } = _this$_stubCall2,
          stubOptions = _objectWithoutProperties(_this$_stubCall2, _excluded2);
        if (stubOptions.hasStub) {
          if (!this._getIsSimulation({
            alreadyInSimulation: stubOptions.alreadyInSimulation,
            isFromCallAsync: stubOptions.isFromCallAsync
          })) {
            this._saveOriginals();
          }
          try {
            /*
             * The code below follows the same logic as the function withValues().
             *
             * But as the Meteor package is not compiled by ecmascript, it is unable to use newer syntax in the browser,
             * such as, the async/await.
             *
             * So, to keep supporting old browsers, like IE 11, we're creating the logic one level above.
             */
            const currentContext = DDP._CurrentMethodInvocation._setNewContextAndGetCurrent(invocation);
            try {
              stubOptions.stubReturnValue = await stubInvocation();
            } catch (e) {
              stubOptions.exception = e;
            } finally {
              DDP._CurrentMethodInvocation._set(currentContext);
            }
          } catch (e) {
            stubOptions.exception = e;
          }
        }
        return stubOptions;
      }
      async _applyAsync(_ref3) {
        let {
          name,
          args,
          options,
          callback,
          stubPromise
        } = _ref3;
        const stubOptions = await stubPromise;
        return this._apply(name, stubOptions, args, options, callback);
      }
      _apply(name, stubCallValue, args, options, callback) {
        const self = this;

        // We were passed 3 arguments. They may be either (name, args, options)
        // or (name, args, callback)
        if (!callback && typeof options === 'function') {
          callback = options;
          options = Object.create(null);
        }
        options = options || Object.create(null);
        if (callback) {
          // XXX would it be better form to do the binding in stream.on,
          // or caller, instead of here?
          // XXX improve error message (and how we report it)
          callback = Meteor.bindEnvironment(callback, "delivering result of invoking '" + name + "'");
        }
        const {
          hasStub,
          exception,
          stubReturnValue,
          alreadyInSimulation,
          randomSeed
        } = stubCallValue;

        // Keep our args safe from mutation (eg if we don't send the message for a
        // while because of a wait method).
        args = EJSON.clone(args);
        // If we're in a simulation, stop and return the result we have,
        // rather than going on to do an RPC. If there was no stub,
        // we'll end up returning undefined.
        if (this._getIsSimulation({
          alreadyInSimulation,
          isFromCallAsync: stubCallValue.isFromCallAsync
        })) {
          let result;
          if (callback) {
            callback(exception, stubReturnValue);
          } else {
            if (exception) throw exception;
            result = stubReturnValue;
          }
          return options._returnMethodInvoker ? {
            result
          } : result;
        }

        // We only create the methodId here because we don't actually need one if
        // we're already in a simulation
        const methodId = '' + self._nextMethodId++;
        if (hasStub) {
          self._retrieveAndStoreOriginals(methodId);
        }

        // Generate the DDP message for the method call. Note that on the client,
        // it is important that the stub have finished before we send the RPC, so
        // that we know we have a complete list of which local documents the stub
        // wrote.
        const message = {
          msg: 'method',
          id: methodId,
          method: name,
          params: args
        };

        // If an exception occurred in a stub, and we're ignoring it
        // because we're doing an RPC and want to use what the server
        // returns instead, log it so the developer knows
        // (unless they explicitly ask to see the error).
        //
        // Tests can set the '_expectedByTest' flag on an exception so it won't
        // go to log.
        if (exception) {
          if (options.throwStubExceptions) {
            throw exception;
          } else if (!exception._expectedByTest) {
            Meteor._debug("Exception while simulating the effect of invoking '" + name + "'", exception);
          }
        }

        // At this point we're definitely doing an RPC, and we're going to
        // return the value of the RPC to the caller.

        // If the caller didn't give a callback, decide what to do.
        let promise;
        if (!callback) {
          if (Meteor.isClient && !options.returnServerResultPromise && (!options.isFromCallAsync || options.returnStubValue)) {
            callback = err => {
              err && Meteor._debug("Error invoking Method '" + name + "'", err);
            };
          } else {
            promise = new Promise((resolve, reject) => {
              callback = function () {
                for (var _len = arguments.length, allArgs = new Array(_len), _key = 0; _key < _len; _key++) {
                  allArgs[_key] = arguments[_key];
                }
                let args = Array.from(allArgs);
                let err = args.shift();
                if (err) {
                  reject(err);
                  return;
                }
                resolve(...args);
              };
            });
          }
        }

        // Send the randomSeed only if we used it
        if (randomSeed.value !== null) {
          message.randomSeed = randomSeed.value;
        }
        const methodInvoker = new MethodInvoker({
          methodId,
          callback: callback,
          connection: self,
          onResultReceived: options.onResultReceived,
          wait: !!options.wait,
          message: message,
          noRetry: !!options.noRetry
        });
        let result;
        if (promise) {
          result = options.returnStubValue ? promise.then(() => stubReturnValue) : promise;
        } else {
          result = options.returnStubValue ? stubReturnValue : undefined;
        }
        if (options._returnMethodInvoker) {
          return {
            methodInvoker,
            result
          };
        }
        self._addOutstandingMethod(methodInvoker, options);
        return result;
      }
      _stubCall(name, args, options) {
        // Run the stub, if we have one. The stub is supposed to make some
        // temporary writes to the database to give the user a smooth experience
        // until the actual result of executing the method comes back from the
        // server (whereupon the temporary writes to the database will be reversed
        // during the beginUpdate/endUpdate process.)
        //
        // Normally, we ignore the return value of the stub (even if it is an
        // exception), in favor of the real return value from the server. The
        // exception is if the *caller* is a stub. In that case, we're not going
        // to do a RPC, so we use the return value of the stub as our return
        // value.
        const self = this;
        const enclosing = DDP._CurrentMethodInvocation.get();
        const stub = self._methodHandlers[name];
        const alreadyInSimulation = enclosing === null || enclosing === void 0 ? void 0 : enclosing.isSimulation;
        const isFromCallAsync = enclosing === null || enclosing === void 0 ? void 0 : enclosing._isFromCallAsync;
        const randomSeed = {
          value: null
        };
        const defaultReturn = {
          alreadyInSimulation,
          randomSeed,
          isFromCallAsync
        };
        if (!stub) {
          return _objectSpread(_objectSpread({}, defaultReturn), {}, {
            hasStub: false
          });
        }

        // Lazily generate a randomSeed, only if it is requested by the stub.
        // The random streams only have utility if they're used on both the client
        // and the server; if the client doesn't generate any 'random' values
        // then we don't expect the server to generate any either.
        // Less commonly, the server may perform different actions from the client,
        // and may in fact generate values where the client did not, but we don't
        // have any client-side values to match, so even here we may as well just
        // use a random seed on the server.  In that case, we don't pass the
        // randomSeed to save bandwidth, and we don't even generate it to save a
        // bit of CPU and to avoid consuming entropy.

        const randomSeedGenerator = () => {
          if (randomSeed.value === null) {
            randomSeed.value = DDPCommon.makeRpcSeed(enclosing, name);
          }
          return randomSeed.value;
        };
        const setUserId = userId => {
          self.setUserId(userId);
        };
        const invocation = new DDPCommon.MethodInvocation({
          name,
          isSimulation: true,
          userId: self.userId(),
          isFromCallAsync: options === null || options === void 0 ? void 0 : options.isFromCallAsync,
          setUserId: setUserId,
          randomSeed() {
            return randomSeedGenerator();
          }
        });

        // Note that unlike in the corresponding server code, we never audit
        // that stubs check() their arguments.
        const stubInvocation = () => {
          if (Meteor.isServer) {
            // Because saveOriginals and retrieveOriginals aren't reentrant,
            // don't allow stubs to yield.
            return Meteor._noYieldsAllowed(() => {
              // re-clone, so that the stub can't affect our caller's values
              return stub.apply(invocation, EJSON.clone(args));
            });
          } else {
            return stub.apply(invocation, EJSON.clone(args));
          }
        };
        return _objectSpread(_objectSpread({}, defaultReturn), {}, {
          hasStub: true,
          stubInvocation,
          invocation
        });
      }

      // Before calling a method stub, prepare all stores to track changes and allow
      // _retrieveAndStoreOriginals to get the original versions of changed
      // documents.
      _saveOriginals() {
        if (!this._waitingForQuiescence()) {
          this._flushBufferedWritesClient();
        }
        Object.values(this._stores).forEach(store => {
          store.saveOriginals();
        });
      }

      // Retrieves the original versions of all documents modified by the stub for
      // method 'methodId' from all stores and saves them to _serverDocuments (keyed
      // by document) and _documentsWrittenByStub (keyed by method ID).
      _retrieveAndStoreOriginals(methodId) {
        const self = this;
        if (self._documentsWrittenByStub[methodId]) throw new Error('Duplicate methodId in _retrieveAndStoreOriginals');
        const docsWritten = [];
        Object.entries(self._stores).forEach(_ref4 => {
          let [collection, store] = _ref4;
          const originals = store.retrieveOriginals();
          // not all stores define retrieveOriginals
          if (!originals) return;
          originals.forEach((doc, id) => {
            docsWritten.push({
              collection,
              id
            });
            if (!hasOwn.call(self._serverDocuments, collection)) {
              self._serverDocuments[collection] = new MongoIDMap();
            }
            const serverDoc = self._serverDocuments[collection].setDefault(id, Object.create(null));
            if (serverDoc.writtenByStubs) {
              // We're not the first stub to write this doc. Just add our method ID
              // to the record.
              serverDoc.writtenByStubs[methodId] = true;
            } else {
              // First stub! Save the original value and our method ID.
              serverDoc.document = doc;
              serverDoc.flushCallbacks = [];
              serverDoc.writtenByStubs = Object.create(null);
              serverDoc.writtenByStubs[methodId] = true;
            }
          });
        });
        if (!isEmpty(docsWritten)) {
          self._documentsWrittenByStub[methodId] = docsWritten;
        }
      }

      // This is very much a private function we use to make the tests
      // take up fewer server resources after they complete.
      _unsubscribeAll() {
        Object.values(this._subscriptions).forEach(sub => {
          // Avoid killing the autoupdate subscription so that developers
          // still get hot code pushes when writing tests.
          //
          // XXX it's a hack to encode knowledge about autoupdate here,
          // but it doesn't seem worth it yet to have a special API for
          // subscriptions to preserve after unit tests.
          if (sub.name !== 'meteor_autoupdate_clientVersions') {
            sub.stop();
          }
        });
      }

      // Sends the DDP stringification of the given message object
      _send(obj) {
        this._stream.send(DDPCommon.stringifyDDP(obj));
      }

      // Always queues the call before sending the message
      // Used, for example, on subscription.[id].stop() to make sure a "sub" message is always called before an "unsub" message
      // https://github.com/meteor/meteor/issues/13212
      //
      // This is part of the actual fix for the rest check:
      // https://github.com/meteor/meteor/pull/13236
      _sendQueued(obj) {
        this._send(obj, true);
      }

      // We detected via DDP-level heartbeats that we've lost the
      // connection.  Unlike `disconnect` or `close`, a lost connection
      // will be automatically retried.
      _lostConnection(error) {
        this._stream._lostConnection(error);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.status
       * @summary Get the current connection status. A reactive data source.
       * @locus Client
       */
      status() {
        return this._stream.status(...arguments);
      }

      /**
       * @summary Force an immediate reconnection attempt if the client is not connected to the server.
       This method does nothing if the client is already connected.
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.reconnect
       * @locus Client
       */
      reconnect() {
        return this._stream.reconnect(...arguments);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.disconnect
       * @summary Disconnect the client from the server.
       * @locus Client
       */
      disconnect() {
        return this._stream.disconnect(...arguments);
      }
      close() {
        return this._stream.disconnect({
          _permanent: true
        });
      }

      ///
      /// Reactive user system
      ///
      userId() {
        if (this._userIdDeps) this._userIdDeps.depend();
        return this._userId;
      }
      setUserId(userId) {
        // Avoid invalidating dependents if setUserId is called with current value.
        if (this._userId === userId) return;
        this._userId = userId;
        if (this._userIdDeps) this._userIdDeps.changed();
      }

      // Returns true if we are in a state after reconnect of waiting for subs to be
      // revived or early methods to finish their data, or we are waiting for a
      // "wait" method to finish.
      _waitingForQuiescence() {
        return !isEmpty(this._subsBeingRevived) || !isEmpty(this._methodsBlockingQuiescence);
      }

      // Returns true if any method whose message has been sent to the server has
      // not yet invoked its user callback.
      _anyMethodsAreOutstanding() {
        const invokers = this._methodInvokers;
        return Object.values(invokers).some(invoker => !!invoker.sentMessage);
      }
      async _livedata_connected(msg) {
        const self = this;
        if (self._version !== 'pre1' && self._heartbeatInterval !== 0) {
          self._heartbeat = new DDPCommon.Heartbeat({
            heartbeatInterval: self._heartbeatInterval,
            heartbeatTimeout: self._heartbeatTimeout,
            onTimeout() {
              self._lostConnection(new DDP.ConnectionError('DDP heartbeat timed out'));
            },
            sendPing() {
              self._send({
                msg: 'ping'
              });
            }
          });
          self._heartbeat.start();
        }

        // If this is a reconnect, we'll have to reset all stores.
        if (self._lastSessionId) self._resetStores = true;
        let reconnectedToPreviousSession;
        if (typeof msg.session === 'string') {
          reconnectedToPreviousSession = self._lastSessionId === msg.session;
          self._lastSessionId = msg.session;
        }
        if (reconnectedToPreviousSession) {
          // Successful reconnection -- pick up where we left off.  Note that right
          // now, this never happens: the server never connects us to a previous
          // session, because DDP doesn't provide enough data for the server to know
          // what messages the client has processed. We need to improve DDP to make
          // this possible, at which point we'll probably need more code here.
          return;
        }

        // Server doesn't have our data any more. Re-sync a new session.

        // Forget about messages we were buffering for unknown collections. They'll
        // be resent if still relevant.
        self._updatesForUnknownStores = Object.create(null);
        if (self._resetStores) {
          // Forget about the effects of stubs. We'll be resetting all collections
          // anyway.
          self._documentsWrittenByStub = Object.create(null);
          self._serverDocuments = Object.create(null);
        }

        // Clear _afterUpdateCallbacks.
        self._afterUpdateCallbacks = [];

        // Mark all named subscriptions which are ready (ie, we already called the
        // ready callback) as needing to be revived.
        // XXX We should also block reconnect quiescence until unnamed subscriptions
        //     (eg, autopublish) are done re-publishing to avoid flicker!
        self._subsBeingRevived = Object.create(null);
        Object.entries(self._subscriptions).forEach(_ref5 => {
          let [id, sub] = _ref5;
          if (sub.ready) {
            self._subsBeingRevived[id] = true;
          }
        });

        // Arrange for "half-finished" methods to have their callbacks run, and
        // track methods that were sent on this connection so that we don't
        // quiesce until they are all done.
        //
        // Start by clearing _methodsBlockingQuiescence: methods sent before
        // reconnect don't matter, and any "wait" methods sent on the new connection
        // that we drop here will be restored by the loop below.
        self._methodsBlockingQuiescence = Object.create(null);
        if (self._resetStores) {
          const invokers = self._methodInvokers;
          keys(invokers).forEach(id => {
            const invoker = invokers[id];
            if (invoker.gotResult()) {
              // This method already got its result, but it didn't call its callback
              // because its data didn't become visible. We did not resend the
              // method RPC. We'll call its callback when we get a full quiesce,
              // since that's as close as we'll get to "data must be visible".
              self._afterUpdateCallbacks.push(function () {
                return invoker.dataVisible(...arguments);
              });
            } else if (invoker.sentMessage) {
              // This method has been sent on this connection (maybe as a resend
              // from the last connection, maybe from onReconnect, maybe just very
              // quickly before processing the connected message).
              //
              // We don't need to do anything special to ensure its callbacks get
              // called, but we'll count it as a method which is preventing
              // reconnect quiescence. (eg, it might be a login method that was run
              // from onReconnect, and we don't want to see flicker by seeing a
              // logged-out state.)
              self._methodsBlockingQuiescence[invoker.methodId] = true;
            }
          });
        }
        self._messagesBufferedUntilQuiescence = [];

        // If we're not waiting on any methods or subs, we can reset the stores and
        // call the callbacks immediately.
        if (!self._waitingForQuiescence()) {
          if (self._resetStores) {
            for (const store of Object.values(self._stores)) {
              await store.beginUpdate(0, true);
              await store.endUpdate();
            }
            self._resetStores = false;
          }
          self._runAfterUpdateCallbacks();
        }
      }
      async _processOneDataMessage(msg, updates) {
        const messageType = msg.msg;

        // msg is one of ['added', 'changed', 'removed', 'ready', 'updated']
        if (messageType === 'added') {
          await this._process_added(msg, updates);
        } else if (messageType === 'changed') {
          this._process_changed(msg, updates);
        } else if (messageType === 'removed') {
          this._process_removed(msg, updates);
        } else if (messageType === 'ready') {
          this._process_ready(msg, updates);
        } else if (messageType === 'updated') {
          this._process_updated(msg, updates);
        } else if (messageType === 'nosub') {
          // ignore this
        } else {
          Meteor._debug('discarding unknown livedata data message type', msg);
        }
      }
      async _livedata_data(msg) {
        const self = this;
        if (self._waitingForQuiescence()) {
          self._messagesBufferedUntilQuiescence.push(msg);
          if (msg.msg === 'nosub') {
            delete self._subsBeingRevived[msg.id];
          }
          if (msg.subs) {
            msg.subs.forEach(subId => {
              delete self._subsBeingRevived[subId];
            });
          }
          if (msg.methods) {
            msg.methods.forEach(methodId => {
              delete self._methodsBlockingQuiescence[methodId];
            });
          }
          if (self._waitingForQuiescence()) {
            return;
          }

          // No methods or subs are blocking quiescence!
          // We'll now process and all of our buffered messages, reset all stores,
          // and apply them all at once.

          const bufferedMessages = self._messagesBufferedUntilQuiescence;
          for (const bufferedMessage of Object.values(bufferedMessages)) {
            await self._processOneDataMessage(bufferedMessage, self._bufferedWrites);
          }
          self._messagesBufferedUntilQuiescence = [];
        } else {
          await self._processOneDataMessage(msg, self._bufferedWrites);
        }

        // Immediately flush writes when:
        //  1. Buffering is disabled. Or;
        //  2. any non-(added/changed/removed) message arrives.
        const standardWrite = msg.msg === "added" || msg.msg === "changed" || msg.msg === "removed";
        if (self._bufferedWritesInterval === 0 || !standardWrite) {
          await self._flushBufferedWrites();
          return;
        }
        if (self._bufferedWritesFlushAt === null) {
          self._bufferedWritesFlushAt = new Date().valueOf() + self._bufferedWritesMaxAge;
        } else if (self._bufferedWritesFlushAt < new Date().valueOf()) {
          await self._flushBufferedWrites();
          return;
        }
        if (self._bufferedWritesFlushHandle) {
          clearTimeout(self._bufferedWritesFlushHandle);
        }
        self._bufferedWritesFlushHandle = setTimeout(() => {
          // __flushBufferedWrites is a promise, so with this we can wait the promise to finish
          // before doing something
          self._liveDataWritesPromise = self.__flushBufferedWrites();
          if (Meteor._isPromise(self._liveDataWritesPromise)) {
            self._liveDataWritesPromise.finally(() => self._liveDataWritesPromise = undefined);
          }
        }, self._bufferedWritesInterval);
      }
      _prepareBuffersToFlush() {
        const self = this;
        if (self._bufferedWritesFlushHandle) {
          clearTimeout(self._bufferedWritesFlushHandle);
          self._bufferedWritesFlushHandle = null;
        }
        self._bufferedWritesFlushAt = null;
        // We need to clear the buffer before passing it to
        //  performWrites. As there's no guarantee that it
        //  will exit cleanly.
        const writes = self._bufferedWrites;
        self._bufferedWrites = Object.create(null);
        return writes;
      }
      async _flushBufferedWritesServer() {
        const self = this;
        const writes = self._prepareBuffersToFlush();
        await self._performWritesServer(writes);
      }
      _flushBufferedWritesClient() {
        const self = this;
        const writes = self._prepareBuffersToFlush();
        self._performWritesClient(writes);
      }
      _flushBufferedWrites() {
        const self = this;
        return Meteor.isClient ? self._flushBufferedWritesClient() : self._flushBufferedWritesServer();
      }
      async _performWritesServer(updates) {
        const self = this;
        if (self._resetStores || !isEmpty(updates)) {
          // Begin a transactional update of each store.

          for (const [storeName, store] of Object.entries(self._stores)) {
            await store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
          }
          self._resetStores = false;
          for (const [storeName, updateMessages] of Object.entries(updates)) {
            const store = self._stores[storeName];
            if (store) {
              for (const updateMessage of updateMessages) {
                await store.update(updateMessage);
              }
            } else {
              // Nobody's listening for this data. Queue it up until
              // someone wants it.
              // XXX memory use will grow without bound if you forget to
              // create a collection or just don't care about it... going
              // to have to do something about that.
              const updates = self._updatesForUnknownStores;
              if (!hasOwn.call(updates, storeName)) {
                updates[storeName] = [];
              }
              updates[storeName].push(...updateMessages);
            }
          }
          // End update transaction.
          for (const store of Object.values(self._stores)) {
            await store.endUpdate();
          }
        }
        self._runAfterUpdateCallbacks();
      }
      _performWritesClient(updates) {
        const self = this;
        if (self._resetStores || !isEmpty(updates)) {
          // Begin a transactional update of each store.

          for (const [storeName, store] of Object.entries(self._stores)) {
            store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
          }
          self._resetStores = false;
          for (const [storeName, updateMessages] of Object.entries(updates)) {
            const store = self._stores[storeName];
            if (store) {
              for (const updateMessage of updateMessages) {
                store.update(updateMessage);
              }
            } else {
              // Nobody's listening for this data. Queue it up until
              // someone wants it.
              // XXX memory use will grow without bound if you forget to
              // create a collection or just don't care about it... going
              // to have to do something about that.
              const updates = self._updatesForUnknownStores;
              if (!hasOwn.call(updates, storeName)) {
                updates[storeName] = [];
              }
              updates[storeName].push(...updateMessages);
            }
          }
          // End update transaction.
          for (const store of Object.values(self._stores)) {
            store.endUpdate();
          }
        }
        self._runAfterUpdateCallbacks();
      }

      // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose
      // relevant docs have been flushed, as well as dataVisible callbacks at
      // reconnect-quiescence time.
      _runAfterUpdateCallbacks() {
        const self = this;
        const callbacks = self._afterUpdateCallbacks;
        self._afterUpdateCallbacks = [];
        callbacks.forEach(c => {
          c();
        });
      }
      _pushUpdate(updates, collection, msg) {
        if (!hasOwn.call(updates, collection)) {
          updates[collection] = [];
        }
        updates[collection].push(msg);
      }
      _getServerDoc(collection, id) {
        const self = this;
        if (!hasOwn.call(self._serverDocuments, collection)) {
          return null;
        }
        const serverDocsForCollection = self._serverDocuments[collection];
        return serverDocsForCollection.get(id) || null;
      }
      async _process_added(msg, updates) {
        const self = this;
        const id = MongoID.idParse(msg.id);
        const serverDoc = self._getServerDoc(msg.collection, id);
        if (serverDoc) {
          // Some outstanding stub wrote here.
          const isExisting = serverDoc.document !== undefined;
          serverDoc.document = msg.fields || Object.create(null);
          serverDoc.document._id = id;
          if (self._resetStores) {
            // During reconnect the server is sending adds for existing ids.
            // Always push an update so that document stays in the store after
            // reset. Use current version of the document for this update, so
            // that stub-written values are preserved.
            const currentDoc = await self._stores[msg.collection].getDoc(msg.id);
            if (currentDoc !== undefined) msg.fields = currentDoc;
            self._pushUpdate(updates, msg.collection, msg);
          } else if (isExisting) {
            throw new Error('Server sent add for existing id: ' + msg.id);
          }
        } else {
          self._pushUpdate(updates, msg.collection, msg);
        }
      }
      _process_changed(msg, updates) {
        const self = this;
        const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
        if (serverDoc) {
          if (serverDoc.document === undefined) throw new Error('Server sent changed for nonexisting id: ' + msg.id);
          DiffSequence.applyChanges(serverDoc.document, msg.fields);
        } else {
          self._pushUpdate(updates, msg.collection, msg);
        }
      }
      _process_removed(msg, updates) {
        const self = this;
        const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
        if (serverDoc) {
          // Some outstanding stub wrote here.
          if (serverDoc.document === undefined) throw new Error('Server sent removed for nonexisting id:' + msg.id);
          serverDoc.document = undefined;
        } else {
          self._pushUpdate(updates, msg.collection, {
            msg: 'removed',
            collection: msg.collection,
            id: msg.id
          });
        }
      }
      _process_updated(msg, updates) {
        const self = this;
        // Process "method done" messages.

        msg.methods.forEach(methodId => {
          const docs = self._documentsWrittenByStub[methodId] || {};
          Object.values(docs).forEach(written => {
            const serverDoc = self._getServerDoc(written.collection, written.id);
            if (!serverDoc) {
              throw new Error('Lost serverDoc for ' + JSON.stringify(written));
            }
            if (!serverDoc.writtenByStubs[methodId]) {
              throw new Error('Doc ' + JSON.stringify(written) + ' not written by  method ' + methodId);
            }
            delete serverDoc.writtenByStubs[methodId];
            if (isEmpty(serverDoc.writtenByStubs)) {
              // All methods whose stubs wrote this method have completed! We can
              // now copy the saved document to the database (reverting the stub's
              // change if the server did not write to this object, or applying the
              // server's writes if it did).

              // This is a fake ddp 'replace' message.  It's just for talking
              // between livedata connections and minimongo.  (We have to stringify
              // the ID because it's supposed to look like a wire message.)
              self._pushUpdate(updates, written.collection, {
                msg: 'replace',
                id: MongoID.idStringify(written.id),
                replace: serverDoc.document
              });
              // Call all flush callbacks.

              serverDoc.flushCallbacks.forEach(c => {
                c();
              });

              // Delete this completed serverDocument. Don't bother to GC empty
              // IdMaps inside self._serverDocuments, since there probably aren't
              // many collections and they'll be written repeatedly.
              self._serverDocuments[written.collection].remove(written.id);
            }
          });
          delete self._documentsWrittenByStub[methodId];

          // We want to call the data-written callback, but we can't do so until all
          // currently buffered messages are flushed.
          const callbackInvoker = self._methodInvokers[methodId];
          if (!callbackInvoker) {
            throw new Error('No callback invoker for method ' + methodId);
          }
          self._runWhenAllServerDocsAreFlushed(function () {
            return callbackInvoker.dataVisible(...arguments);
          });
        });
      }
      _process_ready(msg, updates) {
        const self = this;
        // Process "sub ready" messages. "sub ready" messages don't take effect
        // until all current server documents have been flushed to the local
        // database. We can use a write fence to implement this.

        msg.subs.forEach(subId => {
          self._runWhenAllServerDocsAreFlushed(() => {
            const subRecord = self._subscriptions[subId];
            // Did we already unsubscribe?
            if (!subRecord) return;
            // Did we already receive a ready message? (Oops!)
            if (subRecord.ready) return;
            subRecord.ready = true;
            subRecord.readyCallback && subRecord.readyCallback();
            subRecord.readyDeps.changed();
          });
        });
      }

      // Ensures that "f" will be called after all documents currently in
      // _serverDocuments have been written to the local cache. f will not be called
      // if the connection is lost before then!
      _runWhenAllServerDocsAreFlushed(f) {
        const self = this;
        const runFAfterUpdates = () => {
          self._afterUpdateCallbacks.push(f);
        };
        let unflushedServerDocCount = 0;
        const onServerDocFlush = () => {
          --unflushedServerDocCount;
          if (unflushedServerDocCount === 0) {
            // This was the last doc to flush! Arrange to run f after the updates
            // have been applied.
            runFAfterUpdates();
          }
        };
        Object.values(self._serverDocuments).forEach(serverDocuments => {
          serverDocuments.forEach(serverDoc => {
            const writtenByStubForAMethodWithSentMessage = keys(serverDoc.writtenByStubs).some(methodId => {
              const invoker = self._methodInvokers[methodId];
              return invoker && invoker.sentMessage;
            });
            if (writtenByStubForAMethodWithSentMessage) {
              ++unflushedServerDocCount;
              serverDoc.flushCallbacks.push(onServerDocFlush);
            }
          });
        });
        if (unflushedServerDocCount === 0) {
          // There aren't any buffered docs --- we can call f as soon as the current
          // round of updates is applied!
          runFAfterUpdates();
        }
      }
      async _livedata_nosub(msg) {
        const self = this;

        // First pass it through _livedata_data, which only uses it to help get
        // towards quiescence.
        await self._livedata_data(msg);

        // Do the rest of our processing immediately, with no
        // buffering-until-quiescence.

        // we weren't subbed anyway, or we initiated the unsub.
        if (!hasOwn.call(self._subscriptions, msg.id)) {
          return;
        }

        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        const errorCallback = self._subscriptions[msg.id].errorCallback;
        const stopCallback = self._subscriptions[msg.id].stopCallback;
        self._subscriptions[msg.id].remove();
        const meteorErrorFromMsg = msgArg => {
          return msgArg && msgArg.error && new Meteor.Error(msgArg.error.error, msgArg.error.reason, msgArg.error.details);
        };

        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        if (errorCallback && msg.error) {
          errorCallback(meteorErrorFromMsg(msg));
        }
        if (stopCallback) {
          stopCallback(meteorErrorFromMsg(msg));
        }
      }
      async _livedata_result(msg) {
        // id, result or error. error has error (code), reason, details

        const self = this;

        // Lets make sure there are no buffered writes before returning result.
        if (!isEmpty(self._bufferedWrites)) {
          await self._flushBufferedWrites();
        }

        // find the outstanding request
        // should be O(1) in nearly all realistic use cases
        if (isEmpty(self._outstandingMethodBlocks)) {
          Meteor._debug('Received method result but no methods outstanding');
          return;
        }
        const currentMethodBlock = self._outstandingMethodBlocks[0].methods;
        let i;
        const m = currentMethodBlock.find((method, idx) => {
          const found = method.methodId === msg.id;
          if (found) i = idx;
          return found;
        });
        if (!m) {
          Meteor._debug("Can't match method response to original method call", msg);
          return;
        }

        // Remove from current method block. This may leave the block empty, but we
        // don't move on to the next block until the callback has been delivered, in
        // _outstandingMethodFinished.
        currentMethodBlock.splice(i, 1);
        if (hasOwn.call(msg, 'error')) {
          m.receiveResult(new Meteor.Error(msg.error.error, msg.error.reason, msg.error.details));
        } else {
          // msg.result may be undefined if the method didn't return a
          // value
          m.receiveResult(undefined, msg.result);
        }
      }
      _addOutstandingMethod(methodInvoker, options) {
        if (options !== null && options !== void 0 && options.wait) {
          // It's a wait method! Wait methods go in their own block.
          this._outstandingMethodBlocks.push({
            wait: true,
            methods: [methodInvoker]
          });
        } else {
          // Not a wait method. Start a new block if the previous block was a wait
          // block, and add it to the last block of methods.
          if (isEmpty(this._outstandingMethodBlocks) || last(this._outstandingMethodBlocks).wait) {
            this._outstandingMethodBlocks.push({
              wait: false,
              methods: []
            });
          }
          last(this._outstandingMethodBlocks).methods.push(methodInvoker);
        }

        // If we added it to the first block, send it out now.
        if (this._outstandingMethodBlocks.length === 1) {
          methodInvoker.sendMessage();
        }
      }

      // Called by MethodInvoker after a method's callback is invoked.  If this was
      // the last outstanding method in the current block, runs the next block. If
      // there are no more methods, consider accepting a hot code push.
      _outstandingMethodFinished() {
        const self = this;
        if (self._anyMethodsAreOutstanding()) return;

        // No methods are outstanding. This should mean that the first block of
        // methods is empty. (Or it might not exist, if this was a method that
        // half-finished before disconnect/reconnect.)
        if (!isEmpty(self._outstandingMethodBlocks)) {
          const firstBlock = self._outstandingMethodBlocks.shift();
          if (!isEmpty(firstBlock.methods)) throw new Error('No methods outstanding but nonempty block: ' + JSON.stringify(firstBlock));

          // Send the outstanding methods now in the first block.
          if (!isEmpty(self._outstandingMethodBlocks)) self._sendOutstandingMethods();
        }

        // Maybe accept a hot code push.
        self._maybeMigrate();
      }

      // Sends messages for all the methods in the first block in
      // _outstandingMethodBlocks.
      _sendOutstandingMethods() {
        const self = this;
        if (isEmpty(self._outstandingMethodBlocks)) {
          return;
        }
        self._outstandingMethodBlocks[0].methods.forEach(m => {
          m.sendMessage();
        });
      }
      _livedata_error(msg) {
        Meteor._debug('Received error from server: ', msg.reason);
        if (msg.offendingMessage) Meteor._debug('For: ', msg.offendingMessage);
      }
      _sendOutstandingMethodBlocksMessages(oldOutstandingMethodBlocks) {
        const self = this;
        if (isEmpty(oldOutstandingMethodBlocks)) return;

        // We have at least one block worth of old outstanding methods to try
        // again. First: did onReconnect actually send anything? If not, we just
        // restore all outstanding methods and run the first block.
        if (isEmpty(self._outstandingMethodBlocks)) {
          self._outstandingMethodBlocks = oldOutstandingMethodBlocks;
          self._sendOutstandingMethods();
          return;
        }

        // OK, there are blocks on both sides. Special case: merge the last block of
        // the reconnect methods with the first block of the original methods, if
        // neither of them are "wait" blocks.
        if (!last(self._outstandingMethodBlocks).wait && !oldOutstandingMethodBlocks[0].wait) {
          oldOutstandingMethodBlocks[0].methods.forEach(m => {
            last(self._outstandingMethodBlocks).methods.push(m);

            // If this "last block" is also the first block, send the message.
            if (self._outstandingMethodBlocks.length === 1) {
              m.sendMessage();
            }
          });
          oldOutstandingMethodBlocks.shift();
        }

        // Now add the rest of the original blocks on.
        self._outstandingMethodBlocks.push(...oldOutstandingMethodBlocks);
      }
      _callOnReconnectAndSendAppropriateOutstandingMethods() {
        const self = this;
        const oldOutstandingMethodBlocks = self._outstandingMethodBlocks;
        self._outstandingMethodBlocks = [];
        self.onReconnect && self.onReconnect();
        DDP._reconnectHook.each(callback => {
          callback(self);
          return true;
        });
        self._sendOutstandingMethodBlocksMessages(oldOutstandingMethodBlocks);
      }

      // We can accept a hot code push if there are no methods in flight.
      _readyToMigrate() {
        return isEmpty(this._methodInvokers);
      }

      // If we were blocking a migration, see if it's now possible to continue.
      // Call whenever the set of outstanding/blocked methods shrinks.
      _maybeMigrate() {
        const self = this;
        if (self._retryMigrate && self._readyToMigrate()) {
          self._retryMigrate();
          self._retryMigrate = null;
        }
      }
      async onMessage(raw_msg) {
        let msg;
        try {
          msg = DDPCommon.parseDDP(raw_msg);
        } catch (e) {
          Meteor._debug('Exception while parsing DDP', e);
          return;
        }

        // Any message counts as receiving a pong, as it demonstrates that
        // the server is still alive.
        if (this._heartbeat) {
          this._heartbeat.messageReceived();
        }
        if (msg === null || !msg.msg) {
          if (!msg || !msg.testMessageOnConnect) {
            if (Object.keys(msg).length === 1 && msg.server_id) return;
            Meteor._debug('discarding invalid livedata message', msg);
          }
          return;
        }
        if (msg.msg === 'connected') {
          this._version = this._versionSuggestion;
          await this._livedata_connected(msg);
          this.options.onConnected();
        } else if (msg.msg === 'failed') {
          if (this._supportedDDPVersions.indexOf(msg.version) >= 0) {
            this._versionSuggestion = msg.version;
            this._stream.reconnect({
              _force: true
            });
          } else {
            const description = 'DDP version negotiation failed; server requested version ' + msg.version;
            this._stream.disconnect({
              _permanent: true,
              _error: description
            });
            this.options.onDDPVersionNegotiationFailure(description);
          }
        } else if (msg.msg === 'ping' && this.options.respondToPings) {
          this._send({
            msg: 'pong',
            id: msg.id
          });
        } else if (msg.msg === 'pong') {
          // noop, as we assume everything's a pong
        } else if (['added', 'changed', 'removed', 'ready', 'updated'].includes(msg.msg)) {
          await this._livedata_data(msg);
        } else if (msg.msg === 'nosub') {
          await this._livedata_nosub(msg);
        } else if (msg.msg === 'result') {
          await this._livedata_result(msg);
        } else if (msg.msg === 'error') {
          this._livedata_error(msg);
        } else {
          Meteor._debug('discarding unknown livedata message type', msg);
        }
      }
      onReset() {
        // Send a connect message at the beginning of the stream.
        // NOTE: reset is called even on the first connection, so this is
        // the only place we send this message.
        const msg = {
          msg: 'connect'
        };
        if (this._lastSessionId) msg.session = this._lastSessionId;
        msg.version = this._versionSuggestion || this._supportedDDPVersions[0];
        this._versionSuggestion = msg.version;
        msg.support = this._supportedDDPVersions;
        this._send(msg);

        // Mark non-retry calls as failed. This has to be done early as getting these methods out of the
        // current block is pretty important to making sure that quiescence is properly calculated, as
        // well as possibly moving on to another useful block.

        // Only bother testing if there is an outstandingMethodBlock (there might not be, especially if
        // we are connecting for the first time.
        if (this._outstandingMethodBlocks.length > 0) {
          // If there is an outstanding method block, we only care about the first one as that is the
          // one that could have already sent messages with no response, that are not allowed to retry.
          const currentMethodBlock = this._outstandingMethodBlocks[0].methods;
          this._outstandingMethodBlocks[0].methods = currentMethodBlock.filter(methodInvoker => {
            // Methods with 'noRetry' option set are not allowed to re-send after
            // recovering dropped connection.
            if (methodInvoker.sentMessage && methodInvoker.noRetry) {
              // Make sure that the method is told that it failed.
              methodInvoker.receiveResult(new Meteor.Error('invocation-failed', 'Method invocation might have failed due to dropped connection. ' + 'Failing because `noRetry` option was passed to Meteor.apply.'));
            }

            // Only keep a method if it wasn't sent or it's allowed to retry.
            // This may leave the block empty, but we don't move on to the next
            // block until the callback has been delivered, in _outstandingMethodFinished.
            return !(methodInvoker.sentMessage && methodInvoker.noRetry);
          });
        }

        // Now, to minimize setup latency, go ahead and blast out all of
        // our pending methods ands subscriptions before we've even taken
        // the necessary RTT to know if we successfully reconnected. (1)
        // They're supposed to be idempotent, and where they are not,
        // they can block retry in apply; (2) even if we did reconnect,
        // we're not sure what messages might have gotten lost
        // (in either direction) since we were disconnected (TCP being
        // sloppy about that.)

        // If the current block of methods all got their results (but didn't all get
        // their data visible), discard the empty block now.
        if (this._outstandingMethodBlocks.length > 0 && this._outstandingMethodBlocks[0].methods.length === 0) {
          this._outstandingMethodBlocks.shift();
        }

        // Mark all messages as unsent, they have not yet been sent on this
        // connection.
        keys(this._methodInvokers).forEach(id => {
          this._methodInvokers[id].sentMessage = false;
        });

        // If an `onReconnect` handler is set, call it first. Go through
        // some hoops to ensure that methods that are called from within
        // `onReconnect` get executed _before_ ones that were originally
        // outstanding (since `onReconnect` is used to re-establish auth
        // certificates)
        this._callOnReconnectAndSendAppropriateOutstandingMethods();

        // add new subscriptions at the end. this way they take effect after
        // the handlers and we don't see flicker.
        Object.entries(this._subscriptions).forEach(_ref6 => {
          let [id, sub] = _ref6;
          this._sendQueued({
            msg: 'sub',
            id: id,
            name: sub.name,
            params: sub.params
          });
        });
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"namespace.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/namespace.js                                                                            //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      DDP: () => DDP
    });
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 1);
    let Connection;
    module.link("./livedata_connection.js", {
      Connection(v) {
        Connection = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // This array allows the `_allSubscriptionsReady` method below, which
    // is used by the `spiderable` package, to keep track of whether all
    // data is ready.
    const allConnections = [];

    /**
     * @namespace DDP
     * @summary Namespace for DDP-related methods/classes.
     */
    const DDP = {};
    // This is private but it's used in a few places. accounts-base uses
    // it to get the current user. Meteor.setTimeout and friends clear
    // it. We can probably find a better way to factor this.
    DDP._CurrentMethodInvocation = new Meteor.EnvironmentVariable();
    DDP._CurrentPublicationInvocation = new Meteor.EnvironmentVariable();

    // XXX: Keep DDP._CurrentInvocation for backwards-compatibility.
    DDP._CurrentInvocation = DDP._CurrentMethodInvocation;
    DDP._CurrentCallAsyncInvocation = new Meteor.EnvironmentVariable();

    // This is passed into a weird `makeErrorType` function that expects its thing
    // to be a constructor
    function connectionErrorConstructor(message) {
      this.message = message;
    }
    DDP.ConnectionError = Meteor.makeErrorType('DDP.ConnectionError', connectionErrorConstructor);
    DDP.ForcedReconnectError = Meteor.makeErrorType('DDP.ForcedReconnectError', () => {});

    // Returns the named sequence of pseudo-random values.
    // The scope will be DDP._CurrentMethodInvocation.get(), so the stream will produce
    // consistent values for method calls on the client and server.
    DDP.randomStream = name => {
      const scope = DDP._CurrentMethodInvocation.get();
      return DDPCommon.RandomStream.get(scope, name);
    };

    // @param url {String} URL to Meteor app,
    //     e.g.:
    //     "subdomain.meteor.com",
    //     "http://subdomain.meteor.com",
    //     "/",
    //     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"

    /**
     * @summary Connect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.
     * @locus Anywhere
     * @param {String} url The URL of another Meteor application.
     * @param {Object} [options]
     * @param {Boolean} options.reloadWithOutstanding is it OK to reload if there are outstanding methods?
     * @param {Object} options.headers extra headers to send on the websockets connection, for server-to-server DDP only
     * @param {Object} options._sockjsOptions Specifies options to pass through to the sockjs client
     * @param {Function} options.onDDPNegotiationVersionFailure callback when version negotiation fails.
     */
    DDP.connect = (url, options) => {
      const ret = new Connection(url, options);
      allConnections.push(ret); // hack. see below.
      return ret;
    };
    DDP._reconnectHook = new Hook({
      bindEnvironment: false
    });

    /**
     * @summary Register a function to call as the first step of
     * reconnecting. This function can call methods which will be executed before
     * any other outstanding methods. For example, this can be used to re-establish
     * the appropriate authentication context on the connection.
     * @locus Anywhere
     * @param {Function} callback The function to call. It will be called with a
     * single argument, the [connection object](#ddp_connect) that is reconnecting.
     */
    DDP.onReconnect = callback => DDP._reconnectHook.register(callback);

    // Hack for `spiderable` package: a way to see if the page is done
    // loading all the data it needs.
    //
    DDP._allSubscriptionsReady = () => allConnections.every(conn => Object.values(conn._subscriptions).every(sub => sub.ready));
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

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      DDP: DDP
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-client/server/server.js"
  ],
  mainModulePath: "/node_modules/meteor/ddp-client/server/server.js"
}});

//# sourceURL=meteor://💻app/packages/ddp-client.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9NZXRob2RJbnZva2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9saXZlZGF0YV9jb25uZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9uYW1lc3BhY2UuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsIkREUCIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiZXhwb3J0IiwiZGVmYXVsdCIsIk1ldGhvZEludm9rZXIiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJtZXRob2RJZCIsInNlbnRNZXNzYWdlIiwiX2NhbGxiYWNrIiwiY2FsbGJhY2siLCJfY29ubmVjdGlvbiIsImNvbm5lY3Rpb24iLCJfbWVzc2FnZSIsIm1lc3NhZ2UiLCJfb25SZXN1bHRSZWNlaXZlZCIsIm9uUmVzdWx0UmVjZWl2ZWQiLCJfd2FpdCIsIndhaXQiLCJub1JldHJ5IiwiX21ldGhvZFJlc3VsdCIsIl9kYXRhVmlzaWJsZSIsIl9tZXRob2RJbnZva2VycyIsInNlbmRNZXNzYWdlIiwiZ290UmVzdWx0IiwiRXJyb3IiLCJfbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSIsIl9zZW5kIiwiX21heWJlSW52b2tlQ2FsbGJhY2siLCJfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCIsInJlY2VpdmVSZXN1bHQiLCJlcnIiLCJyZXN1bHQiLCJkYXRhVmlzaWJsZSIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllcyIsInYiLCJfb2JqZWN0U3ByZWFkIiwiX2V4Y2x1ZGVkIiwiX2V4Y2x1ZGVkMiIsIkNvbm5lY3Rpb24iLCJNZXRlb3IiLCJERFBDb21tb24iLCJUcmFja2VyIiwiRUpTT04iLCJSYW5kb20iLCJNb25nb0lEIiwiaGFzT3duIiwic2xpY2UiLCJrZXlzIiwiaXNFbXB0eSIsImxhc3QiLCJNb25nb0lETWFwIiwiSWRNYXAiLCJpZFN0cmluZ2lmeSIsImlkUGFyc2UiLCJ1cmwiLCJvbkNvbm5lY3RlZCIsIm9uRERQVmVyc2lvbk5lZ290aWF0aW9uRmFpbHVyZSIsImRlc2NyaXB0aW9uIiwiX2RlYnVnIiwiaGVhcnRiZWF0SW50ZXJ2YWwiLCJoZWFydGJlYXRUaW1lb3V0IiwibnBtRmF5ZU9wdGlvbnMiLCJPYmplY3QiLCJjcmVhdGUiLCJyZWxvYWRXaXRoT3V0c3RhbmRpbmciLCJzdXBwb3J0ZWRERFBWZXJzaW9ucyIsIlNVUFBPUlRFRF9ERFBfVkVSU0lPTlMiLCJyZXRyeSIsInJlc3BvbmRUb1BpbmdzIiwiYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCIsImJ1ZmZlcmVkV3JpdGVzTWF4QWdlIiwib25SZWNvbm5lY3QiLCJfc3RyZWFtIiwiQ2xpZW50U3RyZWFtIiwiQ29ubmVjdGlvbkVycm9yIiwiaGVhZGVycyIsIl9zb2NranNPcHRpb25zIiwiX2RvbnRQcmludEVycm9ycyIsImNvbm5lY3RUaW1lb3V0TXMiLCJfbGFzdFNlc3Npb25JZCIsIl92ZXJzaW9uU3VnZ2VzdGlvbiIsIl92ZXJzaW9uIiwiX3N0b3JlcyIsIl9tZXRob2RIYW5kbGVycyIsIl9uZXh0TWV0aG9kSWQiLCJfc3VwcG9ydGVkRERQVmVyc2lvbnMiLCJfaGVhcnRiZWF0SW50ZXJ2YWwiLCJfaGVhcnRiZWF0VGltZW91dCIsIl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyIsIl9kb2N1bWVudHNXcml0dGVuQnlTdHViIiwiX3NlcnZlckRvY3VtZW50cyIsIl9hZnRlclVwZGF0ZUNhbGxiYWNrcyIsIl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlIiwiX3N1YnNCZWluZ1Jldml2ZWQiLCJfcmVzZXRTdG9yZXMiLCJfdXBkYXRlc0ZvclVua25vd25TdG9yZXMiLCJfcmV0cnlNaWdyYXRlIiwiX19mbHVzaEJ1ZmZlcmVkV3JpdGVzIiwiYmluZEVudmlyb25tZW50IiwiX2ZsdXNoQnVmZmVyZWRXcml0ZXMiLCJfYnVmZmVyZWRXcml0ZXMiLCJfYnVmZmVyZWRXcml0ZXNGbHVzaEF0IiwiX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUiLCJfYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCIsIl9idWZmZXJlZFdyaXRlc01heEFnZSIsIl9zdWJzY3JpcHRpb25zIiwiX3VzZXJJZCIsIl91c2VySWREZXBzIiwiRGVwZW5kZW5jeSIsImlzQ2xpZW50IiwiUGFja2FnZSIsInJlbG9hZCIsIlJlbG9hZCIsIl9vbk1pZ3JhdGUiLCJfcmVhZHlUb01pZ3JhdGUiLCJvbkRpc2Nvbm5lY3QiLCJfaGVhcnRiZWF0Iiwic3RvcCIsImlzU2VydmVyIiwib24iLCJvbk1lc3NhZ2UiLCJiaW5kIiwib25SZXNldCIsImNyZWF0ZVN0b3JlTWV0aG9kcyIsIm5hbWUiLCJ3cmFwcGVkU3RvcmUiLCJzdG9yZSIsImtleXNPZlN0b3JlIiwiZm9yRWFjaCIsIm1ldGhvZCIsImFyZ3VtZW50cyIsInJlZ2lzdGVyU3RvcmVDbGllbnQiLCJxdWV1ZWQiLCJBcnJheSIsImlzQXJyYXkiLCJiZWdpblVwZGF0ZSIsImxlbmd0aCIsIm1zZyIsInVwZGF0ZSIsImVuZFVwZGF0ZSIsInJlZ2lzdGVyU3RvcmVTZXJ2ZXIiLCJzdWJzY3JpYmUiLCJwYXJhbXMiLCJjYWxsIiwiY2FsbGJhY2tzIiwibGFzdFBhcmFtIiwib25SZWFkeSIsInBvcCIsIm9uRXJyb3IiLCJvblN0b3AiLCJzb21lIiwiZiIsImV4aXN0aW5nIiwidmFsdWVzIiwiZmluZCIsInN1YiIsImluYWN0aXZlIiwiZXF1YWxzIiwiaWQiLCJyZWFkeSIsInJlYWR5Q2FsbGJhY2siLCJlcnJvckNhbGxiYWNrIiwic3RvcENhbGxiYWNrIiwiY2xvbmUiLCJyZWFkeURlcHMiLCJyZW1vdmUiLCJjaGFuZ2VkIiwiX3NlbmRRdWV1ZWQiLCJoYW5kbGUiLCJyZWNvcmQiLCJkZXBlbmQiLCJzdWJzY3JpcHRpb25JZCIsImFjdGl2ZSIsIm9uSW52YWxpZGF0ZSIsImMiLCJhZnRlckZsdXNoIiwiaXNBc3luY0NhbGwiLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJfaXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nIiwibWV0aG9kcyIsImVudHJpZXMiLCJfcmVmIiwiZnVuYyIsIl9nZXRJc1NpbXVsYXRpb24iLCJfcmVmMiIsImlzRnJvbUNhbGxBc3luYyIsImFscmVhZHlJblNpbXVsYXRpb24iLCJhcmdzIiwiYXBwbHkiLCJjYWxsQXN5bmMiLCJhcHBseUFzeW5jIiwicmV0dXJuU2VydmVyUmVzdWx0UHJvbWlzZSIsIl90aGlzJF9zdHViQ2FsbCIsIl9zdHViQ2FsbCIsInN0dWJJbnZvY2F0aW9uIiwiaW52b2NhdGlvbiIsInN0dWJPcHRpb25zIiwiaGFzU3R1YiIsIl9zYXZlT3JpZ2luYWxzIiwic3R1YlJldHVyblZhbHVlIiwid2l0aFZhbHVlIiwiX2lzUHJvbWlzZSIsImNvbmNhdCIsImUiLCJleGNlcHRpb24iLCJfYXBwbHkiLCJ1bmRlZmluZWQiLCJzdHViUHJvbWlzZSIsIl9hcHBseUFzeW5jU3R1Ykludm9jYXRpb24iLCJwcm9taXNlIiwiX2FwcGx5QXN5bmMiLCJ0aGVuIiwibyIsInNlcnZlclByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNhdGNoIiwiX3RoaXMkX3N0dWJDYWxsMiIsImN1cnJlbnRDb250ZXh0IiwiX3NldE5ld0NvbnRleHRBbmRHZXRDdXJyZW50IiwiX3NldCIsIl9yZWYzIiwic3R1YkNhbGxWYWx1ZSIsInJhbmRvbVNlZWQiLCJfcmV0dXJuTWV0aG9kSW52b2tlciIsIl9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIiwidGhyb3dTdHViRXhjZXB0aW9ucyIsIl9leHBlY3RlZEJ5VGVzdCIsInJldHVyblN0dWJWYWx1ZSIsIl9sZW4iLCJhbGxBcmdzIiwiX2tleSIsImZyb20iLCJzaGlmdCIsInZhbHVlIiwibWV0aG9kSW52b2tlciIsIl9hZGRPdXRzdGFuZGluZ01ldGhvZCIsImVuY2xvc2luZyIsImdldCIsInN0dWIiLCJpc1NpbXVsYXRpb24iLCJfaXNGcm9tQ2FsbEFzeW5jIiwiZGVmYXVsdFJldHVybiIsInJhbmRvbVNlZWRHZW5lcmF0b3IiLCJtYWtlUnBjU2VlZCIsInNldFVzZXJJZCIsInVzZXJJZCIsIk1ldGhvZEludm9jYXRpb24iLCJfbm9ZaWVsZHNBbGxvd2VkIiwiX3dhaXRpbmdGb3JRdWllc2NlbmNlIiwiX2ZsdXNoQnVmZmVyZWRXcml0ZXNDbGllbnQiLCJzYXZlT3JpZ2luYWxzIiwiZG9jc1dyaXR0ZW4iLCJfcmVmNCIsImNvbGxlY3Rpb24iLCJvcmlnaW5hbHMiLCJyZXRyaWV2ZU9yaWdpbmFscyIsImRvYyIsInB1c2giLCJzZXJ2ZXJEb2MiLCJzZXREZWZhdWx0Iiwid3JpdHRlbkJ5U3R1YnMiLCJkb2N1bWVudCIsImZsdXNoQ2FsbGJhY2tzIiwiX3Vuc3Vic2NyaWJlQWxsIiwib2JqIiwic2VuZCIsInN0cmluZ2lmeUREUCIsIl9sb3N0Q29ubmVjdGlvbiIsImVycm9yIiwic3RhdHVzIiwicmVjb25uZWN0IiwiZGlzY29ubmVjdCIsImNsb3NlIiwiX3Blcm1hbmVudCIsIl9hbnlNZXRob2RzQXJlT3V0c3RhbmRpbmciLCJpbnZva2VycyIsImludm9rZXIiLCJfbGl2ZWRhdGFfY29ubmVjdGVkIiwiSGVhcnRiZWF0Iiwib25UaW1lb3V0Iiwic2VuZFBpbmciLCJzdGFydCIsInJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb24iLCJzZXNzaW9uIiwiX3JlZjUiLCJfcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfcHJvY2Vzc09uZURhdGFNZXNzYWdlIiwidXBkYXRlcyIsIm1lc3NhZ2VUeXBlIiwiX3Byb2Nlc3NfYWRkZWQiLCJfcHJvY2Vzc19jaGFuZ2VkIiwiX3Byb2Nlc3NfcmVtb3ZlZCIsIl9wcm9jZXNzX3JlYWR5IiwiX3Byb2Nlc3NfdXBkYXRlZCIsIl9saXZlZGF0YV9kYXRhIiwic3VicyIsInN1YklkIiwiYnVmZmVyZWRNZXNzYWdlcyIsImJ1ZmZlcmVkTWVzc2FnZSIsInN0YW5kYXJkV3JpdGUiLCJEYXRlIiwidmFsdWVPZiIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJfbGl2ZURhdGFXcml0ZXNQcm9taXNlIiwiZmluYWxseSIsIl9wcmVwYXJlQnVmZmVyc1RvRmx1c2giLCJ3cml0ZXMiLCJfZmx1c2hCdWZmZXJlZFdyaXRlc1NlcnZlciIsIl9wZXJmb3JtV3JpdGVzU2VydmVyIiwiX3BlcmZvcm1Xcml0ZXNDbGllbnQiLCJzdG9yZU5hbWUiLCJ1cGRhdGVNZXNzYWdlcyIsInVwZGF0ZU1lc3NhZ2UiLCJfcHVzaFVwZGF0ZSIsIl9nZXRTZXJ2ZXJEb2MiLCJzZXJ2ZXJEb2NzRm9yQ29sbGVjdGlvbiIsImlzRXhpc3RpbmciLCJmaWVsZHMiLCJfaWQiLCJjdXJyZW50RG9jIiwiZ2V0RG9jIiwiRGlmZlNlcXVlbmNlIiwiYXBwbHlDaGFuZ2VzIiwiZG9jcyIsIndyaXR0ZW4iLCJKU09OIiwic3RyaW5naWZ5IiwicmVwbGFjZSIsImNhbGxiYWNrSW52b2tlciIsIl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQiLCJzdWJSZWNvcmQiLCJydW5GQWZ0ZXJVcGRhdGVzIiwidW5mbHVzaGVkU2VydmVyRG9jQ291bnQiLCJvblNlcnZlckRvY0ZsdXNoIiwic2VydmVyRG9jdW1lbnRzIiwid3JpdHRlbkJ5U3R1YkZvckFNZXRob2RXaXRoU2VudE1lc3NhZ2UiLCJfbGl2ZWRhdGFfbm9zdWIiLCJtZXRlb3JFcnJvckZyb21Nc2ciLCJtc2dBcmciLCJyZWFzb24iLCJkZXRhaWxzIiwiX2xpdmVkYXRhX3Jlc3VsdCIsImN1cnJlbnRNZXRob2RCbG9jayIsImkiLCJtIiwiaWR4IiwiZm91bmQiLCJzcGxpY2UiLCJmaXJzdEJsb2NrIiwiX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMiLCJfbWF5YmVNaWdyYXRlIiwiX2xpdmVkYXRhX2Vycm9yIiwib2ZmZW5kaW5nTWVzc2FnZSIsIl9zZW5kT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NNZXNzYWdlcyIsIm9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzIiwiX2NhbGxPblJlY29ubmVjdEFuZFNlbmRBcHByb3ByaWF0ZU91dHN0YW5kaW5nTWV0aG9kcyIsIl9yZWNvbm5lY3RIb29rIiwiZWFjaCIsInJhd19tc2ciLCJwYXJzZUREUCIsIm1lc3NhZ2VSZWNlaXZlZCIsInRlc3RNZXNzYWdlT25Db25uZWN0Iiwic2VydmVyX2lkIiwiaW5kZXhPZiIsInZlcnNpb24iLCJfZm9yY2UiLCJfZXJyb3IiLCJpbmNsdWRlcyIsInN1cHBvcnQiLCJmaWx0ZXIiLCJfcmVmNiIsImFsbENvbm5lY3Rpb25zIiwiRW52aXJvbm1lbnRWYXJpYWJsZSIsIl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIiwiX0N1cnJlbnRJbnZvY2F0aW9uIiwiX0N1cnJlbnRDYWxsQXN5bmNJbnZvY2F0aW9uIiwiY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3IiLCJtYWtlRXJyb3JUeXBlIiwiRm9yY2VkUmVjb25uZWN0RXJyb3IiLCJyYW5kb21TdHJlYW0iLCJzY29wZSIsIlJhbmRvbVN0cmVhbSIsImNvbm5lY3QiLCJyZXQiLCJIb29rIiwicmVnaXN0ZXIiLCJfYWxsU3Vic2NyaXB0aW9uc1JlYWR5IiwiZXZlcnkiLCJjb25uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBQSxNQUFNLENBQUNDLElBQUksQ0FBQyx3QkFBd0IsRUFBQztNQUFDQyxHQUFHLEVBQUM7SUFBSyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFBQ0Msc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRzs7Ozs7Ozs7Ozs7QUNBakhQLE1BQU0sQ0FBQ1EsTUFBTSxDQUFDO0VBQUNDLE9BQU8sRUFBQ0EsQ0FBQSxLQUFJQztBQUFhLENBQUMsQ0FBQztBQUszQixNQUFNQSxhQUFhLENBQUM7RUFDakNDLFdBQVdBLENBQUNDLE9BQU8sRUFBRTtJQUNuQjtJQUNBLElBQUksQ0FBQ0MsUUFBUSxHQUFHRCxPQUFPLENBQUNDLFFBQVE7SUFDaEMsSUFBSSxDQUFDQyxXQUFXLEdBQUcsS0FBSztJQUV4QixJQUFJLENBQUNDLFNBQVMsR0FBR0gsT0FBTyxDQUFDSSxRQUFRO0lBQ2pDLElBQUksQ0FBQ0MsV0FBVyxHQUFHTCxPQUFPLENBQUNNLFVBQVU7SUFDckMsSUFBSSxDQUFDQyxRQUFRLEdBQUdQLE9BQU8sQ0FBQ1EsT0FBTztJQUMvQixJQUFJLENBQUNDLGlCQUFpQixHQUFHVCxPQUFPLENBQUNVLGdCQUFnQixLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDL0QsSUFBSSxDQUFDQyxLQUFLLEdBQUdYLE9BQU8sQ0FBQ1ksSUFBSTtJQUN6QixJQUFJLENBQUNDLE9BQU8sR0FBR2IsT0FBTyxDQUFDYSxPQUFPO0lBQzlCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUk7SUFDekIsSUFBSSxDQUFDQyxZQUFZLEdBQUcsS0FBSzs7SUFFekI7SUFDQSxJQUFJLENBQUNWLFdBQVcsQ0FBQ1csZUFBZSxDQUFDLElBQUksQ0FBQ2YsUUFBUSxDQUFDLEdBQUcsSUFBSTtFQUN4RDtFQUNBO0VBQ0E7RUFDQWdCLFdBQVdBLENBQUEsRUFBRztJQUNaO0lBQ0E7SUFDQTtJQUNBLElBQUksSUFBSSxDQUFDQyxTQUFTLENBQUMsQ0FBQyxFQUNsQixNQUFNLElBQUlDLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQzs7SUFFbEU7SUFDQTtJQUNBLElBQUksQ0FBQ0osWUFBWSxHQUFHLEtBQUs7SUFDekIsSUFBSSxDQUFDYixXQUFXLEdBQUcsSUFBSTs7SUFFdkI7SUFDQTtJQUNBLElBQUksSUFBSSxDQUFDUyxLQUFLLEVBQ1osSUFBSSxDQUFDTixXQUFXLENBQUNlLDBCQUEwQixDQUFDLElBQUksQ0FBQ25CLFFBQVEsQ0FBQyxHQUFHLElBQUk7O0lBRW5FO0lBQ0EsSUFBSSxDQUFDSSxXQUFXLENBQUNnQixLQUFLLENBQUMsSUFBSSxDQUFDZCxRQUFRLENBQUM7RUFDdkM7RUFDQTtFQUNBO0VBQ0FlLG9CQUFvQkEsQ0FBQSxFQUFHO0lBQ3JCLElBQUksSUFBSSxDQUFDUixhQUFhLElBQUksSUFBSSxDQUFDQyxZQUFZLEVBQUU7TUFDM0M7TUFDQTtNQUNBLElBQUksQ0FBQ1osU0FBUyxDQUFDLElBQUksQ0FBQ1csYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQ0EsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDOztNQUU1RDtNQUNBLE9BQU8sSUFBSSxDQUFDVCxXQUFXLENBQUNXLGVBQWUsQ0FBQyxJQUFJLENBQUNmLFFBQVEsQ0FBQzs7TUFFdEQ7TUFDQTtNQUNBLElBQUksQ0FBQ0ksV0FBVyxDQUFDa0IsMEJBQTBCLENBQUMsQ0FBQztJQUMvQztFQUNGO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQUMsYUFBYUEsQ0FBQ0MsR0FBRyxFQUFFQyxNQUFNLEVBQUU7SUFDekIsSUFBSSxJQUFJLENBQUNSLFNBQVMsQ0FBQyxDQUFDLEVBQ2xCLE1BQU0sSUFBSUMsS0FBSyxDQUFDLDBDQUEwQyxDQUFDO0lBQzdELElBQUksQ0FBQ0wsYUFBYSxHQUFHLENBQUNXLEdBQUcsRUFBRUMsTUFBTSxDQUFDO0lBQ2xDLElBQUksQ0FBQ2pCLGlCQUFpQixDQUFDZ0IsR0FBRyxFQUFFQyxNQUFNLENBQUM7SUFDbkMsSUFBSSxDQUFDSixvQkFBb0IsQ0FBQyxDQUFDO0VBQzdCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQUssV0FBV0EsQ0FBQSxFQUFHO0lBQ1osSUFBSSxDQUFDWixZQUFZLEdBQUcsSUFBSTtJQUN4QixJQUFJLENBQUNPLG9CQUFvQixDQUFDLENBQUM7RUFDN0I7RUFDQTtFQUNBSixTQUFTQSxDQUFBLEVBQUc7SUFDVixPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUNKLGFBQWE7RUFDN0I7QUFDRixDOzs7Ozs7Ozs7Ozs7OztJQ3BGQSxJQUFJYyx3QkFBd0I7SUFBQ3hDLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLGdEQUFnRCxFQUFDO01BQUNRLE9BQU9BLENBQUNnQyxDQUFDLEVBQUM7UUFBQ0Qsd0JBQXdCLEdBQUNDLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJQyxhQUFhO0lBQUMxQyxNQUFNLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztNQUFDUSxPQUFPQSxDQUFDZ0MsQ0FBQyxFQUFDO1FBQUNDLGFBQWEsR0FBQ0QsQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLE1BQUFFLFNBQUE7TUFBQUMsVUFBQTtJQUE1TzVDLE1BQU0sQ0FBQ1EsTUFBTSxDQUFDO01BQUNxQyxVQUFVLEVBQUNBLENBQUEsS0FBSUE7SUFBVSxDQUFDLENBQUM7SUFBQyxJQUFJQyxNQUFNO0lBQUM5QyxNQUFNLENBQUNDLElBQUksQ0FBQyxlQUFlLEVBQUM7TUFBQzZDLE1BQU1BLENBQUNMLENBQUMsRUFBQztRQUFDSyxNQUFNLEdBQUNMLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJTSxTQUFTO0lBQUMvQyxNQUFNLENBQUNDLElBQUksQ0FBQyxtQkFBbUIsRUFBQztNQUFDOEMsU0FBU0EsQ0FBQ04sQ0FBQyxFQUFDO1FBQUNNLFNBQVMsR0FBQ04sQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlPLE9BQU87SUFBQ2hELE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLGdCQUFnQixFQUFDO01BQUMrQyxPQUFPQSxDQUFDUCxDQUFDLEVBQUM7UUFBQ08sT0FBTyxHQUFDUCxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSVEsS0FBSztJQUFDakQsTUFBTSxDQUFDQyxJQUFJLENBQUMsY0FBYyxFQUFDO01BQUNnRCxLQUFLQSxDQUFDUixDQUFDLEVBQUM7UUFBQ1EsS0FBSyxHQUFDUixDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSVMsTUFBTTtJQUFDbEQsTUFBTSxDQUFDQyxJQUFJLENBQUMsZUFBZSxFQUFDO01BQUNpRCxNQUFNQSxDQUFDVCxDQUFDLEVBQUM7UUFBQ1MsTUFBTSxHQUFDVCxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSVUsT0FBTztJQUFDbkQsTUFBTSxDQUFDQyxJQUFJLENBQUMsaUJBQWlCLEVBQUM7TUFBQ2tELE9BQU9BLENBQUNWLENBQUMsRUFBQztRQUFDVSxPQUFPLEdBQUNWLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJdkMsR0FBRztJQUFDRixNQUFNLENBQUNDLElBQUksQ0FBQyxnQkFBZ0IsRUFBQztNQUFDQyxHQUFHQSxDQUFDdUMsQ0FBQyxFQUFDO1FBQUN2QyxHQUFHLEdBQUN1QyxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSS9CLGFBQWE7SUFBQ1YsTUFBTSxDQUFDQyxJQUFJLENBQUMsb0JBQW9CLEVBQUM7TUFBQ1EsT0FBT0EsQ0FBQ2dDLENBQUMsRUFBQztRQUFDL0IsYUFBYSxHQUFDK0IsQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlXLE1BQU0sRUFBQ0MsS0FBSyxFQUFDQyxJQUFJLEVBQUNDLE9BQU8sRUFBQ0MsSUFBSTtJQUFDeEQsTUFBTSxDQUFDQyxJQUFJLENBQUMsNEJBQTRCLEVBQUM7TUFBQ21ELE1BQU1BLENBQUNYLENBQUMsRUFBQztRQUFDVyxNQUFNLEdBQUNYLENBQUM7TUFBQSxDQUFDO01BQUNZLEtBQUtBLENBQUNaLENBQUMsRUFBQztRQUFDWSxLQUFLLEdBQUNaLENBQUM7TUFBQSxDQUFDO01BQUNhLElBQUlBLENBQUNiLENBQUMsRUFBQztRQUFDYSxJQUFJLEdBQUNiLENBQUM7TUFBQSxDQUFDO01BQUNjLE9BQU9BLENBQUNkLENBQUMsRUFBQztRQUFDYyxPQUFPLEdBQUNkLENBQUM7TUFBQSxDQUFDO01BQUNlLElBQUlBLENBQUNmLENBQUMsRUFBQztRQUFDZSxJQUFJLEdBQUNmLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJdEMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFnQmx6QixNQUFNc0QsVUFBVSxTQUFTQyxLQUFLLENBQUM7TUFDN0IvQyxXQUFXQSxDQUFBLEVBQUc7UUFDWixLQUFLLENBQUN3QyxPQUFPLENBQUNRLFdBQVcsRUFBRVIsT0FBTyxDQUFDUyxPQUFPLENBQUM7TUFDN0M7SUFDRjs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ08sTUFBTWYsVUFBVSxDQUFDO01BQ3RCbEMsV0FBV0EsQ0FBQ2tELEdBQUcsRUFBRWpELE9BQU8sRUFBRTtRQUN4QixNQUFNTixJQUFJLEdBQUcsSUFBSTtRQUVqQixJQUFJLENBQUNNLE9BQU8sR0FBR0EsT0FBTyxHQUFBOEIsYUFBQTtVQUNwQm9CLFdBQVdBLENBQUEsRUFBRyxDQUFDLENBQUM7VUFDaEJDLDhCQUE4QkEsQ0FBQ0MsV0FBVyxFQUFFO1lBQzFDbEIsTUFBTSxDQUFDbUIsTUFBTSxDQUFDRCxXQUFXLENBQUM7VUFDNUIsQ0FBQztVQUNERSxpQkFBaUIsRUFBRSxLQUFLO1VBQ3hCQyxnQkFBZ0IsRUFBRSxLQUFLO1VBQ3ZCQyxjQUFjLEVBQUVDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQztVQUNuQztVQUNBQyxxQkFBcUIsRUFBRSxLQUFLO1VBQzVCQyxvQkFBb0IsRUFBRXpCLFNBQVMsQ0FBQzBCLHNCQUFzQjtVQUN0REMsS0FBSyxFQUFFLElBQUk7VUFDWEMsY0FBYyxFQUFFLElBQUk7VUFDcEI7VUFDQUMsc0JBQXNCLEVBQUUsQ0FBQztVQUN6QjtVQUNBQyxvQkFBb0IsRUFBRTtRQUFHLEdBRXRCakUsT0FBTyxDQUNYOztRQUVEO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQU4sSUFBSSxDQUFDd0UsV0FBVyxHQUFHLElBQUk7O1FBRXZCO1FBQ0EsSUFBSSxPQUFPakIsR0FBRyxLQUFLLFFBQVEsRUFBRTtVQUMzQnZELElBQUksQ0FBQ3lFLE9BQU8sR0FBR2xCLEdBQUc7UUFDcEIsQ0FBQyxNQUFNO1VBN0VYLElBQUltQixZQUFZO1VBQUNoRixNQUFNLENBQUNDLElBQUksQ0FBQyw2QkFBNkIsRUFBQztZQUFDK0UsWUFBWUEsQ0FBQ3ZDLENBQUMsRUFBQztjQUFDdUMsWUFBWSxHQUFDdkMsQ0FBQztZQUFBO1VBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztVQWdGekZuQyxJQUFJLENBQUN5RSxPQUFPLEdBQUcsSUFBSUMsWUFBWSxDQUFDbkIsR0FBRyxFQUFFO1lBQ25DYSxLQUFLLEVBQUU5RCxPQUFPLENBQUM4RCxLQUFLO1lBQ3BCTyxlQUFlLEVBQUUvRSxHQUFHLENBQUMrRSxlQUFlO1lBQ3BDQyxPQUFPLEVBQUV0RSxPQUFPLENBQUNzRSxPQUFPO1lBQ3hCQyxjQUFjLEVBQUV2RSxPQUFPLENBQUN1RSxjQUFjO1lBQ3RDO1lBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQUMsZ0JBQWdCLEVBQUV4RSxPQUFPLENBQUN3RSxnQkFBZ0I7WUFDMUNDLGdCQUFnQixFQUFFekUsT0FBTyxDQUFDeUUsZ0JBQWdCO1lBQzFDakIsY0FBYyxFQUFFeEQsT0FBTyxDQUFDd0Q7VUFDMUIsQ0FBQyxDQUFDO1FBQ0o7UUFFQTlELElBQUksQ0FBQ2dGLGNBQWMsR0FBRyxJQUFJO1FBQzFCaEYsSUFBSSxDQUFDaUYsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDaENqRixJQUFJLENBQUNrRixRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDdEJsRixJQUFJLENBQUNtRixPQUFPLEdBQUdwQixNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3BDaEUsSUFBSSxDQUFDb0YsZUFBZSxHQUFHckIsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUM1Q2hFLElBQUksQ0FBQ3FGLGFBQWEsR0FBRyxDQUFDO1FBQ3RCckYsSUFBSSxDQUFDc0YscUJBQXFCLEdBQUdoRixPQUFPLENBQUM0RCxvQkFBb0I7UUFFekRsRSxJQUFJLENBQUN1RixrQkFBa0IsR0FBR2pGLE9BQU8sQ0FBQ3NELGlCQUFpQjtRQUNuRDVELElBQUksQ0FBQ3dGLGlCQUFpQixHQUFHbEYsT0FBTyxDQUFDdUQsZ0JBQWdCOztRQUVqRDtRQUNBO1FBQ0E7UUFDQTtRQUNBN0QsSUFBSSxDQUFDc0IsZUFBZSxHQUFHeUMsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDOztRQUUxQztRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQWhFLElBQUksQ0FBQ3lGLHdCQUF3QixHQUFHLEVBQUU7O1FBRWxDO1FBQ0E7UUFDQTtRQUNBO1FBQ0F6RixJQUFJLENBQUMwRix1QkFBdUIsR0FBRyxDQUFDLENBQUM7UUFDakM7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTFGLElBQUksQ0FBQzJGLGdCQUFnQixHQUFHLENBQUMsQ0FBQzs7UUFFMUI7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBM0YsSUFBSSxDQUFDNEYscUJBQXFCLEdBQUcsRUFBRTs7UUFFL0I7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBNUYsSUFBSSxDQUFDNkYsZ0NBQWdDLEdBQUcsRUFBRTtRQUMxQztRQUNBO1FBQ0E7UUFDQTdGLElBQUksQ0FBQzBCLDBCQUEwQixHQUFHLENBQUMsQ0FBQztRQUNwQztRQUNBO1FBQ0ExQixJQUFJLENBQUM4RixpQkFBaUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdCO1FBQ0E7UUFDQTlGLElBQUksQ0FBQytGLFlBQVksR0FBRyxLQUFLOztRQUV6QjtRQUNBL0YsSUFBSSxDQUFDZ0csd0JBQXdCLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDO1FBQ0FoRyxJQUFJLENBQUNpRyxhQUFhLEdBQUcsSUFBSTtRQUV6QmpHLElBQUksQ0FBQ2tHLHFCQUFxQixHQUFHMUQsTUFBTSxDQUFDMkQsZUFBZSxDQUNqRG5HLElBQUksQ0FBQ29HLG9CQUFvQixFQUN6Qiw4QkFBOEIsRUFDOUJwRyxJQUNGLENBQUM7UUFDRDtRQUNBQSxJQUFJLENBQUNxRyxlQUFlLEdBQUcsQ0FBQyxDQUFDO1FBQ3pCO1FBQ0FyRyxJQUFJLENBQUNzRyxzQkFBc0IsR0FBRyxJQUFJO1FBQ2xDO1FBQ0F0RyxJQUFJLENBQUN1RywwQkFBMEIsR0FBRyxJQUFJO1FBRXRDdkcsSUFBSSxDQUFDd0csdUJBQXVCLEdBQUdsRyxPQUFPLENBQUNnRSxzQkFBc0I7UUFDN0R0RSxJQUFJLENBQUN5RyxxQkFBcUIsR0FBR25HLE9BQU8sQ0FBQ2lFLG9CQUFvQjs7UUFFekQ7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBdkUsSUFBSSxDQUFDMEcsY0FBYyxHQUFHLENBQUMsQ0FBQzs7UUFFeEI7UUFDQTFHLElBQUksQ0FBQzJHLE9BQU8sR0FBRyxJQUFJO1FBQ25CM0csSUFBSSxDQUFDNEcsV0FBVyxHQUFHLElBQUlsRSxPQUFPLENBQUNtRSxVQUFVLENBQUMsQ0FBQzs7UUFFM0M7UUFDQSxJQUFJckUsTUFBTSxDQUFDc0UsUUFBUSxJQUNqQkMsT0FBTyxDQUFDQyxNQUFNLElBQ2QsQ0FBRTFHLE9BQU8sQ0FBQzJELHFCQUFxQixFQUFFO1VBQ2pDOEMsT0FBTyxDQUFDQyxNQUFNLENBQUNDLE1BQU0sQ0FBQ0MsVUFBVSxDQUFDOUMsS0FBSyxJQUFJO1lBQ3hDLElBQUksQ0FBRXBFLElBQUksQ0FBQ21ILGVBQWUsQ0FBQyxDQUFDLEVBQUU7Y0FDNUJuSCxJQUFJLENBQUNpRyxhQUFhLEdBQUc3QixLQUFLO2NBQzFCLE9BQU8sQ0FBQyxLQUFLLENBQUM7WUFDaEIsQ0FBQyxNQUFNO2NBQ0wsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNmO1VBQ0YsQ0FBQyxDQUFDO1FBQ0o7UUFFQSxNQUFNZ0QsWUFBWSxHQUFHQSxDQUFBLEtBQU07VUFDekIsSUFBSXBILElBQUksQ0FBQ3FILFVBQVUsRUFBRTtZQUNuQnJILElBQUksQ0FBQ3FILFVBQVUsQ0FBQ0MsSUFBSSxDQUFDLENBQUM7WUFDdEJ0SCxJQUFJLENBQUNxSCxVQUFVLEdBQUcsSUFBSTtVQUN4QjtRQUNGLENBQUM7UUFFRCxJQUFJN0UsTUFBTSxDQUFDK0UsUUFBUSxFQUFFO1VBQ25CdkgsSUFBSSxDQUFDeUUsT0FBTyxDQUFDK0MsRUFBRSxDQUNiLFNBQVMsRUFDVGhGLE1BQU0sQ0FBQzJELGVBQWUsQ0FDcEIsSUFBSSxDQUFDc0IsU0FBUyxDQUFDQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3pCLHNCQUNGLENBQ0YsQ0FBQztVQUNEMUgsSUFBSSxDQUFDeUUsT0FBTyxDQUFDK0MsRUFBRSxDQUNiLE9BQU8sRUFDUGhGLE1BQU0sQ0FBQzJELGVBQWUsQ0FBQyxJQUFJLENBQUN3QixPQUFPLENBQUNELElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxvQkFBb0IsQ0FDdEUsQ0FBQztVQUNEMUgsSUFBSSxDQUFDeUUsT0FBTyxDQUFDK0MsRUFBRSxDQUNiLFlBQVksRUFDWmhGLE1BQU0sQ0FBQzJELGVBQWUsQ0FBQ2lCLFlBQVksRUFBRSx5QkFBeUIsQ0FDaEUsQ0FBQztRQUNILENBQUMsTUFBTTtVQUNMcEgsSUFBSSxDQUFDeUUsT0FBTyxDQUFDK0MsRUFBRSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUNDLFNBQVMsQ0FBQ0MsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1VBQ3JEMUgsSUFBSSxDQUFDeUUsT0FBTyxDQUFDK0MsRUFBRSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUNHLE9BQU8sQ0FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1VBQ2pEMUgsSUFBSSxDQUFDeUUsT0FBTyxDQUFDK0MsRUFBRSxDQUFDLFlBQVksRUFBRUosWUFBWSxDQUFDO1FBQzdDO01BQ0Y7O01BRUE7TUFDQTtNQUNBO01BQ0FRLGtCQUFrQkEsQ0FBQ0MsSUFBSSxFQUFFQyxZQUFZLEVBQUU7UUFDckMsTUFBTTlILElBQUksR0FBRyxJQUFJO1FBRWpCLElBQUk2SCxJQUFJLElBQUk3SCxJQUFJLENBQUNtRixPQUFPLEVBQUUsT0FBTyxLQUFLOztRQUV0QztRQUNBO1FBQ0EsTUFBTTRDLEtBQUssR0FBR2hFLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNqQyxNQUFNZ0UsV0FBVyxHQUFHLENBQ2xCLFFBQVEsRUFDUixhQUFhLEVBQ2IsV0FBVyxFQUNYLGVBQWUsRUFDZixtQkFBbUIsRUFDbkIsUUFBUSxFQUNSLGdCQUFnQixDQUNqQjtRQUNEQSxXQUFXLENBQUNDLE9BQU8sQ0FBRUMsTUFBTSxJQUFLO1VBQzlCSCxLQUFLLENBQUNHLE1BQU0sQ0FBQyxHQUFHLFlBQWE7WUFDM0IsSUFBSUosWUFBWSxDQUFDSSxNQUFNLENBQUMsRUFBRTtjQUN4QixPQUFPSixZQUFZLENBQUNJLE1BQU0sQ0FBQyxDQUFDLEdBQUFDLFNBQU8sQ0FBQztZQUN0QztVQUNGLENBQUM7UUFDSCxDQUFDLENBQUM7UUFDRm5JLElBQUksQ0FBQ21GLE9BQU8sQ0FBQzBDLElBQUksQ0FBQyxHQUFHRSxLQUFLO1FBQzFCLE9BQU9BLEtBQUs7TUFDZDtNQUVBSyxtQkFBbUJBLENBQUNQLElBQUksRUFBRUMsWUFBWSxFQUFFO1FBQ3RDLE1BQU05SCxJQUFJLEdBQUcsSUFBSTtRQUVqQixNQUFNK0gsS0FBSyxHQUFHL0gsSUFBSSxDQUFDNEgsa0JBQWtCLENBQUNDLElBQUksRUFBRUMsWUFBWSxDQUFDO1FBRXpELE1BQU1PLE1BQU0sR0FBR3JJLElBQUksQ0FBQ2dHLHdCQUF3QixDQUFDNkIsSUFBSSxDQUFDO1FBQ2xELElBQUlTLEtBQUssQ0FBQ0MsT0FBTyxDQUFDRixNQUFNLENBQUMsRUFBRTtVQUN6Qk4sS0FBSyxDQUFDUyxXQUFXLENBQUNILE1BQU0sQ0FBQ0ksTUFBTSxFQUFFLEtBQUssQ0FBQztVQUN2Q0osTUFBTSxDQUFDSixPQUFPLENBQUNTLEdBQUcsSUFBSTtZQUNwQlgsS0FBSyxDQUFDWSxNQUFNLENBQUNELEdBQUcsQ0FBQztVQUNuQixDQUFDLENBQUM7VUFDRlgsS0FBSyxDQUFDYSxTQUFTLENBQUMsQ0FBQztVQUNqQixPQUFPNUksSUFBSSxDQUFDZ0csd0JBQXdCLENBQUM2QixJQUFJLENBQUM7UUFDNUM7UUFFQSxPQUFPLElBQUk7TUFDYjtNQUNBLE1BQU1nQixtQkFBbUJBLENBQUNoQixJQUFJLEVBQUVDLFlBQVksRUFBRTtRQUM1QyxNQUFNOUgsSUFBSSxHQUFHLElBQUk7UUFFakIsTUFBTStILEtBQUssR0FBRy9ILElBQUksQ0FBQzRILGtCQUFrQixDQUFDQyxJQUFJLEVBQUVDLFlBQVksQ0FBQztRQUV6RCxNQUFNTyxNQUFNLEdBQUdySSxJQUFJLENBQUNnRyx3QkFBd0IsQ0FBQzZCLElBQUksQ0FBQztRQUNsRCxJQUFJUyxLQUFLLENBQUNDLE9BQU8sQ0FBQ0YsTUFBTSxDQUFDLEVBQUU7VUFDekIsTUFBTU4sS0FBSyxDQUFDUyxXQUFXLENBQUNILE1BQU0sQ0FBQ0ksTUFBTSxFQUFFLEtBQUssQ0FBQztVQUM3QyxLQUFLLE1BQU1DLEdBQUcsSUFBSUwsTUFBTSxFQUFFO1lBQ3hCLE1BQU1OLEtBQUssQ0FBQ1ksTUFBTSxDQUFDRCxHQUFHLENBQUM7VUFDekI7VUFDQSxNQUFNWCxLQUFLLENBQUNhLFNBQVMsQ0FBQyxDQUFDO1VBQ3ZCLE9BQU81SSxJQUFJLENBQUNnRyx3QkFBd0IsQ0FBQzZCLElBQUksQ0FBQztRQUM1QztRQUVBLE9BQU8sSUFBSTtNQUNiOztNQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0VpQixTQUFTQSxDQUFDakIsSUFBSSxDQUFDLDhDQUE4QztRQUMzRCxNQUFNN0gsSUFBSSxHQUFHLElBQUk7UUFFakIsTUFBTStJLE1BQU0sR0FBR2hHLEtBQUssQ0FBQ2lHLElBQUksQ0FBQ2IsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUN2QyxJQUFJYyxTQUFTLEdBQUdsRixNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDbkMsSUFBSStFLE1BQU0sQ0FBQ04sTUFBTSxFQUFFO1VBQ2pCLE1BQU1TLFNBQVMsR0FBR0gsTUFBTSxDQUFDQSxNQUFNLENBQUNOLE1BQU0sR0FBRyxDQUFDLENBQUM7VUFDM0MsSUFBSSxPQUFPUyxTQUFTLEtBQUssVUFBVSxFQUFFO1lBQ25DRCxTQUFTLENBQUNFLE9BQU8sR0FBR0osTUFBTSxDQUFDSyxHQUFHLENBQUMsQ0FBQztVQUNsQyxDQUFDLE1BQU0sSUFBSUYsU0FBUyxJQUFJLENBQ3RCQSxTQUFTLENBQUNDLE9BQU87VUFDakI7VUFDQTtVQUNBRCxTQUFTLENBQUNHLE9BQU8sRUFDakJILFNBQVMsQ0FBQ0ksTUFBTSxDQUNqQixDQUFDQyxJQUFJLENBQUNDLENBQUMsSUFBSSxPQUFPQSxDQUFDLEtBQUssVUFBVSxDQUFDLEVBQUU7WUFDcENQLFNBQVMsR0FBR0YsTUFBTSxDQUFDSyxHQUFHLENBQUMsQ0FBQztVQUMxQjtRQUNGOztRQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBLE1BQU1LLFFBQVEsR0FBRzFGLE1BQU0sQ0FBQzJGLE1BQU0sQ0FBQzFKLElBQUksQ0FBQzBHLGNBQWMsQ0FBQyxDQUFDaUQsSUFBSSxDQUN0REMsR0FBRyxJQUFLQSxHQUFHLENBQUNDLFFBQVEsSUFBSUQsR0FBRyxDQUFDL0IsSUFBSSxLQUFLQSxJQUFJLElBQUlsRixLQUFLLENBQUNtSCxNQUFNLENBQUNGLEdBQUcsQ0FBQ2IsTUFBTSxFQUFFQSxNQUFNLENBQzlFLENBQUM7UUFFRCxJQUFJZ0IsRUFBRTtRQUNOLElBQUlOLFFBQVEsRUFBRTtVQUNaTSxFQUFFLEdBQUdOLFFBQVEsQ0FBQ00sRUFBRTtVQUNoQk4sUUFBUSxDQUFDSSxRQUFRLEdBQUcsS0FBSyxDQUFDLENBQUM7O1VBRTNCLElBQUlaLFNBQVMsQ0FBQ0UsT0FBTyxFQUFFO1lBQ3JCO1lBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBLElBQUlNLFFBQVEsQ0FBQ08sS0FBSyxFQUFFO2NBQ2xCZixTQUFTLENBQUNFLE9BQU8sQ0FBQyxDQUFDO1lBQ3JCLENBQUMsTUFBTTtjQUNMTSxRQUFRLENBQUNRLGFBQWEsR0FBR2hCLFNBQVMsQ0FBQ0UsT0FBTztZQUM1QztVQUNGOztVQUVBO1VBQ0E7VUFDQSxJQUFJRixTQUFTLENBQUNJLE9BQU8sRUFBRTtZQUNyQjtZQUNBO1lBQ0FJLFFBQVEsQ0FBQ1MsYUFBYSxHQUFHakIsU0FBUyxDQUFDSSxPQUFPO1VBQzVDO1VBRUEsSUFBSUosU0FBUyxDQUFDSyxNQUFNLEVBQUU7WUFDcEJHLFFBQVEsQ0FBQ1UsWUFBWSxHQUFHbEIsU0FBUyxDQUFDSyxNQUFNO1VBQzFDO1FBQ0YsQ0FBQyxNQUFNO1VBQ0w7VUFDQVMsRUFBRSxHQUFHbkgsTUFBTSxDQUFDbUgsRUFBRSxDQUFDLENBQUM7VUFDaEIvSixJQUFJLENBQUMwRyxjQUFjLENBQUNxRCxFQUFFLENBQUMsR0FBRztZQUN4QkEsRUFBRSxFQUFFQSxFQUFFO1lBQ05sQyxJQUFJLEVBQUVBLElBQUk7WUFDVmtCLE1BQU0sRUFBRXBHLEtBQUssQ0FBQ3lILEtBQUssQ0FBQ3JCLE1BQU0sQ0FBQztZQUMzQmMsUUFBUSxFQUFFLEtBQUs7WUFDZkcsS0FBSyxFQUFFLEtBQUs7WUFDWkssU0FBUyxFQUFFLElBQUkzSCxPQUFPLENBQUNtRSxVQUFVLENBQUMsQ0FBQztZQUNuQ29ELGFBQWEsRUFBRWhCLFNBQVMsQ0FBQ0UsT0FBTztZQUNoQztZQUNBZSxhQUFhLEVBQUVqQixTQUFTLENBQUNJLE9BQU87WUFDaENjLFlBQVksRUFBRWxCLFNBQVMsQ0FBQ0ssTUFBTTtZQUM5QjFJLFVBQVUsRUFBRVosSUFBSTtZQUNoQnNLLE1BQU1BLENBQUEsRUFBRztjQUNQLE9BQU8sSUFBSSxDQUFDMUosVUFBVSxDQUFDOEYsY0FBYyxDQUFDLElBQUksQ0FBQ3FELEVBQUUsQ0FBQztjQUM5QyxJQUFJLENBQUNDLEtBQUssSUFBSSxJQUFJLENBQUNLLFNBQVMsQ0FBQ0UsT0FBTyxDQUFDLENBQUM7WUFDeEMsQ0FBQztZQUNEakQsSUFBSUEsQ0FBQSxFQUFHO2NBQ0wsSUFBSSxDQUFDMUcsVUFBVSxDQUFDNEosV0FBVyxDQUFDO2dCQUFFOUIsR0FBRyxFQUFFLE9BQU87Z0JBQUVxQixFQUFFLEVBQUVBO2NBQUcsQ0FBQyxDQUFDO2NBQ3JELElBQUksQ0FBQ08sTUFBTSxDQUFDLENBQUM7Y0FFYixJQUFJckIsU0FBUyxDQUFDSyxNQUFNLEVBQUU7Z0JBQ3BCTCxTQUFTLENBQUNLLE1BQU0sQ0FBQyxDQUFDO2NBQ3BCO1lBQ0Y7VUFDRixDQUFDO1VBQ0R0SixJQUFJLENBQUMyQixLQUFLLENBQUM7WUFBRStHLEdBQUcsRUFBRSxLQUFLO1lBQUVxQixFQUFFLEVBQUVBLEVBQUU7WUFBRWxDLElBQUksRUFBRUEsSUFBSTtZQUFFa0IsTUFBTSxFQUFFQTtVQUFPLENBQUMsQ0FBQztRQUNoRTs7UUFFQTtRQUNBLE1BQU0wQixNQUFNLEdBQUc7VUFDYm5ELElBQUlBLENBQUEsRUFBRztZQUNMLElBQUksQ0FBRXhFLE1BQU0sQ0FBQ2tHLElBQUksQ0FBQ2hKLElBQUksQ0FBQzBHLGNBQWMsRUFBRXFELEVBQUUsQ0FBQyxFQUFFO2NBQzFDO1lBQ0Y7WUFDQS9KLElBQUksQ0FBQzBHLGNBQWMsQ0FBQ3FELEVBQUUsQ0FBQyxDQUFDekMsSUFBSSxDQUFDLENBQUM7VUFDaEMsQ0FBQztVQUNEMEMsS0FBS0EsQ0FBQSxFQUFHO1lBQ047WUFDQSxJQUFJLENBQUNsSCxNQUFNLENBQUNrRyxJQUFJLENBQUNoSixJQUFJLENBQUMwRyxjQUFjLEVBQUVxRCxFQUFFLENBQUMsRUFBRTtjQUN6QyxPQUFPLEtBQUs7WUFDZDtZQUNBLE1BQU1XLE1BQU0sR0FBRzFLLElBQUksQ0FBQzBHLGNBQWMsQ0FBQ3FELEVBQUUsQ0FBQztZQUN0Q1csTUFBTSxDQUFDTCxTQUFTLENBQUNNLE1BQU0sQ0FBQyxDQUFDO1lBQ3pCLE9BQU9ELE1BQU0sQ0FBQ1YsS0FBSztVQUNyQixDQUFDO1VBQ0RZLGNBQWMsRUFBRWI7UUFDbEIsQ0FBQztRQUVELElBQUlySCxPQUFPLENBQUNtSSxNQUFNLEVBQUU7VUFDbEI7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0FuSSxPQUFPLENBQUNvSSxZQUFZLENBQUVDLENBQUMsSUFBSztZQUMxQixJQUFJakksTUFBTSxDQUFDa0csSUFBSSxDQUFDaEosSUFBSSxDQUFDMEcsY0FBYyxFQUFFcUQsRUFBRSxDQUFDLEVBQUU7Y0FDeEMvSixJQUFJLENBQUMwRyxjQUFjLENBQUNxRCxFQUFFLENBQUMsQ0FBQ0YsUUFBUSxHQUFHLElBQUk7WUFDekM7WUFFQW5ILE9BQU8sQ0FBQ3NJLFVBQVUsQ0FBQyxNQUFNO2NBQ3ZCLElBQUlsSSxNQUFNLENBQUNrRyxJQUFJLENBQUNoSixJQUFJLENBQUMwRyxjQUFjLEVBQUVxRCxFQUFFLENBQUMsSUFDcEMvSixJQUFJLENBQUMwRyxjQUFjLENBQUNxRCxFQUFFLENBQUMsQ0FBQ0YsUUFBUSxFQUFFO2dCQUNwQ1ksTUFBTSxDQUFDbkQsSUFBSSxDQUFDLENBQUM7Y0FDZjtZQUNGLENBQUMsQ0FBQztVQUNKLENBQUMsQ0FBQztRQUNKO1FBRUEsT0FBT21ELE1BQU07TUFDZjs7TUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0VRLFdBQVdBLENBQUEsRUFBRTtRQUNYLE9BQU9yTCxHQUFHLENBQUNzTCx3QkFBd0IsQ0FBQ0MseUJBQXlCLENBQUMsQ0FBQztNQUNqRTtNQUNBQyxPQUFPQSxDQUFDQSxPQUFPLEVBQUU7UUFDZnJILE1BQU0sQ0FBQ3NILE9BQU8sQ0FBQ0QsT0FBTyxDQUFDLENBQUNuRCxPQUFPLENBQUNxRCxJQUFBLElBQWtCO1VBQUEsSUFBakIsQ0FBQ3pELElBQUksRUFBRTBELElBQUksQ0FBQyxHQUFBRCxJQUFBO1VBQzNDLElBQUksT0FBT0MsSUFBSSxLQUFLLFVBQVUsRUFBRTtZQUM5QixNQUFNLElBQUk5SixLQUFLLENBQUMsVUFBVSxHQUFHb0csSUFBSSxHQUFHLHNCQUFzQixDQUFDO1VBQzdEO1VBQ0EsSUFBSSxJQUFJLENBQUN6QyxlQUFlLENBQUN5QyxJQUFJLENBQUMsRUFBRTtZQUM5QixNQUFNLElBQUlwRyxLQUFLLENBQUMsa0JBQWtCLEdBQUdvRyxJQUFJLEdBQUcsc0JBQXNCLENBQUM7VUFDckU7VUFDQSxJQUFJLENBQUN6QyxlQUFlLENBQUN5QyxJQUFJLENBQUMsR0FBRzBELElBQUk7UUFDbkMsQ0FBQyxDQUFDO01BQ0o7TUFFQUMsZ0JBQWdCQSxDQUFBQyxLQUFBLEVBQXlDO1FBQUEsSUFBeEM7VUFBQ0MsZUFBZTtVQUFFQztRQUFtQixDQUFDLEdBQUFGLEtBQUE7UUFDckQsSUFBSSxDQUFDQyxlQUFlLEVBQUU7VUFDcEIsT0FBT0MsbUJBQW1CO1FBQzVCO1FBQ0EsT0FBT0EsbUJBQW1CLElBQUkvTCxHQUFHLENBQUNzTCx3QkFBd0IsQ0FBQ0MseUJBQXlCLENBQUMsQ0FBQztNQUN4Rjs7TUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtNQUNFbkMsSUFBSUEsQ0FBQ25CLElBQUksQ0FBQyxrQ0FBa0M7UUFDMUM7UUFDQTtRQUNBLE1BQU0rRCxJQUFJLEdBQUc3SSxLQUFLLENBQUNpRyxJQUFJLENBQUNiLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFDckMsSUFBSXpILFFBQVE7UUFDWixJQUFJa0wsSUFBSSxDQUFDbkQsTUFBTSxJQUFJLE9BQU9tRCxJQUFJLENBQUNBLElBQUksQ0FBQ25ELE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxVQUFVLEVBQUU7VUFDOUQvSCxRQUFRLEdBQUdrTCxJQUFJLENBQUN4QyxHQUFHLENBQUMsQ0FBQztRQUN2QjtRQUNBLE9BQU8sSUFBSSxDQUFDeUMsS0FBSyxDQUFDaEUsSUFBSSxFQUFFK0QsSUFBSSxFQUFFbEwsUUFBUSxDQUFDO01BQ3pDO01BQ0E7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFDRW9MLFNBQVNBLENBQUNqRSxJQUFJLENBQUMseUJBQXlCO1FBQ3RDLE1BQU0rRCxJQUFJLEdBQUc3SSxLQUFLLENBQUNpRyxJQUFJLENBQUNiLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFDckMsSUFBSXlELElBQUksQ0FBQ25ELE1BQU0sSUFBSSxPQUFPbUQsSUFBSSxDQUFDQSxJQUFJLENBQUNuRCxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssVUFBVSxFQUFFO1VBQzlELE1BQU0sSUFBSWhILEtBQUssQ0FDYiwrRkFDRixDQUFDO1FBQ0g7UUFFQSxPQUFPLElBQUksQ0FBQ3NLLFVBQVUsQ0FBQ2xFLElBQUksRUFBRStELElBQUksRUFBRTtVQUFFSSx5QkFBeUIsRUFBRTtRQUFLLENBQUMsQ0FBQztNQUN6RTs7TUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtNQUNFSCxLQUFLQSxDQUFDaEUsSUFBSSxFQUFFK0QsSUFBSSxFQUFFdEwsT0FBTyxFQUFFSSxRQUFRLEVBQUU7UUFDbkMsTUFBQXVMLGVBQUEsR0FBdUQsSUFBSSxDQUFDQyxTQUFTLENBQUNyRSxJQUFJLEVBQUVsRixLQUFLLENBQUN5SCxLQUFLLENBQUN3QixJQUFJLENBQUMsQ0FBQztVQUF4RjtZQUFFTyxjQUFjO1lBQUVDO1VBQTJCLENBQUMsR0FBQUgsZUFBQTtVQUFiSSxXQUFXLEdBQUFuSyx3QkFBQSxDQUFBK0osZUFBQSxFQUFBNUosU0FBQTtRQUVsRCxJQUFJZ0ssV0FBVyxDQUFDQyxPQUFPLEVBQUU7VUFDdkIsSUFDRSxDQUFDLElBQUksQ0FBQ2QsZ0JBQWdCLENBQUM7WUFDckJHLG1CQUFtQixFQUFFVSxXQUFXLENBQUNWLG1CQUFtQjtZQUNwREQsZUFBZSxFQUFFVyxXQUFXLENBQUNYO1VBQy9CLENBQUMsQ0FBQyxFQUNGO1lBQ0EsSUFBSSxDQUFDYSxjQUFjLENBQUMsQ0FBQztVQUN2QjtVQUNBLElBQUk7WUFDRkYsV0FBVyxDQUFDRyxlQUFlLEdBQUc1TSxHQUFHLENBQUNzTCx3QkFBd0IsQ0FDdkR1QixTQUFTLENBQUNMLFVBQVUsRUFBRUQsY0FBYyxDQUFDO1lBQ3hDLElBQUkzSixNQUFNLENBQUNrSyxVQUFVLENBQUNMLFdBQVcsQ0FBQ0csZUFBZSxDQUFDLEVBQUU7Y0FDbERoSyxNQUFNLENBQUNtQixNQUFNLFdBQUFnSixNQUFBLENBQ0Q5RSxJQUFJLHlJQUNoQixDQUFDO1lBQ0g7VUFDRixDQUFDLENBQUMsT0FBTytFLENBQUMsRUFBRTtZQUNWUCxXQUFXLENBQUNRLFNBQVMsR0FBR0QsQ0FBQztVQUMzQjtRQUNGO1FBQ0EsT0FBTyxJQUFJLENBQUNFLE1BQU0sQ0FBQ2pGLElBQUksRUFBRXdFLFdBQVcsRUFBRVQsSUFBSSxFQUFFdEwsT0FBTyxFQUFFSSxRQUFRLENBQUM7TUFDaEU7O01BRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFDRXFMLFVBQVVBLENBQUNsRSxJQUFJLEVBQUUrRCxJQUFJLEVBQUV0TCxPQUFPLEVBQW1CO1FBQUEsSUFBakJJLFFBQVEsR0FBQXlILFNBQUEsQ0FBQU0sTUFBQSxRQUFBTixTQUFBLFFBQUE0RSxTQUFBLEdBQUE1RSxTQUFBLE1BQUcsSUFBSTtRQUM3QyxNQUFNNkUsV0FBVyxHQUFHLElBQUksQ0FBQ0MseUJBQXlCLENBQUNwRixJQUFJLEVBQUUrRCxJQUFJLEVBQUV0TCxPQUFPLENBQUM7UUFFdkUsTUFBTTRNLE9BQU8sR0FBRyxJQUFJLENBQUNDLFdBQVcsQ0FBQztVQUMvQnRGLElBQUk7VUFDSitELElBQUk7VUFDSnRMLE9BQU87VUFDUEksUUFBUTtVQUNSc007UUFDRixDQUFDLENBQUM7UUFDRixJQUFJeEssTUFBTSxDQUFDc0UsUUFBUSxFQUFFO1VBQ25CO1VBQ0FvRyxPQUFPLENBQUNGLFdBQVcsR0FBR0EsV0FBVyxDQUFDSSxJQUFJLENBQUNDLENBQUMsSUFBSTtZQUMxQyxJQUFJQSxDQUFDLENBQUNSLFNBQVMsRUFBRTtjQUNmLE1BQU1RLENBQUMsQ0FBQ1IsU0FBUztZQUNuQjtZQUNBLE9BQU9RLENBQUMsQ0FBQ2IsZUFBZTtVQUMxQixDQUFDLENBQUM7VUFDRjtVQUNBVSxPQUFPLENBQUNJLGFBQWEsR0FBRyxJQUFJQyxPQUFPLENBQUMsQ0FBQ0MsT0FBTyxFQUFFQyxNQUFNLEtBQ2xEUCxPQUFPLENBQUNFLElBQUksQ0FBQ0ksT0FBTyxDQUFDLENBQUNFLEtBQUssQ0FBQ0QsTUFBTSxDQUNwQyxDQUFDO1FBQ0g7UUFDQSxPQUFPUCxPQUFPO01BQ2hCO01BQ0EsTUFBTUQseUJBQXlCQSxDQUFDcEYsSUFBSSxFQUFFK0QsSUFBSSxFQUFFdEwsT0FBTyxFQUFFO1FBQ25ELE1BQUFxTixnQkFBQSxHQUF1RCxJQUFJLENBQUN6QixTQUFTLENBQUNyRSxJQUFJLEVBQUVsRixLQUFLLENBQUN5SCxLQUFLLENBQUN3QixJQUFJLENBQUMsRUFBRXRMLE9BQU8sQ0FBQztVQUFqRztZQUFFNkwsY0FBYztZQUFFQztVQUEyQixDQUFDLEdBQUF1QixnQkFBQTtVQUFidEIsV0FBVyxHQUFBbkssd0JBQUEsQ0FBQXlMLGdCQUFBLEVBQUFyTCxVQUFBO1FBQ2xELElBQUkrSixXQUFXLENBQUNDLE9BQU8sRUFBRTtVQUN2QixJQUNFLENBQUMsSUFBSSxDQUFDZCxnQkFBZ0IsQ0FBQztZQUNyQkcsbUJBQW1CLEVBQUVVLFdBQVcsQ0FBQ1YsbUJBQW1CO1lBQ3BERCxlQUFlLEVBQUVXLFdBQVcsQ0FBQ1g7VUFDL0IsQ0FBQyxDQUFDLEVBQ0Y7WUFDQSxJQUFJLENBQUNhLGNBQWMsQ0FBQyxDQUFDO1VBQ3ZCO1VBQ0EsSUFBSTtZQUNGO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7WUFDUSxNQUFNcUIsY0FBYyxHQUFHaE8sR0FBRyxDQUFDc0wsd0JBQXdCLENBQUMyQywyQkFBMkIsQ0FDN0V6QixVQUNGLENBQUM7WUFDRCxJQUFJO2NBQ0ZDLFdBQVcsQ0FBQ0csZUFBZSxHQUFHLE1BQU1MLGNBQWMsQ0FBQyxDQUFDO1lBQ3RELENBQUMsQ0FBQyxPQUFPUyxDQUFDLEVBQUU7Y0FDVlAsV0FBVyxDQUFDUSxTQUFTLEdBQUdELENBQUM7WUFDM0IsQ0FBQyxTQUFTO2NBQ1JoTixHQUFHLENBQUNzTCx3QkFBd0IsQ0FBQzRDLElBQUksQ0FBQ0YsY0FBYyxDQUFDO1lBQ25EO1VBQ0YsQ0FBQyxDQUFDLE9BQU9oQixDQUFDLEVBQUU7WUFDVlAsV0FBVyxDQUFDUSxTQUFTLEdBQUdELENBQUM7VUFDM0I7UUFDRjtRQUNBLE9BQU9QLFdBQVc7TUFDcEI7TUFDQSxNQUFNYyxXQUFXQSxDQUFBWSxLQUFBLEVBQWlEO1FBQUEsSUFBaEQ7VUFBRWxHLElBQUk7VUFBRStELElBQUk7VUFBRXRMLE9BQU87VUFBRUksUUFBUTtVQUFFc007UUFBWSxDQUFDLEdBQUFlLEtBQUE7UUFDOUQsTUFBTTFCLFdBQVcsR0FBRyxNQUFNVyxXQUFXO1FBQ3JDLE9BQU8sSUFBSSxDQUFDRixNQUFNLENBQUNqRixJQUFJLEVBQUV3RSxXQUFXLEVBQUVULElBQUksRUFBRXRMLE9BQU8sRUFBRUksUUFBUSxDQUFDO01BQ2hFO01BRUFvTSxNQUFNQSxDQUFDakYsSUFBSSxFQUFFbUcsYUFBYSxFQUFFcEMsSUFBSSxFQUFFdEwsT0FBTyxFQUFFSSxRQUFRLEVBQUU7UUFDbkQsTUFBTVYsSUFBSSxHQUFHLElBQUk7O1FBRWpCO1FBQ0E7UUFDQSxJQUFJLENBQUNVLFFBQVEsSUFBSSxPQUFPSixPQUFPLEtBQUssVUFBVSxFQUFFO1VBQzlDSSxRQUFRLEdBQUdKLE9BQU87VUFDbEJBLE9BQU8sR0FBR3lELE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQztRQUMvQjtRQUNBMUQsT0FBTyxHQUFHQSxPQUFPLElBQUl5RCxNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFFeEMsSUFBSXRELFFBQVEsRUFBRTtVQUNaO1VBQ0E7VUFDQTtVQUNBQSxRQUFRLEdBQUc4QixNQUFNLENBQUMyRCxlQUFlLENBQy9CekYsUUFBUSxFQUNSLGlDQUFpQyxHQUFHbUgsSUFBSSxHQUFHLEdBQzdDLENBQUM7UUFDSDtRQUNBLE1BQU07VUFDSnlFLE9BQU87VUFDUE8sU0FBUztVQUNUTCxlQUFlO1VBQ2ZiLG1CQUFtQjtVQUNuQnNDO1FBQ0YsQ0FBQyxHQUFHRCxhQUFhOztRQUVqQjtRQUNBO1FBQ0FwQyxJQUFJLEdBQUdqSixLQUFLLENBQUN5SCxLQUFLLENBQUN3QixJQUFJLENBQUM7UUFDeEI7UUFDQTtRQUNBO1FBQ0EsSUFDRSxJQUFJLENBQUNKLGdCQUFnQixDQUFDO1VBQ3BCRyxtQkFBbUI7VUFDbkJELGVBQWUsRUFBRXNDLGFBQWEsQ0FBQ3RDO1FBQ2pDLENBQUMsQ0FBQyxFQUNGO1VBQ0EsSUFBSTFKLE1BQU07VUFFVixJQUFJdEIsUUFBUSxFQUFFO1lBQ1pBLFFBQVEsQ0FBQ21NLFNBQVMsRUFBRUwsZUFBZSxDQUFDO1VBQ3RDLENBQUMsTUFBTTtZQUNMLElBQUlLLFNBQVMsRUFBRSxNQUFNQSxTQUFTO1lBQzlCN0ssTUFBTSxHQUFHd0ssZUFBZTtVQUMxQjtVQUVBLE9BQU9sTSxPQUFPLENBQUM0TixvQkFBb0IsR0FBRztZQUFFbE07VUFBTyxDQUFDLEdBQUdBLE1BQU07UUFDM0Q7O1FBRUE7UUFDQTtRQUNBLE1BQU16QixRQUFRLEdBQUcsRUFBRSxHQUFHUCxJQUFJLENBQUNxRixhQUFhLEVBQUU7UUFDMUMsSUFBSWlILE9BQU8sRUFBRTtVQUNYdE0sSUFBSSxDQUFDbU8sMEJBQTBCLENBQUM1TixRQUFRLENBQUM7UUFDM0M7O1FBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQSxNQUFNTyxPQUFPLEdBQUc7VUFDZDRILEdBQUcsRUFBRSxRQUFRO1VBQ2JxQixFQUFFLEVBQUV4SixRQUFRO1VBQ1oySCxNQUFNLEVBQUVMLElBQUk7VUFDWmtCLE1BQU0sRUFBRTZDO1FBQ1YsQ0FBQzs7UUFFRDtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBLElBQUlpQixTQUFTLEVBQUU7VUFDYixJQUFJdk0sT0FBTyxDQUFDOE4sbUJBQW1CLEVBQUU7WUFDL0IsTUFBTXZCLFNBQVM7VUFDakIsQ0FBQyxNQUFNLElBQUksQ0FBQ0EsU0FBUyxDQUFDd0IsZUFBZSxFQUFFO1lBQ3JDN0wsTUFBTSxDQUFDbUIsTUFBTSxDQUNYLHFEQUFxRCxHQUFHa0UsSUFBSSxHQUFHLEdBQUcsRUFDbEVnRixTQUNGLENBQUM7VUFDSDtRQUNGOztRQUVBO1FBQ0E7O1FBRUE7UUFDQSxJQUFJSyxPQUFPO1FBQ1gsSUFBSSxDQUFDeE0sUUFBUSxFQUFFO1VBQ2IsSUFDRThCLE1BQU0sQ0FBQ3NFLFFBQVEsSUFDZixDQUFDeEcsT0FBTyxDQUFDMEwseUJBQXlCLEtBQ2pDLENBQUMxTCxPQUFPLENBQUNvTCxlQUFlLElBQUlwTCxPQUFPLENBQUNnTyxlQUFlLENBQUMsRUFDckQ7WUFDQTVOLFFBQVEsR0FBSXFCLEdBQUcsSUFBSztjQUNsQkEsR0FBRyxJQUFJUyxNQUFNLENBQUNtQixNQUFNLENBQUMseUJBQXlCLEdBQUdrRSxJQUFJLEdBQUcsR0FBRyxFQUFFOUYsR0FBRyxDQUFDO1lBQ25FLENBQUM7VUFDSCxDQUFDLE1BQU07WUFDTG1MLE9BQU8sR0FBRyxJQUFJSyxPQUFPLENBQUMsQ0FBQ0MsT0FBTyxFQUFFQyxNQUFNLEtBQUs7Y0FDekMvTSxRQUFRLEdBQUcsU0FBQUEsQ0FBQSxFQUFnQjtnQkFBQSxTQUFBNk4sSUFBQSxHQUFBcEcsU0FBQSxDQUFBTSxNQUFBLEVBQVorRixPQUFPLE9BQUFsRyxLQUFBLENBQUFpRyxJQUFBLEdBQUFFLElBQUEsTUFBQUEsSUFBQSxHQUFBRixJQUFBLEVBQUFFLElBQUE7a0JBQVBELE9BQU8sQ0FBQUMsSUFBQSxJQUFBdEcsU0FBQSxDQUFBc0csSUFBQTtnQkFBQTtnQkFDcEIsSUFBSTdDLElBQUksR0FBR3RELEtBQUssQ0FBQ29HLElBQUksQ0FBQ0YsT0FBTyxDQUFDO2dCQUM5QixJQUFJek0sR0FBRyxHQUFHNkosSUFBSSxDQUFDK0MsS0FBSyxDQUFDLENBQUM7Z0JBQ3RCLElBQUk1TSxHQUFHLEVBQUU7a0JBQ1AwTCxNQUFNLENBQUMxTCxHQUFHLENBQUM7a0JBQ1g7Z0JBQ0Y7Z0JBQ0F5TCxPQUFPLENBQUMsR0FBRzVCLElBQUksQ0FBQztjQUNsQixDQUFDO1lBQ0gsQ0FBQyxDQUFDO1VBQ0o7UUFDRjs7UUFFQTtRQUNBLElBQUlxQyxVQUFVLENBQUNXLEtBQUssS0FBSyxJQUFJLEVBQUU7VUFDN0I5TixPQUFPLENBQUNtTixVQUFVLEdBQUdBLFVBQVUsQ0FBQ1csS0FBSztRQUN2QztRQUVBLE1BQU1DLGFBQWEsR0FBRyxJQUFJek8sYUFBYSxDQUFDO1VBQ3RDRyxRQUFRO1VBQ1JHLFFBQVEsRUFBRUEsUUFBUTtVQUNsQkUsVUFBVSxFQUFFWixJQUFJO1VBQ2hCZ0IsZ0JBQWdCLEVBQUVWLE9BQU8sQ0FBQ1UsZ0JBQWdCO1VBQzFDRSxJQUFJLEVBQUUsQ0FBQyxDQUFDWixPQUFPLENBQUNZLElBQUk7VUFDcEJKLE9BQU8sRUFBRUEsT0FBTztVQUNoQkssT0FBTyxFQUFFLENBQUMsQ0FBQ2IsT0FBTyxDQUFDYTtRQUNyQixDQUFDLENBQUM7UUFFRixJQUFJYSxNQUFNO1FBRVYsSUFBSWtMLE9BQU8sRUFBRTtVQUNYbEwsTUFBTSxHQUFHMUIsT0FBTyxDQUFDZ08sZUFBZSxHQUFHcEIsT0FBTyxDQUFDRSxJQUFJLENBQUMsTUFBTVosZUFBZSxDQUFDLEdBQUdVLE9BQU87UUFDbEYsQ0FBQyxNQUFNO1VBQ0xsTCxNQUFNLEdBQUcxQixPQUFPLENBQUNnTyxlQUFlLEdBQUc5QixlQUFlLEdBQUdPLFNBQVM7UUFDaEU7UUFFQSxJQUFJek0sT0FBTyxDQUFDNE4sb0JBQW9CLEVBQUU7VUFDaEMsT0FBTztZQUNMVyxhQUFhO1lBQ2I3TTtVQUNGLENBQUM7UUFDSDtRQUVBaEMsSUFBSSxDQUFDOE8scUJBQXFCLENBQUNELGFBQWEsRUFBRXZPLE9BQU8sQ0FBQztRQUNsRCxPQUFPMEIsTUFBTTtNQUNmO01BRUFrSyxTQUFTQSxDQUFDckUsSUFBSSxFQUFFK0QsSUFBSSxFQUFFdEwsT0FBTyxFQUFFO1FBQzdCO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQSxNQUFNTixJQUFJLEdBQUcsSUFBSTtRQUNqQixNQUFNK08sU0FBUyxHQUFHblAsR0FBRyxDQUFDc0wsd0JBQXdCLENBQUM4RCxHQUFHLENBQUMsQ0FBQztRQUNwRCxNQUFNQyxJQUFJLEdBQUdqUCxJQUFJLENBQUNvRixlQUFlLENBQUN5QyxJQUFJLENBQUM7UUFDdkMsTUFBTThELG1CQUFtQixHQUFHb0QsU0FBUyxhQUFUQSxTQUFTLHVCQUFUQSxTQUFTLENBQUVHLFlBQVk7UUFDbkQsTUFBTXhELGVBQWUsR0FBR3FELFNBQVMsYUFBVEEsU0FBUyx1QkFBVEEsU0FBUyxDQUFFSSxnQkFBZ0I7UUFDbkQsTUFBTWxCLFVBQVUsR0FBRztVQUFFVyxLQUFLLEVBQUU7UUFBSSxDQUFDO1FBRWpDLE1BQU1RLGFBQWEsR0FBRztVQUNwQnpELG1CQUFtQjtVQUNuQnNDLFVBQVU7VUFDVnZDO1FBQ0YsQ0FBQztRQUNELElBQUksQ0FBQ3VELElBQUksRUFBRTtVQUNULE9BQUE3TSxhQUFBLENBQUFBLGFBQUEsS0FBWWdOLGFBQWE7WUFBRTlDLE9BQU8sRUFBRTtVQUFLO1FBQzNDOztRQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBOztRQUVBLE1BQU0rQyxtQkFBbUIsR0FBR0EsQ0FBQSxLQUFNO1VBQ2hDLElBQUlwQixVQUFVLENBQUNXLEtBQUssS0FBSyxJQUFJLEVBQUU7WUFDN0JYLFVBQVUsQ0FBQ1csS0FBSyxHQUFHbk0sU0FBUyxDQUFDNk0sV0FBVyxDQUFDUCxTQUFTLEVBQUVsSCxJQUFJLENBQUM7VUFDM0Q7VUFDQSxPQUFPb0csVUFBVSxDQUFDVyxLQUFLO1FBQ3pCLENBQUM7UUFFRCxNQUFNVyxTQUFTLEdBQUdDLE1BQU0sSUFBSTtVQUMxQnhQLElBQUksQ0FBQ3VQLFNBQVMsQ0FBQ0MsTUFBTSxDQUFDO1FBQ3hCLENBQUM7UUFFRCxNQUFNcEQsVUFBVSxHQUFHLElBQUkzSixTQUFTLENBQUNnTixnQkFBZ0IsQ0FBQztVQUNoRDVILElBQUk7VUFDSnFILFlBQVksRUFBRSxJQUFJO1VBQ2xCTSxNQUFNLEVBQUV4UCxJQUFJLENBQUN3UCxNQUFNLENBQUMsQ0FBQztVQUNyQjlELGVBQWUsRUFBRXBMLE9BQU8sYUFBUEEsT0FBTyx1QkFBUEEsT0FBTyxDQUFFb0wsZUFBZTtVQUN6QzZELFNBQVMsRUFBRUEsU0FBUztVQUNwQnRCLFVBQVVBLENBQUEsRUFBRztZQUNYLE9BQU9vQixtQkFBbUIsQ0FBQyxDQUFDO1VBQzlCO1FBQ0YsQ0FBQyxDQUFDOztRQUVGO1FBQ0E7UUFDQSxNQUFNbEQsY0FBYyxHQUFHQSxDQUFBLEtBQU07VUFDekIsSUFBSTNKLE1BQU0sQ0FBQytFLFFBQVEsRUFBRTtZQUNuQjtZQUNBO1lBQ0EsT0FBTy9FLE1BQU0sQ0FBQ2tOLGdCQUFnQixDQUFDLE1BQU07Y0FDbkM7Y0FDQSxPQUFPVCxJQUFJLENBQUNwRCxLQUFLLENBQUNPLFVBQVUsRUFBRXpKLEtBQUssQ0FBQ3lILEtBQUssQ0FBQ3dCLElBQUksQ0FBQyxDQUFDO1lBQ2xELENBQUMsQ0FBQztVQUNKLENBQUMsTUFBTTtZQUNMLE9BQU9xRCxJQUFJLENBQUNwRCxLQUFLLENBQUNPLFVBQVUsRUFBRXpKLEtBQUssQ0FBQ3lILEtBQUssQ0FBQ3dCLElBQUksQ0FBQyxDQUFDO1VBQ2xEO1FBQ0osQ0FBQztRQUNELE9BQUF4SixhQUFBLENBQUFBLGFBQUEsS0FBWWdOLGFBQWE7VUFBRTlDLE9BQU8sRUFBRSxJQUFJO1VBQUVILGNBQWM7VUFBRUM7UUFBVTtNQUN0RTs7TUFFQTtNQUNBO01BQ0E7TUFDQUcsY0FBY0EsQ0FBQSxFQUFHO1FBQ2YsSUFBSSxDQUFFLElBQUksQ0FBQ29ELHFCQUFxQixDQUFDLENBQUMsRUFBRTtVQUNsQyxJQUFJLENBQUNDLDBCQUEwQixDQUFDLENBQUM7UUFDbkM7UUFFQTdMLE1BQU0sQ0FBQzJGLE1BQU0sQ0FBQyxJQUFJLENBQUN2RSxPQUFPLENBQUMsQ0FBQzhDLE9BQU8sQ0FBRUYsS0FBSyxJQUFLO1VBQzdDQSxLQUFLLENBQUM4SCxhQUFhLENBQUMsQ0FBQztRQUN2QixDQUFDLENBQUM7TUFDSjs7TUFFQTtNQUNBO01BQ0E7TUFDQTFCLDBCQUEwQkEsQ0FBQzVOLFFBQVEsRUFBRTtRQUNuQyxNQUFNUCxJQUFJLEdBQUcsSUFBSTtRQUNqQixJQUFJQSxJQUFJLENBQUMwRix1QkFBdUIsQ0FBQ25GLFFBQVEsQ0FBQyxFQUN4QyxNQUFNLElBQUlrQixLQUFLLENBQUMsa0RBQWtELENBQUM7UUFFckUsTUFBTXFPLFdBQVcsR0FBRyxFQUFFO1FBRXRCL0wsTUFBTSxDQUFDc0gsT0FBTyxDQUFDckwsSUFBSSxDQUFDbUYsT0FBTyxDQUFDLENBQUM4QyxPQUFPLENBQUM4SCxLQUFBLElBQXlCO1VBQUEsSUFBeEIsQ0FBQ0MsVUFBVSxFQUFFakksS0FBSyxDQUFDLEdBQUFnSSxLQUFBO1VBQ3ZELE1BQU1FLFNBQVMsR0FBR2xJLEtBQUssQ0FBQ21JLGlCQUFpQixDQUFDLENBQUM7VUFDM0M7VUFDQSxJQUFJLENBQUVELFNBQVMsRUFBRTtVQUNqQkEsU0FBUyxDQUFDaEksT0FBTyxDQUFDLENBQUNrSSxHQUFHLEVBQUVwRyxFQUFFLEtBQUs7WUFDN0IrRixXQUFXLENBQUNNLElBQUksQ0FBQztjQUFFSixVQUFVO2NBQUVqRztZQUFHLENBQUMsQ0FBQztZQUNwQyxJQUFJLENBQUVqSCxNQUFNLENBQUNrRyxJQUFJLENBQUNoSixJQUFJLENBQUMyRixnQkFBZ0IsRUFBRXFLLFVBQVUsQ0FBQyxFQUFFO2NBQ3BEaFEsSUFBSSxDQUFDMkYsZ0JBQWdCLENBQUNxSyxVQUFVLENBQUMsR0FBRyxJQUFJN00sVUFBVSxDQUFDLENBQUM7WUFDdEQ7WUFDQSxNQUFNa04sU0FBUyxHQUFHclEsSUFBSSxDQUFDMkYsZ0JBQWdCLENBQUNxSyxVQUFVLENBQUMsQ0FBQ00sVUFBVSxDQUM1RHZHLEVBQUUsRUFDRmhHLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FDcEIsQ0FBQztZQUNELElBQUlxTSxTQUFTLENBQUNFLGNBQWMsRUFBRTtjQUM1QjtjQUNBO2NBQ0FGLFNBQVMsQ0FBQ0UsY0FBYyxDQUFDaFEsUUFBUSxDQUFDLEdBQUcsSUFBSTtZQUMzQyxDQUFDLE1BQU07Y0FDTDtjQUNBOFAsU0FBUyxDQUFDRyxRQUFRLEdBQUdMLEdBQUc7Y0FDeEJFLFNBQVMsQ0FBQ0ksY0FBYyxHQUFHLEVBQUU7Y0FDN0JKLFNBQVMsQ0FBQ0UsY0FBYyxHQUFHeE0sTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDO2NBQzlDcU0sU0FBUyxDQUFDRSxjQUFjLENBQUNoUSxRQUFRLENBQUMsR0FBRyxJQUFJO1lBQzNDO1VBQ0YsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDO1FBQ0YsSUFBSSxDQUFFMEMsT0FBTyxDQUFDNk0sV0FBVyxDQUFDLEVBQUU7VUFDMUI5UCxJQUFJLENBQUMwRix1QkFBdUIsQ0FBQ25GLFFBQVEsQ0FBQyxHQUFHdVAsV0FBVztRQUN0RDtNQUNGOztNQUVBO01BQ0E7TUFDQVksZUFBZUEsQ0FBQSxFQUFHO1FBQ2hCM00sTUFBTSxDQUFDMkYsTUFBTSxDQUFDLElBQUksQ0FBQ2hELGNBQWMsQ0FBQyxDQUFDdUIsT0FBTyxDQUFFMkIsR0FBRyxJQUFLO1VBQ2xEO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBLElBQUlBLEdBQUcsQ0FBQy9CLElBQUksS0FBSyxrQ0FBa0MsRUFBRTtZQUNuRCtCLEdBQUcsQ0FBQ3RDLElBQUksQ0FBQyxDQUFDO1VBQ1o7UUFDRixDQUFDLENBQUM7TUFDSjs7TUFFQTtNQUNBM0YsS0FBS0EsQ0FBQ2dQLEdBQUcsRUFBRTtRQUNULElBQUksQ0FBQ2xNLE9BQU8sQ0FBQ21NLElBQUksQ0FBQ25PLFNBQVMsQ0FBQ29PLFlBQVksQ0FBQ0YsR0FBRyxDQUFDLENBQUM7TUFDaEQ7O01BRUE7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBO01BQ0FuRyxXQUFXQSxDQUFDbUcsR0FBRyxFQUFFO1FBQ2YsSUFBSSxDQUFDaFAsS0FBSyxDQUFDZ1AsR0FBRyxFQUFFLElBQUksQ0FBQztNQUN2Qjs7TUFFQTtNQUNBO01BQ0E7TUFDQUcsZUFBZUEsQ0FBQ0MsS0FBSyxFQUFFO1FBQ3JCLElBQUksQ0FBQ3RNLE9BQU8sQ0FBQ3FNLGVBQWUsQ0FBQ0MsS0FBSyxDQUFDO01BQ3JDOztNQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0VDLE1BQU1BLENBQUEsRUFBVTtRQUNkLE9BQU8sSUFBSSxDQUFDdk0sT0FBTyxDQUFDdU0sTUFBTSxDQUFDLEdBQUE3SSxTQUFPLENBQUM7TUFDckM7O01BRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtNQUVFOEksU0FBU0EsQ0FBQSxFQUFVO1FBQ2pCLE9BQU8sSUFBSSxDQUFDeE0sT0FBTyxDQUFDd00sU0FBUyxDQUFDLEdBQUE5SSxTQUFPLENBQUM7TUFDeEM7O01BRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFDRStJLFVBQVVBLENBQUEsRUFBVTtRQUNsQixPQUFPLElBQUksQ0FBQ3pNLE9BQU8sQ0FBQ3lNLFVBQVUsQ0FBQyxHQUFBL0ksU0FBTyxDQUFDO01BQ3pDO01BRUFnSixLQUFLQSxDQUFBLEVBQUc7UUFDTixPQUFPLElBQUksQ0FBQzFNLE9BQU8sQ0FBQ3lNLFVBQVUsQ0FBQztVQUFFRSxVQUFVLEVBQUU7UUFBSyxDQUFDLENBQUM7TUFDdEQ7O01BRUE7TUFDQTtNQUNBO01BQ0E1QixNQUFNQSxDQUFBLEVBQUc7UUFDUCxJQUFJLElBQUksQ0FBQzVJLFdBQVcsRUFBRSxJQUFJLENBQUNBLFdBQVcsQ0FBQytELE1BQU0sQ0FBQyxDQUFDO1FBQy9DLE9BQU8sSUFBSSxDQUFDaEUsT0FBTztNQUNyQjtNQUVBNEksU0FBU0EsQ0FBQ0MsTUFBTSxFQUFFO1FBQ2hCO1FBQ0EsSUFBSSxJQUFJLENBQUM3SSxPQUFPLEtBQUs2SSxNQUFNLEVBQUU7UUFDN0IsSUFBSSxDQUFDN0ksT0FBTyxHQUFHNkksTUFBTTtRQUNyQixJQUFJLElBQUksQ0FBQzVJLFdBQVcsRUFBRSxJQUFJLENBQUNBLFdBQVcsQ0FBQzJELE9BQU8sQ0FBQyxDQUFDO01BQ2xEOztNQUVBO01BQ0E7TUFDQTtNQUNBb0YscUJBQXFCQSxDQUFBLEVBQUc7UUFDdEIsT0FDRSxDQUFFMU0sT0FBTyxDQUFDLElBQUksQ0FBQzZDLGlCQUFpQixDQUFDLElBQ2pDLENBQUU3QyxPQUFPLENBQUMsSUFBSSxDQUFDdkIsMEJBQTBCLENBQUM7TUFFOUM7O01BRUE7TUFDQTtNQUNBMlAseUJBQXlCQSxDQUFBLEVBQUc7UUFDMUIsTUFBTUMsUUFBUSxHQUFHLElBQUksQ0FBQ2hRLGVBQWU7UUFDckMsT0FBT3lDLE1BQU0sQ0FBQzJGLE1BQU0sQ0FBQzRILFFBQVEsQ0FBQyxDQUFDL0gsSUFBSSxDQUFFZ0ksT0FBTyxJQUFLLENBQUMsQ0FBQ0EsT0FBTyxDQUFDL1EsV0FBVyxDQUFDO01BQ3pFO01BRUEsTUFBTWdSLG1CQUFtQkEsQ0FBQzlJLEdBQUcsRUFBRTtRQUM3QixNQUFNMUksSUFBSSxHQUFHLElBQUk7UUFFakIsSUFBSUEsSUFBSSxDQUFDa0YsUUFBUSxLQUFLLE1BQU0sSUFBSWxGLElBQUksQ0FBQ3VGLGtCQUFrQixLQUFLLENBQUMsRUFBRTtVQUM3RHZGLElBQUksQ0FBQ3FILFVBQVUsR0FBRyxJQUFJNUUsU0FBUyxDQUFDZ1AsU0FBUyxDQUFDO1lBQ3hDN04saUJBQWlCLEVBQUU1RCxJQUFJLENBQUN1RixrQkFBa0I7WUFDMUMxQixnQkFBZ0IsRUFBRTdELElBQUksQ0FBQ3dGLGlCQUFpQjtZQUN4Q2tNLFNBQVNBLENBQUEsRUFBRztjQUNWMVIsSUFBSSxDQUFDOFEsZUFBZSxDQUNsQixJQUFJbFIsR0FBRyxDQUFDK0UsZUFBZSxDQUFDLHlCQUF5QixDQUNuRCxDQUFDO1lBQ0gsQ0FBQztZQUNEZ04sUUFBUUEsQ0FBQSxFQUFHO2NBQ1QzUixJQUFJLENBQUMyQixLQUFLLENBQUM7Z0JBQUUrRyxHQUFHLEVBQUU7Y0FBTyxDQUFDLENBQUM7WUFDN0I7VUFDRixDQUFDLENBQUM7VUFDRjFJLElBQUksQ0FBQ3FILFVBQVUsQ0FBQ3VLLEtBQUssQ0FBQyxDQUFDO1FBQ3pCOztRQUVBO1FBQ0EsSUFBSTVSLElBQUksQ0FBQ2dGLGNBQWMsRUFBRWhGLElBQUksQ0FBQytGLFlBQVksR0FBRyxJQUFJO1FBRWpELElBQUk4TCw0QkFBNEI7UUFDaEMsSUFBSSxPQUFPbkosR0FBRyxDQUFDb0osT0FBTyxLQUFLLFFBQVEsRUFBRTtVQUNuQ0QsNEJBQTRCLEdBQUc3UixJQUFJLENBQUNnRixjQUFjLEtBQUswRCxHQUFHLENBQUNvSixPQUFPO1VBQ2xFOVIsSUFBSSxDQUFDZ0YsY0FBYyxHQUFHMEQsR0FBRyxDQUFDb0osT0FBTztRQUNuQztRQUVBLElBQUlELDRCQUE0QixFQUFFO1VBQ2hDO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtRQUNGOztRQUVBOztRQUVBO1FBQ0E7UUFDQTdSLElBQUksQ0FBQ2dHLHdCQUF3QixHQUFHakMsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBRW5ELElBQUloRSxJQUFJLENBQUMrRixZQUFZLEVBQUU7VUFDckI7VUFDQTtVQUNBL0YsSUFBSSxDQUFDMEYsdUJBQXVCLEdBQUczQixNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUM7VUFDbERoRSxJQUFJLENBQUMyRixnQkFBZ0IsR0FBRzVCLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQztRQUM3Qzs7UUFFQTtRQUNBaEUsSUFBSSxDQUFDNEYscUJBQXFCLEdBQUcsRUFBRTs7UUFFL0I7UUFDQTtRQUNBO1FBQ0E7UUFDQTVGLElBQUksQ0FBQzhGLGlCQUFpQixHQUFHL0IsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQzVDRCxNQUFNLENBQUNzSCxPQUFPLENBQUNyTCxJQUFJLENBQUMwRyxjQUFjLENBQUMsQ0FBQ3VCLE9BQU8sQ0FBQzhKLEtBQUEsSUFBZTtVQUFBLElBQWQsQ0FBQ2hJLEVBQUUsRUFBRUgsR0FBRyxDQUFDLEdBQUFtSSxLQUFBO1VBQ3BELElBQUluSSxHQUFHLENBQUNJLEtBQUssRUFBRTtZQUNiaEssSUFBSSxDQUFDOEYsaUJBQWlCLENBQUNpRSxFQUFFLENBQUMsR0FBRyxJQUFJO1VBQ25DO1FBQ0YsQ0FBQyxDQUFDOztRQUVGO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0EvSixJQUFJLENBQUMwQiwwQkFBMEIsR0FBR3FDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNyRCxJQUFJaEUsSUFBSSxDQUFDK0YsWUFBWSxFQUFFO1VBQ3JCLE1BQU11TCxRQUFRLEdBQUd0UixJQUFJLENBQUNzQixlQUFlO1VBQ3JDMEIsSUFBSSxDQUFDc08sUUFBUSxDQUFDLENBQUNySixPQUFPLENBQUM4QixFQUFFLElBQUk7WUFDM0IsTUFBTXdILE9BQU8sR0FBR0QsUUFBUSxDQUFDdkgsRUFBRSxDQUFDO1lBQzVCLElBQUl3SCxPQUFPLENBQUMvUCxTQUFTLENBQUMsQ0FBQyxFQUFFO2NBQ3ZCO2NBQ0E7Y0FDQTtjQUNBO2NBQ0F4QixJQUFJLENBQUM0RixxQkFBcUIsQ0FBQ3dLLElBQUksQ0FDN0I7Z0JBQUEsT0FBYW1CLE9BQU8sQ0FBQ3RQLFdBQVcsQ0FBQyxHQUFBa0csU0FBTyxDQUFDO2NBQUEsQ0FDM0MsQ0FBQztZQUNILENBQUMsTUFBTSxJQUFJb0osT0FBTyxDQUFDL1EsV0FBVyxFQUFFO2NBQzlCO2NBQ0E7Y0FDQTtjQUNBO2NBQ0E7Y0FDQTtjQUNBO2NBQ0E7Y0FDQTtjQUNBUixJQUFJLENBQUMwQiwwQkFBMEIsQ0FBQzZQLE9BQU8sQ0FBQ2hSLFFBQVEsQ0FBQyxHQUFHLElBQUk7WUFDMUQ7VUFDRixDQUFDLENBQUM7UUFDSjtRQUVBUCxJQUFJLENBQUM2RixnQ0FBZ0MsR0FBRyxFQUFFOztRQUUxQztRQUNBO1FBQ0EsSUFBSSxDQUFFN0YsSUFBSSxDQUFDMlAscUJBQXFCLENBQUMsQ0FBQyxFQUFFO1VBQ2xDLElBQUkzUCxJQUFJLENBQUMrRixZQUFZLEVBQUU7WUFDckIsS0FBSyxNQUFNZ0MsS0FBSyxJQUFJaEUsTUFBTSxDQUFDMkYsTUFBTSxDQUFDMUosSUFBSSxDQUFDbUYsT0FBTyxDQUFDLEVBQUU7Y0FDL0MsTUFBTTRDLEtBQUssQ0FBQ1MsV0FBVyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUM7Y0FDaEMsTUFBTVQsS0FBSyxDQUFDYSxTQUFTLENBQUMsQ0FBQztZQUN6QjtZQUNBNUksSUFBSSxDQUFDK0YsWUFBWSxHQUFHLEtBQUs7VUFDM0I7VUFDQS9GLElBQUksQ0FBQ2dTLHdCQUF3QixDQUFDLENBQUM7UUFDakM7TUFDRjtNQUVBLE1BQU1DLHNCQUFzQkEsQ0FBQ3ZKLEdBQUcsRUFBRXdKLE9BQU8sRUFBRTtRQUN6QyxNQUFNQyxXQUFXLEdBQUd6SixHQUFHLENBQUNBLEdBQUc7O1FBRTNCO1FBQ0EsSUFBSXlKLFdBQVcsS0FBSyxPQUFPLEVBQUU7VUFDM0IsTUFBTSxJQUFJLENBQUNDLGNBQWMsQ0FBQzFKLEdBQUcsRUFBRXdKLE9BQU8sQ0FBQztRQUN6QyxDQUFDLE1BQU0sSUFBSUMsV0FBVyxLQUFLLFNBQVMsRUFBRTtVQUNwQyxJQUFJLENBQUNFLGdCQUFnQixDQUFDM0osR0FBRyxFQUFFd0osT0FBTyxDQUFDO1FBQ3JDLENBQUMsTUFBTSxJQUFJQyxXQUFXLEtBQUssU0FBUyxFQUFFO1VBQ3BDLElBQUksQ0FBQ0csZ0JBQWdCLENBQUM1SixHQUFHLEVBQUV3SixPQUFPLENBQUM7UUFDckMsQ0FBQyxNQUFNLElBQUlDLFdBQVcsS0FBSyxPQUFPLEVBQUU7VUFDbEMsSUFBSSxDQUFDSSxjQUFjLENBQUM3SixHQUFHLEVBQUV3SixPQUFPLENBQUM7UUFDbkMsQ0FBQyxNQUFNLElBQUlDLFdBQVcsS0FBSyxTQUFTLEVBQUU7VUFDcEMsSUFBSSxDQUFDSyxnQkFBZ0IsQ0FBQzlKLEdBQUcsRUFBRXdKLE9BQU8sQ0FBQztRQUNyQyxDQUFDLE1BQU0sSUFBSUMsV0FBVyxLQUFLLE9BQU8sRUFBRTtVQUNsQztRQUFBLENBQ0QsTUFBTTtVQUNMM1AsTUFBTSxDQUFDbUIsTUFBTSxDQUFDLCtDQUErQyxFQUFFK0UsR0FBRyxDQUFDO1FBQ3JFO01BQ0Y7TUFFQSxNQUFNK0osY0FBY0EsQ0FBQy9KLEdBQUcsRUFBRTtRQUN4QixNQUFNMUksSUFBSSxHQUFHLElBQUk7UUFFakIsSUFBSUEsSUFBSSxDQUFDMlAscUJBQXFCLENBQUMsQ0FBQyxFQUFFO1VBQ2hDM1AsSUFBSSxDQUFDNkYsZ0NBQWdDLENBQUN1SyxJQUFJLENBQUMxSCxHQUFHLENBQUM7VUFFL0MsSUFBSUEsR0FBRyxDQUFDQSxHQUFHLEtBQUssT0FBTyxFQUFFO1lBQ3ZCLE9BQU8xSSxJQUFJLENBQUM4RixpQkFBaUIsQ0FBQzRDLEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQztVQUN2QztVQUVBLElBQUlyQixHQUFHLENBQUNnSyxJQUFJLEVBQUU7WUFDWmhLLEdBQUcsQ0FBQ2dLLElBQUksQ0FBQ3pLLE9BQU8sQ0FBQzBLLEtBQUssSUFBSTtjQUN4QixPQUFPM1MsSUFBSSxDQUFDOEYsaUJBQWlCLENBQUM2TSxLQUFLLENBQUM7WUFDdEMsQ0FBQyxDQUFDO1VBQ0o7VUFFQSxJQUFJakssR0FBRyxDQUFDMEMsT0FBTyxFQUFFO1lBQ2YxQyxHQUFHLENBQUMwQyxPQUFPLENBQUNuRCxPQUFPLENBQUMxSCxRQUFRLElBQUk7Y0FDOUIsT0FBT1AsSUFBSSxDQUFDMEIsMEJBQTBCLENBQUNuQixRQUFRLENBQUM7WUFDbEQsQ0FBQyxDQUFDO1VBQ0o7VUFFQSxJQUFJUCxJQUFJLENBQUMyUCxxQkFBcUIsQ0FBQyxDQUFDLEVBQUU7WUFDaEM7VUFDRjs7VUFFQTtVQUNBO1VBQ0E7O1VBRUEsTUFBTWlELGdCQUFnQixHQUFHNVMsSUFBSSxDQUFDNkYsZ0NBQWdDO1VBQzlELEtBQUssTUFBTWdOLGVBQWUsSUFBSTlPLE1BQU0sQ0FBQzJGLE1BQU0sQ0FBQ2tKLGdCQUFnQixDQUFDLEVBQUU7WUFDN0QsTUFBTTVTLElBQUksQ0FBQ2lTLHNCQUFzQixDQUMvQlksZUFBZSxFQUNmN1MsSUFBSSxDQUFDcUcsZUFDUCxDQUFDO1VBQ0g7VUFFQXJHLElBQUksQ0FBQzZGLGdDQUFnQyxHQUFHLEVBQUU7UUFFNUMsQ0FBQyxNQUFNO1VBQ0wsTUFBTTdGLElBQUksQ0FBQ2lTLHNCQUFzQixDQUFDdkosR0FBRyxFQUFFMUksSUFBSSxDQUFDcUcsZUFBZSxDQUFDO1FBQzlEOztRQUVBO1FBQ0E7UUFDQTtRQUNBLE1BQU15TSxhQUFhLEdBQ2pCcEssR0FBRyxDQUFDQSxHQUFHLEtBQUssT0FBTyxJQUNuQkEsR0FBRyxDQUFDQSxHQUFHLEtBQUssU0FBUyxJQUNyQkEsR0FBRyxDQUFDQSxHQUFHLEtBQUssU0FBUztRQUV2QixJQUFJMUksSUFBSSxDQUFDd0csdUJBQXVCLEtBQUssQ0FBQyxJQUFJLENBQUVzTSxhQUFhLEVBQUU7VUFDekQsTUFBTTlTLElBQUksQ0FBQ29HLG9CQUFvQixDQUFDLENBQUM7VUFDakM7UUFDRjtRQUVBLElBQUlwRyxJQUFJLENBQUNzRyxzQkFBc0IsS0FBSyxJQUFJLEVBQUU7VUFDeEN0RyxJQUFJLENBQUNzRyxzQkFBc0IsR0FDekIsSUFBSXlNLElBQUksQ0FBQyxDQUFDLENBQUNDLE9BQU8sQ0FBQyxDQUFDLEdBQUdoVCxJQUFJLENBQUN5RyxxQkFBcUI7UUFDckQsQ0FBQyxNQUFNLElBQUl6RyxJQUFJLENBQUNzRyxzQkFBc0IsR0FBRyxJQUFJeU0sSUFBSSxDQUFDLENBQUMsQ0FBQ0MsT0FBTyxDQUFDLENBQUMsRUFBRTtVQUM3RCxNQUFNaFQsSUFBSSxDQUFDb0csb0JBQW9CLENBQUMsQ0FBQztVQUNqQztRQUNGO1FBRUEsSUFBSXBHLElBQUksQ0FBQ3VHLDBCQUEwQixFQUFFO1VBQ25DME0sWUFBWSxDQUFDalQsSUFBSSxDQUFDdUcsMEJBQTBCLENBQUM7UUFDL0M7UUFDQXZHLElBQUksQ0FBQ3VHLDBCQUEwQixHQUFHMk0sVUFBVSxDQUFDLE1BQU07VUFDakQ7VUFDQTtVQUNBbFQsSUFBSSxDQUFDbVQsc0JBQXNCLEdBQUduVCxJQUFJLENBQUNrRyxxQkFBcUIsQ0FBQyxDQUFDO1VBRTFELElBQUkxRCxNQUFNLENBQUNrSyxVQUFVLENBQUMxTSxJQUFJLENBQUNtVCxzQkFBc0IsQ0FBQyxFQUFFO1lBQ2xEblQsSUFBSSxDQUFDbVQsc0JBQXNCLENBQUNDLE9BQU8sQ0FDakMsTUFBT3BULElBQUksQ0FBQ21ULHNCQUFzQixHQUFHcEcsU0FDdkMsQ0FBQztVQUNIO1FBQ0YsQ0FBQyxFQUFFL00sSUFBSSxDQUFDd0csdUJBQXVCLENBQUM7TUFDbEM7TUFFQTZNLHNCQUFzQkEsQ0FBQSxFQUFHO1FBQ3ZCLE1BQU1yVCxJQUFJLEdBQUcsSUFBSTtRQUNqQixJQUFJQSxJQUFJLENBQUN1RywwQkFBMEIsRUFBRTtVQUNuQzBNLFlBQVksQ0FBQ2pULElBQUksQ0FBQ3VHLDBCQUEwQixDQUFDO1VBQzdDdkcsSUFBSSxDQUFDdUcsMEJBQTBCLEdBQUcsSUFBSTtRQUN4QztRQUVBdkcsSUFBSSxDQUFDc0csc0JBQXNCLEdBQUcsSUFBSTtRQUNsQztRQUNBO1FBQ0E7UUFDQSxNQUFNZ04sTUFBTSxHQUFHdFQsSUFBSSxDQUFDcUcsZUFBZTtRQUNuQ3JHLElBQUksQ0FBQ3FHLGVBQWUsR0FBR3RDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQztRQUMxQyxPQUFPc1AsTUFBTTtNQUNmO01BRUEsTUFBTUMsMEJBQTBCQSxDQUFBLEVBQUc7UUFDakMsTUFBTXZULElBQUksR0FBRyxJQUFJO1FBQ2pCLE1BQU1zVCxNQUFNLEdBQUd0VCxJQUFJLENBQUNxVCxzQkFBc0IsQ0FBQyxDQUFDO1FBQzVDLE1BQU1yVCxJQUFJLENBQUN3VCxvQkFBb0IsQ0FBQ0YsTUFBTSxDQUFDO01BQ3pDO01BQ0ExRCwwQkFBMEJBLENBQUEsRUFBRztRQUMzQixNQUFNNVAsSUFBSSxHQUFHLElBQUk7UUFDakIsTUFBTXNULE1BQU0sR0FBR3RULElBQUksQ0FBQ3FULHNCQUFzQixDQUFDLENBQUM7UUFDNUNyVCxJQUFJLENBQUN5VCxvQkFBb0IsQ0FBQ0gsTUFBTSxDQUFDO01BQ25DO01BQ0FsTixvQkFBb0JBLENBQUEsRUFBRztRQUNyQixNQUFNcEcsSUFBSSxHQUFHLElBQUk7UUFDakIsT0FBT3dDLE1BQU0sQ0FBQ3NFLFFBQVEsR0FDbEI5RyxJQUFJLENBQUM0UCwwQkFBMEIsQ0FBQyxDQUFDLEdBQ2pDNVAsSUFBSSxDQUFDdVQsMEJBQTBCLENBQUMsQ0FBQztNQUN2QztNQUNBLE1BQU1DLG9CQUFvQkEsQ0FBQ3RCLE9BQU8sRUFBRTtRQUNsQyxNQUFNbFMsSUFBSSxHQUFHLElBQUk7UUFFakIsSUFBSUEsSUFBSSxDQUFDK0YsWUFBWSxJQUFJLENBQUU5QyxPQUFPLENBQUNpUCxPQUFPLENBQUMsRUFBRTtVQUMzQzs7VUFFQSxLQUFLLE1BQU0sQ0FBQ3dCLFNBQVMsRUFBRTNMLEtBQUssQ0FBQyxJQUFJaEUsTUFBTSxDQUFDc0gsT0FBTyxDQUFDckwsSUFBSSxDQUFDbUYsT0FBTyxDQUFDLEVBQUU7WUFDN0QsTUFBTTRDLEtBQUssQ0FBQ1MsV0FBVyxDQUNyQjFGLE1BQU0sQ0FBQ2tHLElBQUksQ0FBQ2tKLE9BQU8sRUFBRXdCLFNBQVMsQ0FBQyxHQUMzQnhCLE9BQU8sQ0FBQ3dCLFNBQVMsQ0FBQyxDQUFDakwsTUFBTSxHQUN6QixDQUFDLEVBQ0x6SSxJQUFJLENBQUMrRixZQUNQLENBQUM7VUFDSDtVQUVBL0YsSUFBSSxDQUFDK0YsWUFBWSxHQUFHLEtBQUs7VUFFekIsS0FBSyxNQUFNLENBQUMyTixTQUFTLEVBQUVDLGNBQWMsQ0FBQyxJQUFJNVAsTUFBTSxDQUFDc0gsT0FBTyxDQUFDNkcsT0FBTyxDQUFDLEVBQUU7WUFDakUsTUFBTW5LLEtBQUssR0FBRy9ILElBQUksQ0FBQ21GLE9BQU8sQ0FBQ3VPLFNBQVMsQ0FBQztZQUNyQyxJQUFJM0wsS0FBSyxFQUFFO2NBQ1QsS0FBSyxNQUFNNkwsYUFBYSxJQUFJRCxjQUFjLEVBQUU7Z0JBQzFDLE1BQU01TCxLQUFLLENBQUNZLE1BQU0sQ0FBQ2lMLGFBQWEsQ0FBQztjQUNuQztZQUNGLENBQUMsTUFBTTtjQUNMO2NBQ0E7Y0FDQTtjQUNBO2NBQ0E7Y0FDQSxNQUFNMUIsT0FBTyxHQUFHbFMsSUFBSSxDQUFDZ0csd0JBQXdCO2NBRTdDLElBQUksQ0FBRWxELE1BQU0sQ0FBQ2tHLElBQUksQ0FBQ2tKLE9BQU8sRUFBRXdCLFNBQVMsQ0FBQyxFQUFFO2dCQUNyQ3hCLE9BQU8sQ0FBQ3dCLFNBQVMsQ0FBQyxHQUFHLEVBQUU7Y0FDekI7Y0FFQXhCLE9BQU8sQ0FBQ3dCLFNBQVMsQ0FBQyxDQUFDdEQsSUFBSSxDQUFDLEdBQUd1RCxjQUFjLENBQUM7WUFDNUM7VUFDRjtVQUNBO1VBQ0EsS0FBSyxNQUFNNUwsS0FBSyxJQUFJaEUsTUFBTSxDQUFDMkYsTUFBTSxDQUFDMUosSUFBSSxDQUFDbUYsT0FBTyxDQUFDLEVBQUU7WUFDL0MsTUFBTTRDLEtBQUssQ0FBQ2EsU0FBUyxDQUFDLENBQUM7VUFDekI7UUFDRjtRQUVBNUksSUFBSSxDQUFDZ1Msd0JBQXdCLENBQUMsQ0FBQztNQUNqQztNQUNBeUIsb0JBQW9CQSxDQUFDdkIsT0FBTyxFQUFFO1FBQzVCLE1BQU1sUyxJQUFJLEdBQUcsSUFBSTtRQUVqQixJQUFJQSxJQUFJLENBQUMrRixZQUFZLElBQUksQ0FBRTlDLE9BQU8sQ0FBQ2lQLE9BQU8sQ0FBQyxFQUFFO1VBQzNDOztVQUVBLEtBQUssTUFBTSxDQUFDd0IsU0FBUyxFQUFFM0wsS0FBSyxDQUFDLElBQUloRSxNQUFNLENBQUNzSCxPQUFPLENBQUNyTCxJQUFJLENBQUNtRixPQUFPLENBQUMsRUFBRTtZQUM3RDRDLEtBQUssQ0FBQ1MsV0FBVyxDQUNmMUYsTUFBTSxDQUFDa0csSUFBSSxDQUFDa0osT0FBTyxFQUFFd0IsU0FBUyxDQUFDLEdBQzNCeEIsT0FBTyxDQUFDd0IsU0FBUyxDQUFDLENBQUNqTCxNQUFNLEdBQ3pCLENBQUMsRUFDTHpJLElBQUksQ0FBQytGLFlBQ1AsQ0FBQztVQUNIO1VBRUEvRixJQUFJLENBQUMrRixZQUFZLEdBQUcsS0FBSztVQUV6QixLQUFLLE1BQU0sQ0FBQzJOLFNBQVMsRUFBRUMsY0FBYyxDQUFDLElBQUk1UCxNQUFNLENBQUNzSCxPQUFPLENBQUM2RyxPQUFPLENBQUMsRUFBRTtZQUNqRSxNQUFNbkssS0FBSyxHQUFHL0gsSUFBSSxDQUFDbUYsT0FBTyxDQUFDdU8sU0FBUyxDQUFDO1lBQ3JDLElBQUkzTCxLQUFLLEVBQUU7Y0FDVCxLQUFLLE1BQU02TCxhQUFhLElBQUlELGNBQWMsRUFBRTtnQkFDMUM1TCxLQUFLLENBQUNZLE1BQU0sQ0FBQ2lMLGFBQWEsQ0FBQztjQUM3QjtZQUNGLENBQUMsTUFBTTtjQUNMO2NBQ0E7Y0FDQTtjQUNBO2NBQ0E7Y0FDQSxNQUFNMUIsT0FBTyxHQUFHbFMsSUFBSSxDQUFDZ0csd0JBQXdCO2NBRTdDLElBQUksQ0FBRWxELE1BQU0sQ0FBQ2tHLElBQUksQ0FBQ2tKLE9BQU8sRUFBRXdCLFNBQVMsQ0FBQyxFQUFFO2dCQUNyQ3hCLE9BQU8sQ0FBQ3dCLFNBQVMsQ0FBQyxHQUFHLEVBQUU7Y0FDekI7Y0FFQXhCLE9BQU8sQ0FBQ3dCLFNBQVMsQ0FBQyxDQUFDdEQsSUFBSSxDQUFDLEdBQUd1RCxjQUFjLENBQUM7WUFDNUM7VUFDRjtVQUNBO1VBQ0EsS0FBSyxNQUFNNUwsS0FBSyxJQUFJaEUsTUFBTSxDQUFDMkYsTUFBTSxDQUFDMUosSUFBSSxDQUFDbUYsT0FBTyxDQUFDLEVBQUU7WUFDL0M0QyxLQUFLLENBQUNhLFNBQVMsQ0FBQyxDQUFDO1VBQ25CO1FBQ0Y7UUFFQTVJLElBQUksQ0FBQ2dTLHdCQUF3QixDQUFDLENBQUM7TUFDakM7O01BRUE7TUFDQTtNQUNBO01BQ0FBLHdCQUF3QkEsQ0FBQSxFQUFHO1FBQ3pCLE1BQU1oUyxJQUFJLEdBQUcsSUFBSTtRQUNqQixNQUFNaUosU0FBUyxHQUFHakosSUFBSSxDQUFDNEYscUJBQXFCO1FBQzVDNUYsSUFBSSxDQUFDNEYscUJBQXFCLEdBQUcsRUFBRTtRQUMvQnFELFNBQVMsQ0FBQ2hCLE9BQU8sQ0FBRThDLENBQUMsSUFBSztVQUN2QkEsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUM7TUFDSjtNQUVBOEksV0FBV0EsQ0FBQzNCLE9BQU8sRUFBRWxDLFVBQVUsRUFBRXRILEdBQUcsRUFBRTtRQUNwQyxJQUFJLENBQUU1RixNQUFNLENBQUNrRyxJQUFJLENBQUNrSixPQUFPLEVBQUVsQyxVQUFVLENBQUMsRUFBRTtVQUN0Q2tDLE9BQU8sQ0FBQ2xDLFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDMUI7UUFDQWtDLE9BQU8sQ0FBQ2xDLFVBQVUsQ0FBQyxDQUFDSSxJQUFJLENBQUMxSCxHQUFHLENBQUM7TUFDL0I7TUFFQW9MLGFBQWFBLENBQUM5RCxVQUFVLEVBQUVqRyxFQUFFLEVBQUU7UUFDNUIsTUFBTS9KLElBQUksR0FBRyxJQUFJO1FBQ2pCLElBQUksQ0FBRThDLE1BQU0sQ0FBQ2tHLElBQUksQ0FBQ2hKLElBQUksQ0FBQzJGLGdCQUFnQixFQUFFcUssVUFBVSxDQUFDLEVBQUU7VUFDcEQsT0FBTyxJQUFJO1FBQ2I7UUFDQSxNQUFNK0QsdUJBQXVCLEdBQUcvVCxJQUFJLENBQUMyRixnQkFBZ0IsQ0FBQ3FLLFVBQVUsQ0FBQztRQUNqRSxPQUFPK0QsdUJBQXVCLENBQUMvRSxHQUFHLENBQUNqRixFQUFFLENBQUMsSUFBSSxJQUFJO01BQ2hEO01BRUEsTUFBTXFJLGNBQWNBLENBQUMxSixHQUFHLEVBQUV3SixPQUFPLEVBQUU7UUFDakMsTUFBTWxTLElBQUksR0FBRyxJQUFJO1FBQ2pCLE1BQU0rSixFQUFFLEdBQUdsSCxPQUFPLENBQUNTLE9BQU8sQ0FBQ29GLEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQztRQUNsQyxNQUFNc0csU0FBUyxHQUFHclEsSUFBSSxDQUFDOFQsYUFBYSxDQUFDcEwsR0FBRyxDQUFDc0gsVUFBVSxFQUFFakcsRUFBRSxDQUFDO1FBQ3hELElBQUlzRyxTQUFTLEVBQUU7VUFDYjtVQUNBLE1BQU0yRCxVQUFVLEdBQUczRCxTQUFTLENBQUNHLFFBQVEsS0FBS3pELFNBQVM7VUFFbkRzRCxTQUFTLENBQUNHLFFBQVEsR0FBRzlILEdBQUcsQ0FBQ3VMLE1BQU0sSUFBSWxRLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQztVQUN0RHFNLFNBQVMsQ0FBQ0csUUFBUSxDQUFDMEQsR0FBRyxHQUFHbkssRUFBRTtVQUUzQixJQUFJL0osSUFBSSxDQUFDK0YsWUFBWSxFQUFFO1lBQ3JCO1lBQ0E7WUFDQTtZQUNBO1lBQ0EsTUFBTW9PLFVBQVUsR0FBRyxNQUFNblUsSUFBSSxDQUFDbUYsT0FBTyxDQUFDdUQsR0FBRyxDQUFDc0gsVUFBVSxDQUFDLENBQUNvRSxNQUFNLENBQUMxTCxHQUFHLENBQUNxQixFQUFFLENBQUM7WUFDcEUsSUFBSW9LLFVBQVUsS0FBS3BILFNBQVMsRUFBRXJFLEdBQUcsQ0FBQ3VMLE1BQU0sR0FBR0UsVUFBVTtZQUVyRG5VLElBQUksQ0FBQzZULFdBQVcsQ0FBQzNCLE9BQU8sRUFBRXhKLEdBQUcsQ0FBQ3NILFVBQVUsRUFBRXRILEdBQUcsQ0FBQztVQUNoRCxDQUFDLE1BQU0sSUFBSXNMLFVBQVUsRUFBRTtZQUNyQixNQUFNLElBQUl2UyxLQUFLLENBQUMsbUNBQW1DLEdBQUdpSCxHQUFHLENBQUNxQixFQUFFLENBQUM7VUFDL0Q7UUFDRixDQUFDLE1BQU07VUFDTC9KLElBQUksQ0FBQzZULFdBQVcsQ0FBQzNCLE9BQU8sRUFBRXhKLEdBQUcsQ0FBQ3NILFVBQVUsRUFBRXRILEdBQUcsQ0FBQztRQUNoRDtNQUNGO01BRUEySixnQkFBZ0JBLENBQUMzSixHQUFHLEVBQUV3SixPQUFPLEVBQUU7UUFDN0IsTUFBTWxTLElBQUksR0FBRyxJQUFJO1FBQ2pCLE1BQU1xUSxTQUFTLEdBQUdyUSxJQUFJLENBQUM4VCxhQUFhLENBQUNwTCxHQUFHLENBQUNzSCxVQUFVLEVBQUVuTixPQUFPLENBQUNTLE9BQU8sQ0FBQ29GLEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQyxDQUFDO1FBQzdFLElBQUlzRyxTQUFTLEVBQUU7VUFDYixJQUFJQSxTQUFTLENBQUNHLFFBQVEsS0FBS3pELFNBQVMsRUFDbEMsTUFBTSxJQUFJdEwsS0FBSyxDQUFDLDBDQUEwQyxHQUFHaUgsR0FBRyxDQUFDcUIsRUFBRSxDQUFDO1VBQ3RFc0ssWUFBWSxDQUFDQyxZQUFZLENBQUNqRSxTQUFTLENBQUNHLFFBQVEsRUFBRTlILEdBQUcsQ0FBQ3VMLE1BQU0sQ0FBQztRQUMzRCxDQUFDLE1BQU07VUFDTGpVLElBQUksQ0FBQzZULFdBQVcsQ0FBQzNCLE9BQU8sRUFBRXhKLEdBQUcsQ0FBQ3NILFVBQVUsRUFBRXRILEdBQUcsQ0FBQztRQUNoRDtNQUNGO01BRUE0SixnQkFBZ0JBLENBQUM1SixHQUFHLEVBQUV3SixPQUFPLEVBQUU7UUFDN0IsTUFBTWxTLElBQUksR0FBRyxJQUFJO1FBQ2pCLE1BQU1xUSxTQUFTLEdBQUdyUSxJQUFJLENBQUM4VCxhQUFhLENBQUNwTCxHQUFHLENBQUNzSCxVQUFVLEVBQUVuTixPQUFPLENBQUNTLE9BQU8sQ0FBQ29GLEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQyxDQUFDO1FBQzdFLElBQUlzRyxTQUFTLEVBQUU7VUFDYjtVQUNBLElBQUlBLFNBQVMsQ0FBQ0csUUFBUSxLQUFLekQsU0FBUyxFQUNsQyxNQUFNLElBQUl0TCxLQUFLLENBQUMseUNBQXlDLEdBQUdpSCxHQUFHLENBQUNxQixFQUFFLENBQUM7VUFDckVzRyxTQUFTLENBQUNHLFFBQVEsR0FBR3pELFNBQVM7UUFDaEMsQ0FBQyxNQUFNO1VBQ0wvTSxJQUFJLENBQUM2VCxXQUFXLENBQUMzQixPQUFPLEVBQUV4SixHQUFHLENBQUNzSCxVQUFVLEVBQUU7WUFDeEN0SCxHQUFHLEVBQUUsU0FBUztZQUNkc0gsVUFBVSxFQUFFdEgsR0FBRyxDQUFDc0gsVUFBVTtZQUMxQmpHLEVBQUUsRUFBRXJCLEdBQUcsQ0FBQ3FCO1VBQ1YsQ0FBQyxDQUFDO1FBQ0o7TUFDRjtNQUVBeUksZ0JBQWdCQSxDQUFDOUosR0FBRyxFQUFFd0osT0FBTyxFQUFFO1FBQzdCLE1BQU1sUyxJQUFJLEdBQUcsSUFBSTtRQUNqQjs7UUFFQTBJLEdBQUcsQ0FBQzBDLE9BQU8sQ0FBQ25ELE9BQU8sQ0FBRTFILFFBQVEsSUFBSztVQUNoQyxNQUFNZ1UsSUFBSSxHQUFHdlUsSUFBSSxDQUFDMEYsdUJBQXVCLENBQUNuRixRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7VUFDekR3RCxNQUFNLENBQUMyRixNQUFNLENBQUM2SyxJQUFJLENBQUMsQ0FBQ3RNLE9BQU8sQ0FBRXVNLE9BQU8sSUFBSztZQUN2QyxNQUFNbkUsU0FBUyxHQUFHclEsSUFBSSxDQUFDOFQsYUFBYSxDQUFDVSxPQUFPLENBQUN4RSxVQUFVLEVBQUV3RSxPQUFPLENBQUN6SyxFQUFFLENBQUM7WUFDcEUsSUFBSSxDQUFFc0csU0FBUyxFQUFFO2NBQ2YsTUFBTSxJQUFJNU8sS0FBSyxDQUFDLHFCQUFxQixHQUFHZ1QsSUFBSSxDQUFDQyxTQUFTLENBQUNGLE9BQU8sQ0FBQyxDQUFDO1lBQ2xFO1lBQ0EsSUFBSSxDQUFFbkUsU0FBUyxDQUFDRSxjQUFjLENBQUNoUSxRQUFRLENBQUMsRUFBRTtjQUN4QyxNQUFNLElBQUlrQixLQUFLLENBQ2IsTUFBTSxHQUNKZ1QsSUFBSSxDQUFDQyxTQUFTLENBQUNGLE9BQU8sQ0FBQyxHQUN2QiwwQkFBMEIsR0FDMUJqVSxRQUNKLENBQUM7WUFDSDtZQUNBLE9BQU84UCxTQUFTLENBQUNFLGNBQWMsQ0FBQ2hRLFFBQVEsQ0FBQztZQUN6QyxJQUFJMEMsT0FBTyxDQUFDb04sU0FBUyxDQUFDRSxjQUFjLENBQUMsRUFBRTtjQUNyQztjQUNBO2NBQ0E7Y0FDQTs7Y0FFQTtjQUNBO2NBQ0E7Y0FDQXZRLElBQUksQ0FBQzZULFdBQVcsQ0FBQzNCLE9BQU8sRUFBRXNDLE9BQU8sQ0FBQ3hFLFVBQVUsRUFBRTtnQkFDNUN0SCxHQUFHLEVBQUUsU0FBUztnQkFDZHFCLEVBQUUsRUFBRWxILE9BQU8sQ0FBQ1EsV0FBVyxDQUFDbVIsT0FBTyxDQUFDekssRUFBRSxDQUFDO2dCQUNuQzRLLE9BQU8sRUFBRXRFLFNBQVMsQ0FBQ0c7Y0FDckIsQ0FBQyxDQUFDO2NBQ0Y7O2NBRUFILFNBQVMsQ0FBQ0ksY0FBYyxDQUFDeEksT0FBTyxDQUFFOEMsQ0FBQyxJQUFLO2dCQUN0Q0EsQ0FBQyxDQUFDLENBQUM7Y0FDTCxDQUFDLENBQUM7O2NBRUY7Y0FDQTtjQUNBO2NBQ0EvSyxJQUFJLENBQUMyRixnQkFBZ0IsQ0FBQzZPLE9BQU8sQ0FBQ3hFLFVBQVUsQ0FBQyxDQUFDMUYsTUFBTSxDQUFDa0ssT0FBTyxDQUFDekssRUFBRSxDQUFDO1lBQzlEO1VBQ0YsQ0FBQyxDQUFDO1VBQ0YsT0FBTy9KLElBQUksQ0FBQzBGLHVCQUF1QixDQUFDbkYsUUFBUSxDQUFDOztVQUU3QztVQUNBO1VBQ0EsTUFBTXFVLGVBQWUsR0FBRzVVLElBQUksQ0FBQ3NCLGVBQWUsQ0FBQ2YsUUFBUSxDQUFDO1VBQ3RELElBQUksQ0FBRXFVLGVBQWUsRUFBRTtZQUNyQixNQUFNLElBQUluVCxLQUFLLENBQUMsaUNBQWlDLEdBQUdsQixRQUFRLENBQUM7VUFDL0Q7VUFFQVAsSUFBSSxDQUFDNlUsK0JBQStCLENBQ2xDO1lBQUEsT0FBYUQsZUFBZSxDQUFDM1MsV0FBVyxDQUFDLEdBQUFrRyxTQUFPLENBQUM7VUFBQSxDQUNuRCxDQUFDO1FBQ0gsQ0FBQyxDQUFDO01BQ0o7TUFFQW9LLGNBQWNBLENBQUM3SixHQUFHLEVBQUV3SixPQUFPLEVBQUU7UUFDM0IsTUFBTWxTLElBQUksR0FBRyxJQUFJO1FBQ2pCO1FBQ0E7UUFDQTs7UUFFQTBJLEdBQUcsQ0FBQ2dLLElBQUksQ0FBQ3pLLE9BQU8sQ0FBRTBLLEtBQUssSUFBSztVQUMxQjNTLElBQUksQ0FBQzZVLCtCQUErQixDQUFDLE1BQU07WUFDekMsTUFBTUMsU0FBUyxHQUFHOVUsSUFBSSxDQUFDMEcsY0FBYyxDQUFDaU0sS0FBSyxDQUFDO1lBQzVDO1lBQ0EsSUFBSSxDQUFDbUMsU0FBUyxFQUFFO1lBQ2hCO1lBQ0EsSUFBSUEsU0FBUyxDQUFDOUssS0FBSyxFQUFFO1lBQ3JCOEssU0FBUyxDQUFDOUssS0FBSyxHQUFHLElBQUk7WUFDdEI4SyxTQUFTLENBQUM3SyxhQUFhLElBQUk2SyxTQUFTLENBQUM3SyxhQUFhLENBQUMsQ0FBQztZQUNwRDZLLFNBQVMsQ0FBQ3pLLFNBQVMsQ0FBQ0UsT0FBTyxDQUFDLENBQUM7VUFDL0IsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDO01BQ0o7O01BRUE7TUFDQTtNQUNBO01BQ0FzSywrQkFBK0JBLENBQUNyTCxDQUFDLEVBQUU7UUFDakMsTUFBTXhKLElBQUksR0FBRyxJQUFJO1FBQ2pCLE1BQU0rVSxnQkFBZ0IsR0FBR0EsQ0FBQSxLQUFNO1VBQzdCL1UsSUFBSSxDQUFDNEYscUJBQXFCLENBQUN3SyxJQUFJLENBQUM1RyxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUNELElBQUl3TCx1QkFBdUIsR0FBRyxDQUFDO1FBQy9CLE1BQU1DLGdCQUFnQixHQUFHQSxDQUFBLEtBQU07VUFDN0IsRUFBRUQsdUJBQXVCO1VBQ3pCLElBQUlBLHVCQUF1QixLQUFLLENBQUMsRUFBRTtZQUNqQztZQUNBO1lBQ0FELGdCQUFnQixDQUFDLENBQUM7VUFDcEI7UUFDRixDQUFDO1FBRURoUixNQUFNLENBQUMyRixNQUFNLENBQUMxSixJQUFJLENBQUMyRixnQkFBZ0IsQ0FBQyxDQUFDc0MsT0FBTyxDQUFFaU4sZUFBZSxJQUFLO1VBQ2hFQSxlQUFlLENBQUNqTixPQUFPLENBQUVvSSxTQUFTLElBQUs7WUFDckMsTUFBTThFLHNDQUFzQyxHQUMxQ25TLElBQUksQ0FBQ3FOLFNBQVMsQ0FBQ0UsY0FBYyxDQUFDLENBQUNoSCxJQUFJLENBQUNoSixRQUFRLElBQUk7Y0FDOUMsTUFBTWdSLE9BQU8sR0FBR3ZSLElBQUksQ0FBQ3NCLGVBQWUsQ0FBQ2YsUUFBUSxDQUFDO2NBQzlDLE9BQU9nUixPQUFPLElBQUlBLE9BQU8sQ0FBQy9RLFdBQVc7WUFDdkMsQ0FBQyxDQUFDO1lBRUosSUFBSTJVLHNDQUFzQyxFQUFFO2NBQzFDLEVBQUVILHVCQUF1QjtjQUN6QjNFLFNBQVMsQ0FBQ0ksY0FBYyxDQUFDTCxJQUFJLENBQUM2RSxnQkFBZ0IsQ0FBQztZQUNqRDtVQUNGLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQztRQUNGLElBQUlELHVCQUF1QixLQUFLLENBQUMsRUFBRTtVQUNqQztVQUNBO1VBQ0FELGdCQUFnQixDQUFDLENBQUM7UUFDcEI7TUFDRjtNQUVBLE1BQU1LLGVBQWVBLENBQUMxTSxHQUFHLEVBQUU7UUFDekIsTUFBTTFJLElBQUksR0FBRyxJQUFJOztRQUVqQjtRQUNBO1FBQ0EsTUFBTUEsSUFBSSxDQUFDeVMsY0FBYyxDQUFDL0osR0FBRyxDQUFDOztRQUU5QjtRQUNBOztRQUVBO1FBQ0EsSUFBSSxDQUFFNUYsTUFBTSxDQUFDa0csSUFBSSxDQUFDaEosSUFBSSxDQUFDMEcsY0FBYyxFQUFFZ0MsR0FBRyxDQUFDcUIsRUFBRSxDQUFDLEVBQUU7VUFDOUM7UUFDRjs7UUFFQTtRQUNBLE1BQU1HLGFBQWEsR0FBR2xLLElBQUksQ0FBQzBHLGNBQWMsQ0FBQ2dDLEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQyxDQUFDRyxhQUFhO1FBQy9ELE1BQU1DLFlBQVksR0FBR25LLElBQUksQ0FBQzBHLGNBQWMsQ0FBQ2dDLEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQyxDQUFDSSxZQUFZO1FBRTdEbkssSUFBSSxDQUFDMEcsY0FBYyxDQUFDZ0MsR0FBRyxDQUFDcUIsRUFBRSxDQUFDLENBQUNPLE1BQU0sQ0FBQyxDQUFDO1FBRXBDLE1BQU0rSyxrQkFBa0IsR0FBR0MsTUFBTSxJQUFJO1VBQ25DLE9BQ0VBLE1BQU0sSUFDTkEsTUFBTSxDQUFDdkUsS0FBSyxJQUNaLElBQUl2TyxNQUFNLENBQUNmLEtBQUssQ0FDZDZULE1BQU0sQ0FBQ3ZFLEtBQUssQ0FBQ0EsS0FBSyxFQUNsQnVFLE1BQU0sQ0FBQ3ZFLEtBQUssQ0FBQ3dFLE1BQU0sRUFDbkJELE1BQU0sQ0FBQ3ZFLEtBQUssQ0FBQ3lFLE9BQ2YsQ0FBQztRQUVMLENBQUM7O1FBRUQ7UUFDQSxJQUFJdEwsYUFBYSxJQUFJeEIsR0FBRyxDQUFDcUksS0FBSyxFQUFFO1VBQzlCN0csYUFBYSxDQUFDbUwsa0JBQWtCLENBQUMzTSxHQUFHLENBQUMsQ0FBQztRQUN4QztRQUVBLElBQUl5QixZQUFZLEVBQUU7VUFDaEJBLFlBQVksQ0FBQ2tMLGtCQUFrQixDQUFDM00sR0FBRyxDQUFDLENBQUM7UUFDdkM7TUFDRjtNQUVBLE1BQU0rTSxnQkFBZ0JBLENBQUMvTSxHQUFHLEVBQUU7UUFDMUI7O1FBRUEsTUFBTTFJLElBQUksR0FBRyxJQUFJOztRQUVqQjtRQUNBLElBQUksQ0FBRWlELE9BQU8sQ0FBQ2pELElBQUksQ0FBQ3FHLGVBQWUsQ0FBQyxFQUFFO1VBQ25DLE1BQU1yRyxJQUFJLENBQUNvRyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ25DOztRQUVBO1FBQ0E7UUFDQSxJQUFJbkQsT0FBTyxDQUFDakQsSUFBSSxDQUFDeUYsd0JBQXdCLENBQUMsRUFBRTtVQUMxQ2pELE1BQU0sQ0FBQ21CLE1BQU0sQ0FBQyxtREFBbUQsQ0FBQztVQUNsRTtRQUNGO1FBQ0EsTUFBTStSLGtCQUFrQixHQUFHMVYsSUFBSSxDQUFDeUYsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUMyRixPQUFPO1FBQ25FLElBQUl1SyxDQUFDO1FBQ0wsTUFBTUMsQ0FBQyxHQUFHRixrQkFBa0IsQ0FBQy9MLElBQUksQ0FBQyxDQUFDekIsTUFBTSxFQUFFMk4sR0FBRyxLQUFLO1VBQ2pELE1BQU1DLEtBQUssR0FBRzVOLE1BQU0sQ0FBQzNILFFBQVEsS0FBS21JLEdBQUcsQ0FBQ3FCLEVBQUU7VUFDeEMsSUFBSStMLEtBQUssRUFBRUgsQ0FBQyxHQUFHRSxHQUFHO1VBQ2xCLE9BQU9DLEtBQUs7UUFDZCxDQUFDLENBQUM7UUFDRixJQUFJLENBQUNGLENBQUMsRUFBRTtVQUNOcFQsTUFBTSxDQUFDbUIsTUFBTSxDQUFDLHFEQUFxRCxFQUFFK0UsR0FBRyxDQUFDO1VBQ3pFO1FBQ0Y7O1FBRUE7UUFDQTtRQUNBO1FBQ0FnTixrQkFBa0IsQ0FBQ0ssTUFBTSxDQUFDSixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRS9CLElBQUk3UyxNQUFNLENBQUNrRyxJQUFJLENBQUNOLEdBQUcsRUFBRSxPQUFPLENBQUMsRUFBRTtVQUM3QmtOLENBQUMsQ0FBQzlULGFBQWEsQ0FDYixJQUFJVSxNQUFNLENBQUNmLEtBQUssQ0FBQ2lILEdBQUcsQ0FBQ3FJLEtBQUssQ0FBQ0EsS0FBSyxFQUFFckksR0FBRyxDQUFDcUksS0FBSyxDQUFDd0UsTUFBTSxFQUFFN00sR0FBRyxDQUFDcUksS0FBSyxDQUFDeUUsT0FBTyxDQUN2RSxDQUFDO1FBQ0gsQ0FBQyxNQUFNO1VBQ0w7VUFDQTtVQUNBSSxDQUFDLENBQUM5VCxhQUFhLENBQUNpTCxTQUFTLEVBQUVyRSxHQUFHLENBQUMxRyxNQUFNLENBQUM7UUFDeEM7TUFDRjtNQUVBOE0scUJBQXFCQSxDQUFDRCxhQUFhLEVBQUV2TyxPQUFPLEVBQUU7UUFDNUMsSUFBSUEsT0FBTyxhQUFQQSxPQUFPLGVBQVBBLE9BQU8sQ0FBRVksSUFBSSxFQUFFO1VBQ2pCO1VBQ0EsSUFBSSxDQUFDdUUsd0JBQXdCLENBQUMySyxJQUFJLENBQUM7WUFDakNsUCxJQUFJLEVBQUUsSUFBSTtZQUNWa0ssT0FBTyxFQUFFLENBQUN5RCxhQUFhO1VBQ3pCLENBQUMsQ0FBQztRQUNKLENBQUMsTUFBTTtVQUNMO1VBQ0E7VUFDQSxJQUFJNUwsT0FBTyxDQUFDLElBQUksQ0FBQ3dDLHdCQUF3QixDQUFDLElBQ3RDdkMsSUFBSSxDQUFDLElBQUksQ0FBQ3VDLHdCQUF3QixDQUFDLENBQUN2RSxJQUFJLEVBQUU7WUFDNUMsSUFBSSxDQUFDdUUsd0JBQXdCLENBQUMySyxJQUFJLENBQUM7Y0FDakNsUCxJQUFJLEVBQUUsS0FBSztjQUNYa0ssT0FBTyxFQUFFO1lBQ1gsQ0FBQyxDQUFDO1VBQ0o7VUFFQWxJLElBQUksQ0FBQyxJQUFJLENBQUN1Qyx3QkFBd0IsQ0FBQyxDQUFDMkYsT0FBTyxDQUFDZ0YsSUFBSSxDQUFDdkIsYUFBYSxDQUFDO1FBQ2pFOztRQUVBO1FBQ0EsSUFBSSxJQUFJLENBQUNwSix3QkFBd0IsQ0FBQ2dELE1BQU0sS0FBSyxDQUFDLEVBQUU7VUFDOUNvRyxhQUFhLENBQUN0TixXQUFXLENBQUMsQ0FBQztRQUM3QjtNQUNGOztNQUVBO01BQ0E7TUFDQTtNQUNBTSwwQkFBMEJBLENBQUEsRUFBRztRQUMzQixNQUFNN0IsSUFBSSxHQUFHLElBQUk7UUFDakIsSUFBSUEsSUFBSSxDQUFDcVIseUJBQXlCLENBQUMsQ0FBQyxFQUFFOztRQUV0QztRQUNBO1FBQ0E7UUFDQSxJQUFJLENBQUVwTyxPQUFPLENBQUNqRCxJQUFJLENBQUN5Rix3QkFBd0IsQ0FBQyxFQUFFO1VBQzVDLE1BQU11USxVQUFVLEdBQUdoVyxJQUFJLENBQUN5Rix3QkFBd0IsQ0FBQ2tKLEtBQUssQ0FBQyxDQUFDO1VBQ3hELElBQUksQ0FBRTFMLE9BQU8sQ0FBQytTLFVBQVUsQ0FBQzVLLE9BQU8sQ0FBQyxFQUMvQixNQUFNLElBQUkzSixLQUFLLENBQ2IsNkNBQTZDLEdBQzNDZ1QsSUFBSSxDQUFDQyxTQUFTLENBQUNzQixVQUFVLENBQzdCLENBQUM7O1VBRUg7VUFDQSxJQUFJLENBQUUvUyxPQUFPLENBQUNqRCxJQUFJLENBQUN5Rix3QkFBd0IsQ0FBQyxFQUMxQ3pGLElBQUksQ0FBQ2lXLHVCQUF1QixDQUFDLENBQUM7UUFDbEM7O1FBRUE7UUFDQWpXLElBQUksQ0FBQ2tXLGFBQWEsQ0FBQyxDQUFDO01BQ3RCOztNQUVBO01BQ0E7TUFDQUQsdUJBQXVCQSxDQUFBLEVBQUc7UUFDeEIsTUFBTWpXLElBQUksR0FBRyxJQUFJO1FBRWpCLElBQUlpRCxPQUFPLENBQUNqRCxJQUFJLENBQUN5Rix3QkFBd0IsQ0FBQyxFQUFFO1VBQzFDO1FBQ0Y7UUFFQXpGLElBQUksQ0FBQ3lGLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDMkYsT0FBTyxDQUFDbkQsT0FBTyxDQUFDMk4sQ0FBQyxJQUFJO1VBQ3BEQSxDQUFDLENBQUNyVSxXQUFXLENBQUMsQ0FBQztRQUNqQixDQUFDLENBQUM7TUFDSjtNQUVBNFUsZUFBZUEsQ0FBQ3pOLEdBQUcsRUFBRTtRQUNuQmxHLE1BQU0sQ0FBQ21CLE1BQU0sQ0FBQyw4QkFBOEIsRUFBRStFLEdBQUcsQ0FBQzZNLE1BQU0sQ0FBQztRQUN6RCxJQUFJN00sR0FBRyxDQUFDME4sZ0JBQWdCLEVBQUU1VCxNQUFNLENBQUNtQixNQUFNLENBQUMsT0FBTyxFQUFFK0UsR0FBRyxDQUFDME4sZ0JBQWdCLENBQUM7TUFDeEU7TUFFQUMsb0NBQW9DQSxDQUFDQywwQkFBMEIsRUFBRTtRQUMvRCxNQUFNdFcsSUFBSSxHQUFHLElBQUk7UUFDakIsSUFBSWlELE9BQU8sQ0FBQ3FULDBCQUEwQixDQUFDLEVBQUU7O1FBRXpDO1FBQ0E7UUFDQTtRQUNBLElBQUlyVCxPQUFPLENBQUNqRCxJQUFJLENBQUN5Rix3QkFBd0IsQ0FBQyxFQUFFO1VBQzFDekYsSUFBSSxDQUFDeUYsd0JBQXdCLEdBQUc2USwwQkFBMEI7VUFDMUR0VyxJQUFJLENBQUNpVyx1QkFBdUIsQ0FBQyxDQUFDO1VBQzlCO1FBQ0Y7O1FBRUE7UUFDQTtRQUNBO1FBQ0EsSUFDRSxDQUFDL1MsSUFBSSxDQUFDbEQsSUFBSSxDQUFDeUYsd0JBQXdCLENBQUMsQ0FBQ3ZFLElBQUksSUFDekMsQ0FBQ29WLDBCQUEwQixDQUFDLENBQUMsQ0FBQyxDQUFDcFYsSUFBSSxFQUNuQztVQUNBb1YsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLENBQUNsTCxPQUFPLENBQUNuRCxPQUFPLENBQUUyTixDQUFDLElBQUs7WUFDbkQxUyxJQUFJLENBQUNsRCxJQUFJLENBQUN5Rix3QkFBd0IsQ0FBQyxDQUFDMkYsT0FBTyxDQUFDZ0YsSUFBSSxDQUFDd0YsQ0FBQyxDQUFDOztZQUVuRDtZQUNBLElBQUk1VixJQUFJLENBQUN5Rix3QkFBd0IsQ0FBQ2dELE1BQU0sS0FBSyxDQUFDLEVBQUU7Y0FDOUNtTixDQUFDLENBQUNyVSxXQUFXLENBQUMsQ0FBQztZQUNqQjtVQUNGLENBQUMsQ0FBQztVQUVGK1UsMEJBQTBCLENBQUMzSCxLQUFLLENBQUMsQ0FBQztRQUNwQzs7UUFFQTtRQUNBM08sSUFBSSxDQUFDeUYsd0JBQXdCLENBQUMySyxJQUFJLENBQUMsR0FBR2tHLDBCQUEwQixDQUFDO01BQ25FO01BRUFDLG9EQUFvREEsQ0FBQSxFQUFHO1FBQ3JELE1BQU12VyxJQUFJLEdBQUcsSUFBSTtRQUNqQixNQUFNc1csMEJBQTBCLEdBQUd0VyxJQUFJLENBQUN5Rix3QkFBd0I7UUFDaEV6RixJQUFJLENBQUN5Rix3QkFBd0IsR0FBRyxFQUFFO1FBRWxDekYsSUFBSSxDQUFDd0UsV0FBVyxJQUFJeEUsSUFBSSxDQUFDd0UsV0FBVyxDQUFDLENBQUM7UUFDdEM1RSxHQUFHLENBQUM0VyxjQUFjLENBQUNDLElBQUksQ0FBRS9WLFFBQVEsSUFBSztVQUNwQ0EsUUFBUSxDQUFDVixJQUFJLENBQUM7VUFDZCxPQUFPLElBQUk7UUFDYixDQUFDLENBQUM7UUFFRkEsSUFBSSxDQUFDcVcsb0NBQW9DLENBQUNDLDBCQUEwQixDQUFDO01BQ3ZFOztNQUVBO01BQ0FuUCxlQUFlQSxDQUFBLEVBQUc7UUFDaEIsT0FBT2xFLE9BQU8sQ0FBQyxJQUFJLENBQUMzQixlQUFlLENBQUM7TUFDdEM7O01BRUE7TUFDQTtNQUNBNFUsYUFBYUEsQ0FBQSxFQUFHO1FBQ2QsTUFBTWxXLElBQUksR0FBRyxJQUFJO1FBQ2pCLElBQUlBLElBQUksQ0FBQ2lHLGFBQWEsSUFBSWpHLElBQUksQ0FBQ21ILGVBQWUsQ0FBQyxDQUFDLEVBQUU7VUFDaERuSCxJQUFJLENBQUNpRyxhQUFhLENBQUMsQ0FBQztVQUNwQmpHLElBQUksQ0FBQ2lHLGFBQWEsR0FBRyxJQUFJO1FBQzNCO01BQ0Y7TUFFQSxNQUFNd0IsU0FBU0EsQ0FBQ2lQLE9BQU8sRUFBRTtRQUN2QixJQUFJaE8sR0FBRztRQUNQLElBQUk7VUFDRkEsR0FBRyxHQUFHakcsU0FBUyxDQUFDa1UsUUFBUSxDQUFDRCxPQUFPLENBQUM7UUFDbkMsQ0FBQyxDQUFDLE9BQU85SixDQUFDLEVBQUU7VUFDVnBLLE1BQU0sQ0FBQ21CLE1BQU0sQ0FBQyw2QkFBNkIsRUFBRWlKLENBQUMsQ0FBQztVQUMvQztRQUNGOztRQUVBO1FBQ0E7UUFDQSxJQUFJLElBQUksQ0FBQ3ZGLFVBQVUsRUFBRTtVQUNuQixJQUFJLENBQUNBLFVBQVUsQ0FBQ3VQLGVBQWUsQ0FBQyxDQUFDO1FBQ25DO1FBRUEsSUFBSWxPLEdBQUcsS0FBSyxJQUFJLElBQUksQ0FBQ0EsR0FBRyxDQUFDQSxHQUFHLEVBQUU7VUFDNUIsSUFBRyxDQUFDQSxHQUFHLElBQUksQ0FBQ0EsR0FBRyxDQUFDbU8sb0JBQW9CLEVBQUU7WUFDcEMsSUFBSTlTLE1BQU0sQ0FBQ2YsSUFBSSxDQUFDMEYsR0FBRyxDQUFDLENBQUNELE1BQU0sS0FBSyxDQUFDLElBQUlDLEdBQUcsQ0FBQ29PLFNBQVMsRUFBRTtZQUNwRHRVLE1BQU0sQ0FBQ21CLE1BQU0sQ0FBQyxxQ0FBcUMsRUFBRStFLEdBQUcsQ0FBQztVQUMzRDtVQUNBO1FBQ0Y7UUFFQSxJQUFJQSxHQUFHLENBQUNBLEdBQUcsS0FBSyxXQUFXLEVBQUU7VUFDM0IsSUFBSSxDQUFDeEQsUUFBUSxHQUFHLElBQUksQ0FBQ0Qsa0JBQWtCO1VBQ3ZDLE1BQU0sSUFBSSxDQUFDdU0sbUJBQW1CLENBQUM5SSxHQUFHLENBQUM7VUFDbkMsSUFBSSxDQUFDcEksT0FBTyxDQUFDa0QsV0FBVyxDQUFDLENBQUM7UUFDNUIsQ0FBQyxNQUFNLElBQUlrRixHQUFHLENBQUNBLEdBQUcsS0FBSyxRQUFRLEVBQUU7VUFDL0IsSUFBSSxJQUFJLENBQUNwRCxxQkFBcUIsQ0FBQ3lSLE9BQU8sQ0FBQ3JPLEdBQUcsQ0FBQ3NPLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUN4RCxJQUFJLENBQUMvUixrQkFBa0IsR0FBR3lELEdBQUcsQ0FBQ3NPLE9BQU87WUFDckMsSUFBSSxDQUFDdlMsT0FBTyxDQUFDd00sU0FBUyxDQUFDO2NBQUVnRyxNQUFNLEVBQUU7WUFBSyxDQUFDLENBQUM7VUFDMUMsQ0FBQyxNQUFNO1lBQ0wsTUFBTXZULFdBQVcsR0FDZiwyREFBMkQsR0FDM0RnRixHQUFHLENBQUNzTyxPQUFPO1lBQ2IsSUFBSSxDQUFDdlMsT0FBTyxDQUFDeU0sVUFBVSxDQUFDO2NBQUVFLFVBQVUsRUFBRSxJQUFJO2NBQUU4RixNQUFNLEVBQUV4VDtZQUFZLENBQUMsQ0FBQztZQUNsRSxJQUFJLENBQUNwRCxPQUFPLENBQUNtRCw4QkFBOEIsQ0FBQ0MsV0FBVyxDQUFDO1VBQzFEO1FBQ0YsQ0FBQyxNQUFNLElBQUlnRixHQUFHLENBQUNBLEdBQUcsS0FBSyxNQUFNLElBQUksSUFBSSxDQUFDcEksT0FBTyxDQUFDK0QsY0FBYyxFQUFFO1VBQzVELElBQUksQ0FBQzFDLEtBQUssQ0FBQztZQUFFK0csR0FBRyxFQUFFLE1BQU07WUFBRXFCLEVBQUUsRUFBRXJCLEdBQUcsQ0FBQ3FCO1VBQUcsQ0FBQyxDQUFDO1FBQ3pDLENBQUMsTUFBTSxJQUFJckIsR0FBRyxDQUFDQSxHQUFHLEtBQUssTUFBTSxFQUFFO1VBQzdCO1FBQUEsQ0FDRCxNQUFNLElBQ0wsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUN5TyxRQUFRLENBQUN6TyxHQUFHLENBQUNBLEdBQUcsQ0FBQyxFQUNyRTtVQUNBLE1BQU0sSUFBSSxDQUFDK0osY0FBYyxDQUFDL0osR0FBRyxDQUFDO1FBQ2hDLENBQUMsTUFBTSxJQUFJQSxHQUFHLENBQUNBLEdBQUcsS0FBSyxPQUFPLEVBQUU7VUFDOUIsTUFBTSxJQUFJLENBQUMwTSxlQUFlLENBQUMxTSxHQUFHLENBQUM7UUFDakMsQ0FBQyxNQUFNLElBQUlBLEdBQUcsQ0FBQ0EsR0FBRyxLQUFLLFFBQVEsRUFBRTtVQUMvQixNQUFNLElBQUksQ0FBQytNLGdCQUFnQixDQUFDL00sR0FBRyxDQUFDO1FBQ2xDLENBQUMsTUFBTSxJQUFJQSxHQUFHLENBQUNBLEdBQUcsS0FBSyxPQUFPLEVBQUU7VUFDOUIsSUFBSSxDQUFDeU4sZUFBZSxDQUFDek4sR0FBRyxDQUFDO1FBQzNCLENBQUMsTUFBTTtVQUNMbEcsTUFBTSxDQUFDbUIsTUFBTSxDQUFDLDBDQUEwQyxFQUFFK0UsR0FBRyxDQUFDO1FBQ2hFO01BQ0Y7TUFFQWYsT0FBT0EsQ0FBQSxFQUFHO1FBQ1I7UUFDQTtRQUNBO1FBQ0EsTUFBTWUsR0FBRyxHQUFHO1VBQUVBLEdBQUcsRUFBRTtRQUFVLENBQUM7UUFDOUIsSUFBSSxJQUFJLENBQUMxRCxjQUFjLEVBQUUwRCxHQUFHLENBQUNvSixPQUFPLEdBQUcsSUFBSSxDQUFDOU0sY0FBYztRQUMxRDBELEdBQUcsQ0FBQ3NPLE9BQU8sR0FBRyxJQUFJLENBQUMvUixrQkFBa0IsSUFBSSxJQUFJLENBQUNLLHFCQUFxQixDQUFDLENBQUMsQ0FBQztRQUN0RSxJQUFJLENBQUNMLGtCQUFrQixHQUFHeUQsR0FBRyxDQUFDc08sT0FBTztRQUNyQ3RPLEdBQUcsQ0FBQzBPLE9BQU8sR0FBRyxJQUFJLENBQUM5UixxQkFBcUI7UUFDeEMsSUFBSSxDQUFDM0QsS0FBSyxDQUFDK0csR0FBRyxDQUFDOztRQUVmO1FBQ0E7UUFDQTs7UUFFQTtRQUNBO1FBQ0EsSUFBSSxJQUFJLENBQUNqRCx3QkFBd0IsQ0FBQ2dELE1BQU0sR0FBRyxDQUFDLEVBQUU7VUFDNUM7VUFDQTtVQUNBLE1BQU1pTixrQkFBa0IsR0FBRyxJQUFJLENBQUNqUSx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsQ0FBQzJGLE9BQU87VUFDbkUsSUFBSSxDQUFDM0Ysd0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUMyRixPQUFPLEdBQUdzSyxrQkFBa0IsQ0FBQzJCLE1BQU0sQ0FDbEV4SSxhQUFhLElBQUk7WUFDZjtZQUNBO1lBQ0EsSUFBSUEsYUFBYSxDQUFDck8sV0FBVyxJQUFJcU8sYUFBYSxDQUFDMU4sT0FBTyxFQUFFO2NBQ3REO2NBQ0EwTixhQUFhLENBQUMvTSxhQUFhLENBQ3pCLElBQUlVLE1BQU0sQ0FBQ2YsS0FBSyxDQUNkLG1CQUFtQixFQUNuQixpRUFBaUUsR0FDL0QsOERBQ0osQ0FDRixDQUFDO1lBQ0g7O1lBRUE7WUFDQTtZQUNBO1lBQ0EsT0FBTyxFQUFFb04sYUFBYSxDQUFDck8sV0FBVyxJQUFJcU8sYUFBYSxDQUFDMU4sT0FBTyxDQUFDO1VBQzlELENBQ0YsQ0FBQztRQUNIOztRQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBLElBQ0UsSUFBSSxDQUFDc0Usd0JBQXdCLENBQUNnRCxNQUFNLEdBQUcsQ0FBQyxJQUN4QyxJQUFJLENBQUNoRCx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsQ0FBQzJGLE9BQU8sQ0FBQzNDLE1BQU0sS0FBSyxDQUFDLEVBQ3JEO1VBQ0EsSUFBSSxDQUFDaEQsd0JBQXdCLENBQUNrSixLQUFLLENBQUMsQ0FBQztRQUN2Qzs7UUFFQTtRQUNBO1FBQ0EzTCxJQUFJLENBQUMsSUFBSSxDQUFDMUIsZUFBZSxDQUFDLENBQUMyRyxPQUFPLENBQUM4QixFQUFFLElBQUk7VUFDdkMsSUFBSSxDQUFDekksZUFBZSxDQUFDeUksRUFBRSxDQUFDLENBQUN2SixXQUFXLEdBQUcsS0FBSztRQUM5QyxDQUFDLENBQUM7O1FBRUY7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBLElBQUksQ0FBQytWLG9EQUFvRCxDQUFDLENBQUM7O1FBRTNEO1FBQ0E7UUFDQXhTLE1BQU0sQ0FBQ3NILE9BQU8sQ0FBQyxJQUFJLENBQUMzRSxjQUFjLENBQUMsQ0FBQ3VCLE9BQU8sQ0FBQ3FQLEtBQUEsSUFBZTtVQUFBLElBQWQsQ0FBQ3ZOLEVBQUUsRUFBRUgsR0FBRyxDQUFDLEdBQUEwTixLQUFBO1VBQ3BELElBQUksQ0FBQzlNLFdBQVcsQ0FBQztZQUNmOUIsR0FBRyxFQUFFLEtBQUs7WUFDVnFCLEVBQUUsRUFBRUEsRUFBRTtZQUNObEMsSUFBSSxFQUFFK0IsR0FBRyxDQUFDL0IsSUFBSTtZQUNka0IsTUFBTSxFQUFFYSxHQUFHLENBQUNiO1VBQ2QsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDO01BQ0o7SUFDRjtJQUFDakosc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRzs7Ozs7Ozs7Ozs7Ozs7SUNoK0REUCxNQUFNLENBQUNRLE1BQU0sQ0FBQztNQUFDTixHQUFHLEVBQUNBLENBQUEsS0FBSUE7SUFBRyxDQUFDLENBQUM7SUFBQyxJQUFJNkMsU0FBUztJQUFDL0MsTUFBTSxDQUFDQyxJQUFJLENBQUMsbUJBQW1CLEVBQUM7TUFBQzhDLFNBQVNBLENBQUNOLENBQUMsRUFBQztRQUFDTSxTQUFTLEdBQUNOLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJSyxNQUFNO0lBQUM5QyxNQUFNLENBQUNDLElBQUksQ0FBQyxlQUFlLEVBQUM7TUFBQzZDLE1BQU1BLENBQUNMLENBQUMsRUFBQztRQUFDSyxNQUFNLEdBQUNMLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJSSxVQUFVO0lBQUM3QyxNQUFNLENBQUNDLElBQUksQ0FBQywwQkFBMEIsRUFBQztNQUFDNEMsVUFBVUEsQ0FBQ0osQ0FBQyxFQUFDO1FBQUNJLFVBQVUsR0FBQ0osQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUl0QyxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNQSxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUs3VDtJQUNBO0lBQ0E7SUFDQSxNQUFNMFgsY0FBYyxHQUFHLEVBQUU7O0lBRXpCO0FBQ0E7QUFDQTtBQUNBO0lBQ08sTUFBTTNYLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFFckI7SUFDQTtJQUNBO0lBQ0FBLEdBQUcsQ0FBQ3NMLHdCQUF3QixHQUFHLElBQUkxSSxNQUFNLENBQUNnVixtQkFBbUIsQ0FBQyxDQUFDO0lBQy9ENVgsR0FBRyxDQUFDNlgsNkJBQTZCLEdBQUcsSUFBSWpWLE1BQU0sQ0FBQ2dWLG1CQUFtQixDQUFDLENBQUM7O0lBRXBFO0lBQ0E1WCxHQUFHLENBQUM4WCxrQkFBa0IsR0FBRzlYLEdBQUcsQ0FBQ3NMLHdCQUF3QjtJQUVyRHRMLEdBQUcsQ0FBQytYLDJCQUEyQixHQUFHLElBQUluVixNQUFNLENBQUNnVixtQkFBbUIsQ0FBQyxDQUFDOztJQUVsRTtJQUNBO0lBQ0EsU0FBU0ksMEJBQTBCQSxDQUFDOVcsT0FBTyxFQUFFO01BQzNDLElBQUksQ0FBQ0EsT0FBTyxHQUFHQSxPQUFPO0lBQ3hCO0lBRUFsQixHQUFHLENBQUMrRSxlQUFlLEdBQUduQyxNQUFNLENBQUNxVixhQUFhLENBQ3hDLHFCQUFxQixFQUNyQkQsMEJBQ0YsQ0FBQztJQUVEaFksR0FBRyxDQUFDa1ksb0JBQW9CLEdBQUd0VixNQUFNLENBQUNxVixhQUFhLENBQzdDLDBCQUEwQixFQUMxQixNQUFNLENBQUMsQ0FDVCxDQUFDOztJQUVEO0lBQ0E7SUFDQTtJQUNBalksR0FBRyxDQUFDbVksWUFBWSxHQUFHbFEsSUFBSSxJQUFJO01BQ3pCLE1BQU1tUSxLQUFLLEdBQUdwWSxHQUFHLENBQUNzTCx3QkFBd0IsQ0FBQzhELEdBQUcsQ0FBQyxDQUFDO01BQ2hELE9BQU92TSxTQUFTLENBQUN3VixZQUFZLENBQUNqSixHQUFHLENBQUNnSixLQUFLLEVBQUVuUSxJQUFJLENBQUM7SUFDaEQsQ0FBQzs7SUFFRDtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDQWpJLEdBQUcsQ0FBQ3NZLE9BQU8sR0FBRyxDQUFDM1UsR0FBRyxFQUFFakQsT0FBTyxLQUFLO01BQzlCLE1BQU02WCxHQUFHLEdBQUcsSUFBSTVWLFVBQVUsQ0FBQ2dCLEdBQUcsRUFBRWpELE9BQU8sQ0FBQztNQUN4Q2lYLGNBQWMsQ0FBQ25ILElBQUksQ0FBQytILEdBQUcsQ0FBQyxDQUFDLENBQUM7TUFDMUIsT0FBT0EsR0FBRztJQUNaLENBQUM7SUFFRHZZLEdBQUcsQ0FBQzRXLGNBQWMsR0FBRyxJQUFJNEIsSUFBSSxDQUFDO01BQUVqUyxlQUFlLEVBQUU7SUFBTSxDQUFDLENBQUM7O0lBRXpEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNBdkcsR0FBRyxDQUFDNEUsV0FBVyxHQUFHOUQsUUFBUSxJQUFJZCxHQUFHLENBQUM0VyxjQUFjLENBQUM2QixRQUFRLENBQUMzWCxRQUFRLENBQUM7O0lBRW5FO0lBQ0E7SUFDQTtJQUNBZCxHQUFHLENBQUMwWSxzQkFBc0IsR0FBRyxNQUFNZixjQUFjLENBQUNnQixLQUFLLENBQ3JEQyxJQUFJLElBQUl6VSxNQUFNLENBQUMyRixNQUFNLENBQUM4TyxJQUFJLENBQUM5UixjQUFjLENBQUMsQ0FBQzZSLEtBQUssQ0FBQzNPLEdBQUcsSUFBSUEsR0FBRyxDQUFDSSxLQUFLLENBQ25FLENBQUM7SUFBQ2xLLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUFFLElBQUE7RUFBQUMsS0FBQTtBQUFBLEciLCJmaWxlIjoiL3BhY2thZ2VzL2RkcC1jbGllbnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgeyBERFAgfSBmcm9tICcuLi9jb21tb24vbmFtZXNwYWNlLmpzJztcbiIsIi8vIEEgTWV0aG9kSW52b2tlciBtYW5hZ2VzIHNlbmRpbmcgYSBtZXRob2QgdG8gdGhlIHNlcnZlciBhbmQgY2FsbGluZyB0aGUgdXNlcidzXG4vLyBjYWxsYmFja3MuIE9uIGNvbnN0cnVjdGlvbiwgaXQgcmVnaXN0ZXJzIGl0c2VsZiBpbiB0aGUgY29ubmVjdGlvbidzXG4vLyBfbWV0aG9kSW52b2tlcnMgbWFwOyBpdCByZW1vdmVzIGl0c2VsZiBvbmNlIHRoZSBtZXRob2QgaXMgZnVsbHkgZmluaXNoZWQgYW5kXG4vLyB0aGUgY2FsbGJhY2sgaXMgaW52b2tlZC4gVGhpcyBvY2N1cnMgd2hlbiBpdCBoYXMgYm90aCByZWNlaXZlZCBhIHJlc3VsdCxcbi8vIGFuZCB0aGUgZGF0YSB3cml0dGVuIGJ5IGl0IGlzIGZ1bGx5IHZpc2libGUuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRob2RJbnZva2VyIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIC8vIFB1YmxpYyAod2l0aGluIHRoaXMgZmlsZSkgZmllbGRzLlxuICAgIHRoaXMubWV0aG9kSWQgPSBvcHRpb25zLm1ldGhvZElkO1xuICAgIHRoaXMuc2VudE1lc3NhZ2UgPSBmYWxzZTtcblxuICAgIHRoaXMuX2NhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcbiAgICB0aGlzLl9jb25uZWN0aW9uID0gb3B0aW9ucy5jb25uZWN0aW9uO1xuICAgIHRoaXMuX21lc3NhZ2UgPSBvcHRpb25zLm1lc3NhZ2U7XG4gICAgdGhpcy5fb25SZXN1bHRSZWNlaXZlZCA9IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCB8fCAoKCkgPT4ge30pO1xuICAgIHRoaXMuX3dhaXQgPSBvcHRpb25zLndhaXQ7XG4gICAgdGhpcy5ub1JldHJ5ID0gb3B0aW9ucy5ub1JldHJ5O1xuICAgIHRoaXMuX21ldGhvZFJlc3VsdCA9IG51bGw7XG4gICAgdGhpcy5fZGF0YVZpc2libGUgPSBmYWxzZTtcblxuICAgIC8vIFJlZ2lzdGVyIHdpdGggdGhlIGNvbm5lY3Rpb24uXG4gICAgdGhpcy5fY29ubmVjdGlvbi5fbWV0aG9kSW52b2tlcnNbdGhpcy5tZXRob2RJZF0gPSB0aGlzO1xuICB9XG4gIC8vIFNlbmRzIHRoZSBtZXRob2QgbWVzc2FnZSB0byB0aGUgc2VydmVyLiBNYXkgYmUgY2FsbGVkIGFkZGl0aW9uYWwgdGltZXMgaWZcbiAgLy8gd2UgbG9zZSB0aGUgY29ubmVjdGlvbiBhbmQgcmVjb25uZWN0IGJlZm9yZSByZWNlaXZpbmcgYSByZXN1bHQuXG4gIHNlbmRNZXNzYWdlKCkge1xuICAgIC8vIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGJlZm9yZSBzZW5kaW5nIGEgbWV0aG9kIChpbmNsdWRpbmcgcmVzZW5kaW5nIG9uXG4gICAgLy8gcmVjb25uZWN0KS4gV2Ugc2hvdWxkIG9ubHkgKHJlKXNlbmQgbWV0aG9kcyB3aGVyZSB3ZSBkb24ndCBhbHJlYWR5IGhhdmUgYVxuICAgIC8vIHJlc3VsdCFcbiAgICBpZiAodGhpcy5nb3RSZXN1bHQoKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcignc2VuZGluZ01ldGhvZCBpcyBjYWxsZWQgb24gbWV0aG9kIHdpdGggcmVzdWx0Jyk7XG5cbiAgICAvLyBJZiB3ZSdyZSByZS1zZW5kaW5nIGl0LCBpdCBkb2Vzbid0IG1hdHRlciBpZiBkYXRhIHdhcyB3cml0dGVuIHRoZSBmaXJzdFxuICAgIC8vIHRpbWUuXG4gICAgdGhpcy5fZGF0YVZpc2libGUgPSBmYWxzZTtcbiAgICB0aGlzLnNlbnRNZXNzYWdlID0gdHJ1ZTtcblxuICAgIC8vIElmIHRoaXMgaXMgYSB3YWl0IG1ldGhvZCwgbWFrZSBhbGwgZGF0YSBtZXNzYWdlcyBiZSBidWZmZXJlZCB1bnRpbCBpdCBpc1xuICAgIC8vIGRvbmUuXG4gICAgaWYgKHRoaXMuX3dhaXQpXG4gICAgICB0aGlzLl9jb25uZWN0aW9uLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlW3RoaXMubWV0aG9kSWRdID0gdHJ1ZTtcblxuICAgIC8vIEFjdHVhbGx5IHNlbmQgdGhlIG1lc3NhZ2UuXG4gICAgdGhpcy5fY29ubmVjdGlvbi5fc2VuZCh0aGlzLl9tZXNzYWdlKTtcbiAgfVxuICAvLyBJbnZva2UgdGhlIGNhbGxiYWNrLCBpZiB3ZSBoYXZlIGJvdGggYSByZXN1bHQgYW5kIGtub3cgdGhhdCBhbGwgZGF0YSBoYXNcbiAgLy8gYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZS5cbiAgX21heWJlSW52b2tlQ2FsbGJhY2soKSB7XG4gICAgaWYgKHRoaXMuX21ldGhvZFJlc3VsdCAmJiB0aGlzLl9kYXRhVmlzaWJsZSkge1xuICAgICAgLy8gQ2FsbCB0aGUgY2FsbGJhY2suIChUaGlzIHdvbid0IHRocm93OiB0aGUgY2FsbGJhY2sgd2FzIHdyYXBwZWQgd2l0aFxuICAgICAgLy8gYmluZEVudmlyb25tZW50LilcbiAgICAgIHRoaXMuX2NhbGxiYWNrKHRoaXMuX21ldGhvZFJlc3VsdFswXSwgdGhpcy5fbWV0aG9kUmVzdWx0WzFdKTtcblxuICAgICAgLy8gRm9yZ2V0IGFib3V0IHRoaXMgbWV0aG9kLlxuICAgICAgZGVsZXRlIHRoaXMuX2Nvbm5lY3Rpb24uX21ldGhvZEludm9rZXJzW3RoaXMubWV0aG9kSWRdO1xuXG4gICAgICAvLyBMZXQgdGhlIGNvbm5lY3Rpb24ga25vdyB0aGF0IHRoaXMgbWV0aG9kIGlzIGZpbmlzaGVkLCBzbyBpdCBjYW4gdHJ5IHRvXG4gICAgICAvLyBtb3ZlIG9uIHRvIHRoZSBuZXh0IGJsb2NrIG9mIG1ldGhvZHMuXG4gICAgICB0aGlzLl9jb25uZWN0aW9uLl9vdXRzdGFuZGluZ01ldGhvZEZpbmlzaGVkKCk7XG4gICAgfVxuICB9XG4gIC8vIENhbGwgd2l0aCB0aGUgcmVzdWx0IG9mIHRoZSBtZXRob2QgZnJvbSB0aGUgc2VydmVyLiBPbmx5IG1heSBiZSBjYWxsZWRcbiAgLy8gb25jZTsgb25jZSBpdCBpcyBjYWxsZWQsIHlvdSBzaG91bGQgbm90IGNhbGwgc2VuZE1lc3NhZ2UgYWdhaW4uXG4gIC8vIElmIHRoZSB1c2VyIHByb3ZpZGVkIGFuIG9uUmVzdWx0UmVjZWl2ZWQgY2FsbGJhY2ssIGNhbGwgaXQgaW1tZWRpYXRlbHkuXG4gIC8vIFRoZW4gaW52b2tlIHRoZSBtYWluIGNhbGxiYWNrIGlmIGRhdGEgaXMgYWxzbyB2aXNpYmxlLlxuICByZWNlaXZlUmVzdWx0KGVyciwgcmVzdWx0KSB7XG4gICAgaWYgKHRoaXMuZ290UmVzdWx0KCkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZHMgc2hvdWxkIG9ubHkgcmVjZWl2ZSByZXN1bHRzIG9uY2UnKTtcbiAgICB0aGlzLl9tZXRob2RSZXN1bHQgPSBbZXJyLCByZXN1bHRdO1xuICAgIHRoaXMuX29uUmVzdWx0UmVjZWl2ZWQoZXJyLCByZXN1bHQpO1xuICAgIHRoaXMuX21heWJlSW52b2tlQ2FsbGJhY2soKTtcbiAgfVxuICAvLyBDYWxsIHRoaXMgd2hlbiBhbGwgZGF0YSB3cml0dGVuIGJ5IHRoZSBtZXRob2QgaXMgdmlzaWJsZS4gVGhpcyBtZWFucyB0aGF0XG4gIC8vIHRoZSBtZXRob2QgaGFzIHJldHVybnMgaXRzIFwiZGF0YSBpcyBkb25lXCIgbWVzc2FnZSAqQU5EKiBhbGwgc2VydmVyXG4gIC8vIGRvY3VtZW50cyB0aGF0IGFyZSBidWZmZXJlZCBhdCB0aGF0IHRpbWUgaGF2ZSBiZWVuIHdyaXR0ZW4gdG8gdGhlIGxvY2FsXG4gIC8vIGNhY2hlLiBJbnZva2VzIHRoZSBtYWluIGNhbGxiYWNrIGlmIHRoZSByZXN1bHQgaGFzIGJlZW4gcmVjZWl2ZWQuXG4gIGRhdGFWaXNpYmxlKCkge1xuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gdHJ1ZTtcbiAgICB0aGlzLl9tYXliZUludm9rZUNhbGxiYWNrKCk7XG4gIH1cbiAgLy8gVHJ1ZSBpZiByZWNlaXZlUmVzdWx0IGhhcyBiZWVuIGNhbGxlZC5cbiAgZ290UmVzdWx0KCkge1xuICAgIHJldHVybiAhIXRoaXMuX21ldGhvZFJlc3VsdDtcbiAgfVxufVxuIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBERFBDb21tb24gfSBmcm9tICdtZXRlb3IvZGRwLWNvbW1vbic7XG5pbXBvcnQgeyBUcmFja2VyIH0gZnJvbSAnbWV0ZW9yL3RyYWNrZXInO1xuaW1wb3J0IHsgRUpTT04gfSBmcm9tICdtZXRlb3IvZWpzb24nO1xuaW1wb3J0IHsgUmFuZG9tIH0gZnJvbSAnbWV0ZW9yL3JhbmRvbSc7XG5pbXBvcnQgeyBNb25nb0lEIH0gZnJvbSAnbWV0ZW9yL21vbmdvLWlkJztcbmltcG9ydCB7IEREUCB9IGZyb20gJy4vbmFtZXNwYWNlLmpzJztcbmltcG9ydCBNZXRob2RJbnZva2VyIGZyb20gJy4vTWV0aG9kSW52b2tlci5qcyc7XG5pbXBvcnQge1xuICBoYXNPd24sXG4gIHNsaWNlLFxuICBrZXlzLFxuICBpc0VtcHR5LFxuICBsYXN0LFxufSBmcm9tIFwibWV0ZW9yL2RkcC1jb21tb24vdXRpbHMuanNcIjtcblxuY2xhc3MgTW9uZ29JRE1hcCBleHRlbmRzIElkTWFwIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoTW9uZ29JRC5pZFN0cmluZ2lmeSwgTW9uZ29JRC5pZFBhcnNlKTtcbiAgfVxufVxuXG4vLyBAcGFyYW0gdXJsIHtTdHJpbmd8T2JqZWN0fSBVUkwgdG8gTWV0ZW9yIGFwcCxcbi8vICAgb3IgYW4gb2JqZWN0IGFzIGEgdGVzdCBob29rIChzZWUgY29kZSlcbi8vIE9wdGlvbnM6XG4vLyAgIHJlbG9hZFdpdGhPdXRzdGFuZGluZzogaXMgaXQgT0sgdG8gcmVsb2FkIGlmIHRoZXJlIGFyZSBvdXRzdGFuZGluZyBtZXRob2RzP1xuLy8gICBoZWFkZXJzOiBleHRyYSBoZWFkZXJzIHRvIHNlbmQgb24gdGhlIHdlYnNvY2tldHMgY29ubmVjdGlvbiwgZm9yXG4vLyAgICAgc2VydmVyLXRvLXNlcnZlciBERFAgb25seVxuLy8gICBfc29ja2pzT3B0aW9uczogU3BlY2lmaWVzIG9wdGlvbnMgdG8gcGFzcyB0aHJvdWdoIHRvIHRoZSBzb2NranMgY2xpZW50XG4vLyAgIG9uRERQTmVnb3RpYXRpb25WZXJzaW9uRmFpbHVyZTogY2FsbGJhY2sgd2hlbiB2ZXJzaW9uIG5lZ290aWF0aW9uIGZhaWxzLlxuLy9cbi8vIFhYWCBUaGVyZSBzaG91bGQgYmUgYSB3YXkgdG8gZGVzdHJveSBhIEREUCBjb25uZWN0aW9uLCBjYXVzaW5nIGFsbFxuLy8gb3V0c3RhbmRpbmcgbWV0aG9kIGNhbGxzIHRvIGZhaWwuXG4vL1xuLy8gWFhYIE91ciBjdXJyZW50IHdheSBvZiBoYW5kbGluZyBmYWlsdXJlIGFuZCByZWNvbm5lY3Rpb24gaXMgZ3JlYXRcbi8vIGZvciBhbiBhcHAgKHdoZXJlIHdlIHdhbnQgdG8gdG9sZXJhdGUgYmVpbmcgZGlzY29ubmVjdGVkIGFzIGFuXG4vLyBleHBlY3Qgc3RhdGUsIGFuZCBrZWVwIHRyeWluZyBmb3JldmVyIHRvIHJlY29ubmVjdCkgYnV0IGN1bWJlcnNvbWVcbi8vIGZvciBzb21ldGhpbmcgbGlrZSBhIGNvbW1hbmQgbGluZSB0b29sIHRoYXQgd2FudHMgdG8gbWFrZSBhXG4vLyBjb25uZWN0aW9uLCBjYWxsIGEgbWV0aG9kLCBhbmQgcHJpbnQgYW4gZXJyb3IgaWYgY29ubmVjdGlvblxuLy8gZmFpbHMuIFdlIHNob3VsZCBoYXZlIGJldHRlciB1c2FiaWxpdHkgaW4gdGhlIGxhdHRlciBjYXNlICh3aGlsZVxuLy8gc3RpbGwgdHJhbnNwYXJlbnRseSByZWNvbm5lY3RpbmcgaWYgaXQncyBqdXN0IGEgdHJhbnNpZW50IGZhaWx1cmVcbi8vIG9yIHRoZSBzZXJ2ZXIgbWlncmF0aW5nIHVzKS5cbmV4cG9ydCBjbGFzcyBDb25uZWN0aW9uIHtcbiAgY29uc3RydWN0b3IodXJsLCBvcHRpb25zKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zID0ge1xuICAgICAgb25Db25uZWN0ZWQoKSB7fSxcbiAgICAgIG9uRERQVmVyc2lvbk5lZ290aWF0aW9uRmFpbHVyZShkZXNjcmlwdGlvbikge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKGRlc2NyaXB0aW9uKTtcbiAgICAgIH0sXG4gICAgICBoZWFydGJlYXRJbnRlcnZhbDogMTc1MDAsXG4gICAgICBoZWFydGJlYXRUaW1lb3V0OiAxNTAwMCxcbiAgICAgIG5wbUZheWVPcHRpb25zOiBPYmplY3QuY3JlYXRlKG51bGwpLFxuICAgICAgLy8gVGhlc2Ugb3B0aW9ucyBhcmUgb25seSBmb3IgdGVzdGluZy5cbiAgICAgIHJlbG9hZFdpdGhPdXRzdGFuZGluZzogZmFsc2UsXG4gICAgICBzdXBwb3J0ZWRERFBWZXJzaW9uczogRERQQ29tbW9uLlNVUFBPUlRFRF9ERFBfVkVSU0lPTlMsXG4gICAgICByZXRyeTogdHJ1ZSxcbiAgICAgIHJlc3BvbmRUb1BpbmdzOiB0cnVlLFxuICAgICAgLy8gV2hlbiB1cGRhdGVzIGFyZSBjb21pbmcgd2l0aGluIHRoaXMgbXMgaW50ZXJ2YWwsIGJhdGNoIHRoZW0gdG9nZXRoZXIuXG4gICAgICBidWZmZXJlZFdyaXRlc0ludGVydmFsOiA1LFxuICAgICAgLy8gRmx1c2ggYnVmZmVycyBpbW1lZGlhdGVseSBpZiB3cml0ZXMgYXJlIGhhcHBlbmluZyBjb250aW51b3VzbHkgZm9yIG1vcmUgdGhhbiB0aGlzIG1hbnkgbXMuXG4gICAgICBidWZmZXJlZFdyaXRlc01heEFnZTogNTAwLFxuXG4gICAgICAuLi5vcHRpb25zXG4gICAgfTtcblxuICAgIC8vIElmIHNldCwgY2FsbGVkIHdoZW4gd2UgcmVjb25uZWN0LCBxdWV1aW5nIG1ldGhvZCBjYWxscyBfYmVmb3JlXyB0aGVcbiAgICAvLyBleGlzdGluZyBvdXRzdGFuZGluZyBvbmVzLlxuICAgIC8vIE5PVEU6IFRoaXMgZmVhdHVyZSBoYXMgYmVlbiBwcmVzZXJ2ZWQgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LiBUaGVcbiAgICAvLyBwcmVmZXJyZWQgbWV0aG9kIG9mIHNldHRpbmcgYSBjYWxsYmFjayBvbiByZWNvbm5lY3QgaXMgdG8gdXNlXG4gICAgLy8gRERQLm9uUmVjb25uZWN0LlxuICAgIHNlbGYub25SZWNvbm5lY3QgPSBudWxsO1xuXG4gICAgLy8gYXMgYSB0ZXN0IGhvb2ssIGFsbG93IHBhc3NpbmcgYSBzdHJlYW0gaW5zdGVhZCBvZiBhIHVybC5cbiAgICBpZiAodHlwZW9mIHVybCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHNlbGYuX3N0cmVhbSA9IHVybDtcbiAgICB9IGVsc2Uge1xuICAgICAgaW1wb3J0IHsgQ2xpZW50U3RyZWFtIH0gZnJvbSBcIm1ldGVvci9zb2NrZXQtc3RyZWFtLWNsaWVudFwiO1xuXG4gICAgICBzZWxmLl9zdHJlYW0gPSBuZXcgQ2xpZW50U3RyZWFtKHVybCwge1xuICAgICAgICByZXRyeTogb3B0aW9ucy5yZXRyeSxcbiAgICAgICAgQ29ubmVjdGlvbkVycm9yOiBERFAuQ29ubmVjdGlvbkVycm9yLFxuICAgICAgICBoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMsXG4gICAgICAgIF9zb2NranNPcHRpb25zOiBvcHRpb25zLl9zb2NranNPcHRpb25zLFxuICAgICAgICAvLyBVc2VkIHRvIGtlZXAgc29tZSB0ZXN0cyBxdWlldCwgb3IgZm9yIG90aGVyIGNhc2VzIGluIHdoaWNoXG4gICAgICAgIC8vIHRoZSByaWdodCB0aGluZyB0byBkbyB3aXRoIGNvbm5lY3Rpb24gZXJyb3JzIGlzIHRvIHNpbGVudGx5XG4gICAgICAgIC8vIGZhaWwgKGUuZy4gc2VuZGluZyBwYWNrYWdlIHVzYWdlIHN0YXRzKS4gQXQgc29tZSBwb2ludCB3ZVxuICAgICAgICAvLyBzaG91bGQgaGF2ZSBhIHJlYWwgQVBJIGZvciBoYW5kbGluZyBjbGllbnQtc3RyZWFtLWxldmVsXG4gICAgICAgIC8vIGVycm9ycy5cbiAgICAgICAgX2RvbnRQcmludEVycm9yczogb3B0aW9ucy5fZG9udFByaW50RXJyb3JzLFxuICAgICAgICBjb25uZWN0VGltZW91dE1zOiBvcHRpb25zLmNvbm5lY3RUaW1lb3V0TXMsXG4gICAgICAgIG5wbUZheWVPcHRpb25zOiBvcHRpb25zLm5wbUZheWVPcHRpb25zXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZWxmLl9sYXN0U2Vzc2lvbklkID0gbnVsbDtcbiAgICBzZWxmLl92ZXJzaW9uU3VnZ2VzdGlvbiA9IG51bGw7IC8vIFRoZSBsYXN0IHByb3Bvc2VkIEREUCB2ZXJzaW9uLlxuICAgIHNlbGYuX3ZlcnNpb24gPSBudWxsOyAvLyBUaGUgRERQIHZlcnNpb24gYWdyZWVkIG9uIGJ5IGNsaWVudCBhbmQgc2VydmVyLlxuICAgIHNlbGYuX3N0b3JlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7IC8vIG5hbWUgLT4gb2JqZWN0IHdpdGggbWV0aG9kc1xuICAgIHNlbGYuX21ldGhvZEhhbmRsZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTsgLy8gbmFtZSAtPiBmdW5jXG4gICAgc2VsZi5fbmV4dE1ldGhvZElkID0gMTtcbiAgICBzZWxmLl9zdXBwb3J0ZWRERFBWZXJzaW9ucyA9IG9wdGlvbnMuc3VwcG9ydGVkRERQVmVyc2lvbnM7XG5cbiAgICBzZWxmLl9oZWFydGJlYXRJbnRlcnZhbCA9IG9wdGlvbnMuaGVhcnRiZWF0SW50ZXJ2YWw7XG4gICAgc2VsZi5faGVhcnRiZWF0VGltZW91dCA9IG9wdGlvbnMuaGVhcnRiZWF0VGltZW91dDtcblxuICAgIC8vIFRyYWNrcyBtZXRob2RzIHdoaWNoIHRoZSB1c2VyIGhhcyB0cmllZCB0byBjYWxsIGJ1dCB3aGljaCBoYXZlIG5vdCB5ZXRcbiAgICAvLyBjYWxsZWQgdGhlaXIgdXNlciBjYWxsYmFjayAoaWUsIHRoZXkgYXJlIHdhaXRpbmcgb24gdGhlaXIgcmVzdWx0IG9yIGZvciBhbGxcbiAgICAvLyBvZiB0aGVpciB3cml0ZXMgdG8gYmUgd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUpLiBNYXAgZnJvbSBtZXRob2QgSUQgdG9cbiAgICAvLyBNZXRob2RJbnZva2VyIG9iamVjdC5cbiAgICBzZWxmLl9tZXRob2RJbnZva2VycyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBUcmFja3MgbWV0aG9kcyB3aGljaCB0aGUgdXNlciBoYXMgY2FsbGVkIGJ1dCB3aG9zZSByZXN1bHQgbWVzc2FnZXMgaGF2ZSBub3RcbiAgICAvLyBhcnJpdmVkIHlldC5cbiAgICAvL1xuICAgIC8vIF9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyBpcyBhbiBhcnJheSBvZiBibG9ja3Mgb2YgbWV0aG9kcy4gRWFjaCBibG9ja1xuICAgIC8vIHJlcHJlc2VudHMgYSBzZXQgb2YgbWV0aG9kcyB0aGF0IGNhbiBydW4gYXQgdGhlIHNhbWUgdGltZS4gVGhlIGZpcnN0IGJsb2NrXG4gICAgLy8gcmVwcmVzZW50cyB0aGUgbWV0aG9kcyB3aGljaCBhcmUgY3VycmVudGx5IGluIGZsaWdodDsgc3Vic2VxdWVudCBibG9ja3NcbiAgICAvLyBtdXN0IHdhaXQgZm9yIHByZXZpb3VzIGJsb2NrcyB0byBiZSBmdWxseSBmaW5pc2hlZCBiZWZvcmUgdGhleSBjYW4gYmUgc2VudFxuICAgIC8vIHRvIHRoZSBzZXJ2ZXIuXG4gICAgLy9cbiAgICAvLyBFYWNoIGJsb2NrIGlzIGFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgZmllbGRzOlxuICAgIC8vIC0gbWV0aG9kczogYSBsaXN0IG9mIE1ldGhvZEludm9rZXIgb2JqZWN0c1xuICAgIC8vIC0gd2FpdDogYSBib29sZWFuOyBpZiB0cnVlLCB0aGlzIGJsb2NrIGhhZCBhIHNpbmdsZSBtZXRob2QgaW52b2tlZCB3aXRoXG4gICAgLy8gICAgICAgICB0aGUgXCJ3YWl0XCIgb3B0aW9uXG4gICAgLy9cbiAgICAvLyBUaGVyZSB3aWxsIG5ldmVyIGJlIGFkamFjZW50IGJsb2NrcyB3aXRoIHdhaXQ9ZmFsc2UsIGJlY2F1c2UgdGhlIG9ubHkgdGhpbmdcbiAgICAvLyB0aGF0IG1ha2VzIG1ldGhvZHMgbmVlZCB0byBiZSBzZXJpYWxpemVkIGlzIGEgd2FpdCBtZXRob2QuXG4gICAgLy9cbiAgICAvLyBNZXRob2RzIGFyZSByZW1vdmVkIGZyb20gdGhlIGZpcnN0IGJsb2NrIHdoZW4gdGhlaXIgXCJyZXN1bHRcIiBpc1xuICAgIC8vIHJlY2VpdmVkLiBUaGUgZW50aXJlIGZpcnN0IGJsb2NrIGlzIG9ubHkgcmVtb3ZlZCB3aGVuIGFsbCBvZiB0aGUgaW4tZmxpZ2h0XG4gICAgLy8gbWV0aG9kcyBoYXZlIHJlY2VpdmVkIHRoZWlyIHJlc3VsdHMgKHNvIHRoZSBcIm1ldGhvZHNcIiBsaXN0IGlzIGVtcHR5KSAqQU5EKlxuICAgIC8vIGFsbCBvZiB0aGUgZGF0YSB3cml0dGVuIGJ5IHRob3NlIG1ldGhvZHMgYXJlIHZpc2libGUgaW4gdGhlIGxvY2FsIGNhY2hlLiBTb1xuICAgIC8vIGl0IGlzIHBvc3NpYmxlIGZvciB0aGUgZmlyc3QgYmxvY2sncyBtZXRob2RzIGxpc3QgdG8gYmUgZW1wdHksIGlmIHdlIGFyZVxuICAgIC8vIHN0aWxsIHdhaXRpbmcgZm9yIHNvbWUgb2JqZWN0cyB0byBxdWllc2NlLlxuICAgIC8vXG4gICAgLy8gRXhhbXBsZTpcbiAgICAvLyAgX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gW1xuICAgIC8vICAgIHt3YWl0OiBmYWxzZSwgbWV0aG9kczogW119LFxuICAgIC8vICAgIHt3YWl0OiB0cnVlLCBtZXRob2RzOiBbPE1ldGhvZEludm9rZXIgZm9yICdsb2dpbic+XX0sXG4gICAgLy8gICAge3dhaXQ6IGZhbHNlLCBtZXRob2RzOiBbPE1ldGhvZEludm9rZXIgZm9yICdmb28nPixcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICA8TWV0aG9kSW52b2tlciBmb3IgJ2Jhcic+XX1dXG4gICAgLy8gVGhpcyBtZWFucyB0aGF0IHRoZXJlIHdlcmUgc29tZSBtZXRob2RzIHdoaWNoIHdlcmUgc2VudCB0byB0aGUgc2VydmVyIGFuZFxuICAgIC8vIHdoaWNoIGhhdmUgcmV0dXJuZWQgdGhlaXIgcmVzdWx0cywgYnV0IHNvbWUgb2YgdGhlIGRhdGEgd3JpdHRlbiBieVxuICAgIC8vIHRoZSBtZXRob2RzIG1heSBub3QgYmUgdmlzaWJsZSBpbiB0aGUgbG9jYWwgY2FjaGUuIE9uY2UgYWxsIHRoYXQgZGF0YSBpc1xuICAgIC8vIHZpc2libGUsIHdlIHdpbGwgc2VuZCBhICdsb2dpbicgbWV0aG9kLiBPbmNlIHRoZSBsb2dpbiBtZXRob2QgaGFzIHJldHVybmVkXG4gICAgLy8gYW5kIGFsbCB0aGUgZGF0YSBpcyB2aXNpYmxlIChpbmNsdWRpbmcgcmUtcnVubmluZyBzdWJzIGlmIHVzZXJJZCBjaGFuZ2VzKSxcbiAgICAvLyB3ZSB3aWxsIHNlbmQgdGhlICdmb28nIGFuZCAnYmFyJyBtZXRob2RzIGluIHBhcmFsbGVsLlxuICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gW107XG5cbiAgICAvLyBtZXRob2QgSUQgLT4gYXJyYXkgb2Ygb2JqZWN0cyB3aXRoIGtleXMgJ2NvbGxlY3Rpb24nIGFuZCAnaWQnLCBsaXN0aW5nXG4gICAgLy8gZG9jdW1lbnRzIHdyaXR0ZW4gYnkgYSBnaXZlbiBtZXRob2QncyBzdHViLiBrZXlzIGFyZSBhc3NvY2lhdGVkIHdpdGhcbiAgICAvLyBtZXRob2RzIHdob3NlIHN0dWIgd3JvdGUgYXQgbGVhc3Qgb25lIGRvY3VtZW50LCBhbmQgd2hvc2UgZGF0YS1kb25lIG1lc3NhZ2VcbiAgICAvLyBoYXMgbm90IHlldCBiZWVuIHJlY2VpdmVkLlxuICAgIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgPSB7fTtcbiAgICAvLyBjb2xsZWN0aW9uIC0+IElkTWFwIG9mIFwic2VydmVyIGRvY3VtZW50XCIgb2JqZWN0LiBBIFwic2VydmVyIGRvY3VtZW50XCIgaGFzOlxuICAgIC8vIC0gXCJkb2N1bWVudFwiOiB0aGUgdmVyc2lvbiBvZiB0aGUgZG9jdW1lbnQgYWNjb3JkaW5nIHRoZVxuICAgIC8vICAgc2VydmVyIChpZSwgdGhlIHNuYXBzaG90IGJlZm9yZSBhIHN0dWIgd3JvdGUgaXQsIGFtZW5kZWQgYnkgYW55IGNoYW5nZXNcbiAgICAvLyAgIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlcilcbiAgICAvLyAgIEl0IGlzIHVuZGVmaW5lZCBpZiB3ZSB0aGluayB0aGUgZG9jdW1lbnQgZG9lcyBub3QgZXhpc3RcbiAgICAvLyAtIFwid3JpdHRlbkJ5U3R1YnNcIjogYSBzZXQgb2YgbWV0aG9kIElEcyB3aG9zZSBzdHVicyB3cm90ZSB0byB0aGUgZG9jdW1lbnRcbiAgICAvLyAgIHdob3NlIFwiZGF0YSBkb25lXCIgbWVzc2FnZXMgaGF2ZSBub3QgeWV0IGJlZW4gcHJvY2Vzc2VkXG4gICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzID0ge307XG5cbiAgICAvLyBBcnJheSBvZiBjYWxsYmFja3MgdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBuZXh0IHVwZGF0ZSBvZiB0aGUgbG9jYWxcbiAgICAvLyBjYWNoZS4gVXNlZCBmb3I6XG4gICAgLy8gIC0gQ2FsbGluZyBtZXRob2RJbnZva2VyLmRhdGFWaXNpYmxlIGFuZCBzdWIgcmVhZHkgY2FsbGJhY2tzIGFmdGVyXG4gICAgLy8gICAgdGhlIHJlbGV2YW50IGRhdGEgaXMgZmx1c2hlZC5cbiAgICAvLyAgLSBJbnZva2luZyB0aGUgY2FsbGJhY2tzIG9mIFwiaGFsZi1maW5pc2hlZFwiIG1ldGhvZHMgYWZ0ZXIgcmVjb25uZWN0XG4gICAgLy8gICAgcXVpZXNjZW5jZS4gU3BlY2lmaWNhbGx5LCBtZXRob2RzIHdob3NlIHJlc3VsdCB3YXMgcmVjZWl2ZWQgb3ZlciB0aGUgb2xkXG4gICAgLy8gICAgY29ubmVjdGlvbiAoc28gd2UgZG9uJ3QgcmUtc2VuZCBpdCkgYnV0IHdob3NlIGRhdGEgaGFkIG5vdCBiZWVuIG1hZGVcbiAgICAvLyAgICB2aXNpYmxlLlxuICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzID0gW107XG5cbiAgICAvLyBJbiB0d28gY29udGV4dHMsIHdlIGJ1ZmZlciBhbGwgaW5jb21pbmcgZGF0YSBtZXNzYWdlcyBhbmQgdGhlbiBwcm9jZXNzIHRoZW1cbiAgICAvLyBhbGwgYXQgb25jZSBpbiBhIHNpbmdsZSB1cGRhdGU6XG4gICAgLy8gICAtIER1cmluZyByZWNvbm5lY3QsIHdlIGJ1ZmZlciBhbGwgZGF0YSBtZXNzYWdlcyB1bnRpbCBhbGwgc3VicyB0aGF0IGhhZFxuICAgIC8vICAgICBiZWVuIHJlYWR5IGJlZm9yZSByZWNvbm5lY3QgYXJlIHJlYWR5IGFnYWluLCBhbmQgYWxsIG1ldGhvZHMgdGhhdCBhcmVcbiAgICAvLyAgICAgYWN0aXZlIGhhdmUgcmV0dXJuZWQgdGhlaXIgXCJkYXRhIGRvbmUgbWVzc2FnZVwiOyB0aGVuXG4gICAgLy8gICAtIER1cmluZyB0aGUgZXhlY3V0aW9uIG9mIGEgXCJ3YWl0XCIgbWV0aG9kLCB3ZSBidWZmZXIgYWxsIGRhdGEgbWVzc2FnZXNcbiAgICAvLyAgICAgdW50aWwgdGhlIHdhaXQgbWV0aG9kIGdldHMgaXRzIFwiZGF0YSBkb25lXCIgbWVzc2FnZS4gKElmIHRoZSB3YWl0IG1ldGhvZFxuICAgIC8vICAgICBvY2N1cnMgZHVyaW5nIHJlY29ubmVjdCwgaXQgZG9lc24ndCBnZXQgYW55IHNwZWNpYWwgaGFuZGxpbmcuKVxuICAgIC8vIGFsbCBkYXRhIG1lc3NhZ2VzIGFyZSBwcm9jZXNzZWQgaW4gb25lIHVwZGF0ZS5cbiAgICAvL1xuICAgIC8vIFRoZSBmb2xsb3dpbmcgZmllbGRzIGFyZSB1c2VkIGZvciB0aGlzIFwicXVpZXNjZW5jZVwiIHByb2Nlc3MuXG5cbiAgICAvLyBUaGlzIGJ1ZmZlcnMgdGhlIG1lc3NhZ2VzIHRoYXQgYXJlbid0IGJlaW5nIHByb2Nlc3NlZCB5ZXQuXG4gICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuICAgIC8vIE1hcCBmcm9tIG1ldGhvZCBJRCAtPiB0cnVlLiBNZXRob2RzIGFyZSByZW1vdmVkIGZyb20gdGhpcyB3aGVuIHRoZWlyXG4gICAgLy8gXCJkYXRhIGRvbmVcIiBtZXNzYWdlIGlzIHJlY2VpdmVkLCBhbmQgd2Ugd2lsbCBub3QgcXVpZXNjZSB1bnRpbCBpdCBpc1xuICAgIC8vIGVtcHR5LlxuICAgIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UgPSB7fTtcbiAgICAvLyBtYXAgZnJvbSBzdWIgSUQgLT4gdHJ1ZSBmb3Igc3VicyB0aGF0IHdlcmUgcmVhZHkgKGllLCBjYWxsZWQgdGhlIHN1YlxuICAgIC8vIHJlYWR5IGNhbGxiYWNrKSBiZWZvcmUgcmVjb25uZWN0IGJ1dCBoYXZlbid0IGJlY29tZSByZWFkeSBhZ2FpbiB5ZXRcbiAgICBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkID0ge307IC8vIG1hcCBmcm9tIHN1Yi5faWQgLT4gdHJ1ZVxuICAgIC8vIGlmIHRydWUsIHRoZSBuZXh0IGRhdGEgdXBkYXRlIHNob3VsZCByZXNldCBhbGwgc3RvcmVzLiAoc2V0IGR1cmluZ1xuICAgIC8vIHJlY29ubmVjdC4pXG4gICAgc2VsZi5fcmVzZXRTdG9yZXMgPSBmYWxzZTtcblxuICAgIC8vIG5hbWUgLT4gYXJyYXkgb2YgdXBkYXRlcyBmb3IgKHlldCB0byBiZSBjcmVhdGVkKSBjb2xsZWN0aW9uc1xuICAgIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzID0ge307XG4gICAgLy8gaWYgd2UncmUgYmxvY2tpbmcgYSBtaWdyYXRpb24sIHRoZSByZXRyeSBmdW5jXG4gICAgc2VsZi5fcmV0cnlNaWdyYXRlID0gbnVsbDtcblxuICAgIHNlbGYuX19mbHVzaEJ1ZmZlcmVkV3JpdGVzID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgIHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMsXG4gICAgICAnZmx1c2hpbmcgRERQIGJ1ZmZlcmVkIHdyaXRlcycsXG4gICAgICBzZWxmXG4gICAgKTtcbiAgICAvLyBDb2xsZWN0aW9uIG5hbWUgLT4gYXJyYXkgb2YgbWVzc2FnZXMuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXMgPSB7fTtcbiAgICAvLyBXaGVuIGN1cnJlbnQgYnVmZmVyIG9mIHVwZGF0ZXMgbXVzdCBiZSBmbHVzaGVkIGF0LCBpbiBtcyB0aW1lc3RhbXAuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEF0ID0gbnVsbDtcbiAgICAvLyBUaW1lb3V0IGhhbmRsZSBmb3IgdGhlIG5leHQgcHJvY2Vzc2luZyBvZiBhbGwgcGVuZGluZyB3cml0ZXNcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlID0gbnVsbDtcblxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwgPSBvcHRpb25zLmJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWw7XG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNNYXhBZ2UgPSBvcHRpb25zLmJ1ZmZlcmVkV3JpdGVzTWF4QWdlO1xuXG4gICAgLy8gbWV0YWRhdGEgZm9yIHN1YnNjcmlwdGlvbnMuICBNYXAgZnJvbSBzdWIgSUQgdG8gb2JqZWN0IHdpdGgga2V5czpcbiAgICAvLyAgIC0gaWRcbiAgICAvLyAgIC0gbmFtZVxuICAgIC8vICAgLSBwYXJhbXNcbiAgICAvLyAgIC0gaW5hY3RpdmUgKGlmIHRydWUsIHdpbGwgYmUgY2xlYW5lZCB1cCBpZiBub3QgcmV1c2VkIGluIHJlLXJ1bilcbiAgICAvLyAgIC0gcmVhZHkgKGhhcyB0aGUgJ3JlYWR5JyBtZXNzYWdlIGJlZW4gcmVjZWl2ZWQ/KVxuICAgIC8vICAgLSByZWFkeUNhbGxiYWNrIChhbiBvcHRpb25hbCBjYWxsYmFjayB0byBjYWxsIHdoZW4gcmVhZHkpXG4gICAgLy8gICAtIGVycm9yQ2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgaWYgdGhlIHN1YiB0ZXJtaW5hdGVzIHdpdGhcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgYW4gZXJyb3IsIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xKVxuICAgIC8vICAgLSBzdG9wQ2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgd2hlbiB0aGUgc3ViIHRlcm1pbmF0ZXNcbiAgICAvLyAgICAgZm9yIGFueSByZWFzb24sIHdpdGggYW4gZXJyb3IgYXJndW1lbnQgaWYgYW4gZXJyb3IgdHJpZ2dlcmVkIHRoZSBzdG9wKVxuICAgIHNlbGYuX3N1YnNjcmlwdGlvbnMgPSB7fTtcblxuICAgIC8vIFJlYWN0aXZlIHVzZXJJZC5cbiAgICBzZWxmLl91c2VySWQgPSBudWxsO1xuICAgIHNlbGYuX3VzZXJJZERlcHMgPSBuZXcgVHJhY2tlci5EZXBlbmRlbmN5KCk7XG5cbiAgICAvLyBCbG9jayBhdXRvLXJlbG9hZCB3aGlsZSB3ZSdyZSB3YWl0aW5nIGZvciBtZXRob2QgcmVzcG9uc2VzLlxuICAgIGlmIChNZXRlb3IuaXNDbGllbnQgJiZcbiAgICAgIFBhY2thZ2UucmVsb2FkICYmXG4gICAgICAhIG9wdGlvbnMucmVsb2FkV2l0aE91dHN0YW5kaW5nKSB7XG4gICAgICBQYWNrYWdlLnJlbG9hZC5SZWxvYWQuX29uTWlncmF0ZShyZXRyeSA9PiB7XG4gICAgICAgIGlmICghIHNlbGYuX3JlYWR5VG9NaWdyYXRlKCkpIHtcbiAgICAgICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSByZXRyeTtcbiAgICAgICAgICByZXR1cm4gW2ZhbHNlXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gW3RydWVdO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBvbkRpc2Nvbm5lY3QgPSAoKSA9PiB7XG4gICAgICBpZiAoc2VsZi5faGVhcnRiZWF0KSB7XG4gICAgICAgIHNlbGYuX2hlYXJ0YmVhdC5zdG9wKCk7XG4gICAgICAgIHNlbGYuX2hlYXJ0YmVhdCA9IG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbihcbiAgICAgICAgJ21lc3NhZ2UnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgICAgIHRoaXMub25NZXNzYWdlLmJpbmQodGhpcyksXG4gICAgICAgICAgJ2hhbmRsaW5nIEREUCBtZXNzYWdlJ1xuICAgICAgICApXG4gICAgICApO1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKFxuICAgICAgICAncmVzZXQnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KHRoaXMub25SZXNldC5iaW5kKHRoaXMpLCAnaGFuZGxpbmcgRERQIHJlc2V0JylcbiAgICAgICk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oXG4gICAgICAgICdkaXNjb25uZWN0JyxcbiAgICAgICAgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChvbkRpc2Nvbm5lY3QsICdoYW5kbGluZyBERFAgZGlzY29ubmVjdCcpXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oJ21lc3NhZ2UnLCB0aGlzLm9uTWVzc2FnZS5iaW5kKHRoaXMpKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbigncmVzZXQnLCB0aGlzLm9uUmVzZXQuYmluZCh0aGlzKSk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oJ2Rpc2Nvbm5lY3QnLCBvbkRpc2Nvbm5lY3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vICduYW1lJyBpcyB0aGUgbmFtZSBvZiB0aGUgZGF0YSBvbiB0aGUgd2lyZSB0aGF0IHNob3VsZCBnbyBpbiB0aGVcbiAgLy8gc3RvcmUuICd3cmFwcGVkU3RvcmUnIHNob3VsZCBiZSBhbiBvYmplY3Qgd2l0aCBtZXRob2RzIGJlZ2luVXBkYXRlLCB1cGRhdGUsXG4gIC8vIGVuZFVwZGF0ZSwgc2F2ZU9yaWdpbmFscywgcmV0cmlldmVPcmlnaW5hbHMuIHNlZSBDb2xsZWN0aW9uIGZvciBhbiBleGFtcGxlLlxuICBjcmVhdGVTdG9yZU1ldGhvZHMobmFtZSwgd3JhcHBlZFN0b3JlKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAobmFtZSBpbiBzZWxmLl9zdG9yZXMpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIFdyYXAgdGhlIGlucHV0IG9iamVjdCBpbiBhbiBvYmplY3Qgd2hpY2ggbWFrZXMgYW55IHN0b3JlIG1ldGhvZCBub3RcbiAgICAvLyBpbXBsZW1lbnRlZCBieSAnc3RvcmUnIGludG8gYSBuby1vcC5cbiAgICBjb25zdCBzdG9yZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3Qga2V5c09mU3RvcmUgPSBbXG4gICAgICAndXBkYXRlJyxcbiAgICAgICdiZWdpblVwZGF0ZScsXG4gICAgICAnZW5kVXBkYXRlJyxcbiAgICAgICdzYXZlT3JpZ2luYWxzJyxcbiAgICAgICdyZXRyaWV2ZU9yaWdpbmFscycsXG4gICAgICAnZ2V0RG9jJyxcbiAgICAgICdfZ2V0Q29sbGVjdGlvbidcbiAgICBdO1xuICAgIGtleXNPZlN0b3JlLmZvckVhY2goKG1ldGhvZCkgPT4ge1xuICAgICAgc3RvcmVbbWV0aG9kXSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGlmICh3cmFwcGVkU3RvcmVbbWV0aG9kXSkge1xuICAgICAgICAgIHJldHVybiB3cmFwcGVkU3RvcmVbbWV0aG9kXSguLi5hcmdzKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgICBzZWxmLl9zdG9yZXNbbmFtZV0gPSBzdG9yZTtcbiAgICByZXR1cm4gc3RvcmU7XG4gIH1cblxuICByZWdpc3RlclN0b3JlQ2xpZW50KG5hbWUsIHdyYXBwZWRTdG9yZSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY29uc3Qgc3RvcmUgPSBzZWxmLmNyZWF0ZVN0b3JlTWV0aG9kcyhuYW1lLCB3cmFwcGVkU3RvcmUpO1xuXG4gICAgY29uc3QgcXVldWVkID0gc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXNbbmFtZV07XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocXVldWVkKSkge1xuICAgICAgc3RvcmUuYmVnaW5VcGRhdGUocXVldWVkLmxlbmd0aCwgZmFsc2UpO1xuICAgICAgcXVldWVkLmZvckVhY2gobXNnID0+IHtcbiAgICAgICAgc3RvcmUudXBkYXRlKG1zZyk7XG4gICAgICB9KTtcbiAgICAgIHN0b3JlLmVuZFVwZGF0ZSgpO1xuICAgICAgZGVsZXRlIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW25hbWVdO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGFzeW5jIHJlZ2lzdGVyU3RvcmVTZXJ2ZXIobmFtZSwgd3JhcHBlZFN0b3JlKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBjb25zdCBzdG9yZSA9IHNlbGYuY3JlYXRlU3RvcmVNZXRob2RzKG5hbWUsIHdyYXBwZWRTdG9yZSk7XG5cbiAgICBjb25zdCBxdWV1ZWQgPSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tuYW1lXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShxdWV1ZWQpKSB7XG4gICAgICBhd2FpdCBzdG9yZS5iZWdpblVwZGF0ZShxdWV1ZWQubGVuZ3RoLCBmYWxzZSk7XG4gICAgICBmb3IgKGNvbnN0IG1zZyBvZiBxdWV1ZWQpIHtcbiAgICAgICAgYXdhaXQgc3RvcmUudXBkYXRlKG1zZyk7XG4gICAgICB9XG4gICAgICBhd2FpdCBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgIGRlbGV0ZSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tuYW1lXTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5zdWJzY3JpYmVcbiAgICogQHN1bW1hcnkgU3Vic2NyaWJlIHRvIGEgcmVjb3JkIHNldC4gIFJldHVybnMgYSBoYW5kbGUgdGhhdCBwcm92aWRlc1xuICAgKiBgc3RvcCgpYCBhbmQgYHJlYWR5KClgIG1ldGhvZHMuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgc3Vic2NyaXB0aW9uLiAgTWF0Y2hlcyB0aGUgbmFtZSBvZiB0aGVcbiAgICogc2VydmVyJ3MgYHB1Ymxpc2goKWAgY2FsbC5cbiAgICogQHBhcmFtIHtFSlNPTmFibGV9IFthcmcxLGFyZzIuLi5dIE9wdGlvbmFsIGFyZ3VtZW50cyBwYXNzZWQgdG8gcHVibGlzaGVyXG4gICAqIGZ1bmN0aW9uIG9uIHNlcnZlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R9IFtjYWxsYmFja3NdIE9wdGlvbmFsLiBNYXkgaW5jbHVkZSBgb25TdG9wYFxuICAgKiBhbmQgYG9uUmVhZHlgIGNhbGxiYWNrcy4gSWYgdGhlcmUgaXMgYW4gZXJyb3IsIGl0IGlzIHBhc3NlZCBhcyBhblxuICAgKiBhcmd1bWVudCB0byBgb25TdG9wYC4gSWYgYSBmdW5jdGlvbiBpcyBwYXNzZWQgaW5zdGVhZCBvZiBhbiBvYmplY3QsIGl0XG4gICAqIGlzIGludGVycHJldGVkIGFzIGFuIGBvblJlYWR5YCBjYWxsYmFjay5cbiAgICovXG4gIHN1YnNjcmliZShuYW1lIC8qIC4uIFthcmd1bWVudHNdIC4uIChjYWxsYmFja3xjYWxsYmFja3MpICovKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBjb25zdCBwYXJhbXMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGV0IGNhbGxiYWNrcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgaWYgKHBhcmFtcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGxhc3RQYXJhbSA9IHBhcmFtc1twYXJhbXMubGVuZ3RoIC0gMV07XG4gICAgICBpZiAodHlwZW9mIGxhc3RQYXJhbSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFja3Mub25SZWFkeSA9IHBhcmFtcy5wb3AoKTtcbiAgICAgIH0gZWxzZSBpZiAobGFzdFBhcmFtICYmIFtcbiAgICAgICAgbGFzdFBhcmFtLm9uUmVhZHksXG4gICAgICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xIG9uRXJyb3IgdXNlZCB0byBleGlzdCwgYnV0IG5vdyB3ZSB1c2VcbiAgICAgICAgLy8gb25TdG9wIHdpdGggYW4gZXJyb3IgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgICAgbGFzdFBhcmFtLm9uRXJyb3IsXG4gICAgICAgIGxhc3RQYXJhbS5vblN0b3BcbiAgICAgIF0uc29tZShmID0+IHR5cGVvZiBmID09PSBcImZ1bmN0aW9uXCIpKSB7XG4gICAgICAgIGNhbGxiYWNrcyA9IHBhcmFtcy5wb3AoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJcyB0aGVyZSBhbiBleGlzdGluZyBzdWIgd2l0aCB0aGUgc2FtZSBuYW1lIGFuZCBwYXJhbSwgcnVuIGluIGFuXG4gICAgLy8gaW52YWxpZGF0ZWQgQ29tcHV0YXRpb24/IFRoaXMgd2lsbCBoYXBwZW4gaWYgd2UgYXJlIHJlcnVubmluZyBhblxuICAgIC8vIGV4aXN0aW5nIGNvbXB1dGF0aW9uLlxuICAgIC8vXG4gICAgLy8gRm9yIGV4YW1wbGUsIGNvbnNpZGVyIGEgcmVydW4gb2Y6XG4gICAgLy9cbiAgICAvLyAgICAgVHJhY2tlci5hdXRvcnVuKGZ1bmN0aW9uICgpIHtcbiAgICAvLyAgICAgICBNZXRlb3Iuc3Vic2NyaWJlKFwiZm9vXCIsIFNlc3Npb24uZ2V0KFwiZm9vXCIpKTtcbiAgICAvLyAgICAgICBNZXRlb3Iuc3Vic2NyaWJlKFwiYmFyXCIsIFNlc3Npb24uZ2V0KFwiYmFyXCIpKTtcbiAgICAvLyAgICAgfSk7XG4gICAgLy9cbiAgICAvLyBJZiBcImZvb1wiIGhhcyBjaGFuZ2VkIGJ1dCBcImJhclwiIGhhcyBub3QsIHdlIHdpbGwgbWF0Y2ggdGhlIFwiYmFyXCJcbiAgICAvLyBzdWJjcmliZSB0byBhbiBleGlzdGluZyBpbmFjdGl2ZSBzdWJzY3JpcHRpb24gaW4gb3JkZXIgdG8gbm90XG4gICAgLy8gdW5zdWIgYW5kIHJlc3ViIHRoZSBzdWJzY3JpcHRpb24gdW5uZWNlc3NhcmlseS5cbiAgICAvL1xuICAgIC8vIFdlIG9ubHkgbG9vayBmb3Igb25lIHN1Y2ggc3ViOyBpZiB0aGVyZSBhcmUgTiBhcHBhcmVudGx5LWlkZW50aWNhbCBzdWJzXG4gICAgLy8gYmVpbmcgaW52YWxpZGF0ZWQsIHdlIHdpbGwgcmVxdWlyZSBOIG1hdGNoaW5nIHN1YnNjcmliZSBjYWxscyB0byBrZWVwXG4gICAgLy8gdGhlbSBhbGwgYWN0aXZlLlxuICAgIGNvbnN0IGV4aXN0aW5nID0gT2JqZWN0LnZhbHVlcyhzZWxmLl9zdWJzY3JpcHRpb25zKS5maW5kKFxuICAgICAgc3ViID0+IChzdWIuaW5hY3RpdmUgJiYgc3ViLm5hbWUgPT09IG5hbWUgJiYgRUpTT04uZXF1YWxzKHN1Yi5wYXJhbXMsIHBhcmFtcykpXG4gICAgKTtcblxuICAgIGxldCBpZDtcbiAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgIGlkID0gZXhpc3RpbmcuaWQ7XG4gICAgICBleGlzdGluZy5pbmFjdGl2ZSA9IGZhbHNlOyAvLyByZWFjdGl2YXRlXG5cbiAgICAgIGlmIChjYWxsYmFja3Mub25SZWFkeSkge1xuICAgICAgICAvLyBJZiB0aGUgc3ViIGlzIG5vdCBhbHJlYWR5IHJlYWR5LCByZXBsYWNlIGFueSByZWFkeSBjYWxsYmFjayB3aXRoIHRoZVxuICAgICAgICAvLyBvbmUgcHJvdmlkZWQgbm93LiAoSXQncyBub3QgcmVhbGx5IGNsZWFyIHdoYXQgdXNlcnMgd291bGQgZXhwZWN0IGZvclxuICAgICAgICAvLyBhbiBvblJlYWR5IGNhbGxiYWNrIGluc2lkZSBhbiBhdXRvcnVuOyB0aGUgc2VtYW50aWNzIHdlIHByb3ZpZGUgaXNcbiAgICAgICAgLy8gdGhhdCBhdCB0aGUgdGltZSB0aGUgc3ViIGZpcnN0IGJlY29tZXMgcmVhZHksIHdlIGNhbGwgdGhlIGxhc3RcbiAgICAgICAgLy8gb25SZWFkeSBjYWxsYmFjayBwcm92aWRlZCwgaWYgYW55LilcbiAgICAgICAgLy8gSWYgdGhlIHN1YiBpcyBhbHJlYWR5IHJlYWR5LCBydW4gdGhlIHJlYWR5IGNhbGxiYWNrIHJpZ2h0IGF3YXkuXG4gICAgICAgIC8vIEl0IHNlZW1zIHRoYXQgdXNlcnMgd291bGQgZXhwZWN0IGFuIG9uUmVhZHkgY2FsbGJhY2sgaW5zaWRlIGFuXG4gICAgICAgIC8vIGF1dG9ydW4gdG8gdHJpZ2dlciBvbmNlIHRoZSBzdWIgZmlyc3QgYmVjb21lcyByZWFkeSBhbmQgYWxzb1xuICAgICAgICAvLyB3aGVuIHJlLXN1YnMgaGFwcGVucy5cbiAgICAgICAgaWYgKGV4aXN0aW5nLnJlYWR5KSB7XG4gICAgICAgICAgY2FsbGJhY2tzLm9uUmVhZHkoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBleGlzdGluZy5yZWFkeUNhbGxiYWNrID0gY2FsbGJhY2tzLm9uUmVhZHk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgd2UgdXNlZCB0byBoYXZlIG9uRXJyb3IgYnV0IG5vdyB3ZSBjYWxsXG4gICAgICAvLyBvblN0b3Agd2l0aCBhbiBvcHRpb25hbCBlcnJvciBhcmd1bWVudFxuICAgICAgaWYgKGNhbGxiYWNrcy5vbkVycm9yKSB7XG4gICAgICAgIC8vIFJlcGxhY2UgZXhpc3RpbmcgY2FsbGJhY2sgaWYgYW55LCBzbyB0aGF0IGVycm9ycyBhcmVuJ3RcbiAgICAgICAgLy8gZG91YmxlLXJlcG9ydGVkLlxuICAgICAgICBleGlzdGluZy5lcnJvckNhbGxiYWNrID0gY2FsbGJhY2tzLm9uRXJyb3I7XG4gICAgICB9XG5cbiAgICAgIGlmIChjYWxsYmFja3Mub25TdG9wKSB7XG4gICAgICAgIGV4aXN0aW5nLnN0b3BDYWxsYmFjayA9IGNhbGxiYWNrcy5vblN0b3A7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5ldyBzdWIhIEdlbmVyYXRlIGFuIGlkLCBzYXZlIGl0IGxvY2FsbHksIGFuZCBzZW5kIG1lc3NhZ2UuXG4gICAgICBpZCA9IFJhbmRvbS5pZCgpO1xuICAgICAgc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF0gPSB7XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgcGFyYW1zOiBFSlNPTi5jbG9uZShwYXJhbXMpLFxuICAgICAgICBpbmFjdGl2ZTogZmFsc2UsXG4gICAgICAgIHJlYWR5OiBmYWxzZSxcbiAgICAgICAgcmVhZHlEZXBzOiBuZXcgVHJhY2tlci5EZXBlbmRlbmN5KCksXG4gICAgICAgIHJlYWR5Q2FsbGJhY2s6IGNhbGxiYWNrcy5vblJlYWR5LFxuICAgICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSAjZXJyb3JDYWxsYmFja1xuICAgICAgICBlcnJvckNhbGxiYWNrOiBjYWxsYmFja3Mub25FcnJvcixcbiAgICAgICAgc3RvcENhbGxiYWNrOiBjYWxsYmFja3Mub25TdG9wLFxuICAgICAgICBjb25uZWN0aW9uOiBzZWxmLFxuICAgICAgICByZW1vdmUoKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbi5fc3Vic2NyaXB0aW9uc1t0aGlzLmlkXTtcbiAgICAgICAgICB0aGlzLnJlYWR5ICYmIHRoaXMucmVhZHlEZXBzLmNoYW5nZWQoKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3RvcCgpIHtcbiAgICAgICAgICB0aGlzLmNvbm5lY3Rpb24uX3NlbmRRdWV1ZWQoeyBtc2c6ICd1bnN1YicsIGlkOiBpZCB9KTtcbiAgICAgICAgICB0aGlzLnJlbW92ZSgpO1xuXG4gICAgICAgICAgaWYgKGNhbGxiYWNrcy5vblN0b3ApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5vblN0b3AoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzZWxmLl9zZW5kKHsgbXNnOiAnc3ViJywgaWQ6IGlkLCBuYW1lOiBuYW1lLCBwYXJhbXM6IHBhcmFtcyB9KTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gYSBoYW5kbGUgdG8gdGhlIGFwcGxpY2F0aW9uLlxuICAgIGNvbnN0IGhhbmRsZSA9IHtcbiAgICAgIHN0b3AoKSB7XG4gICAgICAgIGlmICghIGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXS5zdG9wKCk7XG4gICAgICB9LFxuICAgICAgcmVhZHkoKSB7XG4gICAgICAgIC8vIHJldHVybiBmYWxzZSBpZiB3ZSd2ZSB1bnN1YnNjcmliZWQuXG4gICAgICAgIGlmICghaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlY29yZCA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdO1xuICAgICAgICByZWNvcmQucmVhZHlEZXBzLmRlcGVuZCgpO1xuICAgICAgICByZXR1cm4gcmVjb3JkLnJlYWR5O1xuICAgICAgfSxcbiAgICAgIHN1YnNjcmlwdGlvbklkOiBpZFxuICAgIH07XG5cbiAgICBpZiAoVHJhY2tlci5hY3RpdmUpIHtcbiAgICAgIC8vIFdlJ3JlIGluIGEgcmVhY3RpdmUgY29tcHV0YXRpb24sIHNvIHdlJ2QgbGlrZSB0byB1bnN1YnNjcmliZSB3aGVuIHRoZVxuICAgICAgLy8gY29tcHV0YXRpb24gaXMgaW52YWxpZGF0ZWQuLi4gYnV0IG5vdCBpZiB0aGUgcmVydW4ganVzdCByZS1zdWJzY3JpYmVzXG4gICAgICAvLyB0byB0aGUgc2FtZSBzdWJzY3JpcHRpb24hICBXaGVuIGEgcmVydW4gaGFwcGVucywgd2UgdXNlIG9uSW52YWxpZGF0ZVxuICAgICAgLy8gYXMgYSBjaGFuZ2UgdG8gbWFyayB0aGUgc3Vic2NyaXB0aW9uIFwiaW5hY3RpdmVcIiBzbyB0aGF0IGl0IGNhblxuICAgICAgLy8gYmUgcmV1c2VkIGZyb20gdGhlIHJlcnVuLiAgSWYgaXQgaXNuJ3QgcmV1c2VkLCBpdCdzIGtpbGxlZCBmcm9tXG4gICAgICAvLyBhbiBhZnRlckZsdXNoLlxuICAgICAgVHJhY2tlci5vbkludmFsaWRhdGUoKGMpID0+IHtcbiAgICAgICAgaWYgKGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSkge1xuICAgICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLmluYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIFRyYWNrZXIuYWZ0ZXJGbHVzaCgoKSA9PiB7XG4gICAgICAgICAgaWYgKGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSAmJlxuICAgICAgICAgICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXS5pbmFjdGl2ZSkge1xuICAgICAgICAgICAgaGFuZGxlLnN0b3AoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhbmRsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBUZWxscyBpZiB0aGUgbWV0aG9kIGNhbGwgY2FtZSBmcm9tIGEgY2FsbCBvciBhIGNhbGxBc3luYy5cbiAgICogQGFsaWFzIE1ldGVvci5pc0FzeW5jQ2FsbFxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEByZXR1cm5zIGJvb2xlYW5cbiAgICovXG4gIGlzQXN5bmNDYWxsKCl7XG4gICAgcmV0dXJuIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpXG4gIH1cbiAgbWV0aG9kcyhtZXRob2RzKSB7XG4gICAgT2JqZWN0LmVudHJpZXMobWV0aG9kcykuZm9yRWFjaCgoW25hbWUsIGZ1bmNdKSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdcIiArIG5hbWUgKyBcIicgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX21ldGhvZEhhbmRsZXJzW25hbWVdKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbWV0aG9kIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkXCIpO1xuICAgICAgfVxuICAgICAgdGhpcy5fbWV0aG9kSGFuZGxlcnNbbmFtZV0gPSBmdW5jO1xuICAgIH0pO1xuICB9XG5cbiAgX2dldElzU2ltdWxhdGlvbih7aXNGcm9tQ2FsbEFzeW5jLCBhbHJlYWR5SW5TaW11bGF0aW9ufSkge1xuICAgIGlmICghaXNGcm9tQ2FsbEFzeW5jKSB7XG4gICAgICByZXR1cm4gYWxyZWFkeUluU2ltdWxhdGlvbjtcbiAgICB9XG4gICAgcmV0dXJuIGFscmVhZHlJblNpbXVsYXRpb24gJiYgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5faXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nKCk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuY2FsbFxuICAgKiBAc3VtbWFyeSBJbnZva2VzIGEgbWV0aG9kIHdpdGggYSBzeW5jIHN0dWIsIHBhc3NpbmcgYW55IG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGV9IFthcmcxLGFyZzIuLi5dIE9wdGlvbmFsIG1ldGhvZCBhcmd1bWVudHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2FzeW5jQ2FsbGJhY2tdIE9wdGlvbmFsIGNhbGxiYWNrLCB3aGljaCBpcyBjYWxsZWQgYXN5bmNocm9ub3VzbHkgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IGFmdGVyIHRoZSBtZXRob2QgaXMgY29tcGxldGUuIElmIG5vdCBwcm92aWRlZCwgdGhlIG1ldGhvZCBydW5zIHN5bmNocm9ub3VzbHkgaWYgcG9zc2libGUgKHNlZSBiZWxvdykuXG4gICAqL1xuICBjYWxsKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gY2FsbGJhY2sgKi8pIHtcbiAgICAvLyBpZiBpdCdzIGEgZnVuY3Rpb24sIHRoZSBsYXN0IGFyZ3VtZW50IGlzIHRoZSByZXN1bHQgY2FsbGJhY2ssXG4gICAgLy8gbm90IGEgcGFyYW1ldGVyIHRvIHRoZSByZW1vdGUgbWV0aG9kLlxuICAgIGNvbnN0IGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGV0IGNhbGxiYWNrO1xuICAgIGlmIChhcmdzLmxlbmd0aCAmJiB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFwcGx5KG5hbWUsIGFyZ3MsIGNhbGxiYWNrKTtcbiAgfVxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuY2FsbEFzeW5jXG4gICAqIEBzdW1tYXJ5IEludm9rZXMgYSBtZXRob2Qgd2l0aCBhbiBhc3luYyBzdHViLCBwYXNzaW5nIGFueSBudW1iZXIgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlfSBbYXJnMSxhcmcyLi4uXSBPcHRpb25hbCBtZXRob2QgYXJndW1lbnRzXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgY2FsbEFzeW5jKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gKi8pIHtcbiAgICBjb25zdCBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGlmIChhcmdzLmxlbmd0aCAmJiB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiTWV0ZW9yLmNhbGxBc3luYygpIGRvZXMgbm90IGFjY2VwdCBhIGNhbGxiYWNrLiBZb3Ugc2hvdWxkICdhd2FpdCcgdGhlIHJlc3VsdCwgb3IgdXNlIC50aGVuKCkuXCJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCB7IHJldHVyblNlcnZlclJlc3VsdFByb21pc2U6IHRydWUgfSk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuYXBwbHlcbiAgICogQHN1bW1hcnkgSW52b2tlIGEgbWV0aG9kIHBhc3NpbmcgYW4gYXJyYXkgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlW119IGFyZ3MgTWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy53YWl0IChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCB1bnRpbCBhbGwgcHJldmlvdXMgbWV0aG9kIGNhbGxzIGhhdmUgY29tcGxldGVkLCBhbmQgZG9uJ3Qgc2VuZCBhbnkgc3Vic2VxdWVudCBtZXRob2QgY2FsbHMgdW50aWwgdGhpcyBvbmUgaXMgY29tcGxldGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgKENsaWVudCBvbmx5KSBUaGlzIGNhbGxiYWNrIGlzIGludm9rZWQgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IG9mIHRoZSBtZXRob2QgKGp1c3QgbGlrZSBgYXN5bmNDYWxsYmFja2ApIGFzIHNvb24gYXMgdGhlIGVycm9yIG9yIHJlc3VsdCBpcyBhdmFpbGFibGUuIFRoZSBsb2NhbCBjYWNoZSBtYXkgbm90IHlldCByZWZsZWN0IHRoZSB3cml0ZXMgcGVyZm9ybWVkIGJ5IHRoZSBtZXRob2QuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5ub1JldHJ5IChDbGllbnQgb25seSkgaWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCBhZ2FpbiBvbiByZWxvYWQsIHNpbXBseSBjYWxsIHRoZSBjYWxsYmFjayBhbiBlcnJvciB3aXRoIHRoZSBlcnJvciBjb2RlICdpbnZvY2F0aW9uLWZhaWxlZCcuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy50aHJvd1N0dWJFeGNlcHRpb25zIChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZXhjZXB0aW9ucyB0aHJvd24gYnkgbWV0aG9kIHN0dWJzIHdpbGwgYmUgdGhyb3duIGluc3RlYWQgb2YgbG9nZ2VkLCBhbmQgdGhlIG1ldGhvZCB3aWxsIG5vdCBiZSBpbnZva2VkIG9uIHRoZSBzZXJ2ZXIuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZXR1cm5TdHViVmFsdWUgKENsaWVudCBvbmx5KSBJZiB0cnVlIHRoZW4gaW4gY2FzZXMgd2hlcmUgd2Ugd291bGQgaGF2ZSBvdGhlcndpc2UgZGlzY2FyZGVkIHRoZSBzdHViJ3MgcmV0dXJuIHZhbHVlIGFuZCByZXR1cm5lZCB1bmRlZmluZWQsIGluc3RlYWQgd2UgZ28gYWhlYWQgYW5kIHJldHVybiBpdC4gU3BlY2lmaWNhbGx5LCB0aGlzIGlzIGFueSB0aW1lIG90aGVyIHRoYW4gd2hlbiAoYSkgd2UgYXJlIGFscmVhZHkgaW5zaWRlIGEgc3R1YiBvciAoYikgd2UgYXJlIGluIE5vZGUgYW5kIG5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZC4gQ3VycmVudGx5IHdlIHJlcXVpcmUgdGhpcyBmbGFnIHRvIGJlIGV4cGxpY2l0bHkgcGFzc2VkIHRvIHJlZHVjZSB0aGUgbGlrZWxpaG9vZCB0aGF0IHN0dWIgcmV0dXJuIHZhbHVlcyB3aWxsIGJlIGNvbmZ1c2VkIHdpdGggc2VydmVyIHJldHVybiB2YWx1ZXM7IHdlIG1heSBpbXByb3ZlIHRoaXMgaW4gZnV0dXJlLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbYXN5bmNDYWxsYmFja10gT3B0aW9uYWwgY2FsbGJhY2s7IHNhbWUgc2VtYW50aWNzIGFzIGluIFtgTWV0ZW9yLmNhbGxgXSgjbWV0ZW9yX2NhbGwpLlxuICAgKi9cbiAgYXBwbHkobmFtZSwgYXJncywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCB7IHN0dWJJbnZvY2F0aW9uLCBpbnZvY2F0aW9uLCAuLi5zdHViT3B0aW9ucyB9ID0gdGhpcy5fc3R1YkNhbGwobmFtZSwgRUpTT04uY2xvbmUoYXJncykpO1xuXG4gICAgaWYgKHN0dWJPcHRpb25zLmhhc1N0dWIpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbjogc3R1Yk9wdGlvbnMuYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgICAgICBpc0Zyb21DYWxsQXN5bmM6IHN0dWJPcHRpb25zLmlzRnJvbUNhbGxBc3luYyxcbiAgICAgICAgfSlcbiAgICAgICkge1xuICAgICAgICB0aGlzLl9zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBzdHViT3B0aW9ucy5zdHViUmV0dXJuVmFsdWUgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uXG4gICAgICAgICAgLndpdGhWYWx1ZShpbnZvY2F0aW9uLCBzdHViSW52b2NhdGlvbik7XG4gICAgICAgIGlmIChNZXRlb3IuX2lzUHJvbWlzZShzdHViT3B0aW9ucy5zdHViUmV0dXJuVmFsdWUpKSB7XG4gICAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICAgICAgICAgIGBNZXRob2QgJHtuYW1lfTogQ2FsbGluZyBhIG1ldGhvZCB0aGF0IGhhcyBhbiBhc3luYyBtZXRob2Qgc3R1YiB3aXRoIGNhbGwvYXBwbHkgY2FuIGxlYWQgdG8gdW5leHBlY3RlZCBiZWhhdmlvcnMuIFVzZSBjYWxsQXN5bmMvYXBwbHlBc3luYyBpbnN0ZWFkLmBcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHN0dWJPcHRpb25zLmV4Y2VwdGlvbiA9IGU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9hcHBseShuYW1lLCBzdHViT3B0aW9ucywgYXJncywgb3B0aW9ucywgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLmFwcGx5QXN5bmNcbiAgICogQHN1bW1hcnkgSW52b2tlIGEgbWV0aG9kIHBhc3NpbmcgYW4gYXJyYXkgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlW119IGFyZ3MgTWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy53YWl0IChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCB1bnRpbCBhbGwgcHJldmlvdXMgbWV0aG9kIGNhbGxzIGhhdmUgY29tcGxldGVkLCBhbmQgZG9uJ3Qgc2VuZCBhbnkgc3Vic2VxdWVudCBtZXRob2QgY2FsbHMgdW50aWwgdGhpcyBvbmUgaXMgY29tcGxldGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgKENsaWVudCBvbmx5KSBUaGlzIGNhbGxiYWNrIGlzIGludm9rZWQgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IG9mIHRoZSBtZXRob2QgKGp1c3QgbGlrZSBgYXN5bmNDYWxsYmFja2ApIGFzIHNvb24gYXMgdGhlIGVycm9yIG9yIHJlc3VsdCBpcyBhdmFpbGFibGUuIFRoZSBsb2NhbCBjYWNoZSBtYXkgbm90IHlldCByZWZsZWN0IHRoZSB3cml0ZXMgcGVyZm9ybWVkIGJ5IHRoZSBtZXRob2QuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5ub1JldHJ5IChDbGllbnQgb25seSkgaWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCBhZ2FpbiBvbiByZWxvYWQsIHNpbXBseSBjYWxsIHRoZSBjYWxsYmFjayBhbiBlcnJvciB3aXRoIHRoZSBlcnJvciBjb2RlICdpbnZvY2F0aW9uLWZhaWxlZCcuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy50aHJvd1N0dWJFeGNlcHRpb25zIChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZXhjZXB0aW9ucyB0aHJvd24gYnkgbWV0aG9kIHN0dWJzIHdpbGwgYmUgdGhyb3duIGluc3RlYWQgb2YgbG9nZ2VkLCBhbmQgdGhlIG1ldGhvZCB3aWxsIG5vdCBiZSBpbnZva2VkIG9uIHRoZSBzZXJ2ZXIuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZXR1cm5TdHViVmFsdWUgKENsaWVudCBvbmx5KSBJZiB0cnVlIHRoZW4gaW4gY2FzZXMgd2hlcmUgd2Ugd291bGQgaGF2ZSBvdGhlcndpc2UgZGlzY2FyZGVkIHRoZSBzdHViJ3MgcmV0dXJuIHZhbHVlIGFuZCByZXR1cm5lZCB1bmRlZmluZWQsIGluc3RlYWQgd2UgZ28gYWhlYWQgYW5kIHJldHVybiBpdC4gU3BlY2lmaWNhbGx5LCB0aGlzIGlzIGFueSB0aW1lIG90aGVyIHRoYW4gd2hlbiAoYSkgd2UgYXJlIGFscmVhZHkgaW5zaWRlIGEgc3R1YiBvciAoYikgd2UgYXJlIGluIE5vZGUgYW5kIG5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZC4gQ3VycmVudGx5IHdlIHJlcXVpcmUgdGhpcyBmbGFnIHRvIGJlIGV4cGxpY2l0bHkgcGFzc2VkIHRvIHJlZHVjZSB0aGUgbGlrZWxpaG9vZCB0aGF0IHN0dWIgcmV0dXJuIHZhbHVlcyB3aWxsIGJlIGNvbmZ1c2VkIHdpdGggc2VydmVyIHJldHVybiB2YWx1ZXM7IHdlIG1heSBpbXByb3ZlIHRoaXMgaW4gZnV0dXJlLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmV0dXJuU2VydmVyUmVzdWx0UHJvbWlzZSAoQ2xpZW50IG9ubHkpIElmIHRydWUsIHRoZSBwcm9taXNlIHJldHVybmVkIGJ5IGFwcGx5QXN5bmMgd2lsbCByZXNvbHZlIHRvIHRoZSBzZXJ2ZXIncyByZXR1cm4gdmFsdWUsIHJhdGhlciB0aGFuIHRoZSBzdHViJ3MgcmV0dXJuIHZhbHVlLiBUaGlzIGlzIHVzZWZ1bCB3aGVuIHlvdSB3YW50IHRvIGVuc3VyZSB0aGF0IHRoZSBzZXJ2ZXIncyByZXR1cm4gdmFsdWUgaXMgdXNlZCwgZXZlbiBpZiB0aGUgc3R1YiByZXR1cm5zIGEgcHJvbWlzZS4gVGhlIHNhbWUgYmVoYXZpb3IgYXMgYGNhbGxBc3luY2AuXG4gICAqL1xuICBhcHBseUFzeW5jKG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrID0gbnVsbCkge1xuICAgIGNvbnN0IHN0dWJQcm9taXNlID0gdGhpcy5fYXBwbHlBc3luY1N0dWJJbnZvY2F0aW9uKG5hbWUsIGFyZ3MsIG9wdGlvbnMpO1xuXG4gICAgY29uc3QgcHJvbWlzZSA9IHRoaXMuX2FwcGx5QXN5bmMoe1xuICAgICAgbmFtZSxcbiAgICAgIGFyZ3MsXG4gICAgICBvcHRpb25zLFxuICAgICAgY2FsbGJhY2ssXG4gICAgICBzdHViUHJvbWlzZSxcbiAgICB9KTtcbiAgICBpZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XG4gICAgICAvLyBvbmx5IHJldHVybiB0aGUgc3R1YlJldHVyblZhbHVlXG4gICAgICBwcm9taXNlLnN0dWJQcm9taXNlID0gc3R1YlByb21pc2UudGhlbihvID0+IHtcbiAgICAgICAgaWYgKG8uZXhjZXB0aW9uKSB7XG4gICAgICAgICAgdGhyb3cgby5leGNlcHRpb247XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG8uc3R1YlJldHVyblZhbHVlO1xuICAgICAgfSk7XG4gICAgICAvLyB0aGlzIGF2b2lkcyBhdHRyaWJ1dGUgcmVjdXJzaW9uXG4gICAgICBwcm9taXNlLnNlcnZlclByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgICAgICBwcm9taXNlLnRoZW4ocmVzb2x2ZSkuY2F0Y2gocmVqZWN0KSxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBwcm9taXNlO1xuICB9XG4gIGFzeW5jIF9hcHBseUFzeW5jU3R1Ykludm9jYXRpb24obmFtZSwgYXJncywgb3B0aW9ucykge1xuICAgIGNvbnN0IHsgc3R1Ykludm9jYXRpb24sIGludm9jYXRpb24sIC4uLnN0dWJPcHRpb25zIH0gPSB0aGlzLl9zdHViQ2FsbChuYW1lLCBFSlNPTi5jbG9uZShhcmdzKSwgb3B0aW9ucyk7XG4gICAgaWYgKHN0dWJPcHRpb25zLmhhc1N0dWIpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbjogc3R1Yk9wdGlvbnMuYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgICAgICBpc0Zyb21DYWxsQXN5bmM6IHN0dWJPcHRpb25zLmlzRnJvbUNhbGxBc3luYyxcbiAgICAgICAgfSlcbiAgICAgICkge1xuICAgICAgICB0aGlzLl9zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICAvKlxuICAgICAgICAgKiBUaGUgY29kZSBiZWxvdyBmb2xsb3dzIHRoZSBzYW1lIGxvZ2ljIGFzIHRoZSBmdW5jdGlvbiB3aXRoVmFsdWVzKCkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEJ1dCBhcyB0aGUgTWV0ZW9yIHBhY2thZ2UgaXMgbm90IGNvbXBpbGVkIGJ5IGVjbWFzY3JpcHQsIGl0IGlzIHVuYWJsZSB0byB1c2UgbmV3ZXIgc3ludGF4IGluIHRoZSBicm93c2VyLFxuICAgICAgICAgKiBzdWNoIGFzLCB0aGUgYXN5bmMvYXdhaXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIFNvLCB0byBrZWVwIHN1cHBvcnRpbmcgb2xkIGJyb3dzZXJzLCBsaWtlIElFIDExLCB3ZSdyZSBjcmVhdGluZyB0aGUgbG9naWMgb25lIGxldmVsIGFib3ZlLlxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3QgY3VycmVudENvbnRleHQgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLl9zZXROZXdDb250ZXh0QW5kR2V0Q3VycmVudChcbiAgICAgICAgICBpbnZvY2F0aW9uXG4gICAgICAgICk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgc3R1Yk9wdGlvbnMuc3R1YlJldHVyblZhbHVlID0gYXdhaXQgc3R1Ykludm9jYXRpb24oKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIHN0dWJPcHRpb25zLmV4Y2VwdGlvbiA9IGU7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5fc2V0KGN1cnJlbnRDb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzdHViT3B0aW9ucy5leGNlcHRpb24gPSBlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3R1Yk9wdGlvbnM7XG4gIH1cbiAgYXN5bmMgX2FwcGx5QXN5bmMoeyBuYW1lLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjaywgc3R1YlByb21pc2UgfSkge1xuICAgIGNvbnN0IHN0dWJPcHRpb25zID0gYXdhaXQgc3R1YlByb21pc2U7XG4gICAgcmV0dXJuIHRoaXMuX2FwcGx5KG5hbWUsIHN0dWJPcHRpb25zLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjayk7XG4gIH1cblxuICBfYXBwbHkobmFtZSwgc3R1YkNhbGxWYWx1ZSwgYXJncywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIC8vIFdlIHdlcmUgcGFzc2VkIDMgYXJndW1lbnRzLiBUaGV5IG1heSBiZSBlaXRoZXIgKG5hbWUsIGFyZ3MsIG9wdGlvbnMpXG4gICAgLy8gb3IgKG5hbWUsIGFyZ3MsIGNhbGxiYWNrKVxuICAgIGlmICghY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIH1cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAvLyBYWFggd291bGQgaXQgYmUgYmV0dGVyIGZvcm0gdG8gZG8gdGhlIGJpbmRpbmcgaW4gc3RyZWFtLm9uLFxuICAgICAgLy8gb3IgY2FsbGVyLCBpbnN0ZWFkIG9mIGhlcmU/XG4gICAgICAvLyBYWFggaW1wcm92ZSBlcnJvciBtZXNzYWdlIChhbmQgaG93IHdlIHJlcG9ydCBpdClcbiAgICAgIGNhbGxiYWNrID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgICAgY2FsbGJhY2ssXG4gICAgICAgIFwiZGVsaXZlcmluZyByZXN1bHQgb2YgaW52b2tpbmcgJ1wiICsgbmFtZSArIFwiJ1wiXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCB7XG4gICAgICBoYXNTdHViLFxuICAgICAgZXhjZXB0aW9uLFxuICAgICAgc3R1YlJldHVyblZhbHVlLFxuICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgIHJhbmRvbVNlZWQsXG4gICAgfSA9IHN0dWJDYWxsVmFsdWU7XG5cbiAgICAvLyBLZWVwIG91ciBhcmdzIHNhZmUgZnJvbSBtdXRhdGlvbiAoZWcgaWYgd2UgZG9uJ3Qgc2VuZCB0aGUgbWVzc2FnZSBmb3IgYVxuICAgIC8vIHdoaWxlIGJlY2F1c2Ugb2YgYSB3YWl0IG1ldGhvZCkuXG4gICAgYXJncyA9IEVKU09OLmNsb25lKGFyZ3MpO1xuICAgIC8vIElmIHdlJ3JlIGluIGEgc2ltdWxhdGlvbiwgc3RvcCBhbmQgcmV0dXJuIHRoZSByZXN1bHQgd2UgaGF2ZSxcbiAgICAvLyByYXRoZXIgdGhhbiBnb2luZyBvbiB0byBkbyBhbiBSUEMuIElmIHRoZXJlIHdhcyBubyBzdHViLFxuICAgIC8vIHdlJ2xsIGVuZCB1cCByZXR1cm5pbmcgdW5kZWZpbmVkLlxuICAgIGlmIChcbiAgICAgIHRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgIGFscmVhZHlJblNpbXVsYXRpb24sXG4gICAgICAgIGlzRnJvbUNhbGxBc3luYzogc3R1YkNhbGxWYWx1ZS5pc0Zyb21DYWxsQXN5bmMsXG4gICAgICB9KVxuICAgICkge1xuICAgICAgbGV0IHJlc3VsdDtcblxuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGV4Y2VwdGlvbiwgc3R1YlJldHVyblZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChleGNlcHRpb24pIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgICAgcmVzdWx0ID0gc3R1YlJldHVyblZhbHVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gb3B0aW9ucy5fcmV0dXJuTWV0aG9kSW52b2tlciA/IHsgcmVzdWx0IH0gOiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLy8gV2Ugb25seSBjcmVhdGUgdGhlIG1ldGhvZElkIGhlcmUgYmVjYXVzZSB3ZSBkb24ndCBhY3R1YWxseSBuZWVkIG9uZSBpZlxuICAgIC8vIHdlJ3JlIGFscmVhZHkgaW4gYSBzaW11bGF0aW9uXG4gICAgY29uc3QgbWV0aG9kSWQgPSAnJyArIHNlbGYuX25leHRNZXRob2RJZCsrO1xuICAgIGlmIChoYXNTdHViKSB7XG4gICAgICBzZWxmLl9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSB0aGUgRERQIG1lc3NhZ2UgZm9yIHRoZSBtZXRob2QgY2FsbC4gTm90ZSB0aGF0IG9uIHRoZSBjbGllbnQsXG4gICAgLy8gaXQgaXMgaW1wb3J0YW50IHRoYXQgdGhlIHN0dWIgaGF2ZSBmaW5pc2hlZCBiZWZvcmUgd2Ugc2VuZCB0aGUgUlBDLCBzb1xuICAgIC8vIHRoYXQgd2Uga25vdyB3ZSBoYXZlIGEgY29tcGxldGUgbGlzdCBvZiB3aGljaCBsb2NhbCBkb2N1bWVudHMgdGhlIHN0dWJcbiAgICAvLyB3cm90ZS5cbiAgICBjb25zdCBtZXNzYWdlID0ge1xuICAgICAgbXNnOiAnbWV0aG9kJyxcbiAgICAgIGlkOiBtZXRob2RJZCxcbiAgICAgIG1ldGhvZDogbmFtZSxcbiAgICAgIHBhcmFtczogYXJnc1xuICAgIH07XG5cbiAgICAvLyBJZiBhbiBleGNlcHRpb24gb2NjdXJyZWQgaW4gYSBzdHViLCBhbmQgd2UncmUgaWdub3JpbmcgaXRcbiAgICAvLyBiZWNhdXNlIHdlJ3JlIGRvaW5nIGFuIFJQQyBhbmQgd2FudCB0byB1c2Ugd2hhdCB0aGUgc2VydmVyXG4gICAgLy8gcmV0dXJucyBpbnN0ZWFkLCBsb2cgaXQgc28gdGhlIGRldmVsb3BlciBrbm93c1xuICAgIC8vICh1bmxlc3MgdGhleSBleHBsaWNpdGx5IGFzayB0byBzZWUgdGhlIGVycm9yKS5cbiAgICAvL1xuICAgIC8vIFRlc3RzIGNhbiBzZXQgdGhlICdfZXhwZWN0ZWRCeVRlc3QnIGZsYWcgb24gYW4gZXhjZXB0aW9uIHNvIGl0IHdvbid0XG4gICAgLy8gZ28gdG8gbG9nLlxuICAgIGlmIChleGNlcHRpb24pIHtcbiAgICAgIGlmIChvcHRpb25zLnRocm93U3R1YkV4Y2VwdGlvbnMpIHtcbiAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgfSBlbHNlIGlmICghZXhjZXB0aW9uLl9leHBlY3RlZEJ5VGVzdCkge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKFxuICAgICAgICAgIFwiRXhjZXB0aW9uIHdoaWxlIHNpbXVsYXRpbmcgdGhlIGVmZmVjdCBvZiBpbnZva2luZyAnXCIgKyBuYW1lICsgXCInXCIsXG4gICAgICAgICAgZXhjZXB0aW9uXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXQgdGhpcyBwb2ludCB3ZSdyZSBkZWZpbml0ZWx5IGRvaW5nIGFuIFJQQywgYW5kIHdlJ3JlIGdvaW5nIHRvXG4gICAgLy8gcmV0dXJuIHRoZSB2YWx1ZSBvZiB0aGUgUlBDIHRvIHRoZSBjYWxsZXIuXG5cbiAgICAvLyBJZiB0aGUgY2FsbGVyIGRpZG4ndCBnaXZlIGEgY2FsbGJhY2ssIGRlY2lkZSB3aGF0IHRvIGRvLlxuICAgIGxldCBwcm9taXNlO1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGlmIChcbiAgICAgICAgTWV0ZW9yLmlzQ2xpZW50ICYmXG4gICAgICAgICFvcHRpb25zLnJldHVyblNlcnZlclJlc3VsdFByb21pc2UgJiZcbiAgICAgICAgKCFvcHRpb25zLmlzRnJvbUNhbGxBc3luYyB8fCBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSlcbiAgICAgICkge1xuICAgICAgICBjYWxsYmFjayA9IChlcnIpID0+IHtcbiAgICAgICAgICBlcnIgJiYgTWV0ZW9yLl9kZWJ1ZyhcIkVycm9yIGludm9raW5nIE1ldGhvZCAnXCIgKyBuYW1lICsgXCInXCIsIGVycik7XG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGNhbGxiYWNrID0gKC4uLmFsbEFyZ3MpID0+IHtcbiAgICAgICAgICAgIGxldCBhcmdzID0gQXJyYXkuZnJvbShhbGxBcmdzKTtcbiAgICAgICAgICAgIGxldCBlcnIgPSBhcmdzLnNoaWZ0KCk7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXNvbHZlKC4uLmFyZ3MpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNlbmQgdGhlIHJhbmRvbVNlZWQgb25seSBpZiB3ZSB1c2VkIGl0XG4gICAgaWYgKHJhbmRvbVNlZWQudmFsdWUgIT09IG51bGwpIHtcbiAgICAgIG1lc3NhZ2UucmFuZG9tU2VlZCA9IHJhbmRvbVNlZWQudmFsdWU7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kSW52b2tlciA9IG5ldyBNZXRob2RJbnZva2VyKHtcbiAgICAgIG1ldGhvZElkLFxuICAgICAgY2FsbGJhY2s6IGNhbGxiYWNrLFxuICAgICAgY29ubmVjdGlvbjogc2VsZixcbiAgICAgIG9uUmVzdWx0UmVjZWl2ZWQ6IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCxcbiAgICAgIHdhaXQ6ICEhb3B0aW9ucy53YWl0LFxuICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgIG5vUmV0cnk6ICEhb3B0aW9ucy5ub1JldHJ5XG4gICAgfSk7XG5cbiAgICBsZXQgcmVzdWx0O1xuXG4gICAgaWYgKHByb21pc2UpIHtcbiAgICAgIHJlc3VsdCA9IG9wdGlvbnMucmV0dXJuU3R1YlZhbHVlID8gcHJvbWlzZS50aGVuKCgpID0+IHN0dWJSZXR1cm5WYWx1ZSkgOiBwcm9taXNlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSA/IHN0dWJSZXR1cm5WYWx1ZSA6IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5fcmV0dXJuTWV0aG9kSW52b2tlcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWV0aG9kSW52b2tlcixcbiAgICAgICAgcmVzdWx0LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBzZWxmLl9hZGRPdXRzdGFuZGluZ01ldGhvZChtZXRob2RJbnZva2VyLCBvcHRpb25zKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgX3N0dWJDYWxsKG5hbWUsIGFyZ3MsIG9wdGlvbnMpIHtcbiAgICAvLyBSdW4gdGhlIHN0dWIsIGlmIHdlIGhhdmUgb25lLiBUaGUgc3R1YiBpcyBzdXBwb3NlZCB0byBtYWtlIHNvbWVcbiAgICAvLyB0ZW1wb3Jhcnkgd3JpdGVzIHRvIHRoZSBkYXRhYmFzZSB0byBnaXZlIHRoZSB1c2VyIGEgc21vb3RoIGV4cGVyaWVuY2VcbiAgICAvLyB1bnRpbCB0aGUgYWN0dWFsIHJlc3VsdCBvZiBleGVjdXRpbmcgdGhlIG1ldGhvZCBjb21lcyBiYWNrIGZyb20gdGhlXG4gICAgLy8gc2VydmVyICh3aGVyZXVwb24gdGhlIHRlbXBvcmFyeSB3cml0ZXMgdG8gdGhlIGRhdGFiYXNlIHdpbGwgYmUgcmV2ZXJzZWRcbiAgICAvLyBkdXJpbmcgdGhlIGJlZ2luVXBkYXRlL2VuZFVwZGF0ZSBwcm9jZXNzLilcbiAgICAvL1xuICAgIC8vIE5vcm1hbGx5LCB3ZSBpZ25vcmUgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgc3R1YiAoZXZlbiBpZiBpdCBpcyBhblxuICAgIC8vIGV4Y2VwdGlvbiksIGluIGZhdm9yIG9mIHRoZSByZWFsIHJldHVybiB2YWx1ZSBmcm9tIHRoZSBzZXJ2ZXIuIFRoZVxuICAgIC8vIGV4Y2VwdGlvbiBpcyBpZiB0aGUgKmNhbGxlciogaXMgYSBzdHViLiBJbiB0aGF0IGNhc2UsIHdlJ3JlIG5vdCBnb2luZ1xuICAgIC8vIHRvIGRvIGEgUlBDLCBzbyB3ZSB1c2UgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgc3R1YiBhcyBvdXIgcmV0dXJuXG4gICAgLy8gdmFsdWUuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgZW5jbG9zaW5nID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgICBjb25zdCBzdHViID0gc2VsZi5fbWV0aG9kSGFuZGxlcnNbbmFtZV07XG4gICAgY29uc3QgYWxyZWFkeUluU2ltdWxhdGlvbiA9IGVuY2xvc2luZz8uaXNTaW11bGF0aW9uO1xuICAgIGNvbnN0IGlzRnJvbUNhbGxBc3luYyA9IGVuY2xvc2luZz8uX2lzRnJvbUNhbGxBc3luYztcbiAgICBjb25zdCByYW5kb21TZWVkID0geyB2YWx1ZTogbnVsbH07XG5cbiAgICBjb25zdCBkZWZhdWx0UmV0dXJuID0ge1xuICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgIHJhbmRvbVNlZWQsXG4gICAgICBpc0Zyb21DYWxsQXN5bmMsXG4gICAgfTtcbiAgICBpZiAoIXN0dWIpIHtcbiAgICAgIHJldHVybiB7IC4uLmRlZmF1bHRSZXR1cm4sIGhhc1N0dWI6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgLy8gTGF6aWx5IGdlbmVyYXRlIGEgcmFuZG9tU2VlZCwgb25seSBpZiBpdCBpcyByZXF1ZXN0ZWQgYnkgdGhlIHN0dWIuXG4gICAgLy8gVGhlIHJhbmRvbSBzdHJlYW1zIG9ubHkgaGF2ZSB1dGlsaXR5IGlmIHRoZXkncmUgdXNlZCBvbiBib3RoIHRoZSBjbGllbnRcbiAgICAvLyBhbmQgdGhlIHNlcnZlcjsgaWYgdGhlIGNsaWVudCBkb2Vzbid0IGdlbmVyYXRlIGFueSAncmFuZG9tJyB2YWx1ZXNcbiAgICAvLyB0aGVuIHdlIGRvbid0IGV4cGVjdCB0aGUgc2VydmVyIHRvIGdlbmVyYXRlIGFueSBlaXRoZXIuXG4gICAgLy8gTGVzcyBjb21tb25seSwgdGhlIHNlcnZlciBtYXkgcGVyZm9ybSBkaWZmZXJlbnQgYWN0aW9ucyBmcm9tIHRoZSBjbGllbnQsXG4gICAgLy8gYW5kIG1heSBpbiBmYWN0IGdlbmVyYXRlIHZhbHVlcyB3aGVyZSB0aGUgY2xpZW50IGRpZCBub3QsIGJ1dCB3ZSBkb24ndFxuICAgIC8vIGhhdmUgYW55IGNsaWVudC1zaWRlIHZhbHVlcyB0byBtYXRjaCwgc28gZXZlbiBoZXJlIHdlIG1heSBhcyB3ZWxsIGp1c3RcbiAgICAvLyB1c2UgYSByYW5kb20gc2VlZCBvbiB0aGUgc2VydmVyLiAgSW4gdGhhdCBjYXNlLCB3ZSBkb24ndCBwYXNzIHRoZVxuICAgIC8vIHJhbmRvbVNlZWQgdG8gc2F2ZSBiYW5kd2lkdGgsIGFuZCB3ZSBkb24ndCBldmVuIGdlbmVyYXRlIGl0IHRvIHNhdmUgYVxuICAgIC8vIGJpdCBvZiBDUFUgYW5kIHRvIGF2b2lkIGNvbnN1bWluZyBlbnRyb3B5LlxuXG4gICAgY29uc3QgcmFuZG9tU2VlZEdlbmVyYXRvciA9ICgpID0+IHtcbiAgICAgIGlmIChyYW5kb21TZWVkLnZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIHJhbmRvbVNlZWQudmFsdWUgPSBERFBDb21tb24ubWFrZVJwY1NlZWQoZW5jbG9zaW5nLCBuYW1lKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByYW5kb21TZWVkLnZhbHVlO1xuICAgIH07XG5cbiAgICBjb25zdCBzZXRVc2VySWQgPSB1c2VySWQgPT4ge1xuICAgICAgc2VsZi5zZXRVc2VySWQodXNlcklkKTtcbiAgICB9O1xuXG4gICAgY29uc3QgaW52b2NhdGlvbiA9IG5ldyBERFBDb21tb24uTWV0aG9kSW52b2NhdGlvbih7XG4gICAgICBuYW1lLFxuICAgICAgaXNTaW11bGF0aW9uOiB0cnVlLFxuICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCgpLFxuICAgICAgaXNGcm9tQ2FsbEFzeW5jOiBvcHRpb25zPy5pc0Zyb21DYWxsQXN5bmMsXG4gICAgICBzZXRVc2VySWQ6IHNldFVzZXJJZCxcbiAgICAgIHJhbmRvbVNlZWQoKSB7XG4gICAgICAgIHJldHVybiByYW5kb21TZWVkR2VuZXJhdG9yKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBOb3RlIHRoYXQgdW5saWtlIGluIHRoZSBjb3JyZXNwb25kaW5nIHNlcnZlciBjb2RlLCB3ZSBuZXZlciBhdWRpdFxuICAgIC8vIHRoYXQgc3R1YnMgY2hlY2soKSB0aGVpciBhcmd1bWVudHMuXG4gICAgY29uc3Qgc3R1Ykludm9jYXRpb24gPSAoKSA9PiB7XG4gICAgICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgICAgICAvLyBCZWNhdXNlIHNhdmVPcmlnaW5hbHMgYW5kIHJldHJpZXZlT3JpZ2luYWxzIGFyZW4ndCByZWVudHJhbnQsXG4gICAgICAgICAgLy8gZG9uJ3QgYWxsb3cgc3R1YnMgdG8geWllbGQuXG4gICAgICAgICAgcmV0dXJuIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+IHtcbiAgICAgICAgICAgIC8vIHJlLWNsb25lLCBzbyB0aGF0IHRoZSBzdHViIGNhbid0IGFmZmVjdCBvdXIgY2FsbGVyJ3MgdmFsdWVzXG4gICAgICAgICAgICByZXR1cm4gc3R1Yi5hcHBseShpbnZvY2F0aW9uLCBFSlNPTi5jbG9uZShhcmdzKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHN0dWIuYXBwbHkoaW52b2NhdGlvbiwgRUpTT04uY2xvbmUoYXJncykpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4geyAuLi5kZWZhdWx0UmV0dXJuLCBoYXNTdHViOiB0cnVlLCBzdHViSW52b2NhdGlvbiwgaW52b2NhdGlvbiB9O1xuICB9XG5cbiAgLy8gQmVmb3JlIGNhbGxpbmcgYSBtZXRob2Qgc3R1YiwgcHJlcGFyZSBhbGwgc3RvcmVzIHRvIHRyYWNrIGNoYW5nZXMgYW5kIGFsbG93XG4gIC8vIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIHRvIGdldCB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgY2hhbmdlZFxuICAvLyBkb2N1bWVudHMuXG4gIF9zYXZlT3JpZ2luYWxzKCkge1xuICAgIGlmICghIHRoaXMuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQnVmZmVyZWRXcml0ZXNDbGllbnQoKTtcbiAgICB9XG5cbiAgICBPYmplY3QudmFsdWVzKHRoaXMuX3N0b3JlcykuZm9yRWFjaCgoc3RvcmUpID0+IHtcbiAgICAgIHN0b3JlLnNhdmVPcmlnaW5hbHMoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHJpZXZlcyB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgYWxsIGRvY3VtZW50cyBtb2RpZmllZCBieSB0aGUgc3R1YiBmb3JcbiAgLy8gbWV0aG9kICdtZXRob2RJZCcgZnJvbSBhbGwgc3RvcmVzIGFuZCBzYXZlcyB0aGVtIHRvIF9zZXJ2ZXJEb2N1bWVudHMgKGtleWVkXG4gIC8vIGJ5IGRvY3VtZW50KSBhbmQgX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgKGtleWVkIGJ5IG1ldGhvZCBJRCkuXG4gIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEdXBsaWNhdGUgbWV0aG9kSWQgaW4gX3JldHJpZXZlQW5kU3RvcmVPcmlnaW5hbHMnKTtcblxuICAgIGNvbnN0IGRvY3NXcml0dGVuID0gW107XG5cbiAgICBPYmplY3QuZW50cmllcyhzZWxmLl9zdG9yZXMpLmZvckVhY2goKFtjb2xsZWN0aW9uLCBzdG9yZV0pID0+IHtcbiAgICAgIGNvbnN0IG9yaWdpbmFscyA9IHN0b3JlLnJldHJpZXZlT3JpZ2luYWxzKCk7XG4gICAgICAvLyBub3QgYWxsIHN0b3JlcyBkZWZpbmUgcmV0cmlldmVPcmlnaW5hbHNcbiAgICAgIGlmICghIG9yaWdpbmFscykgcmV0dXJuO1xuICAgICAgb3JpZ2luYWxzLmZvckVhY2goKGRvYywgaWQpID0+IHtcbiAgICAgICAgZG9jc1dyaXR0ZW4ucHVzaCh7IGNvbGxlY3Rpb24sIGlkIH0pO1xuICAgICAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dID0gbmV3IE1vbmdvSURNYXAoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl0uc2V0RGVmYXVsdChcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBPYmplY3QuY3JlYXRlKG51bGwpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpIHtcbiAgICAgICAgICAvLyBXZSdyZSBub3QgdGhlIGZpcnN0IHN0dWIgdG8gd3JpdGUgdGhpcyBkb2MuIEp1c3QgYWRkIG91ciBtZXRob2QgSURcbiAgICAgICAgICAvLyB0byB0aGUgcmVjb3JkLlxuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZpcnN0IHN0dWIhIFNhdmUgdGhlIG9yaWdpbmFsIHZhbHVlIGFuZCBvdXIgbWV0aG9kIElELlxuICAgICAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IGRvYztcbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MgPSBbXTtcbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAoISBpc0VtcHR5KGRvY3NXcml0dGVuKSkge1xuICAgICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YlttZXRob2RJZF0gPSBkb2NzV3JpdHRlbjtcbiAgICB9XG4gIH1cblxuICAvLyBUaGlzIGlzIHZlcnkgbXVjaCBhIHByaXZhdGUgZnVuY3Rpb24gd2UgdXNlIHRvIG1ha2UgdGhlIHRlc3RzXG4gIC8vIHRha2UgdXAgZmV3ZXIgc2VydmVyIHJlc291cmNlcyBhZnRlciB0aGV5IGNvbXBsZXRlLlxuICBfdW5zdWJzY3JpYmVBbGwoKSB7XG4gICAgT2JqZWN0LnZhbHVlcyh0aGlzLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChzdWIpID0+IHtcbiAgICAgIC8vIEF2b2lkIGtpbGxpbmcgdGhlIGF1dG91cGRhdGUgc3Vic2NyaXB0aW9uIHNvIHRoYXQgZGV2ZWxvcGVyc1xuICAgICAgLy8gc3RpbGwgZ2V0IGhvdCBjb2RlIHB1c2hlcyB3aGVuIHdyaXRpbmcgdGVzdHMuXG4gICAgICAvL1xuICAgICAgLy8gWFhYIGl0J3MgYSBoYWNrIHRvIGVuY29kZSBrbm93bGVkZ2UgYWJvdXQgYXV0b3VwZGF0ZSBoZXJlLFxuICAgICAgLy8gYnV0IGl0IGRvZXNuJ3Qgc2VlbSB3b3J0aCBpdCB5ZXQgdG8gaGF2ZSBhIHNwZWNpYWwgQVBJIGZvclxuICAgICAgLy8gc3Vic2NyaXB0aW9ucyB0byBwcmVzZXJ2ZSBhZnRlciB1bml0IHRlc3RzLlxuICAgICAgaWYgKHN1Yi5uYW1lICE9PSAnbWV0ZW9yX2F1dG91cGRhdGVfY2xpZW50VmVyc2lvbnMnKSB7XG4gICAgICAgIHN1Yi5zdG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBTZW5kcyB0aGUgRERQIHN0cmluZ2lmaWNhdGlvbiBvZiB0aGUgZ2l2ZW4gbWVzc2FnZSBvYmplY3RcbiAgX3NlbmQob2JqKSB7XG4gICAgdGhpcy5fc3RyZWFtLnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChvYmopKTtcbiAgfVxuXG4gIC8vIEFsd2F5cyBxdWV1ZXMgdGhlIGNhbGwgYmVmb3JlIHNlbmRpbmcgdGhlIG1lc3NhZ2VcbiAgLy8gVXNlZCwgZm9yIGV4YW1wbGUsIG9uIHN1YnNjcmlwdGlvbi5baWRdLnN0b3AoKSB0byBtYWtlIHN1cmUgYSBcInN1YlwiIG1lc3NhZ2UgaXMgYWx3YXlzIGNhbGxlZCBiZWZvcmUgYW4gXCJ1bnN1YlwiIG1lc3NhZ2VcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzEzMjEyXG4gIC8vXG4gIC8vIFRoaXMgaXMgcGFydCBvZiB0aGUgYWN0dWFsIGZpeCBmb3IgdGhlIHJlc3QgY2hlY2s6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL3B1bGwvMTMyMzZcbiAgX3NlbmRRdWV1ZWQob2JqKSB7XG4gICAgdGhpcy5fc2VuZChvYmosIHRydWUpO1xuICB9XG5cbiAgLy8gV2UgZGV0ZWN0ZWQgdmlhIEREUC1sZXZlbCBoZWFydGJlYXRzIHRoYXQgd2UndmUgbG9zdCB0aGVcbiAgLy8gY29ubmVjdGlvbi4gIFVubGlrZSBgZGlzY29ubmVjdGAgb3IgYGNsb3NlYCwgYSBsb3N0IGNvbm5lY3Rpb25cbiAgLy8gd2lsbCBiZSBhdXRvbWF0aWNhbGx5IHJldHJpZWQuXG4gIF9sb3N0Q29ubmVjdGlvbihlcnJvcikge1xuICAgIHRoaXMuX3N0cmVhbS5fbG9zdENvbm5lY3Rpb24oZXJyb3IpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLnN0YXR1c1xuICAgKiBAc3VtbWFyeSBHZXQgdGhlIGN1cnJlbnQgY29ubmVjdGlvbiBzdGF0dXMuIEEgcmVhY3RpdmUgZGF0YSBzb3VyY2UuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIHN0YXR1cyguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5zdGF0dXMoLi4uYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgRm9yY2UgYW4gaW1tZWRpYXRlIHJlY29ubmVjdGlvbiBhdHRlbXB0IGlmIHRoZSBjbGllbnQgaXMgbm90IGNvbm5lY3RlZCB0byB0aGUgc2VydmVyLlxuXG4gIFRoaXMgbWV0aG9kIGRvZXMgbm90aGluZyBpZiB0aGUgY2xpZW50IGlzIGFscmVhZHkgY29ubmVjdGVkLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5yZWNvbm5lY3RcbiAgICogQGxvY3VzIENsaWVudFxuICAgKi9cbiAgcmVjb25uZWN0KC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLnJlY29ubmVjdCguLi5hcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5kaXNjb25uZWN0XG4gICAqIEBzdW1tYXJ5IERpc2Nvbm5lY3QgdGhlIGNsaWVudCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIGRpc2Nvbm5lY3QoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0uZGlzY29ubmVjdCguLi5hcmdzKTtcbiAgfVxuXG4gIGNsb3NlKCkge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0uZGlzY29ubmVjdCh7IF9wZXJtYW5lbnQ6IHRydWUgfSk7XG4gIH1cblxuICAvLy9cbiAgLy8vIFJlYWN0aXZlIHVzZXIgc3lzdGVtXG4gIC8vL1xuICB1c2VySWQoKSB7XG4gICAgaWYgKHRoaXMuX3VzZXJJZERlcHMpIHRoaXMuX3VzZXJJZERlcHMuZGVwZW5kKCk7XG4gICAgcmV0dXJuIHRoaXMuX3VzZXJJZDtcbiAgfVxuXG4gIHNldFVzZXJJZCh1c2VySWQpIHtcbiAgICAvLyBBdm9pZCBpbnZhbGlkYXRpbmcgZGVwZW5kZW50cyBpZiBzZXRVc2VySWQgaXMgY2FsbGVkIHdpdGggY3VycmVudCB2YWx1ZS5cbiAgICBpZiAodGhpcy5fdXNlcklkID09PSB1c2VySWQpIHJldHVybjtcbiAgICB0aGlzLl91c2VySWQgPSB1c2VySWQ7XG4gICAgaWYgKHRoaXMuX3VzZXJJZERlcHMpIHRoaXMuX3VzZXJJZERlcHMuY2hhbmdlZCgpO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0cnVlIGlmIHdlIGFyZSBpbiBhIHN0YXRlIGFmdGVyIHJlY29ubmVjdCBvZiB3YWl0aW5nIGZvciBzdWJzIHRvIGJlXG4gIC8vIHJldml2ZWQgb3IgZWFybHkgbWV0aG9kcyB0byBmaW5pc2ggdGhlaXIgZGF0YSwgb3Igd2UgYXJlIHdhaXRpbmcgZm9yIGFcbiAgLy8gXCJ3YWl0XCIgbWV0aG9kIHRvIGZpbmlzaC5cbiAgX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkge1xuICAgIHJldHVybiAoXG4gICAgICAhIGlzRW1wdHkodGhpcy5fc3Vic0JlaW5nUmV2aXZlZCkgfHxcbiAgICAgICEgaXNFbXB0eSh0aGlzLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlKVxuICAgICk7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRydWUgaWYgYW55IG1ldGhvZCB3aG9zZSBtZXNzYWdlIGhhcyBiZWVuIHNlbnQgdG8gdGhlIHNlcnZlciBoYXNcbiAgLy8gbm90IHlldCBpbnZva2VkIGl0cyB1c2VyIGNhbGxiYWNrLlxuICBfYW55TWV0aG9kc0FyZU91dHN0YW5kaW5nKCkge1xuICAgIGNvbnN0IGludm9rZXJzID0gdGhpcy5fbWV0aG9kSW52b2tlcnM7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoaW52b2tlcnMpLnNvbWUoKGludm9rZXIpID0+ICEhaW52b2tlci5zZW50TWVzc2FnZSk7XG4gIH1cblxuICBhc3luYyBfbGl2ZWRhdGFfY29ubmVjdGVkKG1zZykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYuX3ZlcnNpb24gIT09ICdwcmUxJyAmJiBzZWxmLl9oZWFydGJlYXRJbnRlcnZhbCAhPT0gMCkge1xuICAgICAgc2VsZi5faGVhcnRiZWF0ID0gbmV3IEREUENvbW1vbi5IZWFydGJlYXQoe1xuICAgICAgICBoZWFydGJlYXRJbnRlcnZhbDogc2VsZi5faGVhcnRiZWF0SW50ZXJ2YWwsXG4gICAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IHNlbGYuX2hlYXJ0YmVhdFRpbWVvdXQsXG4gICAgICAgIG9uVGltZW91dCgpIHtcbiAgICAgICAgICBzZWxmLl9sb3N0Q29ubmVjdGlvbihcbiAgICAgICAgICAgIG5ldyBERFAuQ29ubmVjdGlvbkVycm9yKCdERFAgaGVhcnRiZWF0IHRpbWVkIG91dCcpXG4gICAgICAgICAgKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2VuZFBpbmcoKSB7XG4gICAgICAgICAgc2VsZi5fc2VuZCh7IG1zZzogJ3BpbmcnIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHNlbGYuX2hlYXJ0YmVhdC5zdGFydCgpO1xuICAgIH1cblxuICAgIC8vIElmIHRoaXMgaXMgYSByZWNvbm5lY3QsIHdlJ2xsIGhhdmUgdG8gcmVzZXQgYWxsIHN0b3Jlcy5cbiAgICBpZiAoc2VsZi5fbGFzdFNlc3Npb25JZCkgc2VsZi5fcmVzZXRTdG9yZXMgPSB0cnVlO1xuXG4gICAgbGV0IHJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb247XG4gICAgaWYgKHR5cGVvZiBtc2cuc2Vzc2lvbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb24gPSBzZWxmLl9sYXN0U2Vzc2lvbklkID09PSBtc2cuc2Vzc2lvbjtcbiAgICAgIHNlbGYuX2xhc3RTZXNzaW9uSWQgPSBtc2cuc2Vzc2lvbjtcbiAgICB9XG5cbiAgICBpZiAocmVjb25uZWN0ZWRUb1ByZXZpb3VzU2Vzc2lvbikge1xuICAgICAgLy8gU3VjY2Vzc2Z1bCByZWNvbm5lY3Rpb24gLS0gcGljayB1cCB3aGVyZSB3ZSBsZWZ0IG9mZi4gIE5vdGUgdGhhdCByaWdodFxuICAgICAgLy8gbm93LCB0aGlzIG5ldmVyIGhhcHBlbnM6IHRoZSBzZXJ2ZXIgbmV2ZXIgY29ubmVjdHMgdXMgdG8gYSBwcmV2aW91c1xuICAgICAgLy8gc2Vzc2lvbiwgYmVjYXVzZSBERFAgZG9lc24ndCBwcm92aWRlIGVub3VnaCBkYXRhIGZvciB0aGUgc2VydmVyIHRvIGtub3dcbiAgICAgIC8vIHdoYXQgbWVzc2FnZXMgdGhlIGNsaWVudCBoYXMgcHJvY2Vzc2VkLiBXZSBuZWVkIHRvIGltcHJvdmUgRERQIHRvIG1ha2VcbiAgICAgIC8vIHRoaXMgcG9zc2libGUsIGF0IHdoaWNoIHBvaW50IHdlJ2xsIHByb2JhYmx5IG5lZWQgbW9yZSBjb2RlIGhlcmUuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gU2VydmVyIGRvZXNuJ3QgaGF2ZSBvdXIgZGF0YSBhbnkgbW9yZS4gUmUtc3luYyBhIG5ldyBzZXNzaW9uLlxuXG4gICAgLy8gRm9yZ2V0IGFib3V0IG1lc3NhZ2VzIHdlIHdlcmUgYnVmZmVyaW5nIGZvciB1bmtub3duIGNvbGxlY3Rpb25zLiBUaGV5J2xsXG4gICAgLy8gYmUgcmVzZW50IGlmIHN0aWxsIHJlbGV2YW50LlxuICAgIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgLy8gRm9yZ2V0IGFib3V0IHRoZSBlZmZlY3RzIG9mIHN0dWJzLiBXZSdsbCBiZSByZXNldHRpbmcgYWxsIGNvbGxlY3Rpb25zXG4gICAgICAvLyBhbnl3YXkuXG4gICAgICBzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgIHNlbGYuX3NlcnZlckRvY3VtZW50cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgfVxuXG4gICAgLy8gQ2xlYXIgX2FmdGVyVXBkYXRlQ2FsbGJhY2tzLlxuICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzID0gW107XG5cbiAgICAvLyBNYXJrIGFsbCBuYW1lZCBzdWJzY3JpcHRpb25zIHdoaWNoIGFyZSByZWFkeSAoaWUsIHdlIGFscmVhZHkgY2FsbGVkIHRoZVxuICAgIC8vIHJlYWR5IGNhbGxiYWNrKSBhcyBuZWVkaW5nIHRvIGJlIHJldml2ZWQuXG4gICAgLy8gWFhYIFdlIHNob3VsZCBhbHNvIGJsb2NrIHJlY29ubmVjdCBxdWllc2NlbmNlIHVudGlsIHVubmFtZWQgc3Vic2NyaXB0aW9uc1xuICAgIC8vICAgICAoZWcsIGF1dG9wdWJsaXNoKSBhcmUgZG9uZSByZS1wdWJsaXNoaW5nIHRvIGF2b2lkIGZsaWNrZXIhXG4gICAgc2VsZi5fc3Vic0JlaW5nUmV2aXZlZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgT2JqZWN0LmVudHJpZXMoc2VsZi5fc3Vic2NyaXB0aW9ucykuZm9yRWFjaCgoW2lkLCBzdWJdKSA9PiB7XG4gICAgICBpZiAoc3ViLnJlYWR5KSB7XG4gICAgICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWRbaWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFycmFuZ2UgZm9yIFwiaGFsZi1maW5pc2hlZFwiIG1ldGhvZHMgdG8gaGF2ZSB0aGVpciBjYWxsYmFja3MgcnVuLCBhbmRcbiAgICAvLyB0cmFjayBtZXRob2RzIHRoYXQgd2VyZSBzZW50IG9uIHRoaXMgY29ubmVjdGlvbiBzbyB0aGF0IHdlIGRvbid0XG4gICAgLy8gcXVpZXNjZSB1bnRpbCB0aGV5IGFyZSBhbGwgZG9uZS5cbiAgICAvL1xuICAgIC8vIFN0YXJ0IGJ5IGNsZWFyaW5nIF9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlOiBtZXRob2RzIHNlbnQgYmVmb3JlXG4gICAgLy8gcmVjb25uZWN0IGRvbid0IG1hdHRlciwgYW5kIGFueSBcIndhaXRcIiBtZXRob2RzIHNlbnQgb24gdGhlIG5ldyBjb25uZWN0aW9uXG4gICAgLy8gdGhhdCB3ZSBkcm9wIGhlcmUgd2lsbCBiZSByZXN0b3JlZCBieSB0aGUgbG9vcCBiZWxvdy5cbiAgICBzZWxmLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMpIHtcbiAgICAgIGNvbnN0IGludm9rZXJzID0gc2VsZi5fbWV0aG9kSW52b2tlcnM7XG4gICAgICBrZXlzKGludm9rZXJzKS5mb3JFYWNoKGlkID0+IHtcbiAgICAgICAgY29uc3QgaW52b2tlciA9IGludm9rZXJzW2lkXTtcbiAgICAgICAgaWYgKGludm9rZXIuZ290UmVzdWx0KCkpIHtcbiAgICAgICAgICAvLyBUaGlzIG1ldGhvZCBhbHJlYWR5IGdvdCBpdHMgcmVzdWx0LCBidXQgaXQgZGlkbid0IGNhbGwgaXRzIGNhbGxiYWNrXG4gICAgICAgICAgLy8gYmVjYXVzZSBpdHMgZGF0YSBkaWRuJ3QgYmVjb21lIHZpc2libGUuIFdlIGRpZCBub3QgcmVzZW5kIHRoZVxuICAgICAgICAgIC8vIG1ldGhvZCBSUEMuIFdlJ2xsIGNhbGwgaXRzIGNhbGxiYWNrIHdoZW4gd2UgZ2V0IGEgZnVsbCBxdWllc2NlLFxuICAgICAgICAgIC8vIHNpbmNlIHRoYXQncyBhcyBjbG9zZSBhcyB3ZSdsbCBnZXQgdG8gXCJkYXRhIG11c3QgYmUgdmlzaWJsZVwiLlxuICAgICAgICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzLnB1c2goXG4gICAgICAgICAgICAoLi4uYXJncykgPT4gaW52b2tlci5kYXRhVmlzaWJsZSguLi5hcmdzKVxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW52b2tlci5zZW50TWVzc2FnZSkge1xuICAgICAgICAgIC8vIFRoaXMgbWV0aG9kIGhhcyBiZWVuIHNlbnQgb24gdGhpcyBjb25uZWN0aW9uIChtYXliZSBhcyBhIHJlc2VuZFxuICAgICAgICAgIC8vIGZyb20gdGhlIGxhc3QgY29ubmVjdGlvbiwgbWF5YmUgZnJvbSBvblJlY29ubmVjdCwgbWF5YmUganVzdCB2ZXJ5XG4gICAgICAgICAgLy8gcXVpY2tseSBiZWZvcmUgcHJvY2Vzc2luZyB0aGUgY29ubmVjdGVkIG1lc3NhZ2UpLlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gV2UgZG9uJ3QgbmVlZCB0byBkbyBhbnl0aGluZyBzcGVjaWFsIHRvIGVuc3VyZSBpdHMgY2FsbGJhY2tzIGdldFxuICAgICAgICAgIC8vIGNhbGxlZCwgYnV0IHdlJ2xsIGNvdW50IGl0IGFzIGEgbWV0aG9kIHdoaWNoIGlzIHByZXZlbnRpbmdcbiAgICAgICAgICAvLyByZWNvbm5lY3QgcXVpZXNjZW5jZS4gKGVnLCBpdCBtaWdodCBiZSBhIGxvZ2luIG1ldGhvZCB0aGF0IHdhcyBydW5cbiAgICAgICAgICAvLyBmcm9tIG9uUmVjb25uZWN0LCBhbmQgd2UgZG9uJ3Qgd2FudCB0byBzZWUgZmxpY2tlciBieSBzZWVpbmcgYVxuICAgICAgICAgIC8vIGxvZ2dlZC1vdXQgc3RhdGUuKVxuICAgICAgICAgIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2VbaW52b2tlci5tZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlID0gW107XG5cbiAgICAvLyBJZiB3ZSdyZSBub3Qgd2FpdGluZyBvbiBhbnkgbWV0aG9kcyBvciBzdWJzLCB3ZSBjYW4gcmVzZXQgdGhlIHN0b3JlcyBhbmRcbiAgICAvLyBjYWxsIHRoZSBjYWxsYmFja3MgaW1tZWRpYXRlbHkuXG4gICAgaWYgKCEgc2VsZi5fd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSkge1xuICAgICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICAgIGZvciAoY29uc3Qgc3RvcmUgb2YgT2JqZWN0LnZhbHVlcyhzZWxmLl9zdG9yZXMpKSB7XG4gICAgICAgICAgYXdhaXQgc3RvcmUuYmVnaW5VcGRhdGUoMCwgdHJ1ZSk7XG4gICAgICAgICAgYXdhaXQgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5fcmVzZXRTdG9yZXMgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHNlbGYuX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBtZXNzYWdlVHlwZSA9IG1zZy5tc2c7XG5cbiAgICAvLyBtc2cgaXMgb25lIG9mIFsnYWRkZWQnLCAnY2hhbmdlZCcsICdyZW1vdmVkJywgJ3JlYWR5JywgJ3VwZGF0ZWQnXVxuICAgIGlmIChtZXNzYWdlVHlwZSA9PT0gJ2FkZGVkJykge1xuICAgICAgYXdhaXQgdGhpcy5fcHJvY2Vzc19hZGRlZChtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICdjaGFuZ2VkJykge1xuICAgICAgdGhpcy5fcHJvY2Vzc19jaGFuZ2VkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ3JlbW92ZWQnKSB7XG4gICAgICB0aGlzLl9wcm9jZXNzX3JlbW92ZWQobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAncmVhZHknKSB7XG4gICAgICB0aGlzLl9wcm9jZXNzX3JlYWR5KG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ3VwZGF0ZWQnKSB7XG4gICAgICB0aGlzLl9wcm9jZXNzX3VwZGF0ZWQobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAnbm9zdWInKSB7XG4gICAgICAvLyBpZ25vcmUgdGhpc1xuICAgIH0gZWxzZSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdkaXNjYXJkaW5nIHVua25vd24gbGl2ZWRhdGEgZGF0YSBtZXNzYWdlIHR5cGUnLCBtc2cpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIF9saXZlZGF0YV9kYXRhKG1zZykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIHNlbGYuX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UucHVzaChtc2cpO1xuXG4gICAgICBpZiAobXNnLm1zZyA9PT0gJ25vc3ViJykge1xuICAgICAgICBkZWxldGUgc2VsZi5fc3Vic0JlaW5nUmV2aXZlZFttc2cuaWRdO1xuICAgICAgfVxuXG4gICAgICBpZiAobXNnLnN1YnMpIHtcbiAgICAgICAgbXNnLnN1YnMuZm9yRWFjaChzdWJJZCA9PiB7XG4gICAgICAgICAgZGVsZXRlIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWRbc3ViSWRdO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1zZy5tZXRob2RzKSB7XG4gICAgICAgIG1zZy5tZXRob2RzLmZvckVhY2gobWV0aG9kSWQgPT4ge1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlW21ldGhvZElkXTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzZWxmLl93YWl0aW5nRm9yUXVpZXNjZW5jZSgpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gTm8gbWV0aG9kcyBvciBzdWJzIGFyZSBibG9ja2luZyBxdWllc2NlbmNlIVxuICAgICAgLy8gV2UnbGwgbm93IHByb2Nlc3MgYW5kIGFsbCBvZiBvdXIgYnVmZmVyZWQgbWVzc2FnZXMsIHJlc2V0IGFsbCBzdG9yZXMsXG4gICAgICAvLyBhbmQgYXBwbHkgdGhlbSBhbGwgYXQgb25jZS5cblxuICAgICAgY29uc3QgYnVmZmVyZWRNZXNzYWdlcyA9IHNlbGYuX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2U7XG4gICAgICBmb3IgKGNvbnN0IGJ1ZmZlcmVkTWVzc2FnZSBvZiBPYmplY3QudmFsdWVzKGJ1ZmZlcmVkTWVzc2FnZXMpKSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShcbiAgICAgICAgICBidWZmZXJlZE1lc3NhZ2UsXG4gICAgICAgICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHNlbGYuX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShtc2csIHNlbGYuX2J1ZmZlcmVkV3JpdGVzKTtcbiAgICB9XG5cbiAgICAvLyBJbW1lZGlhdGVseSBmbHVzaCB3cml0ZXMgd2hlbjpcbiAgICAvLyAgMS4gQnVmZmVyaW5nIGlzIGRpc2FibGVkLiBPcjtcbiAgICAvLyAgMi4gYW55IG5vbi0oYWRkZWQvY2hhbmdlZC9yZW1vdmVkKSBtZXNzYWdlIGFycml2ZXMuXG4gICAgY29uc3Qgc3RhbmRhcmRXcml0ZSA9XG4gICAgICBtc2cubXNnID09PSBcImFkZGVkXCIgfHxcbiAgICAgIG1zZy5tc2cgPT09IFwiY2hhbmdlZFwiIHx8XG4gICAgICBtc2cubXNnID09PSBcInJlbW92ZWRcIjtcblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ludGVydmFsID09PSAwIHx8ICEgc3RhbmRhcmRXcml0ZSkge1xuICAgICAgYXdhaXQgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPT09IG51bGwpIHtcbiAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9XG4gICAgICAgIG5ldyBEYXRlKCkudmFsdWVPZigpICsgc2VsZi5fYnVmZmVyZWRXcml0ZXNNYXhBZ2U7XG4gICAgfSBlbHNlIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPCBuZXcgRGF0ZSgpLnZhbHVlT2YoKSkge1xuICAgICAgYXdhaXQgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSk7XG4gICAgfVxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIC8vIF9fZmx1c2hCdWZmZXJlZFdyaXRlcyBpcyBhIHByb21pc2UsIHNvIHdpdGggdGhpcyB3ZSBjYW4gd2FpdCB0aGUgcHJvbWlzZSB0byBmaW5pc2hcbiAgICAgIC8vIGJlZm9yZSBkb2luZyBzb21ldGhpbmdcbiAgICAgIHNlbGYuX2xpdmVEYXRhV3JpdGVzUHJvbWlzZSA9IHNlbGYuX19mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG5cbiAgICAgIGlmIChNZXRlb3IuX2lzUHJvbWlzZShzZWxmLl9saXZlRGF0YVdyaXRlc1Byb21pc2UpKSB7XG4gICAgICAgIHNlbGYuX2xpdmVEYXRhV3JpdGVzUHJvbWlzZS5maW5hbGx5KFxuICAgICAgICAgICgpID0+IChzZWxmLl9saXZlRGF0YVdyaXRlc1Byb21pc2UgPSB1bmRlZmluZWQpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSwgc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCk7XG4gIH1cblxuICBfcHJlcGFyZUJ1ZmZlcnNUb0ZsdXNoKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSk7XG4gICAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlID0gbnVsbDtcbiAgICB9XG5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFdlIG5lZWQgdG8gY2xlYXIgdGhlIGJ1ZmZlciBiZWZvcmUgcGFzc2luZyBpdCB0b1xuICAgIC8vICBwZXJmb3JtV3JpdGVzLiBBcyB0aGVyZSdzIG5vIGd1YXJhbnRlZSB0aGF0IGl0XG4gICAgLy8gIHdpbGwgZXhpdCBjbGVhbmx5LlxuICAgIGNvbnN0IHdyaXRlcyA9IHNlbGYuX2J1ZmZlcmVkV3JpdGVzO1xuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICByZXR1cm4gd3JpdGVzO1xuICB9XG5cbiAgYXN5bmMgX2ZsdXNoQnVmZmVyZWRXcml0ZXNTZXJ2ZXIoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgd3JpdGVzID0gc2VsZi5fcHJlcGFyZUJ1ZmZlcnNUb0ZsdXNoKCk7XG4gICAgYXdhaXQgc2VsZi5fcGVyZm9ybVdyaXRlc1NlcnZlcih3cml0ZXMpO1xuICB9XG4gIF9mbHVzaEJ1ZmZlcmVkV3JpdGVzQ2xpZW50KCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHdyaXRlcyA9IHNlbGYuX3ByZXBhcmVCdWZmZXJzVG9GbHVzaCgpO1xuICAgIHNlbGYuX3BlcmZvcm1Xcml0ZXNDbGllbnQod3JpdGVzKTtcbiAgfVxuICBfZmx1c2hCdWZmZXJlZFdyaXRlcygpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gTWV0ZW9yLmlzQ2xpZW50XG4gICAgICA/IHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXNDbGllbnQoKVxuICAgICAgOiBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzU2VydmVyKCk7XG4gIH1cbiAgYXN5bmMgX3BlcmZvcm1Xcml0ZXNTZXJ2ZXIodXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzIHx8ICEgaXNFbXB0eSh1cGRhdGVzKSkge1xuICAgICAgLy8gQmVnaW4gYSB0cmFuc2FjdGlvbmFsIHVwZGF0ZSBvZiBlYWNoIHN0b3JlLlxuXG4gICAgICBmb3IgKGNvbnN0IFtzdG9yZU5hbWUsIHN0b3JlXSBvZiBPYmplY3QuZW50cmllcyhzZWxmLl9zdG9yZXMpKSB7XG4gICAgICAgIGF3YWl0IHN0b3JlLmJlZ2luVXBkYXRlKFxuICAgICAgICAgIGhhc093bi5jYWxsKHVwZGF0ZXMsIHN0b3JlTmFtZSlcbiAgICAgICAgICAgID8gdXBkYXRlc1tzdG9yZU5hbWVdLmxlbmd0aFxuICAgICAgICAgICAgOiAwLFxuICAgICAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzID0gZmFsc2U7XG5cbiAgICAgIGZvciAoY29uc3QgW3N0b3JlTmFtZSwgdXBkYXRlTWVzc2FnZXNdIG9mIE9iamVjdC5lbnRyaWVzKHVwZGF0ZXMpKSB7XG4gICAgICAgIGNvbnN0IHN0b3JlID0gc2VsZi5fc3RvcmVzW3N0b3JlTmFtZV07XG4gICAgICAgIGlmIChzdG9yZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgdXBkYXRlTWVzc2FnZSBvZiB1cGRhdGVNZXNzYWdlcykge1xuICAgICAgICAgICAgYXdhaXQgc3RvcmUudXBkYXRlKHVwZGF0ZU1lc3NhZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBOb2JvZHkncyBsaXN0ZW5pbmcgZm9yIHRoaXMgZGF0YS4gUXVldWUgaXQgdXAgdW50aWxcbiAgICAgICAgICAvLyBzb21lb25lIHdhbnRzIGl0LlxuICAgICAgICAgIC8vIFhYWCBtZW1vcnkgdXNlIHdpbGwgZ3JvdyB3aXRob3V0IGJvdW5kIGlmIHlvdSBmb3JnZXQgdG9cbiAgICAgICAgICAvLyBjcmVhdGUgYSBjb2xsZWN0aW9uIG9yIGp1c3QgZG9uJ3QgY2FyZSBhYm91dCBpdC4uLiBnb2luZ1xuICAgICAgICAgIC8vIHRvIGhhdmUgdG8gZG8gc29tZXRoaW5nIGFib3V0IHRoYXQuXG4gICAgICAgICAgY29uc3QgdXBkYXRlcyA9IHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzO1xuXG4gICAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKSkge1xuICAgICAgICAgICAgdXBkYXRlc1tzdG9yZU5hbWVdID0gW107XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdXBkYXRlc1tzdG9yZU5hbWVdLnB1c2goLi4udXBkYXRlTWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBFbmQgdXBkYXRlIHRyYW5zYWN0aW9uLlxuICAgICAgZm9yIChjb25zdCBzdG9yZSBvZiBPYmplY3QudmFsdWVzKHNlbGYuX3N0b3JlcykpIHtcbiAgICAgICAgYXdhaXQgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VsZi5fcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MoKTtcbiAgfVxuICBfcGVyZm9ybVdyaXRlc0NsaWVudCh1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMgfHwgISBpc0VtcHR5KHVwZGF0ZXMpKSB7XG4gICAgICAvLyBCZWdpbiBhIHRyYW5zYWN0aW9uYWwgdXBkYXRlIG9mIGVhY2ggc3RvcmUuXG5cbiAgICAgIGZvciAoY29uc3QgW3N0b3JlTmFtZSwgc3RvcmVdIG9mIE9iamVjdC5lbnRyaWVzKHNlbGYuX3N0b3JlcykpIHtcbiAgICAgICAgc3RvcmUuYmVnaW5VcGRhdGUoXG4gICAgICAgICAgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKVxuICAgICAgICAgICAgPyB1cGRhdGVzW3N0b3JlTmFtZV0ubGVuZ3RoXG4gICAgICAgICAgICA6IDAsXG4gICAgICAgICAgc2VsZi5fcmVzZXRTdG9yZXNcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5fcmVzZXRTdG9yZXMgPSBmYWxzZTtcblxuICAgICAgZm9yIChjb25zdCBbc3RvcmVOYW1lLCB1cGRhdGVNZXNzYWdlc10gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykpIHtcbiAgICAgICAgY29uc3Qgc3RvcmUgPSBzZWxmLl9zdG9yZXNbc3RvcmVOYW1lXTtcbiAgICAgICAgaWYgKHN0b3JlKSB7XG4gICAgICAgICAgZm9yIChjb25zdCB1cGRhdGVNZXNzYWdlIG9mIHVwZGF0ZU1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBzdG9yZS51cGRhdGUodXBkYXRlTWVzc2FnZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE5vYm9keSdzIGxpc3RlbmluZyBmb3IgdGhpcyBkYXRhLiBRdWV1ZSBpdCB1cCB1bnRpbFxuICAgICAgICAgIC8vIHNvbWVvbmUgd2FudHMgaXQuXG4gICAgICAgICAgLy8gWFhYIG1lbW9yeSB1c2Ugd2lsbCBncm93IHdpdGhvdXQgYm91bmQgaWYgeW91IGZvcmdldCB0b1xuICAgICAgICAgIC8vIGNyZWF0ZSBhIGNvbGxlY3Rpb24gb3IganVzdCBkb24ndCBjYXJlIGFib3V0IGl0Li4uIGdvaW5nXG4gICAgICAgICAgLy8gdG8gaGF2ZSB0byBkbyBzb21ldGhpbmcgYWJvdXQgdGhhdC5cbiAgICAgICAgICBjb25zdCB1cGRhdGVzID0gc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXM7XG5cbiAgICAgICAgICBpZiAoISBoYXNPd24uY2FsbCh1cGRhdGVzLCBzdG9yZU5hbWUpKSB7XG4gICAgICAgICAgICB1cGRhdGVzW3N0b3JlTmFtZV0gPSBbXTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB1cGRhdGVzW3N0b3JlTmFtZV0ucHVzaCguLi51cGRhdGVNZXNzYWdlcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIEVuZCB1cGRhdGUgdHJhbnNhY3Rpb24uXG4gICAgICBmb3IgKGNvbnN0IHN0b3JlIG9mIE9iamVjdC52YWx1ZXMoc2VsZi5fc3RvcmVzKSkge1xuICAgICAgICBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICB9XG5cbiAgLy8gQ2FsbCBhbnkgY2FsbGJhY2tzIGRlZmVycmVkIHdpdGggX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZCB3aG9zZVxuICAvLyByZWxldmFudCBkb2NzIGhhdmUgYmVlbiBmbHVzaGVkLCBhcyB3ZWxsIGFzIGRhdGFWaXNpYmxlIGNhbGxiYWNrcyBhdFxuICAvLyByZWNvbm5lY3QtcXVpZXNjZW5jZSB0aW1lLlxuICBfcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgY2FsbGJhY2tzID0gc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3M7XG4gICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MgPSBbXTtcbiAgICBjYWxsYmFja3MuZm9yRWFjaCgoYykgPT4ge1xuICAgICAgYygpO1xuICAgIH0pO1xuICB9XG5cbiAgX3B1c2hVcGRhdGUodXBkYXRlcywgY29sbGVjdGlvbiwgbXNnKSB7XG4gICAgaWYgKCEgaGFzT3duLmNhbGwodXBkYXRlcywgY29sbGVjdGlvbikpIHtcbiAgICAgIHVwZGF0ZXNbY29sbGVjdGlvbl0gPSBbXTtcbiAgICB9XG4gICAgdXBkYXRlc1tjb2xsZWN0aW9uXS5wdXNoKG1zZyk7XG4gIH1cblxuICBfZ2V0U2VydmVyRG9jKGNvbGxlY3Rpb24sIGlkKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc2VydmVyRG9jdW1lbnRzLCBjb2xsZWN0aW9uKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHNlcnZlckRvY3NGb3JDb2xsZWN0aW9uID0gc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dO1xuICAgIHJldHVybiBzZXJ2ZXJEb2NzRm9yQ29sbGVjdGlvbi5nZXQoaWQpIHx8IG51bGw7XG4gIH1cblxuICBhc3luYyBfcHJvY2Vzc19hZGRlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBpZCA9IE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpO1xuICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgaWQpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIC8vIFNvbWUgb3V0c3RhbmRpbmcgc3R1YiB3cm90ZSBoZXJlLlxuICAgICAgY29uc3QgaXNFeGlzdGluZyA9IHNlcnZlckRvYy5kb2N1bWVudCAhPT0gdW5kZWZpbmVkO1xuXG4gICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQgPSBtc2cuZmllbGRzIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQuX2lkID0gaWQ7XG5cbiAgICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgICAvLyBEdXJpbmcgcmVjb25uZWN0IHRoZSBzZXJ2ZXIgaXMgc2VuZGluZyBhZGRzIGZvciBleGlzdGluZyBpZHMuXG4gICAgICAgIC8vIEFsd2F5cyBwdXNoIGFuIHVwZGF0ZSBzbyB0aGF0IGRvY3VtZW50IHN0YXlzIGluIHRoZSBzdG9yZSBhZnRlclxuICAgICAgICAvLyByZXNldC4gVXNlIGN1cnJlbnQgdmVyc2lvbiBvZiB0aGUgZG9jdW1lbnQgZm9yIHRoaXMgdXBkYXRlLCBzb1xuICAgICAgICAvLyB0aGF0IHN0dWItd3JpdHRlbiB2YWx1ZXMgYXJlIHByZXNlcnZlZC5cbiAgICAgICAgY29uc3QgY3VycmVudERvYyA9IGF3YWl0IHNlbGYuX3N0b3Jlc1ttc2cuY29sbGVjdGlvbl0uZ2V0RG9jKG1zZy5pZCk7XG4gICAgICAgIGlmIChjdXJyZW50RG9jICE9PSB1bmRlZmluZWQpIG1zZy5maWVsZHMgPSBjdXJyZW50RG9jO1xuXG4gICAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgbXNnLmNvbGxlY3Rpb24sIG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKGlzRXhpc3RpbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgc2VudCBhZGQgZm9yIGV4aXN0aW5nIGlkOiAnICsgbXNnLmlkKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICB9XG4gIH1cblxuICBfcHJvY2Vzc19jaGFuZ2VkKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCkpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIGlmIChzZXJ2ZXJEb2MuZG9jdW1lbnQgPT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgc2VudCBjaGFuZ2VkIGZvciBub25leGlzdGluZyBpZDogJyArIG1zZy5pZCk7XG4gICAgICBEaWZmU2VxdWVuY2UuYXBwbHlDaGFuZ2VzKHNlcnZlckRvYy5kb2N1bWVudCwgbXNnLmZpZWxkcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgbXNnLmNvbGxlY3Rpb24sIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgX3Byb2Nlc3NfcmVtb3ZlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9nZXRTZXJ2ZXJEb2MobXNnLmNvbGxlY3Rpb24sIE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpKTtcbiAgICBpZiAoc2VydmVyRG9jKSB7XG4gICAgICAvLyBTb21lIG91dHN0YW5kaW5nIHN0dWIgd3JvdGUgaGVyZS5cbiAgICAgIGlmIChzZXJ2ZXJEb2MuZG9jdW1lbnQgPT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgc2VudCByZW1vdmVkIGZvciBub25leGlzdGluZyBpZDonICsgbXNnLmlkKTtcbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwge1xuICAgICAgICBtc2c6ICdyZW1vdmVkJyxcbiAgICAgICAgY29sbGVjdGlvbjogbXNnLmNvbGxlY3Rpb24sXG4gICAgICAgIGlkOiBtc2cuaWRcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIF9wcm9jZXNzX3VwZGF0ZWQobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHJvY2VzcyBcIm1ldGhvZCBkb25lXCIgbWVzc2FnZXMuXG5cbiAgICBtc2cubWV0aG9kcy5mb3JFYWNoKChtZXRob2RJZCkgPT4ge1xuICAgICAgY29uc3QgZG9jcyA9IHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdIHx8IHt9O1xuICAgICAgT2JqZWN0LnZhbHVlcyhkb2NzKS5mb3JFYWNoKCh3cml0dGVuKSA9PiB7XG4gICAgICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyh3cml0dGVuLmNvbGxlY3Rpb24sIHdyaXR0ZW4uaWQpO1xuICAgICAgICBpZiAoISBzZXJ2ZXJEb2MpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0xvc3Qgc2VydmVyRG9jIGZvciAnICsgSlNPTi5zdHJpbmdpZnkod3JpdHRlbikpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnRG9jICcgK1xuICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh3cml0dGVuKSArXG4gICAgICAgICAgICAgICcgbm90IHdyaXR0ZW4gYnkgIG1ldGhvZCAnICtcbiAgICAgICAgICAgICAgbWV0aG9kSWRcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnNbbWV0aG9kSWRdO1xuICAgICAgICBpZiAoaXNFbXB0eShzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpKSB7XG4gICAgICAgICAgLy8gQWxsIG1ldGhvZHMgd2hvc2Ugc3R1YnMgd3JvdGUgdGhpcyBtZXRob2QgaGF2ZSBjb21wbGV0ZWQhIFdlIGNhblxuICAgICAgICAgIC8vIG5vdyBjb3B5IHRoZSBzYXZlZCBkb2N1bWVudCB0byB0aGUgZGF0YWJhc2UgKHJldmVydGluZyB0aGUgc3R1YidzXG4gICAgICAgICAgLy8gY2hhbmdlIGlmIHRoZSBzZXJ2ZXIgZGlkIG5vdCB3cml0ZSB0byB0aGlzIG9iamVjdCwgb3IgYXBwbHlpbmcgdGhlXG4gICAgICAgICAgLy8gc2VydmVyJ3Mgd3JpdGVzIGlmIGl0IGRpZCkuXG5cbiAgICAgICAgICAvLyBUaGlzIGlzIGEgZmFrZSBkZHAgJ3JlcGxhY2UnIG1lc3NhZ2UuICBJdCdzIGp1c3QgZm9yIHRhbGtpbmdcbiAgICAgICAgICAvLyBiZXR3ZWVuIGxpdmVkYXRhIGNvbm5lY3Rpb25zIGFuZCBtaW5pbW9uZ28uICAoV2UgaGF2ZSB0byBzdHJpbmdpZnlcbiAgICAgICAgICAvLyB0aGUgSUQgYmVjYXVzZSBpdCdzIHN1cHBvc2VkIHRvIGxvb2sgbGlrZSBhIHdpcmUgbWVzc2FnZS4pXG4gICAgICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCB3cml0dGVuLmNvbGxlY3Rpb24sIHtcbiAgICAgICAgICAgIG1zZzogJ3JlcGxhY2UnLFxuICAgICAgICAgICAgaWQ6IE1vbmdvSUQuaWRTdHJpbmdpZnkod3JpdHRlbi5pZCksXG4gICAgICAgICAgICByZXBsYWNlOiBzZXJ2ZXJEb2MuZG9jdW1lbnRcbiAgICAgICAgICB9KTtcbiAgICAgICAgICAvLyBDYWxsIGFsbCBmbHVzaCBjYWxsYmFja3MuXG5cbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MuZm9yRWFjaCgoYykgPT4ge1xuICAgICAgICAgICAgYygpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gRGVsZXRlIHRoaXMgY29tcGxldGVkIHNlcnZlckRvY3VtZW50LiBEb24ndCBib3RoZXIgdG8gR0MgZW1wdHlcbiAgICAgICAgICAvLyBJZE1hcHMgaW5zaWRlIHNlbGYuX3NlcnZlckRvY3VtZW50cywgc2luY2UgdGhlcmUgcHJvYmFibHkgYXJlbid0XG4gICAgICAgICAgLy8gbWFueSBjb2xsZWN0aW9ucyBhbmQgdGhleSdsbCBiZSB3cml0dGVuIHJlcGVhdGVkbHkuXG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW3dyaXR0ZW4uY29sbGVjdGlvbl0ucmVtb3ZlKHdyaXR0ZW4uaWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZSBzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViW21ldGhvZElkXTtcblxuICAgICAgLy8gV2Ugd2FudCB0byBjYWxsIHRoZSBkYXRhLXdyaXR0ZW4gY2FsbGJhY2ssIGJ1dCB3ZSBjYW4ndCBkbyBzbyB1bnRpbCBhbGxcbiAgICAgIC8vIGN1cnJlbnRseSBidWZmZXJlZCBtZXNzYWdlcyBhcmUgZmx1c2hlZC5cbiAgICAgIGNvbnN0IGNhbGxiYWNrSW52b2tlciA9IHNlbGYuX21ldGhvZEludm9rZXJzW21ldGhvZElkXTtcbiAgICAgIGlmICghIGNhbGxiYWNrSW52b2tlcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGNhbGxiYWNrIGludm9rZXIgZm9yIG1ldGhvZCAnICsgbWV0aG9kSWQpO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoXG4gICAgICAgICguLi5hcmdzKSA9PiBjYWxsYmFja0ludm9rZXIuZGF0YVZpc2libGUoLi4uYXJncylcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cblxuICBfcHJvY2Vzc19yZWFkeShtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAvLyBQcm9jZXNzIFwic3ViIHJlYWR5XCIgbWVzc2FnZXMuIFwic3ViIHJlYWR5XCIgbWVzc2FnZXMgZG9uJ3QgdGFrZSBlZmZlY3RcbiAgICAvLyB1bnRpbCBhbGwgY3VycmVudCBzZXJ2ZXIgZG9jdW1lbnRzIGhhdmUgYmVlbiBmbHVzaGVkIHRvIHRoZSBsb2NhbFxuICAgIC8vIGRhdGFiYXNlLiBXZSBjYW4gdXNlIGEgd3JpdGUgZmVuY2UgdG8gaW1wbGVtZW50IHRoaXMuXG5cbiAgICBtc2cuc3Vicy5mb3JFYWNoKChzdWJJZCkgPT4ge1xuICAgICAgc2VsZi5fcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkKCgpID0+IHtcbiAgICAgICAgY29uc3Qgc3ViUmVjb3JkID0gc2VsZi5fc3Vic2NyaXB0aW9uc1tzdWJJZF07XG4gICAgICAgIC8vIERpZCB3ZSBhbHJlYWR5IHVuc3Vic2NyaWJlP1xuICAgICAgICBpZiAoIXN1YlJlY29yZCkgcmV0dXJuO1xuICAgICAgICAvLyBEaWQgd2UgYWxyZWFkeSByZWNlaXZlIGEgcmVhZHkgbWVzc2FnZT8gKE9vcHMhKVxuICAgICAgICBpZiAoc3ViUmVjb3JkLnJlYWR5KSByZXR1cm47XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeSA9IHRydWU7XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeUNhbGxiYWNrICYmIHN1YlJlY29yZC5yZWFkeUNhbGxiYWNrKCk7XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeURlcHMuY2hhbmdlZCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBFbnN1cmVzIHRoYXQgXCJmXCIgd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgYWxsIGRvY3VtZW50cyBjdXJyZW50bHkgaW5cbiAgLy8gX3NlcnZlckRvY3VtZW50cyBoYXZlIGJlZW4gd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUuIGYgd2lsbCBub3QgYmUgY2FsbGVkXG4gIC8vIGlmIHRoZSBjb25uZWN0aW9uIGlzIGxvc3QgYmVmb3JlIHRoZW4hXG4gIF9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoZikge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHJ1bkZBZnRlclVwZGF0ZXMgPSAoKSA9PiB7XG4gICAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcy5wdXNoKGYpO1xuICAgIH07XG4gICAgbGV0IHVuZmx1c2hlZFNlcnZlckRvY0NvdW50ID0gMDtcbiAgICBjb25zdCBvblNlcnZlckRvY0ZsdXNoID0gKCkgPT4ge1xuICAgICAgLS11bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudDtcbiAgICAgIGlmICh1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCA9PT0gMCkge1xuICAgICAgICAvLyBUaGlzIHdhcyB0aGUgbGFzdCBkb2MgdG8gZmx1c2ghIEFycmFuZ2UgdG8gcnVuIGYgYWZ0ZXIgdGhlIHVwZGF0ZXNcbiAgICAgICAgLy8gaGF2ZSBiZWVuIGFwcGxpZWQuXG4gICAgICAgIHJ1bkZBZnRlclVwZGF0ZXMoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgT2JqZWN0LnZhbHVlcyhzZWxmLl9zZXJ2ZXJEb2N1bWVudHMpLmZvckVhY2goKHNlcnZlckRvY3VtZW50cykgPT4ge1xuICAgICAgc2VydmVyRG9jdW1lbnRzLmZvckVhY2goKHNlcnZlckRvYykgPT4ge1xuICAgICAgICBjb25zdCB3cml0dGVuQnlTdHViRm9yQU1ldGhvZFdpdGhTZW50TWVzc2FnZSA9XG4gICAgICAgICAga2V5cyhzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpLnNvbWUobWV0aG9kSWQgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW52b2tlciA9IHNlbGYuX21ldGhvZEludm9rZXJzW21ldGhvZElkXTtcbiAgICAgICAgICAgIHJldHVybiBpbnZva2VyICYmIGludm9rZXIuc2VudE1lc3NhZ2U7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHdyaXR0ZW5CeVN0dWJGb3JBTWV0aG9kV2l0aFNlbnRNZXNzYWdlKSB7XG4gICAgICAgICAgKyt1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudDtcbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MucHVzaChvblNlcnZlckRvY0ZsdXNoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgaWYgKHVuZmx1c2hlZFNlcnZlckRvY0NvdW50ID09PSAwKSB7XG4gICAgICAvLyBUaGVyZSBhcmVuJ3QgYW55IGJ1ZmZlcmVkIGRvY3MgLS0tIHdlIGNhbiBjYWxsIGYgYXMgc29vbiBhcyB0aGUgY3VycmVudFxuICAgICAgLy8gcm91bmQgb2YgdXBkYXRlcyBpcyBhcHBsaWVkIVxuICAgICAgcnVuRkFmdGVyVXBkYXRlcygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIF9saXZlZGF0YV9ub3N1Yihtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIC8vIEZpcnN0IHBhc3MgaXQgdGhyb3VnaCBfbGl2ZWRhdGFfZGF0YSwgd2hpY2ggb25seSB1c2VzIGl0IHRvIGhlbHAgZ2V0XG4gICAgLy8gdG93YXJkcyBxdWllc2NlbmNlLlxuICAgIGF3YWl0IHNlbGYuX2xpdmVkYXRhX2RhdGEobXNnKTtcblxuICAgIC8vIERvIHRoZSByZXN0IG9mIG91ciBwcm9jZXNzaW5nIGltbWVkaWF0ZWx5LCB3aXRoIG5vXG4gICAgLy8gYnVmZmVyaW5nLXVudGlsLXF1aWVzY2VuY2UuXG5cbiAgICAvLyB3ZSB3ZXJlbid0IHN1YmJlZCBhbnl3YXksIG9yIHdlIGluaXRpYXRlZCB0aGUgdW5zdWIuXG4gICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgbXNnLmlkKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xICNlcnJvckNhbGxiYWNrXG4gICAgY29uc3QgZXJyb3JDYWxsYmFjayA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5lcnJvckNhbGxiYWNrO1xuICAgIGNvbnN0IHN0b3BDYWxsYmFjayA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5zdG9wQ2FsbGJhY2s7XG5cbiAgICBzZWxmLl9zdWJzY3JpcHRpb25zW21zZy5pZF0ucmVtb3ZlKCk7XG5cbiAgICBjb25zdCBtZXRlb3JFcnJvckZyb21Nc2cgPSBtc2dBcmcgPT4ge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgbXNnQXJnICYmXG4gICAgICAgIG1zZ0FyZy5lcnJvciAmJlxuICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5lcnJvcixcbiAgICAgICAgICBtc2dBcmcuZXJyb3IucmVhc29uLFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5kZXRhaWxzXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgfTtcblxuICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xICNlcnJvckNhbGxiYWNrXG4gICAgaWYgKGVycm9yQ2FsbGJhY2sgJiYgbXNnLmVycm9yKSB7XG4gICAgICBlcnJvckNhbGxiYWNrKG1ldGVvckVycm9yRnJvbU1zZyhtc2cpKTtcbiAgICB9XG5cbiAgICBpZiAoc3RvcENhbGxiYWNrKSB7XG4gICAgICBzdG9wQ2FsbGJhY2sobWV0ZW9yRXJyb3JGcm9tTXNnKG1zZykpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIF9saXZlZGF0YV9yZXN1bHQobXNnKSB7XG4gICAgLy8gaWQsIHJlc3VsdCBvciBlcnJvci4gZXJyb3IgaGFzIGVycm9yIChjb2RlKSwgcmVhc29uLCBkZXRhaWxzXG5cbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIC8vIExldHMgbWFrZSBzdXJlIHRoZXJlIGFyZSBubyBidWZmZXJlZCB3cml0ZXMgYmVmb3JlIHJldHVybmluZyByZXN1bHQuXG4gICAgaWYgKCEgaXNFbXB0eShzZWxmLl9idWZmZXJlZFdyaXRlcykpIHtcbiAgICAgIGF3YWl0IHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICB9XG5cbiAgICAvLyBmaW5kIHRoZSBvdXRzdGFuZGluZyByZXF1ZXN0XG4gICAgLy8gc2hvdWxkIGJlIE8oMSkgaW4gbmVhcmx5IGFsbCByZWFsaXN0aWMgdXNlIGNhc2VzXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdSZWNlaXZlZCBtZXRob2QgcmVzdWx0IGJ1dCBubyBtZXRob2RzIG91dHN0YW5kaW5nJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGN1cnJlbnRNZXRob2RCbG9jayA9IHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHM7XG4gICAgbGV0IGk7XG4gICAgY29uc3QgbSA9IGN1cnJlbnRNZXRob2RCbG9jay5maW5kKChtZXRob2QsIGlkeCkgPT4ge1xuICAgICAgY29uc3QgZm91bmQgPSBtZXRob2QubWV0aG9kSWQgPT09IG1zZy5pZDtcbiAgICAgIGlmIChmb3VuZCkgaSA9IGlkeDtcbiAgICAgIHJldHVybiBmb3VuZDtcbiAgICB9KTtcbiAgICBpZiAoIW0pIHtcbiAgICAgIE1ldGVvci5fZGVidWcoXCJDYW4ndCBtYXRjaCBtZXRob2QgcmVzcG9uc2UgdG8gb3JpZ2luYWwgbWV0aG9kIGNhbGxcIiwgbXNnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBjdXJyZW50IG1ldGhvZCBibG9jay4gVGhpcyBtYXkgbGVhdmUgdGhlIGJsb2NrIGVtcHR5LCBidXQgd2VcbiAgICAvLyBkb24ndCBtb3ZlIG9uIHRvIHRoZSBuZXh0IGJsb2NrIHVudGlsIHRoZSBjYWxsYmFjayBoYXMgYmVlbiBkZWxpdmVyZWQsIGluXG4gICAgLy8gX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQuXG4gICAgY3VycmVudE1ldGhvZEJsb2NrLnNwbGljZShpLCAxKTtcblxuICAgIGlmIChoYXNPd24uY2FsbChtc2csICdlcnJvcicpKSB7XG4gICAgICBtLnJlY2VpdmVSZXN1bHQoXG4gICAgICAgIG5ldyBNZXRlb3IuRXJyb3IobXNnLmVycm9yLmVycm9yLCBtc2cuZXJyb3IucmVhc29uLCBtc2cuZXJyb3IuZGV0YWlscylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG1zZy5yZXN1bHQgbWF5IGJlIHVuZGVmaW5lZCBpZiB0aGUgbWV0aG9kIGRpZG4ndCByZXR1cm4gYVxuICAgICAgLy8gdmFsdWVcbiAgICAgIG0ucmVjZWl2ZVJlc3VsdCh1bmRlZmluZWQsIG1zZy5yZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIF9hZGRPdXRzdGFuZGluZ01ldGhvZChtZXRob2RJbnZva2VyLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnM/LndhaXQpIHtcbiAgICAgIC8vIEl0J3MgYSB3YWl0IG1ldGhvZCEgV2FpdCBtZXRob2RzIGdvIGluIHRoZWlyIG93biBibG9jay5cbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goe1xuICAgICAgICB3YWl0OiB0cnVlLFxuICAgICAgICBtZXRob2RzOiBbbWV0aG9kSW52b2tlcl1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb3QgYSB3YWl0IG1ldGhvZC4gU3RhcnQgYSBuZXcgYmxvY2sgaWYgdGhlIHByZXZpb3VzIGJsb2NrIHdhcyBhIHdhaXRcbiAgICAgIC8vIGJsb2NrLCBhbmQgYWRkIGl0IHRvIHRoZSBsYXN0IGJsb2NrIG9mIG1ldGhvZHMuXG4gICAgICBpZiAoaXNFbXB0eSh0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykgfHxcbiAgICAgICAgICBsYXN0KHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS53YWl0KSB7XG4gICAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goe1xuICAgICAgICAgIHdhaXQ6IGZhbHNlLFxuICAgICAgICAgIG1ldGhvZHM6IFtdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgbGFzdCh0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykubWV0aG9kcy5wdXNoKG1ldGhvZEludm9rZXIpO1xuICAgIH1cblxuICAgIC8vIElmIHdlIGFkZGVkIGl0IHRvIHRoZSBmaXJzdCBibG9jaywgc2VuZCBpdCBvdXQgbm93LlxuICAgIGlmICh0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIG1ldGhvZEludm9rZXIuc2VuZE1lc3NhZ2UoKTtcbiAgICB9XG4gIH1cblxuICAvLyBDYWxsZWQgYnkgTWV0aG9kSW52b2tlciBhZnRlciBhIG1ldGhvZCdzIGNhbGxiYWNrIGlzIGludm9rZWQuICBJZiB0aGlzIHdhc1xuICAvLyB0aGUgbGFzdCBvdXRzdGFuZGluZyBtZXRob2QgaW4gdGhlIGN1cnJlbnQgYmxvY2ssIHJ1bnMgdGhlIG5leHQgYmxvY2suIElmXG4gIC8vIHRoZXJlIGFyZSBubyBtb3JlIG1ldGhvZHMsIGNvbnNpZGVyIGFjY2VwdGluZyBhIGhvdCBjb2RlIHB1c2guXG4gIF9vdXRzdGFuZGluZ01ldGhvZEZpbmlzaGVkKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9hbnlNZXRob2RzQXJlT3V0c3RhbmRpbmcoKSkgcmV0dXJuO1xuXG4gICAgLy8gTm8gbWV0aG9kcyBhcmUgb3V0c3RhbmRpbmcuIFRoaXMgc2hvdWxkIG1lYW4gdGhhdCB0aGUgZmlyc3QgYmxvY2sgb2ZcbiAgICAvLyBtZXRob2RzIGlzIGVtcHR5LiAoT3IgaXQgbWlnaHQgbm90IGV4aXN0LCBpZiB0aGlzIHdhcyBhIG1ldGhvZCB0aGF0XG4gICAgLy8gaGFsZi1maW5pc2hlZCBiZWZvcmUgZGlzY29ubmVjdC9yZWNvbm5lY3QuKVxuICAgIGlmICghIGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBjb25zdCBmaXJzdEJsb2NrID0gc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3Muc2hpZnQoKTtcbiAgICAgIGlmICghIGlzRW1wdHkoZmlyc3RCbG9jay5tZXRob2RzKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdObyBtZXRob2RzIG91dHN0YW5kaW5nIGJ1dCBub25lbXB0eSBibG9jazogJyArXG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShmaXJzdEJsb2NrKVxuICAgICAgICApO1xuXG4gICAgICAvLyBTZW5kIHRoZSBvdXRzdGFuZGluZyBtZXRob2RzIG5vdyBpbiB0aGUgZmlyc3QgYmxvY2suXG4gICAgICBpZiAoISBpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSlcbiAgICAgICAgc2VsZi5fc2VuZE91dHN0YW5kaW5nTWV0aG9kcygpO1xuICAgIH1cblxuICAgIC8vIE1heWJlIGFjY2VwdCBhIGhvdCBjb2RlIHB1c2guXG4gICAgc2VsZi5fbWF5YmVNaWdyYXRlKCk7XG4gIH1cblxuICAvLyBTZW5kcyBtZXNzYWdlcyBmb3IgYWxsIHRoZSBtZXRob2RzIGluIHRoZSBmaXJzdCBibG9jayBpblxuICAvLyBfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MuXG4gIF9zZW5kT3V0c3RhbmRpbmdNZXRob2RzKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcy5mb3JFYWNoKG0gPT4ge1xuICAgICAgbS5zZW5kTWVzc2FnZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgX2xpdmVkYXRhX2Vycm9yKG1zZykge1xuICAgIE1ldGVvci5fZGVidWcoJ1JlY2VpdmVkIGVycm9yIGZyb20gc2VydmVyOiAnLCBtc2cucmVhc29uKTtcbiAgICBpZiAobXNnLm9mZmVuZGluZ01lc3NhZ2UpIE1ldGVvci5fZGVidWcoJ0ZvcjogJywgbXNnLm9mZmVuZGluZ01lc3NhZ2UpO1xuICB9XG5cbiAgX3NlbmRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrc01lc3NhZ2VzKG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKGlzRW1wdHkob2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSByZXR1cm47XG5cbiAgICAvLyBXZSBoYXZlIGF0IGxlYXN0IG9uZSBibG9jayB3b3J0aCBvZiBvbGQgb3V0c3RhbmRpbmcgbWV0aG9kcyB0byB0cnlcbiAgICAvLyBhZ2Fpbi4gRmlyc3Q6IGRpZCBvblJlY29ubmVjdCBhY3R1YWxseSBzZW5kIGFueXRoaW5nPyBJZiBub3QsIHdlIGp1c3RcbiAgICAvLyByZXN0b3JlIGFsbCBvdXRzdGFuZGluZyBtZXRob2RzIGFuZCBydW4gdGhlIGZpcnN0IGJsb2NrLlxuICAgIGlmIChpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkge1xuICAgICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2NrcztcbiAgICAgIHNlbGYuX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBPSywgdGhlcmUgYXJlIGJsb2NrcyBvbiBib3RoIHNpZGVzLiBTcGVjaWFsIGNhc2U6IG1lcmdlIHRoZSBsYXN0IGJsb2NrIG9mXG4gICAgLy8gdGhlIHJlY29ubmVjdCBtZXRob2RzIHdpdGggdGhlIGZpcnN0IGJsb2NrIG9mIHRoZSBvcmlnaW5hbCBtZXRob2RzLCBpZlxuICAgIC8vIG5laXRoZXIgb2YgdGhlbSBhcmUgXCJ3YWl0XCIgYmxvY2tzLlxuICAgIGlmIChcbiAgICAgICFsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS53YWl0ICYmXG4gICAgICAhb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ud2FpdFxuICAgICkge1xuICAgICAgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcy5mb3JFYWNoKChtKSA9PiB7XG4gICAgICAgIGxhc3Qoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpLm1ldGhvZHMucHVzaChtKTtcblxuICAgICAgICAvLyBJZiB0aGlzIFwibGFzdCBibG9ja1wiIGlzIGFsc28gdGhlIGZpcnN0IGJsb2NrLCBzZW5kIHRoZSBtZXNzYWdlLlxuICAgICAgICBpZiAoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgbS5zZW5kTWVzc2FnZSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3Muc2hpZnQoKTtcbiAgICB9XG5cbiAgICAvLyBOb3cgYWRkIHRoZSByZXN0IG9mIHRoZSBvcmlnaW5hbCBibG9ja3Mgb24uXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MucHVzaCguLi5vbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrcyk7XG4gIH1cblxuICBfY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3M7XG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXTtcblxuICAgIHNlbGYub25SZWNvbm5lY3QgJiYgc2VsZi5vblJlY29ubmVjdCgpO1xuICAgIEREUC5fcmVjb25uZWN0SG9vay5lYWNoKChjYWxsYmFjaykgPT4ge1xuICAgICAgY2FsbGJhY2soc2VsZik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIHNlbGYuX3NlbmRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrc01lc3NhZ2VzKG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzKTtcbiAgfVxuXG4gIC8vIFdlIGNhbiBhY2NlcHQgYSBob3QgY29kZSBwdXNoIGlmIHRoZXJlIGFyZSBubyBtZXRob2RzIGluIGZsaWdodC5cbiAgX3JlYWR5VG9NaWdyYXRlKCkge1xuICAgIHJldHVybiBpc0VtcHR5KHRoaXMuX21ldGhvZEludm9rZXJzKTtcbiAgfVxuXG4gIC8vIElmIHdlIHdlcmUgYmxvY2tpbmcgYSBtaWdyYXRpb24sIHNlZSBpZiBpdCdzIG5vdyBwb3NzaWJsZSB0byBjb250aW51ZS5cbiAgLy8gQ2FsbCB3aGVuZXZlciB0aGUgc2V0IG9mIG91dHN0YW5kaW5nL2Jsb2NrZWQgbWV0aG9kcyBzaHJpbmtzLlxuICBfbWF5YmVNaWdyYXRlKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9yZXRyeU1pZ3JhdGUgJiYgc2VsZi5fcmVhZHlUb01pZ3JhdGUoKSkge1xuICAgICAgc2VsZi5fcmV0cnlNaWdyYXRlKCk7XG4gICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG9uTWVzc2FnZShyYXdfbXNnKSB7XG4gICAgbGV0IG1zZztcbiAgICB0cnkge1xuICAgICAgbXNnID0gRERQQ29tbW9uLnBhcnNlRERQKHJhd19tc2cpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIE1ldGVvci5fZGVidWcoJ0V4Y2VwdGlvbiB3aGlsZSBwYXJzaW5nIEREUCcsIGUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEFueSBtZXNzYWdlIGNvdW50cyBhcyByZWNlaXZpbmcgYSBwb25nLCBhcyBpdCBkZW1vbnN0cmF0ZXMgdGhhdFxuICAgIC8vIHRoZSBzZXJ2ZXIgaXMgc3RpbGwgYWxpdmUuXG4gICAgaWYgKHRoaXMuX2hlYXJ0YmVhdCkge1xuICAgICAgdGhpcy5faGVhcnRiZWF0Lm1lc3NhZ2VSZWNlaXZlZCgpO1xuICAgIH1cblxuICAgIGlmIChtc2cgPT09IG51bGwgfHwgIW1zZy5tc2cpIHtcbiAgICAgIGlmKCFtc2cgfHwgIW1zZy50ZXN0TWVzc2FnZU9uQ29ubmVjdCkge1xuICAgICAgICBpZiAoT2JqZWN0LmtleXMobXNnKS5sZW5ndGggPT09IDEgJiYgbXNnLnNlcnZlcl9pZCkgcmV0dXJuO1xuICAgICAgICBNZXRlb3IuX2RlYnVnKCdkaXNjYXJkaW5nIGludmFsaWQgbGl2ZWRhdGEgbWVzc2FnZScsIG1zZyk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKG1zZy5tc2cgPT09ICdjb25uZWN0ZWQnKSB7XG4gICAgICB0aGlzLl92ZXJzaW9uID0gdGhpcy5fdmVyc2lvblN1Z2dlc3Rpb247XG4gICAgICBhd2FpdCB0aGlzLl9saXZlZGF0YV9jb25uZWN0ZWQobXNnKTtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkNvbm5lY3RlZCgpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2ZhaWxlZCcpIHtcbiAgICAgIGlmICh0aGlzLl9zdXBwb3J0ZWRERFBWZXJzaW9ucy5pbmRleE9mKG1zZy52ZXJzaW9uKSA+PSAwKSB7XG4gICAgICAgIHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uID0gbXNnLnZlcnNpb247XG4gICAgICAgIHRoaXMuX3N0cmVhbS5yZWNvbm5lY3QoeyBfZm9yY2U6IHRydWUgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBkZXNjcmlwdGlvbiA9XG4gICAgICAgICAgJ0REUCB2ZXJzaW9uIG5lZ290aWF0aW9uIGZhaWxlZDsgc2VydmVyIHJlcXVlc3RlZCB2ZXJzaW9uICcgK1xuICAgICAgICAgIG1zZy52ZXJzaW9uO1xuICAgICAgICB0aGlzLl9zdHJlYW0uZGlzY29ubmVjdCh7IF9wZXJtYW5lbnQ6IHRydWUsIF9lcnJvcjogZGVzY3JpcHRpb24gfSk7XG4gICAgICAgIHRoaXMub3B0aW9ucy5vbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUoZGVzY3JpcHRpb24pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3BpbmcnICYmIHRoaXMub3B0aW9ucy5yZXNwb25kVG9QaW5ncykge1xuICAgICAgdGhpcy5fc2VuZCh7IG1zZzogJ3BvbmcnLCBpZDogbXNnLmlkIH0pO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3BvbmcnKSB7XG4gICAgICAvLyBub29wLCBhcyB3ZSBhc3N1bWUgZXZlcnl0aGluZydzIGEgcG9uZ1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICBbJ2FkZGVkJywgJ2NoYW5nZWQnLCAncmVtb3ZlZCcsICdyZWFkeScsICd1cGRhdGVkJ10uaW5jbHVkZXMobXNnLm1zZylcbiAgICApIHtcbiAgICAgIGF3YWl0IHRoaXMuX2xpdmVkYXRhX2RhdGEobXNnKTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdub3N1YicpIHtcbiAgICAgIGF3YWl0IHRoaXMuX2xpdmVkYXRhX25vc3ViKG1zZyk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVzdWx0Jykge1xuICAgICAgYXdhaXQgdGhpcy5fbGl2ZWRhdGFfcmVzdWx0KG1zZyk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnZXJyb3InKSB7XG4gICAgICB0aGlzLl9saXZlZGF0YV9lcnJvcihtc2cpO1xuICAgIH0gZWxzZSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdkaXNjYXJkaW5nIHVua25vd24gbGl2ZWRhdGEgbWVzc2FnZSB0eXBlJywgbXNnKTtcbiAgICB9XG4gIH1cblxuICBvblJlc2V0KCkge1xuICAgIC8vIFNlbmQgYSBjb25uZWN0IG1lc3NhZ2UgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgc3RyZWFtLlxuICAgIC8vIE5PVEU6IHJlc2V0IGlzIGNhbGxlZCBldmVuIG9uIHRoZSBmaXJzdCBjb25uZWN0aW9uLCBzbyB0aGlzIGlzXG4gICAgLy8gdGhlIG9ubHkgcGxhY2Ugd2Ugc2VuZCB0aGlzIG1lc3NhZ2UuXG4gICAgY29uc3QgbXNnID0geyBtc2c6ICdjb25uZWN0JyB9O1xuICAgIGlmICh0aGlzLl9sYXN0U2Vzc2lvbklkKSBtc2cuc2Vzc2lvbiA9IHRoaXMuX2xhc3RTZXNzaW9uSWQ7XG4gICAgbXNnLnZlcnNpb24gPSB0aGlzLl92ZXJzaW9uU3VnZ2VzdGlvbiB8fCB0aGlzLl9zdXBwb3J0ZWRERFBWZXJzaW9uc1swXTtcbiAgICB0aGlzLl92ZXJzaW9uU3VnZ2VzdGlvbiA9IG1zZy52ZXJzaW9uO1xuICAgIG1zZy5zdXBwb3J0ID0gdGhpcy5fc3VwcG9ydGVkRERQVmVyc2lvbnM7XG4gICAgdGhpcy5fc2VuZChtc2cpO1xuXG4gICAgLy8gTWFyayBub24tcmV0cnkgY2FsbHMgYXMgZmFpbGVkLiBUaGlzIGhhcyB0byBiZSBkb25lIGVhcmx5IGFzIGdldHRpbmcgdGhlc2UgbWV0aG9kcyBvdXQgb2YgdGhlXG4gICAgLy8gY3VycmVudCBibG9jayBpcyBwcmV0dHkgaW1wb3J0YW50IHRvIG1ha2luZyBzdXJlIHRoYXQgcXVpZXNjZW5jZSBpcyBwcm9wZXJseSBjYWxjdWxhdGVkLCBhc1xuICAgIC8vIHdlbGwgYXMgcG9zc2libHkgbW92aW5nIG9uIHRvIGFub3RoZXIgdXNlZnVsIGJsb2NrLlxuXG4gICAgLy8gT25seSBib3RoZXIgdGVzdGluZyBpZiB0aGVyZSBpcyBhbiBvdXRzdGFuZGluZ01ldGhvZEJsb2NrICh0aGVyZSBtaWdodCBub3QgYmUsIGVzcGVjaWFsbHkgaWZcbiAgICAvLyB3ZSBhcmUgY29ubmVjdGluZyBmb3IgdGhlIGZpcnN0IHRpbWUuXG4gICAgaWYgKHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIElmIHRoZXJlIGlzIGFuIG91dHN0YW5kaW5nIG1ldGhvZCBibG9jaywgd2Ugb25seSBjYXJlIGFib3V0IHRoZSBmaXJzdCBvbmUgYXMgdGhhdCBpcyB0aGVcbiAgICAgIC8vIG9uZSB0aGF0IGNvdWxkIGhhdmUgYWxyZWFkeSBzZW50IG1lc3NhZ2VzIHdpdGggbm8gcmVzcG9uc2UsIHRoYXQgYXJlIG5vdCBhbGxvd2VkIHRvIHJldHJ5LlxuICAgICAgY29uc3QgY3VycmVudE1ldGhvZEJsb2NrID0gdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcztcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMgPSBjdXJyZW50TWV0aG9kQmxvY2suZmlsdGVyKFxuICAgICAgICBtZXRob2RJbnZva2VyID0+IHtcbiAgICAgICAgICAvLyBNZXRob2RzIHdpdGggJ25vUmV0cnknIG9wdGlvbiBzZXQgYXJlIG5vdCBhbGxvd2VkIHRvIHJlLXNlbmQgYWZ0ZXJcbiAgICAgICAgICAvLyByZWNvdmVyaW5nIGRyb3BwZWQgY29ubmVjdGlvbi5cbiAgICAgICAgICBpZiAobWV0aG9kSW52b2tlci5zZW50TWVzc2FnZSAmJiBtZXRob2RJbnZva2VyLm5vUmV0cnkpIHtcbiAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBtZXRob2QgaXMgdG9sZCB0aGF0IGl0IGZhaWxlZC5cbiAgICAgICAgICAgIG1ldGhvZEludm9rZXIucmVjZWl2ZVJlc3VsdChcbiAgICAgICAgICAgICAgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgICAgICAgICAnaW52b2NhdGlvbi1mYWlsZWQnLFxuICAgICAgICAgICAgICAgICdNZXRob2QgaW52b2NhdGlvbiBtaWdodCBoYXZlIGZhaWxlZCBkdWUgdG8gZHJvcHBlZCBjb25uZWN0aW9uLiAnICtcbiAgICAgICAgICAgICAgICAgICdGYWlsaW5nIGJlY2F1c2UgYG5vUmV0cnlgIG9wdGlvbiB3YXMgcGFzc2VkIHRvIE1ldGVvci5hcHBseS4nXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gT25seSBrZWVwIGEgbWV0aG9kIGlmIGl0IHdhc24ndCBzZW50IG9yIGl0J3MgYWxsb3dlZCB0byByZXRyeS5cbiAgICAgICAgICAvLyBUaGlzIG1heSBsZWF2ZSB0aGUgYmxvY2sgZW1wdHksIGJ1dCB3ZSBkb24ndCBtb3ZlIG9uIHRvIHRoZSBuZXh0XG4gICAgICAgICAgLy8gYmxvY2sgdW50aWwgdGhlIGNhbGxiYWNrIGhhcyBiZWVuIGRlbGl2ZXJlZCwgaW4gX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQuXG4gICAgICAgICAgcmV0dXJuICEobWV0aG9kSW52b2tlci5zZW50TWVzc2FnZSAmJiBtZXRob2RJbnZva2VyLm5vUmV0cnkpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIE5vdywgdG8gbWluaW1pemUgc2V0dXAgbGF0ZW5jeSwgZ28gYWhlYWQgYW5kIGJsYXN0IG91dCBhbGwgb2ZcbiAgICAvLyBvdXIgcGVuZGluZyBtZXRob2RzIGFuZHMgc3Vic2NyaXB0aW9ucyBiZWZvcmUgd2UndmUgZXZlbiB0YWtlblxuICAgIC8vIHRoZSBuZWNlc3NhcnkgUlRUIHRvIGtub3cgaWYgd2Ugc3VjY2Vzc2Z1bGx5IHJlY29ubmVjdGVkLiAoMSlcbiAgICAvLyBUaGV5J3JlIHN1cHBvc2VkIHRvIGJlIGlkZW1wb3RlbnQsIGFuZCB3aGVyZSB0aGV5IGFyZSBub3QsXG4gICAgLy8gdGhleSBjYW4gYmxvY2sgcmV0cnkgaW4gYXBwbHk7ICgyKSBldmVuIGlmIHdlIGRpZCByZWNvbm5lY3QsXG4gICAgLy8gd2UncmUgbm90IHN1cmUgd2hhdCBtZXNzYWdlcyBtaWdodCBoYXZlIGdvdHRlbiBsb3N0XG4gICAgLy8gKGluIGVpdGhlciBkaXJlY3Rpb24pIHNpbmNlIHdlIHdlcmUgZGlzY29ubmVjdGVkIChUQ1AgYmVpbmdcbiAgICAvLyBzbG9wcHkgYWJvdXQgdGhhdC4pXG5cbiAgICAvLyBJZiB0aGUgY3VycmVudCBibG9jayBvZiBtZXRob2RzIGFsbCBnb3QgdGhlaXIgcmVzdWx0cyAoYnV0IGRpZG4ndCBhbGwgZ2V0XG4gICAgLy8gdGhlaXIgZGF0YSB2aXNpYmxlKSwgZGlzY2FyZCB0aGUgZW1wdHkgYmxvY2sgbm93LlxuICAgIGlmIChcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA+IDAgJiZcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMubGVuZ3RoID09PSAwXG4gICAgKSB7XG4gICAgICB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgIH1cblxuICAgIC8vIE1hcmsgYWxsIG1lc3NhZ2VzIGFzIHVuc2VudCwgdGhleSBoYXZlIG5vdCB5ZXQgYmVlbiBzZW50IG9uIHRoaXNcbiAgICAvLyBjb25uZWN0aW9uLlxuICAgIGtleXModGhpcy5fbWV0aG9kSW52b2tlcnMpLmZvckVhY2goaWQgPT4ge1xuICAgICAgdGhpcy5fbWV0aG9kSW52b2tlcnNbaWRdLnNlbnRNZXNzYWdlID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICAvLyBJZiBhbiBgb25SZWNvbm5lY3RgIGhhbmRsZXIgaXMgc2V0LCBjYWxsIGl0IGZpcnN0LiBHbyB0aHJvdWdoXG4gICAgLy8gc29tZSBob29wcyB0byBlbnN1cmUgdGhhdCBtZXRob2RzIHRoYXQgYXJlIGNhbGxlZCBmcm9tIHdpdGhpblxuICAgIC8vIGBvblJlY29ubmVjdGAgZ2V0IGV4ZWN1dGVkIF9iZWZvcmVfIG9uZXMgdGhhdCB3ZXJlIG9yaWdpbmFsbHlcbiAgICAvLyBvdXRzdGFuZGluZyAoc2luY2UgYG9uUmVjb25uZWN0YCBpcyB1c2VkIHRvIHJlLWVzdGFibGlzaCBhdXRoXG4gICAgLy8gY2VydGlmaWNhdGVzKVxuICAgIHRoaXMuX2NhbGxPblJlY29ubmVjdEFuZFNlbmRBcHByb3ByaWF0ZU91dHN0YW5kaW5nTWV0aG9kcygpO1xuXG4gICAgLy8gYWRkIG5ldyBzdWJzY3JpcHRpb25zIGF0IHRoZSBlbmQuIHRoaXMgd2F5IHRoZXkgdGFrZSBlZmZlY3QgYWZ0ZXJcbiAgICAvLyB0aGUgaGFuZGxlcnMgYW5kIHdlIGRvbid0IHNlZSBmbGlja2VyLlxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuX3N1YnNjcmlwdGlvbnMpLmZvckVhY2goKFtpZCwgc3ViXSkgPT4ge1xuICAgICAgdGhpcy5fc2VuZFF1ZXVlZCh7XG4gICAgICAgIG1zZzogJ3N1YicsXG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgbmFtZTogc3ViLm5hbWUsXG4gICAgICAgIHBhcmFtczogc3ViLnBhcmFtc1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEREUENvbW1vbiB9IGZyb20gJ21ldGVvci9kZHAtY29tbW9uJztcbmltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuXG5pbXBvcnQgeyBDb25uZWN0aW9uIH0gZnJvbSAnLi9saXZlZGF0YV9jb25uZWN0aW9uLmpzJztcblxuLy8gVGhpcyBhcnJheSBhbGxvd3MgdGhlIGBfYWxsU3Vic2NyaXB0aW9uc1JlYWR5YCBtZXRob2QgYmVsb3csIHdoaWNoXG4vLyBpcyB1c2VkIGJ5IHRoZSBgc3BpZGVyYWJsZWAgcGFja2FnZSwgdG8ga2VlcCB0cmFjayBvZiB3aGV0aGVyIGFsbFxuLy8gZGF0YSBpcyByZWFkeS5cbmNvbnN0IGFsbENvbm5lY3Rpb25zID0gW107XG5cbi8qKlxuICogQG5hbWVzcGFjZSBERFBcbiAqIEBzdW1tYXJ5IE5hbWVzcGFjZSBmb3IgRERQLXJlbGF0ZWQgbWV0aG9kcy9jbGFzc2VzLlxuICovXG5leHBvcnQgY29uc3QgRERQID0ge307XG5cbi8vIFRoaXMgaXMgcHJpdmF0ZSBidXQgaXQncyB1c2VkIGluIGEgZmV3IHBsYWNlcy4gYWNjb3VudHMtYmFzZSB1c2VzXG4vLyBpdCB0byBnZXQgdGhlIGN1cnJlbnQgdXNlci4gTWV0ZW9yLnNldFRpbWVvdXQgYW5kIGZyaWVuZHMgY2xlYXJcbi8vIGl0LiBXZSBjYW4gcHJvYmFibHkgZmluZCBhIGJldHRlciB3YXkgdG8gZmFjdG9yIHRoaXMuXG5ERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlKCk7XG5ERFAuX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24gPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGUoKTtcblxuLy8gWFhYOiBLZWVwIEREUC5fQ3VycmVudEludm9jYXRpb24gZm9yIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5LlxuRERQLl9DdXJyZW50SW52b2NhdGlvbiA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb247XG5cbkREUC5fQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24gPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGUoKTtcblxuLy8gVGhpcyBpcyBwYXNzZWQgaW50byBhIHdlaXJkIGBtYWtlRXJyb3JUeXBlYCBmdW5jdGlvbiB0aGF0IGV4cGVjdHMgaXRzIHRoaW5nXG4vLyB0byBiZSBhIGNvbnN0cnVjdG9yXG5mdW5jdGlvbiBjb25uZWN0aW9uRXJyb3JDb25zdHJ1Y3RvcihtZXNzYWdlKSB7XG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5cbkREUC5Db25uZWN0aW9uRXJyb3IgPSBNZXRlb3IubWFrZUVycm9yVHlwZShcbiAgJ0REUC5Db25uZWN0aW9uRXJyb3InLFxuICBjb25uZWN0aW9uRXJyb3JDb25zdHJ1Y3RvclxuKTtcblxuRERQLkZvcmNlZFJlY29ubmVjdEVycm9yID0gTWV0ZW9yLm1ha2VFcnJvclR5cGUoXG4gICdERFAuRm9yY2VkUmVjb25uZWN0RXJyb3InLFxuICAoKSA9PiB7fVxuKTtcblxuLy8gUmV0dXJucyB0aGUgbmFtZWQgc2VxdWVuY2Ugb2YgcHNldWRvLXJhbmRvbSB2YWx1ZXMuXG4vLyBUaGUgc2NvcGUgd2lsbCBiZSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpLCBzbyB0aGUgc3RyZWFtIHdpbGwgcHJvZHVjZVxuLy8gY29uc2lzdGVudCB2YWx1ZXMgZm9yIG1ldGhvZCBjYWxscyBvbiB0aGUgY2xpZW50IGFuZCBzZXJ2ZXIuXG5ERFAucmFuZG9tU3RyZWFtID0gbmFtZSA9PiB7XG4gIGNvbnN0IHNjb3BlID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgcmV0dXJuIEREUENvbW1vbi5SYW5kb21TdHJlYW0uZ2V0KHNjb3BlLCBuYW1lKTtcbn07XG5cbi8vIEBwYXJhbSB1cmwge1N0cmluZ30gVVJMIHRvIE1ldGVvciBhcHAsXG4vLyAgICAgZS5nLjpcbi8vICAgICBcInN1YmRvbWFpbi5tZXRlb3IuY29tXCIsXG4vLyAgICAgXCJodHRwOi8vc3ViZG9tYWluLm1ldGVvci5jb21cIixcbi8vICAgICBcIi9cIixcbi8vICAgICBcImRkcCtzb2NranM6Ly9kZHAtLSoqKiotZm9vLm1ldGVvci5jb20vc29ja2pzXCJcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25uZWN0IHRvIHRoZSBzZXJ2ZXIgb2YgYSBkaWZmZXJlbnQgTWV0ZW9yIGFwcGxpY2F0aW9uIHRvIHN1YnNjcmliZSB0byBpdHMgZG9jdW1lbnQgc2V0cyBhbmQgaW52b2tlIGl0cyByZW1vdGUgbWV0aG9kcy5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtTdHJpbmd9IHVybCBUaGUgVVJMIG9mIGFub3RoZXIgTWV0ZW9yIGFwcGxpY2F0aW9uLlxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJlbG9hZFdpdGhPdXRzdGFuZGluZyBpcyBpdCBPSyB0byByZWxvYWQgaWYgdGhlcmUgYXJlIG91dHN0YW5kaW5nIG1ldGhvZHM/XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5oZWFkZXJzIGV4dHJhIGhlYWRlcnMgdG8gc2VuZCBvbiB0aGUgd2Vic29ja2V0cyBjb25uZWN0aW9uLCBmb3Igc2VydmVyLXRvLXNlcnZlciBERFAgb25seVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuX3NvY2tqc09wdGlvbnMgU3BlY2lmaWVzIG9wdGlvbnMgdG8gcGFzcyB0aHJvdWdoIHRvIHRoZSBzb2NranMgY2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uRERQTmVnb3RpYXRpb25WZXJzaW9uRmFpbHVyZSBjYWxsYmFjayB3aGVuIHZlcnNpb24gbmVnb3RpYXRpb24gZmFpbHMuXG4gKi9cbkREUC5jb25uZWN0ID0gKHVybCwgb3B0aW9ucykgPT4ge1xuICBjb25zdCByZXQgPSBuZXcgQ29ubmVjdGlvbih1cmwsIG9wdGlvbnMpO1xuICBhbGxDb25uZWN0aW9ucy5wdXNoKHJldCk7IC8vIGhhY2suIHNlZSBiZWxvdy5cbiAgcmV0dXJuIHJldDtcbn07XG5cbkREUC5fcmVjb25uZWN0SG9vayA9IG5ldyBIb29rKHsgYmluZEVudmlyb25tZW50OiBmYWxzZSB9KTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGNhbGwgYXMgdGhlIGZpcnN0IHN0ZXAgb2ZcbiAqIHJlY29ubmVjdGluZy4gVGhpcyBmdW5jdGlvbiBjYW4gY2FsbCBtZXRob2RzIHdoaWNoIHdpbGwgYmUgZXhlY3V0ZWQgYmVmb3JlXG4gKiBhbnkgb3RoZXIgb3V0c3RhbmRpbmcgbWV0aG9kcy4gRm9yIGV4YW1wbGUsIHRoaXMgY2FuIGJlIHVzZWQgdG8gcmUtZXN0YWJsaXNoXG4gKiB0aGUgYXBwcm9wcmlhdGUgYXV0aGVudGljYXRpb24gY29udGV4dCBvbiB0aGUgY29ubmVjdGlvbi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuIEl0IHdpbGwgYmUgY2FsbGVkIHdpdGggYVxuICogc2luZ2xlIGFyZ3VtZW50LCB0aGUgW2Nvbm5lY3Rpb24gb2JqZWN0XSgjZGRwX2Nvbm5lY3QpIHRoYXQgaXMgcmVjb25uZWN0aW5nLlxuICovXG5ERFAub25SZWNvbm5lY3QgPSBjYWxsYmFjayA9PiBERFAuX3JlY29ubmVjdEhvb2sucmVnaXN0ZXIoY2FsbGJhY2spO1xuXG4vLyBIYWNrIGZvciBgc3BpZGVyYWJsZWAgcGFja2FnZTogYSB3YXkgdG8gc2VlIGlmIHRoZSBwYWdlIGlzIGRvbmVcbi8vIGxvYWRpbmcgYWxsIHRoZSBkYXRhIGl0IG5lZWRzLlxuLy9cbkREUC5fYWxsU3Vic2NyaXB0aW9uc1JlYWR5ID0gKCkgPT4gYWxsQ29ubmVjdGlvbnMuZXZlcnkoXG4gIGNvbm4gPT4gT2JqZWN0LnZhbHVlcyhjb25uLl9zdWJzY3JpcHRpb25zKS5ldmVyeShzdWIgPT4gc3ViLnJlYWR5KVxuKTtcbiJdfQ==
